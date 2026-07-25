import { collect, isCommentLine, read, short, stringLiterals } from '../lib/files.mjs';
import { finding } from '../lib/report.mjs';

/**
 * 도메인 용어집 준수.
 *
 * 용어가 화면마다 흔들리면 코드와 DB 컬럼까지 흔들린다.
 * 실제로 시안 검수에서 "견적"이 사용자 카피에 노출된 것과
 * 승인(is_approved)을 "인증"이라 부르는 드리프트가 발견됐다.
 *
 * design/ 은 warn 이다. 시안은 고치지 않기로 했고 판단은 이미 노트에 남았다.
 * 코드에서 같은 실수가 나오면 그건 error 다.
 *
 * 근거: brain/20-도메인/도메인 용어집.md · brain/30-설계/시안 검수 결과.md 5번
 */
export const name = 'glossary';
export const description = '도메인 용어집 — 금지어와 용어 드리프트';

const BANNED = [
  {
    id: 'estimate',
    // "견적"은 MVP 맥락에서 쓰지 않는다. 컨택에 담기는 건 제안 메시지다.
    pattern: /견적/,
    message: '"견적"은 MVP에서 쓰지 않는다. 제안 또는 비용으로 바꾼다',
  },
  {
    id: 'matched',
    pattern: /매칭\s*완료/,
    message: '"매칭 완료" 상태는 존재하지 않는다. ACCEPTED는 연락처 공개일 뿐이다',
  },
  {
    id: 'vendor',
    // 우리 공급자는 업체가 아니라 개인 시공자다.
    // 다만 "종합업체"는 걷어내려는 기존 구조를 가리키는 말이라 정당하다.
    pattern: /(?<!종합)업체/,
    message: '"업체"는 쓰지 않는다. 시공자 또는 PRO로 통일한다',
  },
  {
    id: 'certified',
    // 정식 용어는 승인(is_approved)이다. "인증 시공자"는 볼트에 없는 말이다.
    pattern: /인증\s*시공자/,
    message: '승인(is_approved)이 정식 용어다. "인증 시공자"를 쓰지 않는다',
  },
];

export function run() {
  const findings = [];

  const targets = [
    { dir: 'design', extensions: ['.dc.html'], severity: 'warn' },
    { dir: 'apps', extensions: ['.ts', '.tsx'], severity: 'error' },
    { dir: 'packages', extensions: ['.ts', '.tsx'], severity: 'error' },
  ];

  for (const target of targets) {
    const isCode = target.dir !== 'design';

    for (const file of collect(target.dir, target.extensions)) {
      const rel = short(file);
      if (rel.startsWith('scripts/qc/')) continue; // 규칙 정의 파일 자신은 제외
      /*
       * 테스트 이름은 개발자가 읽는 문장이지 사용자 카피가 아니다.
       * 금지어 규칙이 막으려는 건 "화면에서 견적이라는 말을 보고 금액이 확정된다고 오해하는 것"이다.
       */
      if (/\.(test|spec|e2e-spec)\.tsx?$/.test(rel)) continue;

      const lines = read(file).split(/\r?\n/);

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];

        /*
         * 코드에서는 사용자에게 보이는 문자열만 본다.
         * 주석은 대개 규칙을 설명하는 문장이고, 식별자는 영어라 애초에 걸리지 않는다.
         */
        if (isCode && isCommentLine(line)) continue;
        const subject = isCode ? stringLiterals(line) : line;
        if (!subject) continue;

        for (const banned of BANNED) {
          if (!banned.pattern.test(subject)) continue;
          findings.push(
            finding({
              severity: target.severity,
              rule: `glossary/${banned.id}`,
              file: rel,
              line: i + 1,
              message: banned.message,
              why: 'brain/20-도메인/도메인 용어집.md',
            }),
          );
        }
      }
    }
  }

  return findings;
}
