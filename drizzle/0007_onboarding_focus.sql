ALTER TABLE "profile" ADD COLUMN "onboarding_state" jsonb;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "focus_areas" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "blockers" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "preferred_times" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "default_duration" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "session_style" text DEFAULT 'quiet' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "weekly_goal" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "email_marketing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "welcome_video_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "tour_answered_at" timestamp with time zone;