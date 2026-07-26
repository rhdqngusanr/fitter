import { execFileSync } from 'node:child_process';

/**
 * Stop 훅 — 화면을 고쳤으면 정적 QC 를 돌리고 화면 QC 를 상기시킨다.
 *
 * **훅이 브라우저를 돌게 할 수는 없다.** 훅은 셸 명령이고, 화면 QC(2·3층)는
 * 사람이나 에이전트가 불러야 돈다. 그래서 이 훅이 하는 일은 둘이다.
 *
 * 1. `apps/web` 이 바뀌었으면 **1층(정적 QC)을 실제로 돌린다**
 * 2. 1층이 통과했더라도 **"2·3층은 아직 안 돌았다"고 말한다**
 *
 * 두 번째가 더 중요하다. `pnpm qc` 가 통과했다는 사실이 "화면을 검사했다"로
 * 읽히는 것이 이 프로젝트가 실제로 겪은 문제였다 — 시안과 다른 화면이
 * 전부 통과한 채로 쌓였다.
 *
 * **막지 않는다(`continue` 를 건드리지 않는다).** QC error 가 있어도 알리기만 한다.
 * 훅이 턴을 막으면 고치라고 되돌리는 루프가 생기고, error 가 의도된 것일 때
 * 빠져나갈 방법이 없어진다. 판단은 사람이 한다.
 *
 * 근거: brain/90-규약/화면 QC 목록.md
 */

/** 출력은 JSON 한 줄이다. `systemMessage` 만 사용자에게 보인다. */
function say(message) {
  if (message) process.stdout.write(`${JSON.stringify({ systemMessage: message })}\n`);
  process.exit(0);
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    /* git 이 없거나 저장소가 아니면 훅이 조용히 물러난다. 개발을 막지 않는다. */
    return '';
  }
}

/*
 * 커밋 안 된 화면 변경을 찾는다. 세 갈래를 다 본다 —
 * 워킹 트리, 스테이지, 그리고 **추적되지 않은 새 파일**.
 * 새 화면은 대개 세 번째다.
 */
const changed = new Set(
  [
    git(['diff', '--name-only', '--', 'apps/web']),
    git(['diff', '--cached', '--name-only', '--', 'apps/web']),
    git(['ls-files', '--others', '--exclude-standard', '--', 'apps/web']),
  ]
    .join('\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
);

if (changed.size === 0) say(null);

/* 화면 파일만 센다. 스타일·컴포넌트도 화면에 영향을 주므로 포함한다. */
const screens = [...changed].filter((f) => /\.(tsx|css)$/.test(f));
if (screens.length === 0) say(null);

let qcOut = '';
let qcFailed = false;
try {
  qcOut = execFileSync(process.execPath, ['scripts/qc/index.mjs', '--errors'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  qcFailed = true;
  qcOut = `${error.stdout ?? ''}${error.stderr ?? ''}`;
}

const lines = [`화면 파일 ${screens.length}개가 바뀌었다.`];

if (qcFailed) {
  /* error 목록만 추린다. 전문은 `pnpm qc` 로 다시 보면 된다. */
  const errors = qcOut
    .split('\n')
    .filter((l) => l.includes('[ERROR]') || /^\s{2}\S+:\d+/.test(l))
    .slice(0, 8);
  lines.push('❌ 정적 QC(1층) error — `pnpm qc` 로 전문을 보라.');
  if (errors.length > 0) lines.push(errors.join('\n'));
} else {
  lines.push('✅ 정적 QC(1층) 통과.');
}

/*
 * 이 문장이 이 훅의 존재 이유다.
 * 1층 통과를 "화면을 검사했다"로 읽지 않게 만든다.
 */
lines.push('⚠️ 화면 QC(2·3층)는 아직 안 돌았다 — 렌더 결과·상태·문장 모순은 `/qc-screens` 가 본다.');

say(lines.join('\n'));
