import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  index,
  uniqueIndex,
  jsonb,
  date,
  primaryKey,
  check,
  customType,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  defaultSoundSettings,
  defaultWorkHours,
  type CustomPreset,
  type DraftQuestion,
  type ExplanationAnalysis,
  type LearningNotes,
  type SoundSettings,
  type TechniqueSettings,
  type WorkHours,
} from "./json-types";
const time = (name: string) => timestamp(name, { withTimezone: true });
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  analyticsConsent: boolean("analytics_consent").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: time("expires_at").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: time("access_token_expires_at"),
    refreshTokenExpiresAt: time("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("account_user_idx").on(t.userId),
    uniqueIndex("account_provider_unique").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: time("expires_at").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
export const billingCustomer = pgTable("billing_customer", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  customerId: text("customer_id").unique(),
  syncedAt: time("synced_at"),
});
export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    status: text("status").notNull(),
    periodEnd: time("period_end").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  },
  (t) => [index("subscription_user_idx").on(t.userId)],
);
export const entitlement = pgTable("entitlement", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  pro: boolean("pro").notNull().default(false),
  validUntil: time("valid_until").notNull(),
  source: text("source").notNull(),
});
export const processedEvent = pgTable("processed_event", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: time("processed_at").notNull().defaultNow(),
});
export const emailPreview = pgTable("email_preview", {
  id: text("id").primaryKey(),
  recipient: text("recipient").notNull(),
  kind: text("kind").notNull(),
  url: text("url").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const analyticsOutbox = pgTable(
  "analytics_outbox",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    sentAt: time("sent_at"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("outbox_pending_idx").on(t.userId, t.sentAt)],
);

// ---------------------------------------------------------------------------
// FocusKept product tables. Every row is owned by a user and cascades on
// account deletion. Dates that mean "a day in the user's timezone" are `date`.
// ---------------------------------------------------------------------------
const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});
const day = (name: string) => date(name, { mode: "string" });
const userRef = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
const stamps = {
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
};

export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    locale: text("locale").notNull().default("en"),
    timezone: text("timezone").notNull().default("UTC"),
    weekStartsOn: integer("week_starts_on").notNull().default(1),
    dailyReminderTime: text("daily_reminder_time").notNull().default("08:00"),
    workHours: jsonb("work_hours")
      .$type<WorkHours>()
      .notNull()
      .default(defaultWorkHours),
    reviewSteps: integer("review_steps")
      .array()
      .notNull()
      .default(sql`'{5,10,30}'::integer[]`),
    defaultTimeTechnique: text("default_time_technique")
      .notNull()
      .default("pomodoro"),
    defaultLearningMethod: text("default_learning_method")
      .notNull()
      .default("feynman"),
    techniqueSettings: jsonb("technique_settings")
      .$type<TechniqueSettings>()
      .notNull()
      .default({}),
    customPresets: jsonb("custom_presets")
      .$type<CustomPreset[]>()
      .notNull()
      .default([]),
    soundSettings: jsonb("sound_settings")
      .$type<SoundSettings>()
      .notNull()
      .default(defaultSoundSettings),
    weeklyFocusGoalMinutes: integer("weekly_focus_goal_minutes")
      .notNull()
      .default(600),
    emailReviews: boolean("email_reviews").notNull().default(true),
    emailWeekly: boolean("email_weekly").notNull().default(true),
    streakNudge: boolean("streak_nudge").notNull().default(false),
    onboardedAt: time("onboarded_at"),
    ...stamps,
  },
  (t) => [
    check("prefs_week_start", sql`${t.weekStartsOn} between 0 and 6`),
    check(
      "prefs_reminder_time",
      sql`${t.dailyReminderTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
    check(
      "prefs_review_steps",
      sql`cardinality(${t.reviewSteps}) = 3 and ${t.reviewSteps}[1] between 1 and 365 and ${t.reviewSteps}[1] < ${t.reviewSteps}[2] and ${t.reviewSteps}[2] < ${t.reviewSteps}[3] and ${t.reviewSteps}[3] <= 365`,
    ),
    check(
      "prefs_weekly_goal",
      sql`${t.weeklyFocusGoalMinutes} between 0 and 10080`,
    ),
  ],
);

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    userId: userRef(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#2F6F62"),
    archivedAt: time("archived_at"),
    ...stamps,
  },
  (t) => [index("project_user_idx").on(t.userId)],
);

/** What a Learning session is about (e.g. "Biology"); cards are reviewed per subject. */
export const subject = pgTable(
  "subject",
  {
    id: text("id").primaryKey(),
    userId: userRef(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#5FC3A8"),
    archivedAt: time("archived_at"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("subject_user_name_unique").on(t.userId, sql`lower(${t.name})`),
  ],
);

export const task = pgTable(
  "task",
  {
    id: text("id").primaryKey(),
    userId: userRef(),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    notes: text("notes"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text("status")
      .$type<"todo" | "doing" | "done" | "archived">()
      .notNull()
      .default("todo"),
    priority: integer("priority").notNull().default(3),
    eisenhower: text("eisenhower").$type<
      "do" | "schedule" | "delegate" | "delete"
    >(),
    size135: text("size_135").$type<"big" | "medium" | "small">(),
    plannedFor: day("planned_for"),
    ivyRank: integer("ivy_rank"),
    isFrogOn: day("is_frog_on"),
    sortOrder: integer("sort_order").notNull().default(0),
    estimatedMinutes: integer("estimated_minutes"),
    completedAt: time("completed_at"),
    clientId: text("client_id"),
    ...stamps,
  },
  (t) => [
    index("task_user_status_idx").on(t.userId, t.status),
    index("task_user_planned_idx").on(t.userId, t.plannedFor),
    uniqueIndex("task_user_client_unique")
      .on(t.userId, t.clientId)
      .where(sql`${t.clientId} is not null`),
    uniqueIndex("task_user_frog_unique")
      .on(t.userId, t.isFrogOn)
      .where(sql`${t.isFrogOn} is not null`),
    check(
      "task_status",
      sql`${t.status} in ('todo','doing','done','archived')`,
    ),
    check("task_priority", sql`${t.priority} between 1 and 4`),
    check(
      "task_eisenhower",
      sql`${t.eisenhower} is null or ${t.eisenhower} in ('do','schedule','delegate','delete')`,
    ),
    check(
      "task_size_135",
      sql`${t.size135} is null or ${t.size135} in ('big','medium','small')`,
    ),
    check(
      "task_ivy_rank",
      sql`${t.ivyRank} is null or ${t.ivyRank} between 1 and 6`,
    ),
  ],
);

export const focusSession = pgTable(
  "focus_session",
  {
    id: text("id").primaryKey(),
    userId: userRef(),
    mode: text("mode").$type<"work" | "learning">().notNull(),
    timeTechnique: text("time_technique").notNull(),
    learningMethod: text("learning_method"),
    planningTechnique: text("planning_technique"),
    taskId: text("task_id").references(() => task.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    subjectId: text("subject_id").references(() => subject.id, {
      onDelete: "set null",
    }),
    learningItemId: text("learning_item_id").references(
      (): AnyPgColumn => learningItem.id,
      { onDelete: "set null" },
    ),
    goal: text("goal").notNull().default(""),
    startedAt: time("started_at").notNull(),
    endedAt: time("ended_at").notNull(),
    focusedSeconds: integer("focused_seconds").notNull().default(0),
    breakSeconds: integer("break_seconds").notNull().default(0),
    cyclesCompleted: integer("cycles_completed").notNull().default(0),
    interruptions: integer("interruptions").notNull().default(0),
    overrunSeconds: integer("overrun_seconds").notNull().default(0),
    focusRating: integer("focus_rating"),
    note: text("note"),
    completed: boolean("completed").notNull().default(false),
    clientId: text("client_id"),
    ...stamps,
  },
  (t) => [
    index("session_user_started_idx").on(t.userId, t.startedAt.desc()),
    uniqueIndex("session_user_client_unique")
      .on(t.userId, t.clientId)
      .where(sql`${t.clientId} is not null`),
    check("session_mode", sql`${t.mode} in ('work','learning')`),
    check(
      "session_rating",
      sql`${t.focusRating} is null or ${t.focusRating} between 1 and 5`,
    ),
    check(
      "session_seconds",
      sql`${t.focusedSeconds} >= 0 and ${t.breakSeconds} >= 0 and ${t.overrunSeconds} >= 0`,
    ),
  ],
);

export const learningItem = pgTable(
  "learning_item",
  {
    id: text("id").primaryKey(),
    userId: userRef(),
    sessionId: text("session_id").references(() => focusSession.id, {
      onDelete: "set null",
    }),
    topic: text("topic").notNull(),
    subjectId: text("subject_id").references(() => subject.id, {
      onDelete: "set null",
    }),
    sourceUrl: text("source_url"),
    learningMethod: text("learning_method").notNull(),
    explanation: text("explanation").notNull(),
    analysis: jsonb("analysis").$type<ExplanationAnalysis>(),
    language: text("language"),
    promptVersion: text("prompt_version"),
    status: text("status")
      .$type<"active" | "archived">()
      .notNull()
      .default("active"),
    currentStep: integer("current_step").notNull().default(0),
    intervalDays: integer("interval_days").notNull(),
    dueOn: day("due_on").notNull(),
    relearn: boolean("relearn").notNull().default(false),
    lastReviewedAt: time("last_reviewed_at"),
    reviewCount: integer("review_count").notNull().default(0),
    lapseCount: integer("lapse_count").notNull().default(0),
    search: tsvector("search").generatedAlwaysAs(
      sql`to_tsvector('simple'::regconfig, coalesce(topic, '') || ' ' || coalesce(explanation, ''))`,
    ),
    ...stamps,
  },
  (t) => [
    index("card_user_due_idx")
      .on(t.userId, t.dueOn)
      .where(sql`${t.status} = 'active'`),
    index("card_user_created_idx").on(t.userId, t.createdAt.desc(), t.id),
    index("card_user_subject_idx").on(t.userId, t.subjectId),
    index("card_search_idx").using("gin", t.search),
    check("card_status", sql`${t.status} in ('active','archived')`),
    check("card_step", sql`${t.currentStep} >= 0`),
  ],
);

export const question = pgTable(
  "question",
  {
    id: text("id").primaryKey(),
    learningItemId: text("learning_item_id")
      .notNull()
      .references(() => learningItem.id, { onDelete: "cascade" }),
    type: text("type").$type<"open" | "true_false" | "cloze">().notNull(),
    prompt: text("prompt").notNull(),
    answer: text("answer").notNull(),
    explanation: text("explanation"),
    position: integer("position").notNull().default(0),
    source: text("source")
      .$type<"ai" | "user" | "ai_edited">()
      .notNull()
      .default("user"),
    ...stamps,
  },
  (t) => [
    index("question_card_idx").on(t.learningItemId, t.position),
    check("question_type", sql`${t.type} in ('open','true_false','cloze')`),
    check("question_source", sql`${t.source} in ('ai','user','ai_edited')`),
  ],
);

export const review = pgTable(
  "review",
  {
    id: text("id").primaryKey(),
    learningItemId: text("learning_item_id")
      .notNull()
      .references(() => learningItem.id, { onDelete: "cascade" }),
    userId: userRef(),
    scheduledOn: day("scheduled_on").notNull(),
    completedAt: time("completed_at").notNull().defaultNow(),
    scorePct: integer("score_pct").notNull(),
    passed: boolean("passed").notNull(),
    stepBefore: integer("step_before").notNull(),
    stepAfter: integer("step_after").notNull(),
    nextDueOn: day("next_due_on").notNull(),
    wasRelearn: boolean("was_relearn").notNull().default(false),
    wasEarly: boolean("was_early").notNull().default(false),
    clientId: text("client_id"),
  },
  (t) => [
    index("review_user_completed_idx").on(t.userId, t.completedAt),
    index("review_card_idx").on(t.learningItemId, t.completedAt),
    uniqueIndex("review_user_client_unique")
      .on(t.userId, t.clientId)
      .where(sql`${t.clientId} is not null`),
    check("review_score", sql`${t.scorePct} between 0 and 100`),
  ],
);

export const reviewAnswer = pgTable(
  "review_answer",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => review.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => question.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    verdict: text("verdict")
      .$type<"correct" | "partial" | "incorrect">()
      .notNull(),
    feedback: text("feedback"),
    gradedBy: text("graded_by").$type<"rule" | "ai" | "self">().notNull(),
  },
  (t) => [
    index("review_answer_review_idx").on(t.reviewId),
    check(
      "review_answer_verdict",
      sql`${t.verdict} in ('correct','partial','incorrect')`,
    ),
    check(
      "review_answer_graded_by",
      sql`${t.gradedBy} in ('rule','ai','self')`,
    ),
  ],
);

/** A Learning session in progress: topic, notes, explanation and AI output
 * until the user saves it as a card. */
export const learningDraft = pgTable(
  "learning_draft",
  {
    id: text("id").primaryKey(),
    userId: userRef(),
    sessionId: text("session_id")
      .notNull()
      .unique()
      .references(() => focusSession.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    subjectId: text("subject_id").references(() => subject.id, {
      onDelete: "set null",
    }),
    sourceUrl: text("source_url"),
    learningMethod: text("learning_method").notNull(),
    notes: jsonb("notes").$type<LearningNotes>().notNull().default({}),
    explanation: text("explanation"),
    analysis: jsonb("analysis").$type<ExplanationAnalysis>(),
    questions: jsonb("questions").$type<DraftQuestion[]>(),
    language: text("language"),
    promptVersion: text("prompt_version"),
    analysisCount: integer("analysis_count").notNull().default(0),
    aiCounted: boolean("ai_counted").notNull().default(false),
    ...stamps,
  },
  (t) => [index("draft_user_idx").on(t.userId)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: userRef(),
    /** Calendar month in the user's timezone, YYYY-MM. */
    period: text("period").notNull(),
    cardsAnalyzed: integer("cards_analyzed").notNull().default(0),
    answersGraded: integer("answers_graded").notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    outputTokens: bigint("output_tokens", { mode: "number" })
      .notNull()
      .default(0),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.period] })],
);

/** Global AI token usage per UTC day, for the daily kill switch. */
export const aiDailyUsage = pgTable("ai_daily_usage", {
  day: day("day").primaryKey(),
  inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
  outputTokens: bigint("output_tokens", { mode: "number" })
    .notNull()
    .default(0),
  freeDisabledAt: time("free_disabled_at"),
  allDisabledAt: time("all_disabled_at"),
});

export const notificationLog = pgTable(
  "notification_log",
  {
    id: text("id").primaryKey(),
    userId: userRef(),
    kind: text("kind").notNull(),
    channel: text("channel").$type<"email" | "push">().notNull(),
    periodKey: text("period_key").notNull(),
    status: text("status")
      .$type<"pending" | "sent" | "failed" | "skipped">()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    sentAt: time("sent_at"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("notification_unique").on(
      t.userId,
      t.kind,
      t.channel,
      t.periodKey,
    ),
    index("notification_created_idx").on(t.createdAt),
    check("notification_channel", sql`${t.channel} in ('email','push')`),
    check(
      "notification_status",
      sql`${t.status} in ('pending','sent','failed','skipped')`,
    ),
  ],
);

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: text("id").primaryKey(),
    userId: userRef(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: time("created_at").notNull().defaultNow(),
    lastSuccessAt: time("last_success_at"),
  },
  (t) => [index("push_user_idx").on(t.userId)],
);
