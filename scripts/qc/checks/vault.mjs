import { basename } from 'node:path';

import { collect, findLines, read, short } from '../lib/files.mjs';
import { finding } from '../lib/report.mjs';

/**
 * brain 볼트 무결성.
 *
 * 볼트는 이 프로젝트의 판단 근거이고, 앞으로 포트폴리오 자산이 될 것이다.
 * 링크가 끊기거나 노트가 고아가 되면 그 순간부터 볼트는 지도가 아니라 파일 더미가 된다.
 *
 * 근거: brain/90-규약/노트 작성 규칙.md
 */
export const name = 'vault';
export const description = 'brain 볼트 무결성 — 링크·고아·프론트매터';

const REQUIRED_FRONTMATTER = ['type', 'status', 'tags', 'updated'];
const VALID_TYPES = [
  '허브',
  '제품',
  '도메인',
  '설계',
  '프롬프트',
  '결정',
  '로그',
  '산출물',
  '규약',
];

export function run() {
  const files = collect('brain', ['.md']);
  if (files.length === 0) return [];

  const findings = [];
  const noteNames = new Set(files.map((f) => basename(f, '.md')));
  const linkedTargets = new Set();

  /*
   * 캔버스도 옵시디언에서는 링크 대상이다. `.md` 만 알면 [[지도.canvas]] 가 깨진 링크로 잡힌다.
   * 확장자를 뗀 이름과 붙인 이름을 둘 다 받는다 — 옵시디언이 둘 다 허용하기 때문이다.
   * 다만 프론트매터·고아 검사는 노트에만 적용한다. 캔버스에는 본문이 없다.
   */
  const linkTargets = new Set(noteNames);
  for (const canvas of collect('brain', ['.canvas'])) {
    linkTargets.add(basename(canvas, '.canvas'));
    linkTargets.add(basename(canvas));
  }

  for (const file of files) {
    const content = read(file);
    const rel = short(file);

    /* 1. 프론트매터 */
    const frontmatter = content.startsWith('---')
      ? content.slice(0, content.indexOf('\n---', 3))
      : '';
    if (!frontmatter) {
      findings.push(
        finding({
          rule: 'vault/frontmatter-missing',
          file: rel,
          message: '프론트매터가 없다',
          why: 'brain/90-규약/노트 작성 규칙.md',
        }),
      );
    } else {
      for (const key of REQUIRED_FRONTMATTER) {
        if (!new RegExp(`^${key}:`, 'm').test(frontmatter)) {
          findings.push(
            finding({
              rule: 'vault/frontmatter-field',
              file: rel,
              message: `프론트매터에 ${key} 가 없다`,
              why: 'brain/90-규약/노트 작성 규칙.md',
            }),
          );
        }
      }
      const typeMatch = frontmatter.match(/^type:\s*(.+)$/m);
      if (typeMatch && !VALID_TYPES.includes(typeMatch[1].trim())) {
        findings.push(
          finding({
            rule: 'vault/frontmatter-type',
            file: rel,
            message: `정의되지 않은 type: ${typeMatch[1].trim()}`,
            why: 'brain/90-규약/노트 작성 규칙.md',
          }),
        );
      }
    }

    /* 2. 연결 섹션 — 모든 노트는 마지막에 ## 연결 을 갖는다 */
    if (!/^##\s*연결\s*$/m.test(content)) {
      findings.push(
        finding({
          severity: 'warn',
          rule: 'vault/no-links-section',
          file: rel,
          message: '## 연결 섹션이 없다',
          why: 'brain/90-규약/노트 작성 규칙.md',
        }),
      );
    }

    /* 3. 위키링크 대상이 실제로 있는가 */
    for (const match of content.matchAll(/\[\[([^\]|#]+)/g)) {
      const target = match[1].trim();
      linkedTargets.add(target);
      if (!linkTargets.has(target)) {
        const hit = findLines(content, new RegExp(`\\[\\[${escapeRegex(target)}`))[0];
        findings.push(
          finding({
            rule: 'vault/broken-link',
            file: rel,
            line: hit?.line,
            message: `[[${target}]] 대상 노트가 없다`,
            why: 'brain/90-규약/노트 작성 규칙.md',
          }),
        );
      }
    }
  }

  /* 4. 고아 노트 — 아무도 링크하지 않는 노트 */
  for (const note of noteNames) {
    if (!linkedTargets.has(note)) {
      findings.push(
        finding({
          severity: 'warn',
          rule: 'vault/orphan-note',
          file: `brain/**/${note}.md`,
          message: '아무 노트도 이 노트를 링크하지 않는다',
          why: 'brain/90-규약/노트 작성 규칙.md — 고아 노트를 만들지 않는다',
        }),
      );
    }
  }

  return dedupe(findings);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.rule}|${f.file}|${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
