-- ============================================================================
-- 1) area_m2 생성 컬럼 제거
--
-- 왜 되돌리나. Prisma 스키마는 GENERATED ALWAYS 를 표현하지 못한다.
-- 그래서 스키마와 DB가 영구히 어긋난 것으로 보이고, `prisma migrate dev`가
-- 매번 그 차이를 "고치려" 들다 실패한다. 앞으로 남은 모든 마이그레이션에 걸리는 세금이다.
--
-- 확장 규약 1조가 요구하는 건 "평수는 숫자이고 ㎡는 파생"이다.
-- 그 파생은 도메인의 pyeongToSquareMeters 가 이미 하고 있고 테스트도 있다.
-- 같은 파생을 DB와 도메인 두 곳에서 하면 언젠가 둘이 어긋난다. **파생 경로는 하나여야 한다.**
--
-- 규약의 진짜 방어선인 `area_pyeong DECIMAL` + 범위 CHECK 는 그대로 남는다.
-- 나중에 ㎡ 로 SQL 필터가 필요해지면 그때 생성 컬럼을 다시 넣는다.
-- ============================================================================

ALTER TABLE "reference_requests" DROP COLUMN IF EXISTS "area_m2";
ALTER TABLE "portfolio_items"    DROP COLUMN IF EXISTS "area_m2";

-- ============================================================================
-- 2) 리프레시 토큰
--
-- 액세스 토큰은 무상태로 검증하지만 리프레시는 회전과 재사용 탐지가 필요해 저장한다.
-- 토큰이 아니라 해시를 저장한다 — DB가 유출돼도 그걸로 로그인할 수 없어야 한다.
-- 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 1
-- ============================================================================

CREATE TABLE "refresh_tokens" (
    "id"         UUID         NOT NULL,
    "user_id"    UUID         NOT NULL,
    "token_hash" TEXT         NOT NULL,
    "family_id"  UUID         NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
-- 만료된 토큰 정리 배치용
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
