import { collect, findLines, isCommentLine, read, short } from '../lib/files.mjs';
import { finding } from '../lib/report.mjs';

/**
 * 구조적 원칙 검사.
 *
 * ESLint가 이미 막는 것도 있지만(도메인 순수성) 여기서 한 번 더 본다.
 * 이유는 두 가지다. ESLint 규칙은 주석으로 끌 수 있고,
 * QC 리포트는 "왜 그게 규칙인지"를 근거 노트와 함께 보여준다.
 *
 * 근거: brain/30-설계/구조적 원칙.md · brain/30-설계/권한 모델.md
 */
export const name = 'structure';
export const description = '구조적 원칙 — 도메인 순수성·페이지네이션·연락처';

/** 도메인이 알면 안 되는 것들. ESLint 설정과 같은 목록을 유지한다. */
const FRAMEWORK_IMPORTS =
  /from\s+['"](@nestjs\/|next(\/|['"])|react|react-dom|express|@prisma\/|prisma['"]|bullmq|ioredis|pino|zod|@aws-sdk\/)/;

export function run() {
  const findings = [];

  /* 1. 도메인 순수성 — packages/domain 은 프레임워크를 모른다 */
  for (const file of collect('packages/domain', ['.ts'])) {
    const rel = short(file);
    for (const hit of findLines(read(file), FRAMEWORK_IMPORTS)) {
      findings.push(
        finding({
          rule: 'structure/domain-purity',
          file: rel,
          line: hit.line,
          message: '도메인이 프레임워크를 import 한다. ports/ 에 인터페이스를 만들어라',
          why: 'brain/30-설계/구조적 원칙.md 1·2조',
        }),
      );
    }
  }

  /*
   * 2. process.env 는 앱마다 한 곳에서만 읽는다
   *
   * 앱이 둘이라 진입점도 둘이다. api 는 zod 로 검증하고, web 은 NEXT_PUBLIC_* 을 모은다.
   * web 을 api 의 env.ts 로 보낼 수는 없다 — Next 는 `process.env.NEXT_PUBLIC_X` 를
   * **빌드 시점에 문자열로 치환**하므로 다른 패키지의 함수로 감싸면 값이 사라진다.
   * 규칙의 목적은 "파일 하나"가 아니라 "앱마다 통제된 진입점 하나"다.
   */
  const ENV_ENTRYPOINTS = new Map([
    ['apps/api/', 'apps/api/src/config/env.ts'],
    ['apps/web/', 'apps/web/src/lib/env.ts'],
  ]);
  for (const dir of ['apps', 'packages']) {
    for (const file of collect(dir, ['.ts', '.tsx'])) {
      const rel = short(file);
      const owner = [...ENV_ENTRYPOINTS].find(([prefix]) => rel.startsWith(prefix))?.[1];
      /*
       * 테스트 하네스는 예외다. 환경변수를 "읽는" 게 아니라 테스트용으로 "채우는" 파일이고,
       * 그게 그 파일의 존재 이유다. 앱 코드가 검증을 우회하는 것과는 다르다.
       */
      if (rel === owner || rel.endsWith('next.config.mjs') || /\/test\//.test(rel)) continue;
      for (const hit of findLines(read(file), /process\.env/)) {
        if (isCommentLine(hit.text)) continue; // 규칙을 설명하는 주석은 위반이 아니다
        findings.push(
          finding({
            rule: 'structure/env-direct-access',
            file: rel,
            line: hit.line,
            /* packages/* 는 환경변수를 읽을 자격이 아예 없다 — 어느 앱에 실릴지 모르기 때문이다. */
            message: owner
              ? `process.env 를 직접 읽는다. ${owner} 를 통해 주입받아라`
              : 'process.env 를 직접 읽는다. 패키지는 환경을 몰라야 한다 — 인자로 받아라',
            why: 'CLAUDE.md 금지 목록 — 검증되지 않은 환경변수가 런타임에 터진다',
          }),
        );
      }
    }
  }

  /* 3. 오프셋 페이지네이션 금지 */
  for (const dir of ['apps', 'packages']) {
    for (const file of collect(dir, ['.ts', '.tsx'])) {
      const rel = short(file);
      const content = read(file);
      for (const hit of findLines(content, /\b(offset|skip)\s*[:=]\s*\d|[?&]page=/)) {
        if (/outline-offset|offsetWidth|offsetHeight|offsetTop/.test(hit.text)) continue;
        findings.push(
          finding({
            rule: 'structure/offset-pagination',
            file: rel,
            line: hit.line,
            message: '오프셋 페이지네이션 흔적. 커서 기반이어야 한다',
            why: 'brain/30-설계/구조적 원칙.md 5조',
          }),
        );
      }
    }
  }

  /* 4. 연락처 리터럴 — 이 프로젝트에서 가장 위험한 유출 지점 */
  const phonePattern = /01[016789]-?\d{3,4}-?\d{4}/;
  for (const target of [
    { dir: 'design', extensions: ['.dc.html'], severity: 'warn' },
    { dir: 'apps', extensions: ['.ts', '.tsx'], severity: 'error' },
    { dir: 'packages', extensions: ['.ts', '.tsx'], severity: 'error' },
  ]) {
    for (const file of collect(target.dir, target.extensions)) {
      const rel = short(file);
      /*
       * 테스트는 제외한다. **연락처가 새지 않는지 검증하는 테스트는 연락처를 담을 수밖에 없다.**
       * 오히려 여기 전화번호가 있다는 건 그 규칙을 검증하고 있다는 뜻이다.
       */
      if (/\.(test|spec|e2e-spec)\.tsx?$/.test(rel)) continue;
      for (const hit of findLines(read(file), phonePattern)) {
        findings.push(
          finding({
            severity: target.severity,
            rule: 'structure/phone-literal',
            file: rel,
            line: hit.line,
            message: '전화번호 리터럴. ACCEPTED 상태에서만 서버가 채워야 한다',
            why: 'brain/30-설계/권한 모델.md — 연락처 노출 통제',
          }),
        );
      }
    }
  }

  return findings;
}
