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
  primaryKey,
  real,
  check,
} from "drizzle-orm/pg-core";
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
  subject: text("subject"),
  body: text("body"),
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
// Product tables
// ---------------------------------------------------------------------------

const userRef = (name: string) =>
  text(name)
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const profile = pgTable(
  "profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    locale: text("locale").notNull().default("en"),
    timezone: text("timezone").notNull().default("America/New_York"),
    bio: text("bio").notNull().default(""),
    goal: text("goal").notNull().default(""),
    segments: text("segments")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    referralCode: text("referral_code").notNull(),
    referredBy: text("referred_by").references(() => user.id, {
      onDelete: "set null",
    }),
    birthdateConfirmed: boolean("birthdate_confirmed").notNull().default(false),
    ageConfirmedAt: time("age_confirmed_at"),
    role: text("role").notNull().default("user"),
    isHouse: boolean("is_house").notNull().default(false),
    emailReminders: boolean("email_reminders").notNull().default(true),
    pushReminders: boolean("push_reminders").notNull().default(true),
    microphoneDefault: boolean("microphone_default").notNull().default(true),
    matchSameSegment: boolean("match_same_segment").notNull().default(false),
    statsPublic: boolean("stats_public").notNull().default(true),
    onboardedAt: time("onboarded_at"),
    suspendedAt: time("suspended_at"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profile_username_unique").on(sql`lower(${t.username})`),
    uniqueIndex("profile_referral_code_unique").on(t.referralCode),
    check("profile_role_check", sql`${t.role} in ('user','admin')`),
  ],
);

export const focusSession = pgTable(
  "focus_session",
  {
    id: text("id").primaryKey(),
    startAt: time("start_at").notNull(),
    durationMin: integer("duration_min").notNull(),
    type: text("type").notNull().default("pair"),
    status: text("status").notNull().default("scheduled"),
    hostId: text("host_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title"),
    capacity: integer("capacity").notNull().default(2),
    isFallbackRoom: boolean("is_fallback_room").notNull().default(false),
    videoRoomId: text("video_room_id"),
    startedAt: time("started_at"),
    // Hosts can move the group into focus or wrap-up early.
    focusAt: time("focus_at"),
    wrapAt: time("wrap_at"),
    endedAt: time("ended_at"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("focus_session_start_idx").on(t.startAt),
    index("focus_session_host_idx").on(t.hostId, t.startAt),
    check("focus_session_type_check", sql`${t.type} in ('pair','group')`),
    check(
      "focus_session_status_check",
      sql`${t.status} in ('scheduled','live','ended','cancelled')`,
    ),
    check("focus_session_duration_check", sql`${t.durationMin} in (25,50,75)`),
  ],
);

export const booking = pgTable(
  "booking",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    startAt: time("start_at").notNull(),
    durationMin: integer("duration_min").notNull(),
    status: text("status").notNull().default("booked"),
    kind: text("kind").notNull().default("pair"),
    preferredPartnerId: text("preferred_partner_id").references(() => user.id, {
      onDelete: "set null",
    }),
    sessionId: text("session_id").references(() => focusSession.id, {
      onDelete: "set null",
    }),
    fallbackOfferedAt: time("fallback_offered_at"),
    cancelledAt: time("cancelled_at"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("booking_slot_idx").on(t.startAt, t.durationMin, t.status),
    index("booking_user_idx").on(t.userId, t.startAt),
    uniqueIndex("booking_active_unique")
      .on(t.userId, t.startAt)
      .where(sql`${t.status} in ('booked','matched')`),
    check(
      "booking_status_check",
      sql`${t.status} in ('booked','matched','cancelled','late_cancel','no_show','completed')`,
    ),
    check("booking_kind_check", sql`${t.kind} in ('pair','group')`),
    check("booking_duration_check", sql`${t.durationMin} in (25,50,75)`),
  ],
);

export const sessionParticipant = pgTable(
  "session_participant",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => focusSession.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    bookingId: text("booking_id").references(() => booking.id, {
      onDelete: "set null",
    }),
    goalText: text("goal_text"),
    outcome: text("outcome"),
    joinedAt: time("joined_at"),
    leftAt: time("left_at"),
    videoSessionId: text("video_session_id"),
    tracks: jsonb("tracks").$type<{ audio?: string; video?: string }>(),
    quality: jsonb("quality").$type<Record<string, number | boolean>>(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.userId] }),
    index("participant_user_idx").on(t.userId),
    check(
      "participant_outcome_check",
      sql`${t.outcome} is null or ${t.outcome} in ('done','partial','not_done')`,
    ),
  ],
);

export const favorite = pgTable(
  "favorite",
  {
    userId: userRef("user_id"),
    partnerId: userRef("partner_id"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.partnerId] })],
);

export const block = pgTable(
  "block",
  {
    blockerId: userRef("blocker_id"),
    blockedId: userRef("blocked_id"),
    sessionId: text("session_id").references(() => focusSession.id, {
      onDelete: "set null",
    }),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index("block_blocked_idx").on(t.blockedId),
  ],
);

export const report = pgTable(
  "report",
  {
    id: text("id").primaryKey(),
    reporterId: userRef("reporter_id"),
    targetId: userRef("target_id"),
    sessionId: text("session_id").references(() => focusSession.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: text("status").notNull().default("open"),
    resolvedBy: text("resolved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    resolvedAt: time("resolved_at"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("report_status_idx").on(t.status, t.createdAt),
    index("report_target_idx").on(t.targetId),
    check(
      "report_status_check",
      sql`${t.status} in ('open','actioned','dismissed')`,
    ),
  ],
);

export const matchFailure = pgTable(
  "match_failure",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").references(() => booking.id, {
      onDelete: "set null",
    }),
    userId: userRef("user_id"),
    startAt: time("start_at").notNull(),
    durationMin: integer("duration_min").notNull(),
    resolution: text("resolution"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("match_failure_booking_unique").on(t.bookingId),
    index("match_failure_start_idx").on(t.startAt),
  ],
);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    kind: text("kind").notNull(),
    refId: text("ref_id").notNull(),
    channel: text("channel").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_once").on(t.userId, t.kind, t.refId, t.channel),
  ],
);

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("push_user_idx").on(t.userId)],
);

export const referral = pgTable(
  "referral",
  {
    id: text("id").primaryKey(),
    referrerId: userRef("referrer_id"),
    refereeId: userRef("referee_id"),
    status: text("status").notNull().default("pending"),
    referrerDiscountCode: text("referrer_discount_code"),
    refereeDiscountCode: text("referee_discount_code"),
    convertedAt: time("converted_at"),
    rewardedAt: time("rewarded_at"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("referral_referee_unique").on(t.refereeId),
    index("referral_referrer_idx").on(t.referrerId),
    check(
      "referral_status_check",
      sql`${t.status} in ('pending','converted','rewarded')`,
    ),
  ],
);

export const challenge = pgTable(
  "challenge",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    goalType: text("goal_type").notNull(),
    goalValue: integer("goal_value").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "challenge_goal_type_check",
      sql`${t.goalType} in ('sessions','minutes')`,
    ),
    check("challenge_range_check", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const challengeMember = pgTable(
  "challenge_member",
  {
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenge.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    joinedAt: time("joined_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.challengeId, t.userId] }),
    index("challenge_member_user_idx").on(t.userId),
  ],
);

export const community = pgTable(
  "community",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    kind: text("kind").notNull().default("other"),
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "set null",
    }),
    joinCode: text("join_code").notNull().unique(),
    plusSeats: integer("plus_seats").notNull().default(0),
    licenseUntil: time("license_until"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "community_kind_check",
      sql`${t.kind} in ('university','bootcamp','company','other')`,
    ),
  ],
);

export const communityMember = pgTable(
  "community_member",
  {
    communityId: text("community_id")
      .notNull()
      .references(() => community.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    role: text("role").notNull().default("member"),
    joinedAt: time("joined_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.userId] }),
    index("community_member_user_idx").on(t.userId),
    check(
      "community_member_role_check",
      sql`${t.role} in ('owner','admin','member')`,
    ),
  ],
);

export const host = pgTable(
  "host",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("applied"),
    pitch: text("pitch").notNull().default(""),
    audienceUrl: text("audience_url"),
    rating: real("rating"),
    ratingsCount: integer("ratings_count").notNull().default(0),
    sessionsHosted: integer("sessions_hosted").notNull().default(0),
    perkUntil: time("perk_until"),
    appliedAt: time("applied_at").notNull().defaultNow(),
    decidedAt: time("decided_at"),
  },
  (t) => [
    check(
      "host_status_check",
      sql`${t.status} in ('applied','approved','rejected','suspended')`,
    ),
  ],
);

export const hostRating = pgTable(
  "host_rating",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => focusSession.id, { onDelete: "cascade" }),
    raterId: userRef("rater_id"),
    hostId: userRef("host_id"),
    score: integer("score").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.raterId] }),
    index("host_rating_host_idx").on(t.hostId),
    check("host_rating_score_check", sql`${t.score} between 1 and 5`),
  ],
);
