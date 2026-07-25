-- CreateTable
CREATE TABLE "upload_intents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "declared_size" INTEGER NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_intents_storage_key_key" ON "upload_intents"("storage_key");

-- CreateIndex
CREATE INDEX "upload_intents_consumed_at_created_at_idx" ON "upload_intents"("consumed_at", "created_at");

-- CreateIndex
CREATE INDEX "upload_intents_user_id_idx" ON "upload_intents"("user_id");

-- AddForeignKey
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

