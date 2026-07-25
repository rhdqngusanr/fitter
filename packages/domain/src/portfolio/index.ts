/**
 * 포트폴리오 — 시공자가 자기를 증명하는 유일한 수단.
 *
 * 여기에 들어올 것 (P4-4에서 구현):
 * - portfolio-item.ts   엔티티와 불변식
 * - portfolio-image.ts  phase(BEFORE/AFTER/PROCESS), 대표 사진, 순서
 *
 * 공개 조건이 두 개다. 포트폴리오가 PUBLISHED 이고 **소속 시공자가 승인됐을 때**만 공개된다.
 * 둘 중 하나만 보고 공개하는 실수를 하기 쉬우니 테스트로 박는다.
 *
 * 실제 비용 공개(actual_cost)는 금액만 남기면 쓸모가 없다.
 * 공종·평수·시공연월·자재등급·지역 코드와 함께 정규화되어야 2차 통계의 재료가 된다.
 *
 * 근거: brain/20-도메인/엔티티 - PortfolioItem.md
 */
export {};
