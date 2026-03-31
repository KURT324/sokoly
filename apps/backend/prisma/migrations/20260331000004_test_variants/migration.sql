-- ============================================================
-- ИНСТРУКЦИЯ: Запустить ВРУЧНУЮ на сервере ДО деплоя новой версии приложения.
--
-- Шаги:
--   1. Подключитесь к серверу через SSH.
--   2. Скопируйте этот файл на сервер (или используйте путь внутри контейнера).
--   3. Выполните:
--        docker exec -i <postgres_container_name> psql -U <db_user> -d <db_name> \
--          < /path/to/migration.sql
--      или, если есть прямой доступ:
--        psql "$DATABASE_URL" -f /path/to/migration.sql
--   4. Убедитесь, что скрипт завершился без ошибок.
--   5. После этого деплойте новый Docker-образ приложения.
-- ============================================================

-- Step 1: Create test_variants table
CREATE TABLE "test_variants" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_variants_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create test_variant_assignments table
CREATE TABLE "test_variant_assignments" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    CONSTRAINT "test_variant_assignments_pkey" PRIMARY KEY ("id")
);

-- Step 3: Add FK for test_variants.test_id → tests.id
ALTER TABLE "test_variants"
    ADD CONSTRAINT "test_variants_test_id_fkey"
    FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Add FKs for test_variant_assignments
ALTER TABLE "test_variant_assignments"
    ADD CONSTRAINT "test_variant_assignments_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "test_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "test_variant_assignments"
    ADD CONSTRAINT "test_variant_assignments_test_id_fkey"
    FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "test_variant_assignments"
    ADD CONSTRAINT "test_variant_assignments_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Unique index on (test_id, student_id) in assignments
CREATE UNIQUE INDEX "test_variant_assignments_test_id_student_id_key"
    ON "test_variant_assignments"("test_id", "student_id");

-- Step 6: Add variant_id to test_questions (nullable initially for data migration)
ALTER TABLE "test_questions" ADD COLUMN "variant_id" TEXT;

-- Step 7: Create a default "Вариант 1" for each existing test
INSERT INTO "test_variants" ("id", "test_id", "name", "created_at")
SELECT gen_random_uuid()::TEXT, "id", 'Вариант 1', NOW()
FROM "tests";

-- Step 8: Point every question at its test's default variant
UPDATE "test_questions" tq
SET "variant_id" = tv."id"
FROM "test_variants" tv
WHERE tv."test_id" = tq."test_id";

-- Step 9: Make variant_id NOT NULL now that data is filled
ALTER TABLE "test_questions" ALTER COLUMN "variant_id" SET NOT NULL;

-- Step 10: Add FK for test_questions.variant_id → test_variants.id
ALTER TABLE "test_questions"
    ADD CONSTRAINT "test_questions_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "test_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 11: Drop old test_id FK and column from test_questions
ALTER TABLE "test_questions" DROP CONSTRAINT "test_questions_test_id_fkey";
ALTER TABLE "test_questions" DROP COLUMN "test_id";

-- Step 12: Add variant_id to test_submissions (nullable — existing submissions keep working)
ALTER TABLE "test_submissions" ADD COLUMN "variant_id" TEXT;

ALTER TABLE "test_submissions"
    ADD CONSTRAINT "test_submissions_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "test_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
