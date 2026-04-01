-- ============================================================
-- ИНСТРУКЦИЯ: Запустить ВРУЧНУЮ на сервере ДО деплоя новой версии приложения.
--
-- Шаги:
--   1. Подключитесь к серверу через SSH.
--   2. Выполните:
--        docker exec -i <postgres_container_name> psql -U <db_user> -d <db_name> \
--          < /path/to/migration.sql
--      или:
--        psql "$DATABASE_URL" -f /path/to/migration.sql
--   3. Убедитесь, что скрипт завершился без ошибок.
--   4. Деплойте новый Docker-образ приложения.
-- ============================================================

-- Step 1: Create material_libraries table
CREATE TABLE "material_libraries" (
    "id" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "title" TEXT NOT NULL,
    "folder" TEXT,
    "storage_path" TEXT,
    "url" TEXT,
    "size_bytes" BIGINT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_libraries_pkey" PRIMARY KEY ("id")
);

-- Step 2: FK to users
ALTER TABLE "material_libraries"
    ADD CONSTRAINT "material_libraries_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 3: Add library_id to materials (nullable)
ALTER TABLE "materials" ADD COLUMN "library_id" TEXT;

-- Step 4: FK to material_libraries (SET NULL on delete — deleting from library doesn't remove attached materials)
ALTER TABLE "materials"
    ADD CONSTRAINT "materials_library_id_fkey"
    FOREIGN KEY ("library_id") REFERENCES "material_libraries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
