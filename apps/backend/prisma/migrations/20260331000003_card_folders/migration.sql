-- CreateTable
CREATE TABLE "card_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_folders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "card_folders" ADD CONSTRAINT "card_folders_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddColumn
ALTER TABLE "card_libraries" ADD COLUMN "folder_id" TEXT;

ALTER TABLE "card_libraries" ADD CONSTRAINT "card_libraries_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "card_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
