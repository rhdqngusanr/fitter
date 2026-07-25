-- ============================================================================
-- 1) 현장 변수 컬럼
--
-- ADR-010이 요구한 것이다. 층수와 엘리베이터는 자재 운반비를, 철거 유무는
-- 공정 자체를 가른다. 셋 다 없으면 2차 가격 분포에 설명되지 않는 분산이 남는다.
--
-- 전부 선택 입력이다. 필수로 하면 폼이 길어져 고객이 이탈하는데,
-- 그렇다고 안 받으면 소급이 안 된다. 선택이면 입력한 사람 데이터만이라도 쌓인다.
--
-- 근거: brain/50-결정/ADR-010 - 가격 정책 모델.md · brain/00-허브/열린 질문.md Q7
-- ============================================================================

ALTER TABLE "reference_requests"
  ADD COLUMN "floor"            INTEGER,
  ADD COLUMN "has_elevator"     BOOLEAN,
  ADD COLUMN "needs_demolition" BOOLEAN;

-- 지하 5층부터 지상 100층까지. 벗어나면 오타다.
ALTER TABLE "reference_requests"
  ADD CONSTRAINT "reference_requests_floor_range"
  CHECK ("floor" IS NULL OR ("floor" >= -5 AND "floor" <= 100));

-- ============================================================================
-- 2) 평수 상한을 1000 → 500 으로 좁힌다
--
-- 반셀프 인테리어에서 500평을 넘는 의뢰는 사실상 없다. 상가라도 500평이면 대형이고,
-- 상한이 낮을수록 오타(240 → 2400)를 더 잘 잡는다.
-- 도메인의 MAX_PYEONG 과 같은 값을 유지한다.
-- ============================================================================

ALTER TABLE "reference_requests" DROP CONSTRAINT IF EXISTS "reference_requests_area_range";
ALTER TABLE "reference_requests"
  ADD CONSTRAINT "reference_requests_area_range"
  CHECK ("area_pyeong" >= 1 AND "area_pyeong" <= 500);

ALTER TABLE "portfolio_items" DROP CONSTRAINT IF EXISTS "portfolio_items_area_range";
ALTER TABLE "portfolio_items"
  ADD CONSTRAINT "portfolio_items_area_range"
  CHECK ("area_pyeong" >= 1 AND "area_pyeong" <= 500);
