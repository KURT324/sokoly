CREATE TABLE "direct_chats" (
  "id" TEXT NOT NULL,
  "user1_id" TEXT NOT NULL,
  "user2_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_chats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "direct_messages" (
  "id" TEXT NOT NULL,
  "chat_id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "direct_chats_user1_id_user2_id_key" ON "direct_chats"("user1_id", "user2_id");

ALTER TABLE "direct_chats" ADD CONSTRAINT "direct_chats_user1_id_fkey"
  FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_chats" ADD CONSTRAINT "direct_chats_user2_id_fkey"
  FOREIGN KEY ("user2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "direct_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
