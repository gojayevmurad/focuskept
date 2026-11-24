CREATE TABLE "admin_alert_pref" (
	"user_id" text NOT NULL,
	"event" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "admin_alert_pref_user_id_event_pk" PRIMARY KEY("user_id","event"),
	CONSTRAINT "admin_alert_event_check" CHECK ("admin_alert_pref"."event" in ('user_signed_up','report_created','support_ticket_created','match_now_waiting','booking_unmatched'))
);
--> statement-breakpoint
CREATE TABLE "match_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"duration_min" integer NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matched_at" timestamp with time zone,
	CONSTRAINT "match_request_duration_check" CHECK ("match_request"."duration_min" in (25,50)),
	CONSTRAINT "match_request_status_check" CHECK ("match_request"."status" in ('waiting','matched','cancelled','expired'))
);
--> statement-breakpoint
ALTER TABLE "admin_alert_pref" ADD CONSTRAINT "admin_alert_pref_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_request" ADD CONSTRAINT "match_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_request" ADD CONSTRAINT "match_request_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_request_waiting_user_unique" ON "match_request" USING btree ("user_id") WHERE "match_request"."status" = 'waiting';--> statement-breakpoint
CREATE INDEX "match_request_queue_idx" ON "match_request" USING btree ("status","duration_min","created_at");--> statement-breakpoint
CREATE INDEX "match_request_user_idx" ON "match_request" USING btree ("user_id","created_at");