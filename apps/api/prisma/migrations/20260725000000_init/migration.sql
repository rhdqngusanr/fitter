-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'KAKAO');

-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('CUSTOMER', 'PRO', 'ADMIN');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "PortfolioStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "HousingType" AS ENUM ('APARTMENT', 'VILLA', 'OFFICETEL', 'HOUSE', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "MaterialGrade" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ImageSourceType" AS ENUM ('SELF', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ImagePhase" AS ENUM ('BEFORE', 'AFTER', 'PROCESS');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ContactDirection" AS ENUM ('PRO_TO_REQUEST', 'CUSTOMER_TO_PRO');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('COPYRIGHT', 'INAPPROPRIATE', 'SPAM');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('REFERENCE_REQUEST', 'PORTFOLIO_ITEM', 'USER');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('CONTACT_REQUESTED', 'CONTACT_ACCEPTED', 'CONTACT_DECLINED', 'CONTACT_EXPIRED', 'PRO_APPROVED', 'PRO_REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "nickname" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ProfileType" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "user_profile_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("user_profile_id")
);

-- CreateTable
CREATE TABLE "pro_profiles" (
    "user_profile_id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "intro" TEXT,
    "career_years" INTEGER NOT NULL DEFAULT 0,
    "business_number" TEXT,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "rejection_reason" TEXT,
    "profile_completeness" INTEGER NOT NULL DEFAULT 0,
    "is_dormant" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pro_profiles_pkey" PRIMARY KEY ("user_profile_id")
);

-- CreateTable
CREATE TABLE "work_categories" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ko" TEXT NOT NULL,
    "parent_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "code" CHAR(5) NOT NULL,
    "sido_code" CHAR(2) NOT NULL,
    "sido_name" TEXT NOT NULL,
    "sigungu_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "pro_work_categories" (
    "pro_profile_id" UUID NOT NULL,
    "work_category_id" INTEGER NOT NULL,

    CONSTRAINT "pro_work_categories_pkey" PRIMARY KEY ("pro_profile_id","work_category_id")
);

-- CreateTable
CREATE TABLE "pro_service_areas" (
    "pro_profile_id" UUID NOT NULL,
    "region_code" CHAR(5) NOT NULL,

    CONSTRAINT "pro_service_areas_pkey" PRIMARY KEY ("pro_profile_id","region_code")
);

-- CreateTable
CREATE TABLE "reference_requests" (
    "id" UUID NOT NULL,
    "customer_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "area_pyeong" DECIMAL(6,2) NOT NULL,
    "area_m2" DECIMAL(8,2),
    "housing_type" "HousingType" NOT NULL,
    "region_code" CHAR(5) NOT NULL,
    "desired_start_at" DATE,
    "desired_end_at" DATE,
    "is_occupied" BOOLEAN NOT NULL DEFAULT false,
    "material_grade" "MaterialGrade",
    "budget_min" INTEGER,
    "budget_max" INTEGER,
    "estimate_snapshot" JSONB,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "reference_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_request_categories" (
    "reference_request_id" UUID NOT NULL,
    "work_category_id" INTEGER NOT NULL,

    CONSTRAINT "reference_request_categories_pkey" PRIMARY KEY ("reference_request_id","work_category_id")
);

-- CreateTable
CREATE TABLE "reference_images" (
    "id" UUID NOT NULL,
    "reference_request_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "thumb_400_key" TEXT,
    "thumb_1200_key" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "source_type" "ImageSourceType" NOT NULL,
    "source_url" TEXT,
    "is_takedown_requested" BOOLEAN NOT NULL DEFAULT false,
    "takedown_requested_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "reference_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" UUID NOT NULL,
    "pro_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PortfolioStatus" NOT NULL DEFAULT 'DRAFT',
    "area_pyeong" DECIMAL(6,2) NOT NULL,
    "area_m2" DECIMAL(8,2),
    "housing_type" "HousingType",
    "region_code" CHAR(5) NOT NULL,
    "work_days" INTEGER,
    "worked_at" DATE,
    "material_grade" "MaterialGrade",
    "is_cost_public" BOOLEAN NOT NULL DEFAULT false,
    "actual_cost" INTEGER,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_item_categories" (
    "portfolio_item_id" UUID NOT NULL,
    "work_category_id" INTEGER NOT NULL,

    CONSTRAINT "portfolio_item_categories_pkey" PRIMARY KEY ("portfolio_item_id","work_category_id")
);

-- CreateTable
CREATE TABLE "portfolio_images" (
    "id" UUID NOT NULL,
    "portfolio_item_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "thumb_400_key" TEXT,
    "thumb_1200_key" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "phase" "ImagePhase",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "portfolio_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_requests" (
    "id" UUID NOT NULL,
    "direction" "ContactDirection" NOT NULL,
    "requester_user_id" UUID NOT NULL,
    "receiver_user_id" UUID NOT NULL,
    "reference_request_id" UUID,
    "portfolio_item_id" UUID,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'REQUESTED',
    "decline_reason" TEXT,
    "responded_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "contact_viewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraps" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_type" "TargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID,
    "type" "ReportType" NOT NULL,
    "target_type" "TargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "rights_holder_name" TEXT,
    "rights_holder_contact" TEXT,
    "original_source_url" TEXT,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "resource_id" UUID,
    "payload" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_type_key" ON "user_profiles"("user_id", "type");

-- CreateIndex
CREATE INDEX "pro_profiles_is_approved_is_dormant_idx" ON "pro_profiles"("is_approved", "is_dormant");

-- CreateIndex
CREATE UNIQUE INDEX "work_categories_code_key" ON "work_categories"("code");

-- CreateIndex
CREATE INDEX "work_categories_is_active_sort_order_idx" ON "work_categories"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "regions_sido_code_idx" ON "regions"("sido_code");

-- CreateIndex
CREATE INDEX "pro_work_categories_work_category_id_pro_profile_id_idx" ON "pro_work_categories"("work_category_id", "pro_profile_id");

-- CreateIndex
CREATE INDEX "pro_service_areas_region_code_pro_profile_id_idx" ON "pro_service_areas"("region_code", "pro_profile_id");

-- CreateIndex
CREATE INDEX "reference_requests_status_region_code_created_at_id_idx" ON "reference_requests"("status", "region_code", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "reference_requests_customer_user_id_created_at_idx" ON "reference_requests"("customer_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reference_request_categories_work_category_id_reference_req_idx" ON "reference_request_categories"("work_category_id", "reference_request_id");

-- CreateIndex
CREATE INDEX "reference_images_reference_request_id_sort_order_idx" ON "reference_images"("reference_request_id", "sort_order");

-- CreateIndex
CREATE INDEX "portfolio_items_status_region_code_created_at_id_idx" ON "portfolio_items"("status", "region_code", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "portfolio_items_pro_user_id_created_at_idx" ON "portfolio_items"("pro_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "portfolio_item_categories_work_category_id_portfolio_item_i_idx" ON "portfolio_item_categories"("work_category_id", "portfolio_item_id");

-- CreateIndex
CREATE INDEX "portfolio_images_portfolio_item_id_sort_order_idx" ON "portfolio_images"("portfolio_item_id", "sort_order");

-- CreateIndex
CREATE INDEX "contact_requests_receiver_user_id_status_created_at_idx" ON "contact_requests"("receiver_user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contact_requests_requester_user_id_status_created_at_idx" ON "contact_requests"("requester_user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contact_requests_status_expires_at_idx" ON "contact_requests"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "scraps_user_id_target_type_target_id_key" ON "scraps"("user_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_profiles" ADD CONSTRAINT "pro_profiles_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_categories" ADD CONSTRAINT "work_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "work_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_work_categories" ADD CONSTRAINT "pro_work_categories_pro_profile_id_fkey" FOREIGN KEY ("pro_profile_id") REFERENCES "pro_profiles"("user_profile_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_work_categories" ADD CONSTRAINT "pro_work_categories_work_category_id_fkey" FOREIGN KEY ("work_category_id") REFERENCES "work_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_service_areas" ADD CONSTRAINT "pro_service_areas_pro_profile_id_fkey" FOREIGN KEY ("pro_profile_id") REFERENCES "pro_profiles"("user_profile_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_service_areas" ADD CONSTRAINT "pro_service_areas_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_requests" ADD CONSTRAINT "reference_requests_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_requests" ADD CONSTRAINT "reference_requests_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_request_categories" ADD CONSTRAINT "reference_request_categories_reference_request_id_fkey" FOREIGN KEY ("reference_request_id") REFERENCES "reference_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_request_categories" ADD CONSTRAINT "reference_request_categories_work_category_id_fkey" FOREIGN KEY ("work_category_id") REFERENCES "work_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_images" ADD CONSTRAINT "reference_images_reference_request_id_fkey" FOREIGN KEY ("reference_request_id") REFERENCES "reference_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_pro_user_id_fkey" FOREIGN KEY ("pro_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_item_categories" ADD CONSTRAINT "portfolio_item_categories_portfolio_item_id_fkey" FOREIGN KEY ("portfolio_item_id") REFERENCES "portfolio_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_item_categories" ADD CONSTRAINT "portfolio_item_categories_work_category_id_fkey" FOREIGN KEY ("work_category_id") REFERENCES "work_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_images" ADD CONSTRAINT "portfolio_images_portfolio_item_id_fkey" FOREIGN KEY ("portfolio_item_id") REFERENCES "portfolio_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_receiver_user_id_fkey" FOREIGN KEY ("receiver_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_reference_request_id_fkey" FOREIGN KEY ("reference_request_id") REFERENCES "reference_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_portfolio_item_id_fkey" FOREIGN KEY ("portfolio_item_id") REFERENCES "portfolio_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraps" ADD CONSTRAINT "scraps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================================
-- Prisma 스키마로 표현할 수 없는 제약들.
--
-- 여기부터가 이 마이그레이션의 핵심이다. 확장 규약을 애플리케이션의 선의가 아니라
-- DB 제약으로 지키는 부분이고, 시안 검수에서 실제로 새는 걸 봤기 때문에 넣었다.
-- 근거: brain/20-도메인/확장 규약.md · brain/70-산출물/ERD.md
-- ============================================================================

-- ── 확장 규약 1조: 평수는 숫자이고 area_m2는 파생이다 ───────────────────────
-- 애플리케이션이 계산해서 넣으면 언젠가 둘이 어긋난다. DB가 계산하면 어긋날 수가 없다.
-- 1평 = 400/121 ㎡.
ALTER TABLE "reference_requests" DROP COLUMN "area_m2";
ALTER TABLE "reference_requests"
  ADD COLUMN "area_m2" DECIMAL(8,2)
  GENERATED ALWAYS AS (ROUND("area_pyeong" * 400.0 / 121.0, 2)) STORED;

ALTER TABLE "portfolio_items" DROP COLUMN "area_m2";
ALTER TABLE "portfolio_items"
  ADD COLUMN "area_m2" DECIMAL(8,2)
  GENERATED ALWAYS AS (ROUND("area_pyeong" * 400.0 / 121.0, 2)) STORED;

-- 숫자여도 말이 안 되는 값은 있다. 자유 텍스트를 막는 것만으로는 부족하다.
ALTER TABLE "reference_requests"
  ADD CONSTRAINT "reference_requests_area_range"
  CHECK ("area_pyeong" >= 1 AND "area_pyeong" <= 1000);

ALTER TABLE "portfolio_items"
  ADD CONSTRAINT "portfolio_items_area_range"
  CHECK ("area_pyeong" >= 1 AND "area_pyeong" <= 1000);

-- ── 저작권: 외부 출처 사진은 원본 URL이 반드시 있어야 한다 ──────────────────
-- 시안에는 이 필드가 아예 없었고 전역 동의 체크박스 하나가 그 자리를 대신하고 있었다.
-- 애플리케이션이 잊어도 DB가 거부한다.
-- 근거: brain/10-제품/리스크 - 레퍼런스 사진 저작권.md
ALTER TABLE "reference_images"
  ADD CONSTRAINT "reference_images_source_url_required"
  CHECK (
    ("source_type" = 'EXTERNAL' AND "source_url" IS NOT NULL) OR
    ("source_type" = 'SELF'     AND "source_url" IS NULL)
  );

-- ── 비용 공개: 공개가 아니면 금액이 남아 있으면 안 된다 ─────────────────────
-- 토글을 껐는데 금액이 남으면 그건 유출이다.
ALTER TABLE "portfolio_items"
  ADD CONSTRAINT "portfolio_items_cost_consistency"
  CHECK (
    ("is_cost_public" = false AND "actual_cost" IS NULL) OR
    ("is_cost_public" = true  AND "actual_cost" > 0)
  );

-- ── 컨택: direction과 FK가 어긋나면 안 된다 ─────────────────────────────────
ALTER TABLE "contact_requests"
  ADD CONSTRAINT "contact_requests_direction_target"
  CHECK (
    ("direction" = 'PRO_TO_REQUEST'  AND "reference_request_id" IS NOT NULL AND "portfolio_item_id" IS NULL) OR
    ("direction" = 'CUSTOMER_TO_PRO' AND "portfolio_item_id"    IS NOT NULL AND "reference_request_id" IS NULL)
  );

-- 자기 자신에게 컨택을 보낼 수는 없다.
ALTER TABLE "contact_requests"
  ADD CONSTRAINT "contact_requests_no_self"
  CHECK ("requester_user_id" <> "receiver_user_id");

-- ── 어뷰징: 진행 중인 요청이 있으면 같은 상대에게 또 못 보낸다 ──────────────
-- 애플리케이션 검사와 경쟁 상태가 나도 여기가 최종 방어선이다.
-- 근거: brain/70-산출물/유저 스토리.md US-040
CREATE UNIQUE INDEX "contact_requests_active_uniq"
  ON "contact_requests" ("requester_user_id", "receiver_user_id")
  WHERE "status" = 'REQUESTED' AND "deleted_at" IS NULL;

-- ── 대표 사진은 하나뿐이다 ──────────────────────────────────────────────────
CREATE UNIQUE INDEX "reference_images_single_cover"
  ON "reference_images" ("reference_request_id")
  WHERE "is_cover" = true AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "portfolio_images_single_cover"
  ON "portfolio_images" ("portfolio_item_id")
  WHERE "is_cover" = true AND "deleted_at" IS NULL;
