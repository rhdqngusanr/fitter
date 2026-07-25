import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 저장소 루트. scripts/qc/lib 에서 세 단계 위다. */
export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git', 'coverage', '.turbo']);

/** 디렉터리를 재귀로 훑어 확장자가 맞는 파일 경로를 모은다. */
export function collect(dir, extensions) {
  const out = [];
  const absolute = join(ROOT, dir);

  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return; // 폴더가 없으면 조용히 넘긴다. brain은 없을 수도 있다.
    }
    for (const entry of entries) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(entry)) walk(full);
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        out.push(full);
      }
    }
  };

  walk(absolute);
  return out;
}

export function read(path) {
  return readFileSync(path, 'utf8');
}

/** 리포트에 찍을 짧은 경로. 슬래시로 통일한다. */
export function short(path) {
  return relative(ROOT, path).split(sep).join('/');
}

/**
 * 주석 줄인가.
 *
 * 이게 없으면 "견적을 쓰지 마라"라고 적어둔 주석 자체가 위반으로 잡힌다.
 * 규칙을 설명하는 문장과 규칙을 어기는 코드는 다르다.
 */
export function isCommentLine(text) {
  const trimmed = text.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('#')
  );
}

/**
 * 한 줄에서 문자열 리터럴만 뽑아 잇는다.
 *
 * 금지어 검사는 **사용자에게 보이는 문자열**을 대상으로 해야 한다.
 * 식별자는 영어이고(EstimatePolicy 같은) 그건 도메인 용어집이 정한 정식 이름이다.
 */
export function stringLiterals(text) {
  const parts = [];
  const pattern =
    /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  for (const match of text.matchAll(pattern)) {
    parts.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return parts.join(' ');
}

/**
 * 정규식에 걸리는 모든 줄을 찾는다.
 * 줄 번호가 있어야 지적이 쓸모 있어진다. "어딘가 있다"는 정보량이 거의 없다.
 */
export function findLines(content, pattern) {
  const hits = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    pattern.lastIndex = 0;
    if (pattern.test(line)) {
      hits.push({ line: i + 1, text: line.trim().slice(0, 160) });
    }
  }
  return hits;
}
