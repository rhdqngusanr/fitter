-- ADR-010과 ADR-011이 "P4-6 구현 전에 넣으라"고 지목한 컬럼들.
--
-- 안 받은 데이터는 소급되지 않는다. 컨택 기능이 돌기 시작한 뒤에 넣으면
-- 그 전의 모든 컨택은 가격 데이터가 없다.

-- ── 제안 금액 (ADR-010) ────────────────────────────────────────────────
-- 가격 전략의 급소다. 실거래가는 시공자의 자발적 공개에만 의존해 느리게 쌓이지만,
-- 제안은 플랫폼 안에서 일어나므로 플랫폼 이탈과 무관하게 쌓인다.
-- 선택 입력이다 — 필수로 하면 "현장 봐야 안다"는 정당한 경우를 막고 시공자가 이탈한다.
ALTER TABLE "contact_requests"
  ADD COLUMN "proposed_amount"      INTEGER,
  ADD COLUMN "proposed_amount_note" TEXT;

ALTER TABLE "contact_requests"
  ADD CONSTRAINT "contact_requests_proposed_amount_positive"
  CHECK ("proposed_amount" IS NULL OR "proposed_amount" > 0);

-- ── 완료 확인 (ADR-011) ────────────────────────────────────────────────
-- 가장 싼 신뢰 장치가 가장 많은 걸 푼다.
-- 양방 확인 하나로 리뷰 작성 자격, 실거래가 데이터, 이탈률 지표가 동시에 생긴다.
ALTER TABLE "contact_requests"
  ADD COLUMN "completed_confirmed_by_customer_at" TIMESTAMPTZ(3),
  ADD COLUMN "completed_confirmed_by_pro_at"      TIMESTAMPTZ(3),
  ADD COLUMN "final_amount"                       INTEGER;

ALTER TABLE "contact_requests"
  ADD CONSTRAINT "contact_requests_final_amount_positive"
  CHECK ("final_amount" IS NULL OR "final_amount" > 0);
