/**
 * 레퍼런스 의뢰 — 고객이 올리는 "이렇게 해주세요". **이 서비스의 심장.**
 *
 * 여기에 들어올 것 (P4-3에서 구현):
 * - reference-request.ts  엔티티와 불변식
 * - request-status.ts     DRAFT / PUBLISHED / CLOSED / HIDDEN
 * - reference-image.ts    source_type(SELF/EXTERNAL)과 source_url 검증
 *
 * 확장 규약이 여기서 가장 강하게 걸린다.
 * 평수는 숫자, 공종은 코드 참조, 지역은 행정구역 코드, 주거형태·자재등급·거주중은 enum.
 * 자유 텍스트로 받으면 2차에서 스키마를 갈아엎어야 한다.
 *
 * DRAFT 는 어떤 목록에도 노출되지 않는다. 목록 쿼리에서 빠뜨리기 쉬우니 테스트로 잡는다.
 *
 * 근거: brain/20-도메인/엔티티 - ReferenceRequest.md · brain/20-도메인/확장 규약.md
 */
export {};
