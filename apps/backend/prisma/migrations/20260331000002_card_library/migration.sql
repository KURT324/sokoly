-- CreateTable
CREATE TABLE "card_libraries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "image_path" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_libraries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "card_libraries" ADD CONSTRAINT "card_libraries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: make day_id nullable
ALTER TABLE "card_tasks" ALTER COLUMN "day_id" DROP NOT NULL;

-- AlterTable: add library_id
ALTER TABLE "card_tasks" ADD COLUMN "library_id" TEXT;

-- AddForeignKey
ALTER TABLE "card_tasks" ADD CONSTRAINT "card_tasks_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "card_libraries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
