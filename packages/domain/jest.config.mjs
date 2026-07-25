/**
 * ts-jest를 쓰는 이유.
 *
 * 원래 vitest + SWC로 러너를 하나로 통일하려 했으나, 이 개발 환경의
 * Windows Application Control 정책이 서명되지 않은 네이티브 모듈(@swc/core)의 로드를 막는다.
 * 보안 정책을 끄는 대신 네이티브 바이너리가 필요 없는 ts-jest로 간다.
 *
 * 부수 효과로 컴파일러가 tsc 하나로 통일된다 — 빌드와 테스트가 같은 규칙으로 돈다.
 */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '\\.test\\.ts$',
  clearMocks: true,
};
