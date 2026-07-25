-- 포트폴리오도 DRAFT를 지원한다. 의뢰와 같은 이유다.
--
-- 시공자는 현장에서 사진부터 올리고 나머지는 나중에 채운다.
-- NOT NULL이면 그 순간 임시값을 넣어야 하고, 그러면 실제 시공 데이터가 오염된다.
-- 2차 가격 통계의 원재료가 여기 있으므로 특히 조심해야 한다.

ALTER TABLE "portfolio_items" ALTER COLUMN "area_pyeong" DROP NOT NULL;
ALTER TABLE "portfolio_items" ALTER COLUMN "region_code" DROP NOT NULL;

ALTER TABLE "portfolio_items" DROP CONSTRAINT IF EXISTS "portfolio_items_area_range";
ALTER TABLE "portfolio_items"
  ADD CONSTRAINT "portfolio_items_area_range"
  CHECK ("area_pyeong" IS NULL OR ("area_pyeong" >= 1 AND "area_pyeong" <= 500));
