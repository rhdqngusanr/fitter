/**
 * NestJS는 생성자 주입을 위해 emitDecoratorMetadata가 필요하고,
 * ts-jest는 tsc로 컴파일하므로 그 메타데이터가 그대로 남는다.
 * `nest build`와 같은 컴파일러를 쓰기 때문에 테스트에서만 통과하는 코드가 생기지 않는다.
 */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '\\.(spec|e2e-spec)\\.ts$',
  clearMocks: true,
  /* e2e는 앱을 실제로 띄우므로 기본 5초로는 모자랄 수 있다. */
  testTimeout: 20000,
};
