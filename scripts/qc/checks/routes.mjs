import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, collect, read, short, isCommentLine } from '../lib/files.mjs';
import { finding } from '../lib/report.mjs';

/**
 * 라우트 무결성 — 링크가 실제 화면으로 가는가, 화면으로 가는 길이 있는가.
 *
 * **브라우저 없이 잡을 수 있는 화면 결함이 두 종류 있다.** 둘 다 실제로 겪었다.
 *
 * 1. **없는 곳으로 가는 링크.** `C-05` 의 `프로필 전체 보기` 가 404 였고,
 *    `P-01` 의 `공개 프로필 보기` 도 404 였다. 링크는 타입 검사를 통과한다 —
 *    문자열이기 때문이다. 404 는 메뉴가 없는 것보다 나쁘다.
 * 2. **아무도 가리키지 않는 화면.** `C-03` 을 만들었는데 `/requests/mine` 의
 *    카드에 링크가 없어서 **도달할 수 없었다.** 화면을 만든 사람은 주소를 아니까
 *    직접 치고 들어가서 끝까지 모른다.
 *
 * 이 검사가 판단하지 못하는 것도 분명히 해둔다. **조건부 404 는 못 잡는다** —
 * `/pros/:id` 는 라우트가 있지만 승인·활동명 조건을 안 맞추면 404 다. 그건
 * 화면 QC(`/qc-screens`)가 눌러봐야 안다. 여기서 잡는 건 "라우트 자체가 없는" 경우다.
 *
 * 근거: brain/30-설계/시안 대조 결과.md · brain/90-규약/화면 QC 목록.md
 */
export const name = 'routes';
export const description = '라우트 — 링크가 실제 화면으로 가는가';

const APP_DIR = 'apps/web/src/app';

/**
 * `app/` 을 걸어 실제 라우트를 모은다.
 *
 * 라우트 그룹 `(public)` · `(app)` 은 주소에 안 들어가고, `[id]` 는 무엇이든 받는다.
 */
function collectRoutes() {
  const routes = new Set();

  const walk = (dir, urlParts) => {
    let entries;
    try {
      entries = readdirSync(join(ROOT, dir));
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = join(ROOT, dir, entry);
      if (!statSync(full).isDirectory()) {
        if (entry === 'page.tsx' || entry === 'page.ts') {
          routes.add(`/${urlParts.join('/')}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/');
        }
        continue;
      }
      /* 라우트 그룹은 주소에 기여하지 않는다. */
      const isGroup = entry.startsWith('(') && entry.endsWith(')');
      walk(join(dir, entry), isGroup ? urlParts : [...urlParts, entry]);
    }
  };

  walk(APP_DIR, []);
  return routes;
}

/** `/gallery/[id]` 같은 동적 라우트를 정규식으로 바꾼다. */
function toMatcher(route) {
  const pattern = route
    .split('/')
    .map((seg) => {
      if (seg.startsWith('[...') || seg.startsWith('[[')) return '.*';
      if (seg.startsWith('[')) return '[^/]+';
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${pattern}$`);
}

/**
 * 링크 대상을 뽑는다.
 *
 * `href="/gallery"` 와 `href={`/gallery/${id}`}` 둘 다 본다. 후자는 보간 부분을
 * `[x]` 로 바꿔서 동적 라우트와 맞춰본다.
 */
const HREF = /href=(?:"([^"]*)"|\{`([^`]*)`\})/g;

/** 화면이 아닌 목적지. 이 검사의 대상이 아니다. */
function skipTarget(href) {
  if (!href) return true;
  if (href.startsWith('#')) return true;
  if (href.startsWith('http://') || href.startsWith('https://')) return true;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;
  /* 변수 하나로만 된 링크는 여기서 판단할 수 없다. */
  if (!href.startsWith('/')) return true;
  return false;
}

export function run() {
  const findings = [];
  const routes = collectRoutes();
  const matchers = [...routes].map((r) => ({ route: r, re: toMatcher(r) }));

  /**
   * 라우트가 아닌데 서버가 서는 경로들.
   *
   * 법정 정적 페이지와 앵커는 [[화면 목록]]이 화면 수에 넣지 않기로 한 것이고,
   * 아직 안 만들었다. **링크는 이미 걸려 있으므로 여기 적어 예외로 둔다** —
   * 예외 목록이 곧 "만들어야 하는 것" 목록이 된다.
   */
  const known = new Set(['/terms', '/privacy', '/support']);

  const linked = new Set();

  for (const path of collect('apps/web/src', ['.tsx', '.ts'])) {
    const file = short(path);
    const content = read(path);

    for (const raw of content.split(/\r?\n/).entries()) {
      const [index, line] = raw;
      if (isCommentLine(line)) continue;

      for (const match of line.matchAll(HREF)) {
        const literal = match[1];
        const template = match[2];
        /* 템플릿의 보간 자리는 아무 값이나 올 수 있으므로 동적 세그먼트로 취급한다. */
        const href = (literal ?? template ?? '').replace(/\$\{[^}]*\}/g, 'x');
        if (skipTarget(href)) continue;

        /* 쿼리·해시를 떼고 경로만 본다. */
        const target = href.split(/[?#]/)[0].replace(/\/$/, '') || '/';

        const hit = matchers.find((m) => m.re.test(target));
        if (hit) {
          linked.add(hit.route);
          continue;
        }
        if (known.has(target)) continue;

        findings.push(
          finding({
            rule: 'routes/dead-link',
            file,
            line: index + 1,
            message: `없는 화면으로 가는 링크다: ${href} — 라우트를 만들거나 링크를 지우라`,
            why: 'brain/30-설계/시안 대조 결과.md — 404 는 메뉴가 없는 것보다 나쁘다',
          }),
        );
      }
    }
  }

  /*
   * 아무도 가리키지 않는 화면.
   *
   * 진입이 리디렉션·프로그램 이동뿐인 화면이 있어서 warn 이다 —
   * `/onboarding` 은 역할이 없을 때 코드가 보내고, `/login` 은 가드가 보낸다.
   * 그래도 목록에 뜨는 편이 낫다: C-03 이 도달 불가였던 걸 이걸로 잡는다.
   */
  const entryByCode = new Set(['/', '/login', '/signup', '/onboarding']);

  for (const route of routes) {
    if (linked.has(route) || entryByCode.has(route)) continue;
    findings.push(
      finding({
        severity: 'warn',
        rule: 'routes/unreachable',
        file: `${APP_DIR}${route === '/' ? '' : route}/page.tsx`,
        line: 1,
        message: `이 화면으로 가는 링크가 코드에 없다: ${route} — 만든 사람만 주소를 안다`,
        why: 'brain/90-규약/화면 QC 목록.md — 도달할 수 없는 화면은 없는 화면이다',
      }),
    );
  }

  return findings;
}
