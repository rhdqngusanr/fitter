-- 20260725000000_init 롤백
--
-- Prisma는 down 마이그레이션을 자동 실행하지 않는다(`migrate reset`으로 전체를 지우는 모델이다).
-- 그래도 되돌리는 방법을 적어두는 건 결정의 절반이라서 손으로 남긴다.
-- 실행: psql "$DATABASE_URL" -f down.sql
--
-- 순서가 중요하다. FK를 참조하는 쪽부터 지운다.

DROP INDEX IF EXISTS "portfolio_images_single_cover";
DROP INDEX IF EXISTS "reference_images_single_cover";
DROP INDEX IF EXISTS "contact_requests_active_uniq";

DROP TABLE IF EXISTS "notifications";
DROP TABLE IF EXISTS "reports";
DROP TABLE IF EXISTS "scraps";
DROP TABLE IF EXISTS "contact_requests";

DROP TABLE IF EXISTS "portfolio_images";
DROP TABLE IF EXISTS "portfolio_item_categories";
DROP TABLE IF EXISTS "portfolio_items";

DROP TABLE IF EXISTS "reference_images";
DROP TABLE IF EXISTS "reference_request_categories";
DROP TABLE IF EXISTS "reference_requests";

DROP TABLE IF EXISTS "pro_service_areas";
DROP TABLE IF EXISTS "pro_work_categories";
DROP TABLE IF EXISTS "pro_profiles";
DROP TABLE IF EXISTS "customer_profiles";
DROP TABLE IF EXISTS "user_profiles";
DROP TABLE IF EXISTS "users";

DROP TABLE IF EXISTS "regions";
DROP TABLE IF EXISTS "work_categories";

DROP TYPE IF EXISTS "NotificationKind";
DROP TYPE IF EXISTS "TargetType";
DROP TYPE IF EXISTS "ReportStatus";
DROP TYPE IF EXISTS "ReportType";
DROP TYPE IF EXISTS "ContactDirection";
DROP TYPE IF EXISTS "ContactStatus";
DROP TYPE IF EXISTS "ImagePhase";
DROP TYPE IF EXISTS "ImageSourceType";
DROP TYPE IF EXISTS "MaterialGrade";
DROP TYPE IF EXISTS "HousingType";
DROP TYPE IF EXISTS "PortfolioStatus";
DROP TYPE IF EXISTS "RequestStatus";
DROP TYPE IF EXISTS "ProfileType";
DROP TYPE IF EXISTS "AuthProvider";

-- 적용 기록도 지운다. 안 지우면 prisma migrate deploy가 "이미 적용됨"으로 보고 건너뛴다.
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260725000000_init';
