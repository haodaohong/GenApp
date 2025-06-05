ALTER TABLE "deploy" DROP CONSTRAINT "deploy_chat_id_chats_id_fk";
--> statement-breakpoint
ALTER TABLE "deploy" ADD CONSTRAINT "deploy_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE cascade;