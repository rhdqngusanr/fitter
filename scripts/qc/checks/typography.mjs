import { collect, read, short, findLines } from '../lib/files.mjs';
import { finding } from '../lib/report.mjs';

/**
 * 타이포 스케일 하드코딩.
 *
 * **시안은 타이포를 6단으로 정해뒀는데(display · h1 · h2 · h3 · body · caption)
 * 구현은 화면마다 `fontSize: 24` 를 직접 적고 있었다.**
 *
 * 이게 왜 문제인가. 색은 토큰으로 강제돼 있어서 시안과 대조할 수 있지만 크기는
 * 숫자라서 대조할 방법이 없다. 화면 A 가 20px, 화면 B 가 22px 를 쓰면 둘 다
 * "대충 h2" 인데 어느 쪽이 시안인지 판단할 근거가 없다. 실제로 그렇게 갈라졌고
 * 사용자가 결과물을 보고 "계획한 디자인이랑 엄청 다르다"고 한 이유의 큰 부분이었다.
 *
 * 그래서 `.t-display` ~ `.t-caption` 클래스를 쓰고 숫자는 적지 않는다.
 *
 * **2026-07-26 에 error 로 올렸다.** 도입할 때 101건이었고 화면을 하나씩 옮겨 0이 됐다.
 * warn 으로 두는 동안에는 "나중에"가 계속 미뤄진다 — 0이 된 순간이 잠글 때다.
 *
 * 화면이 스케일 밖의 크기를 써야 한다면(랜딩 h1 52px 처럼 **시안이 그렇게 그렸다면**)
 * `components.css` 에 화면 전용 클래스로 넣는다. 예외를 없애는 게 목적이 아니라
 * 예외가 한 곳에 모여 눈에 보이게 하는 게 목적이다.
 *
 * 근거: brain/30-설계/시안 대조 결과.md
 */
export const name = 'typography';
export const description = '타이포 — 크기를 숫자로 적지 않았는가';

/*
 * `fontSize: 24` · `fontSize: '24px'` · `font-size:24px` 를 잡는다.
 *
 * 12px 이하는 빼뒀다. 시안 자체가 뱃지·오버레이 칩에 10~12px 를 직접 쓰고
 * 스케일에 그 단이 없다 — 스케일에 없는 걸 스케일로 쓰라고 할 수는 없다.
 * caption(13px) 이상만 대상이다.
 */
const HARDCODED = /font-?[sS]ize\s*[:=]\s*['"]?(1[3-9]|[2-9]\d|\d{3})(px)?['"]?/;

/* 정본 자신. 여기에는 숫자가 있어야 한다. */
const ALLOWED = new Set(['apps/web/src/styles/tokens.css', 'apps/web/src/styles/components.css']);

export function run() {
  const findings = [];

  for (const path of collect('apps/web/src', ['.tsx', '.ts', '.css'])) {
    const file = short(path);
    if (ALLOWED.has(file)) continue;

    for (const hit of findLines(read(path), HARDCODED)) {
      findings.push(
        finding({
          rule: 'design/type-hardcoded',
          file,
          line: hit.line,
          message: `크기를 직접 적었다 — .t-h1 / .t-h2 / .t-body 같은 스케일 클래스를 쓰라: ${hit.text}`,
          why: 'brain/30-설계/시안 대조 결과.md — 타이포 스케일 정본은 시안의 6단이다',
        }),
      );
    }
  }

  return findings;
}
