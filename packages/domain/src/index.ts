/**
 * @fitter/domain
 *
 * 비즈니스 로직. NestJS도 Next.js도 Prisma도 모른다.
 * 이 패키지의 import 문에 프레임워크 이름이 하나라도 있으면 그건 버그다.
 * ESLint 규칙(eslint.config.mjs)과 패키지 경계가 그것을 함께 막는다.
 *
 * 근거: brain/30-설계/구조적 원칙.md
 */

export * from './shared';
export * from './pricing';
export * from './ports';
export * from './user';
export * from './image';

/*
 * 아래 모듈들은 아직 뼈대만 있다. 각 폴더의 index.ts 에
 * 무엇이 들어올지와 어떤 brain 노트가 그것을 규정하는지 적어뒀다.
 *
 *   contact/        P4-6  컨택 상태머신 (하이라이트)
 *   request/        P4-3  레퍼런스 의뢰
 *   portfolio/      P4-4  포트폴리오
 *   user/           P4-1  사용자와 역할
 *   work-category/  P3-1  공종 코드 테이블
 */
