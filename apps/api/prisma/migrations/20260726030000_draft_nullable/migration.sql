-- DRAFT는 본질적으로 미완성이다.
--
-- 다단계 폼의 1스텝에서 평수·지역·주거형태를 알 수 없는데 NOT NULL이면
-- 임시값을 넣어야 하고, 그러면 "사용자가 24평이라고 답했다"와 "아직 안 물어봤다"를
-- 구분할 수 없게 된다. 그 구분이 사라지면 2차 가격 통계가 오염된다.
--
-- 완성 판정은 publish 한 곳에서만 한다. 확장 규약은 "받을 때 숫자로 받는다"이지
-- "빈 값을 허용하지 않는다"가 아니다.

ALTER TABLE "reference_requests" ALTER COLUMN "area_pyeong"  DROP NOT NULL;
ALTER TABLE "reference_requests" ALTER COLUMN "housing_type" DROP NOT NULL;
ALTER TABLE "reference_requests" ALTER COLUMN "region_code"  DROP NOT NULL;

-- 값이 있으면 여전히 범위를 지켜야 한다.
ALTER TABLE "reference_requests" DROP CONSTRAINT IF EXISTS "reference_requests_area_range";
ALTER TABLE "reference_requests"
  ADD CONSTRAINT "reference_requests_area_range"
  CHECK ("area_pyeong" IS NULL OR ("area_pyeong" >= 1 AND "area_pyeong" <= 500));
