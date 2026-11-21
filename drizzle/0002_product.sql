CREATE TABLE "block" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "block_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"kind" text DEFAULT 'pair' NOT NULL,
	"preferred_partner_id" text,
	"session_id" text,
	"fallback_offered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_status_check" CHECK ("booking"."status" in ('booked','matched','cancelled','late_cancel','no_show','completed')),
	CONSTRAINT "booking_kind_check" CHECK ("booking"."kind" in ('pair','group')),
	CONSTRAINT "booking_duration_check" CHECK ("booking"."duration_min" in (25,50,75))
);
--> statement-breakpoint
CREATE TABLE "challenge" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"goal_type" text NOT NULL,
	"goal_value" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_slug_unique" UNIQUE("slug"),
	CONSTRAINT "challenge_goal_type_check" CHECK ("challenge"."goal_type" in ('sessions','minutes')),
	CONSTRAINT "challenge_range_check" CHECK ("challenge"."ends_at" > "challenge"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "challenge_member" (
	"challenge_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_member_challenge_id_user_id_pk" PRIMARY KEY("challenge_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "community" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"owner_id" text,
	"join_code" text NOT NULL,
	"plus_seats" integer DEFAULT 0 NOT NULL,
	"license_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_slug_unique" UNIQUE("slug"),
	CONSTRAINT "community_join_code_unique" UNIQUE("join_code"),
	CONSTRAINT "community_kind_check" CHECK ("community"."kind" in ('university','bootcamp','company','other'))
);
--> statement-breakpoint
CREATE TABLE "community_member" (
	"community_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_member_community_id_user_id_pk" PRIMARY KEY("community_id","user_id"),
	CONSTRAINT "community_member_role_check" CHECK ("community_member"."role" in ('owner','admin','member'))
);
--> statement-breakpoint
CREATE TABLE "favorite" (
	"user_id" text NOT NULL,
	"partner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_user_id_partner_id_pk" PRIMARY KEY("user_id","partner_id")
);
--> statement-breakpoint
CREATE TABLE "focus_session" (
	"id" text PRIMARY KEY NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"type" text DEFAULT 'pair' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"host_id" text,
	"title" text,
	"capacity" integer DEFAULT 2 NOT NULL,
	"is_fallback_room" boolean DEFAULT false NOT NULL,
	"video_room_id" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "focus_session_type_check" CHECK ("focus_session"."type" in ('pair','group')),
	CONSTRAINT "focus_session_status_check" CHECK ("focus_session"."status" in ('scheduled','live','ended','cancelled')),
	CONSTRAINT "focus_session_duration_check" CHECK ("focus_session"."duration_min" in (25,50,75))
);
--> statement-breakpoint
CREATE TABLE "host" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'applied' NOT NULL,
	"pitch" text DEFAULT '' NOT NULL,
	"audience_url" text,
	"rating" real,
	"ratings_count" integer DEFAULT 0 NOT NULL,
	"sessions_hosted" integer DEFAULT 0 NOT NULL,
	"perk_until" timestamp with time zone,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "host_status_check" CHECK ("host"."status" in ('applied','approved','rejected','suspended'))
);
--> statement-breakpoint
CREATE TABLE "host_rating" (
	"session_id" text NOT NULL,
	"rater_id" text NOT NULL,
	"host_id" text NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_rating_session_id_rater_id_pk" PRIMARY KEY("session_id","rater_id"),
	CONSTRAINT "host_rating_score_check" CHECK ("host_rating"."score" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "match_failure" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text,
	"user_id" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"channel" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"segments" text[] DEFAULT '{}'::text[] NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by" text,
	"birthdate_confirmed" boolean DEFAULT false NOT NULL,
	"age_confirmed_at" timestamp with time zone,
	"role" text DEFAULT 'user' NOT NULL,
	"is_house" boolean DEFAULT false NOT NULL,
	"email_reminders" boolean DEFAULT true NOT NULL,
	"push_reminders" boolean DEFAULT true NOT NULL,
	"microphone_default" boolean DEFAULT true NOT NULL,
	"match_same_segment" boolean DEFAULT false NOT NULL,
	"stats_public" boolean DEFAULT true NOT NULL,
	"onboarded_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_role_check" CHECK ("profile"."role" in ('user','admin'))
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_id" text NOT NULL,
	"referee_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"referrer_discount_code" text,
	"referee_discount_code" text,
	"converted_at" timestamp with time zone,
	"rewarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_status_check" CHECK ("referral"."status" in ('pending','converted','rewarded'))
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"target_id" text NOT NULL,
	"session_id" text,
	"reason" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_status_check" CHECK ("report"."status" in ('open','actioned','dismissed'))
);
--> statement-breakpoint
CREATE TABLE "session_participant" (
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"booking_id" text,
	"goal_text" text,
	"outcome" text,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"video_session_id" text,
	"tracks" jsonb,
	"quality" jsonb,
	CONSTRAINT "session_participant_session_id_user_id_pk" PRIMARY KEY("session_id","user_id"),
	CONSTRAINT "participant_outcome_check" CHECK ("session_participant"."outcome" is null or "session_participant"."outcome" in ('done','partial','not_done'))
);
--> statement-breakpoint
ALTER TABLE "email_preview" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "email_preview" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_preferred_partner_id_user_id_fk" FOREIGN KEY ("preferred_partner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_member" ADD CONSTRAINT "challenge_member_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_member" ADD CONSTRAINT "challenge_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community" ADD CONSTRAINT "community_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_partner_id_user_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host" ADD CONSTRAINT "host_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_rating" ADD CONSTRAINT "host_rating_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_rating" ADD CONSTRAINT "host_rating_rater_id_user_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_rating" ADD CONSTRAINT "host_rating_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_failure" ADD CONSTRAINT "match_failure_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_failure" ADD CONSTRAINT "match_failure_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_referred_by_user_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_id_user_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referee_id_user_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_target_id_user_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participant" ADD CONSTRAINT "session_participant_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participant" ADD CONSTRAINT "session_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participant" ADD CONSTRAINT "session_participant_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "block_blocked_idx" ON "block" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "booking_slot_idx" ON "booking" USING btree ("start_at","duration_min","status");--> statement-breakpoint
CREATE INDEX "booking_user_idx" ON "booking" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_active_unique" ON "booking" USING btree ("user_id","start_at") WHERE "booking"."status" in ('booked','matched');--> statement-breakpoint
CREATE INDEX "challenge_member_user_idx" ON "challenge_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "community_member_user_idx" ON "community_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "focus_session_start_idx" ON "focus_session" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "focus_session_host_idx" ON "focus_session" USING btree ("host_id","start_at");--> statement-breakpoint
CREATE INDEX "host_rating_host_idx" ON "host_rating" USING btree ("host_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_failure_booking_unique" ON "match_failure" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "match_failure_start_idx" ON "match_failure" USING btree ("start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_once" ON "notification_log" USING btree ("user_id","kind","ref_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_username_unique" ON "profile" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "profile_referral_code_unique" ON "profile" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "push_user_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_referee_unique" ON "referral" USING btree ("referee_id");--> statement-breakpoint
CREATE INDEX "referral_referrer_idx" ON "referral" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "report_status_idx" ON "report" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "report_target_idx" ON "report" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "participant_user_idx" ON "session_participant" USING btree ("user_id");