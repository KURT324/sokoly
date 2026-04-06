CREATE TYPE "ActivityEntity" AS ENUM ('DAY', 'TEST');
CREATE TYPE "ActivityAction" AS ENUM ('OPENED', 'CLOSED');

CREATE TABLE "activity_logs" (
  "id"          TEXT NOT NULL,
  "entity_type" "ActivityEntity" NOT NULL,
  "entity_id"   TEXT NOT NULL,
  "action"      "ActivityAction" NOT NULL,
  "actor_id"    TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_logs_entity_type_entity_id_idx"
  ON "activity_logs"("entity_type", "entity_id");

ALTER TABLE "activity_logs"
  ADD CONSTRAINT "activity_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
