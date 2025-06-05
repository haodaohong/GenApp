ALTER TABLE "deploy" DROP CONSTRAINT "deploy_userId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "deploy" DROP CONSTRAINT "deploy_chatId_chats_id_fk";
--> statement-breakpoint
ALTER TABLE "deploy" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "deploy" ADD COLUMN "chat_id" uuid;--> statement-breakpoint
ALTER TABLE "deploy" ADD COLUMN "sit_name" text;--> statement-breakpoint
ALTER TABLE "deploy" ADD COLUMN "site_id" text;--> statement-breakpoint
ALTER TABLE "deploy" ADD CONSTRAINT "deploy_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deploy" ADD CONSTRAINT "deploy_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deploy" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "deploy" DROP COLUMN "chatId";--> statement-breakpoint
ALTER TABLE "deploy" DROP COLUMN "siteName";--> statement-breakpoint
ALTER TABLE "deploy" DROP COLUMN "siteId";