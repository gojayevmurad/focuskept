CREATE TABLE "subject" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#5FC3A8' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "focus_session" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "focus_session" ADD COLUMN "subject_id" text;--> statement-breakpoint
ALTER TABLE "learning_draft" ADD COLUMN "subject_id" text;--> statement-breakpoint
ALTER TABLE "learning_item" ADD COLUMN "subject_id" text;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subject_user_name_unique" ON "subject" USING btree ("user_id",lower("name"));--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_draft" ADD CONSTRAINT "learning_draft_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_item" ADD CONSTRAINT "learning_item_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_user_subject_idx" ON "learning_item" USING btree ("user_id","subject_id");