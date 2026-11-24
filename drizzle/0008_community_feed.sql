-- SPDX-License-Identifier: AGPL-3.0-only
CREATE TABLE "community_post" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"group_id" text,
	"body" text NOT NULL,
	"kind" text DEFAULT 'working' NOT NULL,
	"automatic" boolean DEFAULT false NOT NULL,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "community_post_body_check" CHECK (char_length("community_post"."body") between 1 and 280),
	CONSTRAINT "community_post_kind_check" CHECK ("community_post"."kind" in ('working','done'))
);
--> statement-breakpoint
CREATE TABLE "community_reaction" (
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_reaction_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "share_wins_automatically" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "report" ADD COLUMN "post_id" text;--> statement-breakpoint
ALTER TABLE "community_post" ADD CONSTRAINT "community_post_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_post" ADD CONSTRAINT "community_post_group_id_community_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."community"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_post" ADD CONSTRAINT "community_post_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reaction" ADD CONSTRAINT "community_reaction_post_id_community_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reaction" ADD CONSTRAINT "community_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_post_feed_idx" ON "community_post" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "community_post_user_idx" ON "community_post" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "community_post_auto_win_unique" ON "community_post" USING btree ("user_id","session_id") WHERE "community_post"."automatic" = true;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_post_id_community_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_post"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Publish only newly completed, opted-in wins. Both events are handled because
-- the outcome may be submitted before or after the completion worker runs.
CREATE FUNCTION community_share_win(person_id text, focus_id text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE win_body text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('community-post:' || person_id, 0));
  SELECT left(coalesce(nullif(trim(p.goal_text), ''), '✓'), 280) INTO win_body
  FROM session_participant p
  JOIN booking b ON b.id = p.booking_id AND b.status = 'completed'
  JOIN profile u ON u.user_id = p.user_id
  WHERE p.user_id = person_id AND p.session_id = focus_id
    AND p.outcome = 'done' AND p.joined_at IS NOT NULL
    AND u.share_wins_automatically AND u.suspended_at IS NULL;
  IF win_body IS NULL THEN RETURN; END IF;
  IF (SELECT count(*) FROM community_post WHERE user_id = person_id
      AND created_at >= now() - interval '1 hour') >= 10 THEN RETURN; END IF;
  INSERT INTO community_post (id, user_id, body, kind, automatic, session_id)
  VALUES (gen_random_uuid()::text, person_id, win_body, 'done', true, focus_id)
  ON CONFLICT DO NOTHING;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION community_win_from_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.outcome = 'done' AND OLD.outcome IS DISTINCT FROM NEW.outcome THEN
    PERFORM community_share_win(NEW.user_id, NEW.session_id);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER community_win_outcome AFTER UPDATE OF outcome ON session_participant
FOR EACH ROW EXECUTE FUNCTION community_win_from_outcome();
--> statement-breakpoint
CREATE FUNCTION community_win_from_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM community_share_win(NEW.user_id, NEW.session_id);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER community_win_booking AFTER UPDATE OF status ON booking
FOR EACH ROW EXECUTE FUNCTION community_win_from_booking();
