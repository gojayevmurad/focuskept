CREATE TABLE "support_ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"page_url" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"admin_note" text DEFAULT '' NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_ticket_category_check" CHECK ("support_ticket"."category" in ('question','bug','billing','account','safety','privacy','legal','feedback')),
	CONSTRAINT "support_ticket_status_check" CHECK ("support_ticket"."status" in ('open','answered','closed','spam'))
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "email_tips" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "attribution" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_ticket_status_idx" ON "support_ticket" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "support_ticket_user_idx" ON "support_ticket" USING btree ("user_id");