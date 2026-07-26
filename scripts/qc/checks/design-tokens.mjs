import { readFileSync, existsSync } from 'node:fs';

import { finding } from '../lib/report.mjs';

/**
 * 디자인 토큰 정본 일치.
 *
 * **정본은 시안 HTML이고 `tokens.css` 는 사본이다.**
 *
 * 이 검사가 생긴 이유는 실제로 어긋났기 때문이다. 화면을 만들면서 시안을 열지 않고
 * 컬러만 뽑아 썼더니 `--shadow-1/2/3` 이 `--shadow-sm/md` 로 바뀌고,
 * 다크 모드 토큰 한 벌이 통째로 사라지고, `--radius-xl` 과 폰트 토큰이 빠졌다.
 * 이름이 갈라지면 시안과 구현을 눈으로 대조하는 것 자체가 불가능해진다.
 *
 * 값이 아니라 **이름만** 본다. 값은 근거가 있으면 바꿀 수 있고
 * (`--color-border-focus` 가 그랬다) 그 근거는 노트에 남는다.
 * 그러나 이름을 바꾸는 건 근거가 있을 수 없다.
 *
 * 근거: brain/30-설계/시안 대조 결과.md · brain/30-설계/디자인 원칙.md
 */
export const name = 'design-tokens';
export const description = '디자인 토큰 — 시안 정본과 이름이 같은가';

const SOURCE = 'design/Fitter 디자인 시스템 v1.dc.html';
const COPY = 'apps/web/src/styles/tokens.css';

/** `--이름:` 형태를 전부 긁는다. 선언만 세고 사용(var(--x))은 세지 않는다. */
function declaredTokens(text) {
  const names = new Set();
  for (const match of text.matchAll(/(^|[;{\s])(--[a-z0-9-]+)\s*:/gi)) {
    names.add(match[2]);
  }
  return names;
}

export function run() {
  if (!existsSync(SOURCE) || !existsSync(COPY)) return [];

  const findings = [];
  const source = declaredTokens(readFileSync(SOURCE, 'utf8'));
  const copy = declaredTokens(readFileSync(COPY, 'utf8'));

  /*
   * 시안에만 있는 토큰. 사본이 정본을 따라가지 못한 것이므로 error 다.
   * 다크 모드처럼 "지금 안 쓴다"는 이유로 빼면, 나중에 켜려 할 때
   * 이미 화면마다 색이 하드코딩돼 있어서 못 켠다.
   */
  for (const token of [...source].sort()) {
    if (copy.has(token)) continue;
    findings.push(
      finding({
        rule: 'design/token-missing',
        file: COPY,
        message: `${token} 이(가) 시안에는 있는데 여기 없다. ${SOURCE} 를 보라`,
        why: 'brain/30-설계/시안 대조 결과.md — 토큰 정본은 시안이다',
      }),
    );
  }

  /*
   * 사본에만 있는 토큰. 이름을 새로 지었거나 바꿔치기했다는 뜻이다.
   * 화면 전용 토큰이 정말 필요하면 시안에 먼저 넣고 가져와야 한다.
   */
  for (const token of [...copy].sort()) {
    if (source.has(token)) continue;
    findings.push(
      finding({
        rule: 'design/token-invented',
        file: COPY,
        message: `${token} 은(는) 시안에 없는 이름이다. 시안에 먼저 넣고 가져와라`,
        why: 'brain/30-설계/시안 대조 결과.md — 이름을 바꾸면 시안과 대조가 안 된다',
      }),
    );
  }

  return findings;
}
