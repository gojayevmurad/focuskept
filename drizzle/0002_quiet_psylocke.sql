CREATE TABLE "ai_daily_usage" (
	"day" date PRIMARY KEY NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"free_disabled_at" timestamp with time zone,
	"all_disabled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"user_id" text NOT NULL,
	"period" text NOT NULL,
	"cards_analyzed" integer DEFAULT 0 NOT NULL,
	"answers_graded" integer DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_user_id_period_pk" PRIMARY KEY("user_id","period")
);
--> statement-breakpoint
CREATE TABLE "focus_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mode" text NOT NULL,
	"time_technique" text NOT NULL,
	"learning_method" text,
	"planning_technique" text,
	"task_id" text,
	"learning_item_id" text,
	"goal" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"focused_seconds" integer DEFAULT 0 NOT NULL,
	"break_seconds" integer DEFAULT 0 NOT NULL,
	"cycles_completed" integer DEFAULT 0 NOT NULL,
	"interruptions" integer DEFAULT 0 NOT NULL,
	"overrun_seconds" integer DEFAULT 0 NOT NULL,
	"focus_rating" integer,
	"note" text,
	"completed" boolean DEFAULT false NOT NULL,
	"client_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_mode" CHECK ("focus_session"."mode" in ('work','learning')),
	CONSTRAINT "session_rating" CHECK ("focus_session"."focus_rating" is null or "focus_session"."focus_rating" between 1 and 5),
	CONSTRAINT "session_seconds" CHECK ("focus_session"."focused_seconds" >= 0 and "focus_session"."break_seconds" >= 0 and "focus_session"."overrun_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "learning_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"topic" text NOT NULL,
	"source_url" text,
	"learning_method" text NOT NULL,
	"notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"explanation" text,
	"analysis" jsonb,
	"questions" jsonb,
	"language" text,
	"prompt_version" text,
	"analysis_count" integer DEFAULT 0 NOT NULL,
	"ai_counted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_draft_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "learning_item" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"topic" text NOT NULL,
	"source_url" text,
	"learning_method" text NOT NULL,
	"explanation" text NOT NULL,
	"analysis" jsonb,
	"language" text,
	"prompt_version" text,
	"status" text DEFAULT 'active' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"interval_days" integer NOT NULL,
	"due_on" date NOT NULL,
	"relearn" boolean DEFAULT false NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"review_count" integer DEFAULT 0 NOT NULL,
	"lapse_count" integer DEFAULT 0 NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, coalesce(topic, '') || ' ' || coalesce(explanation, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_status" CHECK ("learning_item"."status" in ('active','archived')),
	CONSTRAINT "card_step" CHECK ("learning_item"."current_step" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"period_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_channel" CHECK ("notification_log"."channel" in ('email','push')),
	CONSTRAINT "notification_status" CHECK ("notification_log"."status" in ('pending','sent','failed','skipped'))
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#2F6F62' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" text PRIMARY KEY NOT NULL,
	"learning_item_id" text NOT NULL,
	"type" text NOT NULL,
	"prompt" text NOT NULL,
	"answer" text NOT NULL,
	"explanation" text,
	"position" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_type" CHECK ("question"."type" in ('open','true_false','cloze')),
	CONSTRAINT "question_source" CHECK ("question"."source" in ('ai','user','ai_edited'))
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"learning_item_id" text NOT NULL,
	"user_id" text NOT NULL,
	"scheduled_on" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score_pct" integer NOT NULL,
	"passed" boolean NOT NULL,
	"step_before" integer NOT NULL,
	"step_after" integer NOT NULL,
	"next_due_on" date NOT NULL,
	"was_relearn" boolean DEFAULT false NOT NULL,
	"was_early" boolean DEFAULT false NOT NULL,
	"client_id" text,
	CONSTRAINT "review_score" CHECK ("review"."score_pct" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "review_answer" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"question_id" text NOT NULL,
	"answer" text NOT NULL,
	"verdict" text NOT NULL,
	"feedback" text,
	"graded_by" text NOT NULL,
	CONSTRAINT "review_answer_verdict" CHECK ("review_answer"."verdict" in ('correct','partial','incorrect')),
	CONSTRAINT "review_answer_graded_by" CHECK ("review_answer"."graded_by" in ('rule','ai','self'))
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"notes" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"eisenhower" text,
	"size_135" text,
	"planned_for" date,
	"ivy_rank" integer,
	"is_frog_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"estimated_minutes" integer,
	"completed_at" timestamp with time zone,
	"client_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_status" CHECK ("task"."status" in ('todo','doing','done','archived')),
	CONSTRAINT "task_priority" CHECK ("task"."priority" between 1 and 4),
	CONSTRAINT "task_eisenhower" CHECK ("task"."eisenhower" is null or "task"."eisenhower" in ('do','schedule','delegate','delete')),
	CONSTRAINT "task_size_135" CHECK ("task"."size_135" is null or "task"."size_135" in ('big','medium','small')),
	CONSTRAINT "task_ivy_rank" CHECK ("task"."ivy_rank" is null or "task"."ivy_rank" between 1 and 6)
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"week_starts_on" integer DEFAULT 1 NOT NULL,
	"daily_reminder_time" text DEFAULT '08:00' NOT NULL,
	"work_hours" jsonb DEFAULT '{"0":{"start":"08:00","end":"21:00"},"1":{"start":"08:00","end":"21:00"},"2":{"start":"08:00","end":"21:00"},"3":{"start":"08:00","end":"21:00"},"4":{"start":"08:00","end":"21:00"},"5":{"start":"08:00","end":"21:00"},"6":{"start":"08:00","end":"21:00"}}'::jsonb NOT NULL,
	"review_steps" integer[] DEFAULT '{5,10,30}'::integer[] NOT NULL,
	"default_time_technique" text DEFAULT 'pomodoro' NOT NULL,
	"default_learning_method" text DEFAULT 'feynman' NOT NULL,
	"technique_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_presets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sound_settings" jsonb DEFAULT '{"chime":true,"chimeVolume":0.6,"background":"none","backgroundVolume":0.35}'::jsonb NOT NULL,
	"weekly_focus_goal_minutes" integer DEFAULT 600 NOT NULL,
	"email_reviews" boolean DEFAULT true NOT NULL,
	"email_weekly" boolean DEFAULT true NOT NULL,
	"streak_nudge" boolean DEFAULT false NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prefs_week_start" CHECK ("user_preferences"."week_starts_on" between 0 and 6),
	CONSTRAINT "prefs_reminder_time" CHECK ("user_preferences"."daily_reminder_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "prefs_review_steps" CHECK (cardinality("user_preferences"."review_steps") = 3 and "user_preferences"."review_steps"[1] between 1 and 365 and "user_preferences"."review_steps"[1] < "user_preferences"."review_steps"[2] and "user_preferences"."review_steps"[2] < "user_preferences"."review_steps"[3] and "user_preferences"."review_steps"[3] <= 365),
	CONSTRAINT "prefs_weekly_goal" CHECK ("user_preferences"."weekly_focus_goal_minutes" between 0 and 10080)
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_learning_item_id_learning_item_id_fk" FOREIGN KEY ("learning_item_id") REFERENCES "public"."learning_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_draft" ADD CONSTRAINT "learning_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_draft" ADD CONSTRAINT "learning_draft_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_item" ADD CONSTRAINT "learning_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_item" ADD CONSTRAINT "learning_item_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_learning_item_id_learning_item_id_fk" FOREIGN KEY ("learning_item_id") REFERENCES "public"."learning_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_learning_item_id_learning_item_id_fk" FOREIGN KEY ("learning_item_id") REFERENCES "public"."learning_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_answer" ADD CONSTRAINT "review_answer_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_answer" ADD CONSTRAINT "review_answer_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_user_started_idx" ON "focus_session" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "session_user_client_unique" ON "focus_session" USING btree ("user_id","client_id") WHERE "focus_session"."client_id" is not null;--> statement-breakpoint
CREATE INDEX "draft_user_idx" ON "learning_draft" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "card_user_due_idx" ON "learning_item" USING btree ("user_id","due_on") WHERE "learning_item"."status" = 'active';--> statement-breakpoint
CREATE INDEX "card_user_created_idx" ON "learning_item" USING btree ("user_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "card_search_idx" ON "learning_item" USING gin ("search");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_unique" ON "notification_log" USING btree ("user_id","kind","channel","period_key");--> statement-breakpoint
CREATE INDEX "notification_created_idx" ON "notification_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "project_user_idx" ON "project" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_user_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "question_card_idx" ON "question" USING btree ("learning_item_id","position");--> statement-breakpoint
CREATE INDEX "review_user_completed_idx" ON "review" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "review_card_idx" ON "review" USING btree ("learning_item_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_user_client_unique" ON "review" USING btree ("user_id","client_id") WHERE "review"."client_id" is not null;--> statement-breakpoint
CREATE INDEX "review_answer_review_idx" ON "review_answer" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "task_user_status_idx" ON "task" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "task_user_planned_idx" ON "task" USING btree ("user_id","planned_for");--> statement-breakpoint
CREATE UNIQUE INDEX "task_user_client_unique" ON "task" USING btree ("user_id","client_id") WHERE "task"."client_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "task_user_frog_unique" ON "task" USING btree ("user_id","is_frog_on") WHERE "task"."is_frog_on" is not null;