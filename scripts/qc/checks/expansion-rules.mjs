import { collect, isCommentLine, read, short } from '../lib/files.mjs';
import { finding } from '../lib/report.mjs';

/**
 * 확장 규약 위반 검사.
 *
 * 이 파일이 잡으려는 건 전부 **실제로 터졌던 것들**이다.
 * 시안 검수에서 평수·지역이 자유 텍스트였고, 공종 목록이 화면마다 다섯 갈래로 갈라져 있었고,
 * 이미지 용량이 20MB와 10MB로 나뉘어 있었다.
 *
 * 기능은 나중에 붙일 수 있지만 안 받은 데이터는 소급되지 않는다.
 * 그래서 이 검사는 코드에서는 error 다.
 *
 * 근거: brain/20-도메인/확장 규약.md · brain/30-설계/시안 검수 결과.md 1·4번
 */
export const name = 'expansion-rules';
export const description = '확장 규약 — 구조화 필드와 정본 단일화';

/** 공종 라벨 조각. 시안이 쓰던 변형(바닥·장판, 샷시)까지 포함한다. */
const CATEGORY_TOKENS = [
  '도배',
  '타일',
  '목공',
  '필름',
  '철거',
  '욕실',
  '주방',
  '줄눈',
  '장판',
  '조명',
  '페인트',
  '샷시',
  '새시',
  '청소',
];

/** 공종 목록의 정본. 여기 말고 다른 데서 목록을 만들면 그게 분열이다. */
const CATEGORY_SOURCE_OF_TRUTH = 'packages/shared/src/work-categories.ts';
const LIMITS_SOURCE_OF_TRUTH = 'packages/shared/src/constants.ts';

export function run() {
  const findings = [];

  const targets = [
    { dir: 'design', extensions: ['.dc.html'], severity: 'warn' },
    { dir: 'apps', extensions: ['.ts', '.tsx'], severity: 'error' },
    { dir: 'packages', extensions: ['.ts', '.tsx'], severity: 'error' },
  ];

  for (const target of targets) {
    for (const file of collect(target.dir, target.extensions)) {
      const rel = short(file);
      /*
       * 테스트는 제외한다. "10MB를 넘으면 거부한다" 같은 **테스트 제목**이
       * 용량 하드코딩으로 잡히는 오탐이 났다. 테스트가 한도를 언급하는 건 정상이고,
       * 오히려 그 한도를 검증하고 있다는 뜻이다.
       */
      if (/\.(test|spec|e2e-spec)\.tsx?$/.test(rel)) continue;
      const content = read(file);
      const lines = content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        /* 라벨 앞 8줄을 함께 본다. 라벨과 인풋이 다른 줄에 있는 경우가 많다. */
        const context = lines.slice(Math.max(0, i - 8), i + 1).join(' ');
        /*
         * **인풋은 줄 단위로 보면 안 된다.** Prettier 가 속성을 여러 줄로 쪼개기 때문에
         * `<input` 다음 줄에 `type="number"` 가 오는 게 정상이고, 한 줄만 보면 그게
         * 자유 텍스트로 오인된다. 실제로 오탐이 났다 — 태그가 닫힐 때까지 이어 붙인다.
         */
        const element = elementAt(lines, i);

        /*
         * 1조 — 평수는 숫자다.
         *
         * "이 인풋이 평수인가"를 두 곳에서 본다. 위쪽 라벨과 **인풋 자신의 `aria-label`**.
         * 라벨만 보면 Prettier 가 라벨을 여러 줄로 쪼갠 순간 창 밖으로 밀려나서 놓친다 —
         * 실제로 그래서 못 잡았다. 줄 수에 기대는 판정을 하나 줄인 것이다.
         */
        if (
          /<input/.test(line) &&
          (/평형|평수/.test(context) || /평형|평수/.test(element)) &&
          !/type="number"|inputMode="numeric"|inputmode="numeric"|type="range"/.test(element)
        ) {
          findings.push(
            finding({
              severity: target.severity,
              rule: 'expansion/area-free-text',
              file: rel,
              line: i + 1,
              message: '평수를 자유 텍스트로 받는다. 숫자 입력이나 슬라이더여야 한다',
              why: 'brain/20-도메인/확장 규약.md 1조',
            }),
          );
        }

        /*
         * 3조 — 지역은 행정구역 코드다. 주소 원문을 저장하지 않는다.
         *
         * **행정구역 접미사는 낱말 끝에서만 센다.** 전에는 `[가-힣]+(구|시|동)` 을
         * 문자열 아무 곳에서나 찾아서, `자동으로` 의 `동` 이나 `구성` 의 `구` 같은
         * 평범한 낱말이 주소로 잡혔다. 실제로 "하이픈은 자동으로 지웁니다" 라는
         * 전화번호 플레이스홀더가 지역 위반으로 걸렸다.
         *
         * 주소는 `성북구`, `정릉동` 처럼 **낱말 자체가 접미사로 끝난다.**
         * 공백으로 끊어 각 낱말의 끝만 본다.
         */
        const placeholderText = /placeholder="([^"]*)"/.exec(element)?.[1] ?? '';
        const looksLikeAddress = placeholderText
          .split(/[\s·,)(]+/)
          .some((word) => /^[가-힣]{2,}(구|시|군|동|읍|면)$/.test(word));
        if (/<input/.test(line) && looksLikeAddress) {
          findings.push(
            finding({
              severity: target.severity,
              rule: 'expansion/region-free-text',
              file: rel,
              line: i + 1,
              message: '지역을 주소 원문으로 받는다. 시도·시군구 코드 선택이어야 한다',
              why: 'brain/20-도메인/확장 규약.md 3조',
            }),
          );
        }

        /* 2조 — 공종은 코드 테이블이다. 목록이 여러 곳에 있으면 반드시 갈라진다 */
        if (rel !== CATEGORY_SOURCE_OF_TRUTH) {
          const hits = CATEGORY_TOKENS.filter((token) => line.includes(token)).length;
          if (hits >= 4) {
            findings.push(
              finding({
                severity: target.severity,
                rule: 'expansion/category-list-duplicated',
                file: rel,
                line: i + 1,
                message: `공종 목록을 여기서 다시 정의한다(${hits}종). ${CATEGORY_SOURCE_OF_TRUTH} 를 참조하라`,
                why: 'brain/20-도메인/확장 규약.md 2조',
              }),
            );
          }
        }

        /*
         * 정책 상수 단일화 — 용량이 화면마다 다르면 한쪽은 반드시 틀린 값이다.
         *
         * 주석은 건너뛴다. scrypt의 메모리 상한을 설명하는 "32MB" 같은 문장이
         * 이미지 용량 하드코딩으로 잡히는 오탐이 실제로 났다.
         * 규칙을 설명하는 문장과 규칙을 어기는 코드는 다르다.
         */
        if (rel !== LIMITS_SOURCE_OF_TRUTH && !isCommentLine(line) && /\b\d{1,3}MB\b/.test(line)) {
          findings.push(
            finding({
              severity: target.severity,
              rule: 'expansion/limit-hardcoded',
              file: rel,
              line: i + 1,
              message: `용량 상수를 직접 적었다. ${LIMITS_SOURCE_OF_TRUTH} 를 참조하라`,
              why: 'brain/70-산출물/PRD.md 7장 — 장당 10MB가 정본',
            }),
          );
        }
      }
    }
  }

  return findings;
}

/**
 * `i` 번째 줄에서 시작하는 태그 하나를 통째로 잇는다.
 *
 * Prettier 가 JSX 속성을 여러 줄로 쪼개기 때문에 `<input` 과 `type="number"` 가 다른 줄에
 * 산다. 한 줄만 보면 멀쩡한 숫자 인풋이 자유 텍스트로 잡힌다 — 실제로 그 오탐이 났다.
 *
 * 태그가 안 닫히는 경우(문자열 안의 `<input` 등)를 대비해 12줄에서 끊는다.
 * 검사기가 파일 하나에서 오래 도는 것보다 몇 건 놓치는 편이 낫다.
 */
function elementAt(lines, i) {
  const parts = [];
  for (let j = i; j < Math.min(lines.length, i + 12); j += 1) {
    parts.push(lines[j]);
    if (/\/?>\s*$/.test(lines[j].trim())) break;
  }
  return parts.join(' ');
}
