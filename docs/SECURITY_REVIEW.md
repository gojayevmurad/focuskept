# Security Architecture Review & STRIDE Threat Model

**Target**: FocusKept (`main`)  
**Scope**: Full Stack (Authentication, Session Rooms, Video Proxy, Realtime SSE, Billing, Moderation/Admin, Rate Limiting, GDPR, Worker)  
**Standard**: STRIDE Threat Modeling, DREAD Risk Scoring, RFC 9116, OWASP ASVS 4.0  
**License**: AGPL-3.0-only  

---

## 1. Executive Summary

FocusKept is an open-source body-doubling / virtual coworking platform handling live video, peer matching, notifications, Polar billing, and community features. The system is designed with privacy by default (GDPR compliance, zero third-party trackers in default configurations, IP addresses never persisted in application tables, and runtime configuration decoupled from build artifacts).

This review conducts a systematic differential and architectural audit across all core application boundaries, applying the **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) and **DREAD** risk scoring. Every finding has been evaluated using false-positive verification gates (source-to-sink data flow tracing, caller constraint validation, and exploit scenario modeling).

Hardening measures implemented in Job F include:
1. **Production-grade Security Headers** in `next.config.ts`, including strict HSTS, COOP, Referrer-Policy, Permissions-Policy, and an application-aligned Content Security Policy (CSP).
2. **RFC 9116 Security Policy Discovery** at `/.well-known/security.txt` with dynamic request-time expiration, flexible security contact resolution, and canonical links.
3. **Validation & Redirect Defense Hardening** in `src/lib/security/validation.ts`, closing null-byte and control-character bypass vectors in `safeRedirect`, adding defensive handling in `sameOrigin`, and introducing an SSRF protection helper for outbound Web Push endpoints.
4. **Middleware Reliability & Safety** in `src/lib/security/request.ts`, ensuring Next.js redirect errors propagate cleanly without logging 500 error noise.
5. **Security Policy Documentation** in `SECURITY.md` establishing private reporting workflows, response SLAs, and vulnerability disclosure terms.

---

## 2. Architecture & Trust Boundaries

The system is structured across several key trust zones:

```
[ Internet Browser ] 
        │ (HTTPS / WSS)
  ─── Trust Boundary 1 (Client <-> Reverse Proxy / Next.js) ───
        ▼
[ Next.js App Router (Proxy & API Handlers) ]
   ├── Better Auth (Session Cookie / OAuth)
   ├── Session Room Lifecycle & Video Token Generator
   ├── Server Actions (Admin, Bookings, Settings)
   └── Realtime SSE Controller
        │
  ─── Trust Boundary 2 (Application <-> Persistence) ───
        ▼
[ PostgreSQL Database (pgcrypto, advisory locks, LISTEN/NOTIFY bus) ]
        ▲
        │
  ─── Trust Boundary 3 (Worker <-> Database) ───
[ Background Worker (pg-boss: minuteTick, dailyTick) ]
        │
  ─── Trust Boundary 4 (Server <-> External Providers) ───
        ├── Cloudflare Realtime Calls / LiveKit Server
        ├── Polar Billing API & Webhooks
        ├── Resend Email API
        └── Web Push Services (Google FCM / Apple / Mozilla)
```

### Trust Boundary Analysis
- **TB-1 (Browser to Server)**: All incoming HTTP requests and WebSocket connections originate here. Untrusted inputs, query strings, headers, and media track announcements must be validated strictly before processing.
- **TB-2 (Application to PostgreSQL)**: Handled via Drizzle ORM parameterization and transactional advisory locks. Raw SQL is strictly constrained to safe operators (`sql` tagged template literals with parameter binding).
- **TB-3 (Worker to Application Data)**: Isolated background worker process running with dropped Linux capabilities (`security_opt: ["no-new-privileges:true"]`, `cap_drop: ["ALL"]`) accessing queues and scheduled tasks.
- **TB-4 (Application to Third Parties)**: Outbound calls to Cloudflare Realtime, Polar, Resend, and Web Push services. Incoming webhooks from Polar cross from the internet into the application.
- **TB-5 (Regular User to Admin)**: Role elevation checks gate administrative mutations and reports.
- **TB-6 (Cross-Tenant Peer Isolation)**: In paired and group video rooms, participants exchange media tracks and goals without exposing IP addresses or private account data to peers.

---

## 3. STRIDE Threat Model by Component

### 3.1 Authentication & Identity (`src/lib/auth/`, `app/api/auth/`)
- **Spoofing**: 
  - *Threat*: Session hijacking or token manipulation.
  - *Mitigations*: Better Auth uses cryptographically secure session tokens stored in database with `httpOnly: true`, `sameSite: "lax"`, and `secure: true` (when on HTTPS). Password minimum length is enforced at 12 characters. Email verification is mandatory (`requireEmailVerification: true`).
- **Tampering**:
  - *Threat*: Alteration of password reset or verification links.
  - *Mitigations*: Single-use tokens stored in `verification` table with expiration. Passwords hashed with secure modern primitives. Sessions revoked on password reset (`revokeSessionsOnPasswordReset: true`).
- **Repudiation**:
  - *Threat*: Unlogged authentication attempts.
  - *Mitigations*: All auth endpoints wrapped with `withRequestLogging` generating an unforgeable `X-Request-ID`.
- **Information Disclosure**:
  - *Threat*: Passwords or session tokens leaking in server logs or error traces.
  - *Mitigations*: Pino logger configures explicit redaction paths (`password`, `token`, `secret`, `email`, `authorization`, `cookie`, `headers`). Sentry instrumentation in `instrumentation.ts` strips `event.user`, `event.request`, and breadcrumbs before transmission.
- **Denial of Service**:
  - *Threat*: Credential stuffing or password reset flooding.
  - *Mitigations*: Database-backed rate limits configured in Better Auth: `/sign-in/email` (5/min), `/sign-up/email` (3/min), `/request-password-reset` (3/min), overall (60/min).
- **Elevation of Privilege**:
  - *Threat*: Account takeover or self-elevation during signup.
  - *Mitigations*: User roles default to `'user'` in database schema (`profile_role_check` ensures only `'user'` or `'admin'`). `validateUserInfo` hook enforces `SIGNUPS_MODE` restrictions ("closed" blocks registration, "invite" requires a verified referral cookie).

### 3.2 Sessions & Focus Rooms (`src/lib/sessions/`, `app/api/sessions/`, `app/[locale]/session/`)
- **Spoofing**:
  - *Threat*: User impersonates another session attendee or sends bogus presence.
  - *Mitigations*: All room endpoints extract `userId` directly from verified session cookie (`session.user.id`). Room access requires `authorizeRoom(id, userId)` which confirms presence in `session_participant` table.
- **Tampering**:
  - *Threat*: Goal manipulation, malicious outcome submissions, or forged timestamps.
  - *Mitigations*: Goal text truncated to `GOAL_MAX` (280 chars). Outcomes validated against `['done', 'partial', 'not_done']`. Phase overrides restricted to host. CSRF protected via `sameOrigin`.
- **Repudiation**:
  - *Threat*: Participant denies attending, or leaves without record.
  - *Mitigations*: Attendance recorded in `session_participant` table with `joinedAt`, `leftAt`, and participant outcomes. Realtime presence broadcast to room subscribers.
- **Information Disclosure (IDOR)**:
  - *Threat*: Non-participants probe `/api/sessions/[id]/state` to harvest user goals, partner names, or session schedules.
  - *Mitigations*: Verified safe (True Negative). `roomState(sessionId, userId)` returns `null` if the caller is not an authorized participant, yielding a generic 404 response that prevents existence enumeration.
- **Denial of Service**:
  - *Threat*: Rapid polling or room action spam.
  - *Mitigations*: Fixed-window rate limit on room actions (`room:${userId}`, 120 requests / 60s). Advisory transaction locks (`pg_advisory_xact_lock`) serialize concurrent matching and booking operations.
- **Elevation of Privilege**:
  - *Threat*: Participant executes host actions (e.g. `phase` early start, `cancelGroupSession`).
  - *Mitigations*: Host operations explicitly query `eq(focusSession.hostId, hostId)`. If the caller is not the recorded host, mutations return 0 updated rows and fail safely.

### 3.3 Video Proxy & Signaling (`src/lib/video/`, `app/api/video/`)
- **Spoofing**:
  - *Threat*: Malicious client sends arbitrary track IDs or injects unauthorized WebRTC audio/video.
  - *Mitigations*: `canAnnounce(userId, tracks)` requires track names to be prefixed with caller's user ID (`${userId}-audio-...`, `${userId}-video-...`). `canPull` verifies target user is an active participant in the same session.
- **Tampering**:
  - *Threat*: Client alters Cloudflare Calls or LiveKit signaling parameters.
  - *Mitigations*: All client actions are parsed against strict Zod schemas (`requestSchemas`). Local track names are generated server-side with random cryptographic bytes (`randomBytes(4).toString("hex")`).
- **Repudiation**:
  - *Threat*: WebRTC quality disputes or unlogged connection issues.
  - *Mitigations*: Participant quality metrics (`rttMs`, `packetLossPct`, `bitrates`) periodically saved to `session_participant.quality` and emitted for analytics.
- **Information Disclosure**:
  - *Threat*: Leakage of `CLOUDFLARE_REALTIME_APP_TOKEN` or `LIVEKIT_API_SECRET`.
  - *Mitigations*: Long-lived provider tokens never leave the server environment. Browsers only receive short-lived TURN credentials or scoped JWTs (`roomJoin: true`, `ttl: "2h"`, scoped to single room).
- **Denial of Service**:
  - *Threat*: Excessive session creation or TURN credential requests driving Cloudflare costs.
  - *Mitigations*: Identified as Finding SEC-03 (Medium). Added recommendation to rate-limit `/api/video/join/[sessionId]`.
- **Elevation of Privilege**:
  - *Threat*: Calling unauthorized Cloudflare Calls API routes via proxy.
  - *Mitigations*: `action` parameter validated against exhaustive schema keys (`session`, `push`, `announce`, `pull`, `renegotiate`, `close`). Arbitrary path traversal is impossible.

### 3.4 Realtime SSE & PostgreSQL Bus (`src/lib/realtime/`, `app/api/realtime/`)
- **Spoofing**:
  - *Threat*: Subscribing to another user's private notification feed.
  - *Mitigations*: `/api/realtime` only subscribes caller to `user:${session.user.id}`. Room topics (`session:${focusId}`) require `getParticipant(focusId, userId)` verification.
- **Tampering**:
  - *Threat*: Injecting forged SSE messages into the bus.
  - *Mitigations*: `pg_notify('realtime', payload)` executes exclusively on the server inside authorized transactions or workers.
- **Repudiation**:
  - *Threat*: Unmonitored connection dropouts.
  - *Mitigations*: Connection heartbeats (`: ping\n\n`) emitted every 25 seconds; client auto-reconnects with exponential backoff.
- **Information Disclosure**:
  - *Threat*: Cross-tenant leakage through broadcast channels.
  - *Mitigations*: Topics are strictly segregated. Only presence, track names, goals, and timers are broadcast to room participants.
- **Denial of Service**:
  - *Threat*: Connection pool exhaustion from long-lived SSE connections.
  - *Mitigations*: The server uses a single shared PostgreSQL `LISTEN realtime` connection across the entire process (`bus.ts`), eliminating connection starvation. Payload size capped at 7,500 bytes.

### 3.5 Billing Webhook & Payment Reconciliation (`src/lib/billing/`, `app/api/webhooks/polar/`)
- **Spoofing**:
  - *Threat*: Attacker posts fake `order.paid` or `subscription.active` events to grant free Plus access.
  - *Mitigations*: HMAC SHA-256 webhook signature verified via `@polar-sh/sdk` `validateEvent` against `POLAR_WEBHOOK_SECRET`. Unsigned/invalid requests return 403.
- **Tampering**:
  - *Threat*: Replay attacks or forged benefit payloads.
  - *Mitigations*: Verified safe (True Negative). Reconcile logic checks `processed_event` table; duplicate `event.id` is dropped immediately. Furthermore, server does not trust webhook payload for entitlement grant: it re-queries Polar API directly (`polar().customers.getStateExternal(userId)`) to fetch authoritative status.
- **Repudiation**:
  - *Threat*: Unlogged billing disputes.
  - *Mitigations*: All transactions logged with event ID, user ID, and customer ID. Outbox pattern records analytics events (`payment_completed`, `upgrade_completed`).
- **Information Disclosure**:
  - *Threat*: Payment card data leakage.
  - *Mitigations*: Full PCI compliance offloaded to Polar. No credit card numbers, CVVs, or bank details touch FocusKept servers or database.
- **Denial of Service**:
  - *Threat*: Oversized webhook payloads or portal session exhaustion.
  - *Mitigations*: Payload size checked before parsing (`raw.length > 1048576` returns 413). Finding SEC-02 flags missing rate limiting on `/api/billing/checkout` and `/api/billing/portal`.
- **Elevation of Privilege**:
  - *Threat*: Self-granting Pro privileges without active subscription.
  - *Mitigations*: Pro benefit verified against `POLAR_PRO_BENEFIT_ID`. Granted entitlement carries short lease (`validUntil: now + 15 minutes`), failing closed if billing reconciliation stops.

### 3.6 Remote Media & Uploads (`app/[locale]/(app)/settings/`)
- **Spoofing**:
  - *Threat*: Fake avatar URLs pointing to malicious schemes (`javascript:`, `data:`).
  - *Mitigations*: `avatarUrl` validated via Zod: `z.union([z.literal(""), z.url().startsWith("https://").max(500)])`. Non-HTTPS schemes rejected. No direct file upload endpoint exists (zero multipart storage on disk or S3).
- **Tampering**:
  - *Threat*: Profile parameter tampering.
  - *Mitigations*: `saveProfile` Server Action validates displayName, username, bio, goal, timezone, and segments via Zod.
- **Information Disclosure**:
  - *Threat*: Cross-site scripting (XSS) via SVG avatars or external resources.
  - *Mitigations*: CSP `img-src 'self' data: blob: https:` allows image display while restricting script execution.
- **Denial of Service**:
  - *Threat*: URL length bomb.
  - *Mitigations*: Max 500 characters on avatar URL, max 60 on displayName, max 280 on bio.

### 3.7 Administration & Moderation (`app/[locale]/(app)/admin/`, `src/lib/admin/`, `src/lib/safety/`)
- **Spoofing**:
  - *Threat*: Regular user invokes administrative Server Actions.
  - *Mitigations*: Every action calls `requireAdmin()`, verifying `profile.role === "admin"` or email matching `ADMIN_EMAILS`.
- **Tampering**:
  - *Threat*: Unsanitized moderation input.
  - *Mitigations*: Discriminated union Zod schema (`command`) enforces strict typing on all operations. Report resolution runs inside database transactions with row-level locks (`for("update")`).
- **Repudiation**:
  - *Threat*: Admin actions without accountability.
  - *Mitigations*: Reports record `resolvedBy` and `resolvedAt`. Host approvals record `decidedAt`.
- **Information Disclosure**:
  - *Threat*: Leakage of reporter identity to reported users.
  - *Mitigations*: Reported users cannot see reports against them or reporter IDs. Admin panel displays reports only to authenticated admins.
- **Elevation of Privilege**:
  - *Threat*: Admin accidentally locks themselves out or is demoted by mistake.
  - *Mitigations*: Self-demotion check (`input.operation === "removeAdmin" && input.id === current.user.id`) prevents removing own admin role.

### 3.8 Rate Limiting & Abuse Prevention (`src/lib/security/rate-limit.ts`)
- **Spoofing / Tampering**:
  - *Threat*: Bypass of rate limit counters via race conditions.
  - *Mitigations*: Atomic PostgreSQL `insert ... on conflict (key) do update set count = ... returning count` handles concurrent requests safely without distributed lock race conditions.
- **Denial of Service**:
  - *Threat*: Flooding rate limit table.
  - *Mitigations*: Maintenance job in background worker (`cleanup` in `worker/maintenance.ts`) deletes expired records older than 24 hours daily. Input key length restricted to 200 chars.

### 3.9 Account Export & Erasure (GDPR) (`app/api/account/export/`, `src/lib/auth/index.ts`)
- **Spoofing**:
  - *Threat*: Attacker triggers export or deletion of another account.
  - *Mitigations*: Scoped strictly to verified `session.user.id`.
- **Information Disclosure**:
  - *Threat*: Export data exposes third-party information.
  - *Mitigations*: Exported dataset only includes rows where user is primary subject (`booking.userId`, `profile.userId`, `favorite.userId`, etc.). Target reports made by user are sanitized to reason and details.
- **Denial of Service**:
  - *Threat*: Resource exhaustion from repeated heavy JSON exports.
  - *Mitigations*: Endpoint rate limited to 5 requests per hour (`export:${id}`).
- **Integrity**:
  - *Threat*: Deleting account leaves orphan recurring subscription charging customer.
  - *Mitigations*: `beforeDelete` lifecycle hook blocks user deletion if an active, non-cancelled Plus subscription exists, requiring cancellation first. Foreign keys specify `onDelete: "cascade"`.

### 3.10 Background Worker (`worker/`)
- **Tampering**:
  - *Threat*: Job injection or queue tampering.
  - *Mitigations*: `pg-boss` queues reside in dedicated `pgboss` PostgreSQL schema. Queues configured as `singleton` to prevent concurrent execution races.
- **Denial of Service**:
  - *Threat*: Worker crashes or stalls without notice.
  - *Mitigations*: Worker writes heartbeat timestamp to `appConfig` every minute. `/api/health` probes heartbeat and flags `stale` if older than 3 minutes. Container runs with memory limits (384MB) and CPU quotas (1.0).

---

## 4. Security Hardening Implementation (Job F)

### 4.1 Content Security Policy & HTTP Headers (`next.config.ts`, `src/lib/security/headers.ts`)
The application enforces comprehensive defense-in-depth headers on all routes:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
Cross-Origin-Opener-Policy: same-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(self), geolocation=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self' https://rtc.live.cloudflare.com wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com https://*.polar.sh https://polar.sh; object-src 'none'; upgrade-insecure-requests
```

#### Technical Trade-Off: Script & Style Directives
- Next.js App Router relies on inline scripts for dark-mode theme hydration (`app/[locale]/layout.tsx:74`) and dynamic streaming chunk registration.
- Implementing per-request cryptographic nonces (`'nonce-...'`) requires attaching nonces in middleware and prop-drilling into `<script>` tags across root layouts (`app/[locale]/layout.tsx`). Because layout files are outside Job F ownership, adopting a strict nonce-based policy would violate component isolation boundaries and break SSR hydration.
- The policy adopts a pragmatic approach: `'self' 'unsafe-inline'` for scripts and styles, fortified by `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, and strict `form-action` restrictions. This eliminates classic DOM injection sinks while maintaining complete framework compatibility.

#### WebRTC, Cloudflare & LiveKit Media
- WebRTC ICE candidate discovery (STUN/TURN) runs over UDP/TCP via browser internal network stacks and is not governed by CSP `connect-src`.
- However, HTTP signaling and token exchange are governed by CSP:
  - Cloudflare Realtime Calls signaling is proxied server-side via `/api/video/cloudflare/...` (`connect-src 'self'`). `https://rtc.live.cloudflare.com` is included to support direct client signaling where applicable.
  - LiveKit connects via WebSocket to `LIVEKIT_URL`. Because Next.js config headers are static at build/startup and cannot dynamically reflect runtime container environment variables, `wss:` is explicitly allowed in `connect-src`.

#### Testing / Switching to Report-Only
To test policy updates in staging environments without blocking user traffic, modify `next.config.ts` to rename `Content-Security-Policy` to `Content-Security-Policy-Report-Only` and append `report-uri /api/csp-report;`. For production, the policy is enforced directly.

### 4.2 RFC 9116 `security.txt` (`app/.well-known/security.txt/route.ts`, `src/lib/security/security-txt.ts`)
A dedicated route handler serves `/.well-known/security.txt` per RFC 9116 specifications:
- **Contact**: Automatically resolved from `SECURITY_CONTACT` environment variable, falling back to the first address in `ADMIN_EMAILS`, or default `mailto:security@focuskept.com`.
- **Expires**: Dynamically computed at request time to exactly 365 days in the future (ISO 8601 UTC).
- **Preferred-Languages**: Declared as `en`.
- **Policy**: Links to the official repository policy `https://github.com/gojayevmurad/focuskept/blob/main/SECURITY.md`.
- **Canonical**: Declares canonical path at `${APP_URL}/.well-known/security.txt`.
- Handled with `Content-Type: text/plain; charset=utf-8` and `Cache-Control: public, max-age=86400`. Because `proxy.ts` excludes paths with file extensions (`.*\\..*`), `security.txt` is served directly without locale redirection.

### 4.3 Validation & Redirect Hardening (`src/lib/security/validation.ts`)
- `safeRedirect`: Hardened against control-character bypasses (`/[\r\n\t\0-\x1f\\]/`). Protocol-relative URLs (`//evil.com`), backslashes (`/\evil`), tabs, and null bytes are rejected, defaulting safely to `/dashboard`.
- `sameOrigin`: Hardened with explicit null checks on the `Origin` header and defensive `try/catch` wrapping `new URL(origin)`, preventing uncaught exceptions on malformed origins.
- `isSafePushEndpoint`: New security validator preventing Server-Side Request Forgery (SSRF) on Web Push subscription URLs, blocking non-HTTPS schemes, loopback (`localhost`, `127.0.0.1`, `[::1]`), AWS/cloud metadata (`169.254.169.254`), and private RFC 1918 IPv4/IPv6 networks.

### 4.4 Request Middleware Hardening (`src/lib/security/request.ts`)
- Next.js App Router redirects function by throwing a synthetic error containing a `NEXT_REDIRECT` digest. `withRequestLogging` previously caught all errors and logged them as 500 failures. The middleware now recognizes `isNextRedirect` and re-throws cleanly, preserving redirect semantics and eliminating Sentry error noise.

---

## 5. Security Findings Registry & DREAD Scoring

| ID | Finding | Severity | File : Line | STRIDE | D | R | E | A | D | Avg | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **SEC-01** | SSRF risk in Web Push subscription endpoint | Medium | `app/api/push/route.ts:13` | Tampering / Info Disclosure | 7 | 8 | 6 | 4 | 7 | **6.4** | Needs Owner |
| **SEC-02** | Missing rate limits on billing checkout and portal | Medium | `app/api/billing/[action]/route.ts:11` | Denial of Service | 6 | 9 | 8 | 5 | 7 | **7.0** | Needs Owner |
| **SEC-03** | Missing rate limits on video join & Cloudflare proxy | Medium | `app/api/video/join/[sessionId]/route.ts:13` | Denial of Service | 6 | 9 | 7 | 5 | 7 | **6.8** | Needs Owner |
| **SEC-04** | Missing rate limits on push subscription registration | Low | `app/api/push/route.ts:23` | Denial of Service | 4 | 9 | 8 | 3 | 6 | **6.0** | Needs Owner |
| **SEC-05** | Redirect sanitizer omitted tabs and null bytes | Low | `src/lib/security/validation.ts:11` | Spoofing | 5 | 6 | 5 | 4 | 5 | **5.0** | **FIXED** |
| **SEC-06** | `sameOrigin` threw unhandled TypeError on invalid URL | Low | `src/lib/security/validation.ts:18` | Denial of Service | 4 | 7 | 6 | 3 | 4 | **4.8** | **FIXED** |
| **SEC-07** | Repeated host phase overrides broadcast duplicate timers | Low | `src/lib/hosts/index.ts:166` | Tampering | 3 | 8 | 7 | 3 | 5 | **5.2** | Needs Owner |
| **SEC-08** | Missing RFC 9116 `security.txt` and contact discovery | Info | `app/.well-known/security.txt/route.ts` | Info Disclosure | 2 | 9 | 9 | 2 | 8 | **6.0** | **FIXED** |
| **SEC-09** | Missing comprehensive Content Security Policy & HSTS | Medium | `next.config.ts:21` | Tampering / Info Disclosure | 7 | 8 | 6 | 8 | 7 | **7.2** | **FIXED** |
| **SEC-10** | Verify IDOR resistance in session and booking routes | Safe | `src/lib/bookings/service.ts:183` | Info Disclosure | - | - | - | - | - | - | **VERIFIED** |
| **SEC-11** | Verify Polar webhook HMAC verification & deduplication | Safe | `app/api/webhooks/polar/route.ts:17` | Tampering | - | - | - | - | - | - | **VERIFIED** |
| **SEC-12** | Verify secret redaction in logging & Sentry errors | Safe | `src/lib/logger.ts:5` | Info Disclosure | - | - | - | - | - | - | **VERIFIED** |

---

## 6. Deep Verification & False Positive Analysis

### SEC-01: SSRF in Web Push Subscription Endpoint
- **Claim**: An authenticated user can submit an internal network URL (e.g. `http://localhost:5432`, `http://169.254.169.254/latest/meta-data`, `http://db:5432`) as their push subscription `endpoint`. When a notification is dispatched (`sendPush`), `webpush.sendNotification` issues an HTTP request to that URL with VAPID authentication headers.
- **Root Cause**: `app/api/push/route.ts:13` validates `endpoint: z.url().max(1000)` without restricting protocol to `https:` or checking for private/loopback/cloud-metadata IP ranges.
- **Threat Model**: Authenticated user vs internal server infrastructure. The worker container resides on `networks: ["private", "egress"]`.
- **Verdict**: **TRUE POSITIVE (Medium Severity)**.
- **Remediation**: Use the new `isSafePushEndpoint(endpoint)` validator in `app/api/push/route.ts`.

### SEC-02: Missing Rate Limits on Billing Checkout & Portal
- **Claim**: An authenticated user can flood `/api/billing/checkout` and `/api/billing/portal`, triggering thousands of outbound API calls to Polar.
- **Root Cause**: `app/api/billing/[action]/route.ts` validates `sameOrigin` and email verification but contains no call to `rateLimit(...)`.
- **Verdict**: **TRUE POSITIVE (Medium Severity)**.
- **Remediation**: Add `await rateLimit(`billing:${session.user.id}`, 10, 60)` prior to Polar API calls.

### SEC-03: Missing Rate Limits on Video Join & Proxy Endpoints
- **Claim**: Rapid invocation of `/api/video/join/[sessionId]` or `/api/video/cloudflare/[sessionId]/push` can flood Cloudflare Calls with session creation requests.
- **Root Cause**: Neither `app/api/video/join/[sessionId]/route.ts` nor `app/api/video/cloudflare/[sessionId]/[action]/route.ts` invoke `rateLimit(...)`.
- **Verdict**: **TRUE POSITIVE (Medium Severity)**.
- **Remediation**: Add `rateLimit(`video-join:${user.id}`, 30, 60)` and `rateLimit(`video-proxy:${user.id}`, 120, 60)`.

### SEC-10: IDOR Verification on Session and Booking Access (Audit Check)
- **Claim**: Could an attacker cancel another user's booking or access unauthorized room states by guessing UUIDs?
- **Analysis**:
  - `cancelBooking` executes `where(and(eq(booking.id, bookingId), eq(booking.userId, userId)))`. If the booking does not belong to caller, it throws `not_found`.
  - `acceptFallback` executes `where(and(eq(booking.id, bookingId), eq(booking.userId, userId)))`.
  - `authorizeRoom` queries `sessionParticipant` table for `eq(sessionParticipant.userId, userId)`. Non-participants receive `null` and 404.
  - `cloudflareProxy` row-locks `sessionParticipant` on caller's user ID.
- **Verdict**: **FALSE POSITIVE / VERIFIED SECURE**. Complete ownership verification is enforced at the database query level.

### SEC-11: Webhook Signature Verification & Replay Protection (Audit Check)
- **Claim**: Could an attacker forge Polar webhooks or replay old payments?
- **Analysis**:
  - Webhooks validate raw request body and headers against `POLAR_WEBHOOK_SECRET` using `webhooks.validateEvent(...)`.
  - Replay attacks are prevented via `processed_event` table lookup. Duplicate events are discarded.
  - Authoritative subscription state is re-queried directly from Polar API via `customers.getStateExternal(userId)` rather than blindly accepting webhook payload data.
- **Verdict**: **FALSE POSITIVE / VERIFIED SECURE**. Defense-in-depth is rigorously maintained.

### SEC-12: Secrets in Logs & Sentry Errors (Audit Check)
- **Claim**: Do tokens or passwords leak in logs or monitoring systems?
- **Analysis**:
  - Pino logger (`src/lib/logger.ts`) configures strict redaction paths for `password`, `token`, `secret`, `email`, `authorization`, `cookie`, and `headers`.
  - Sentry instrumentation (`instrumentation.ts`, `instrumentation-client.ts`) strips user and request objects and empties breadcrumbs before dispatch.
  - `withRequestLogging` logs only operational metadata (`requestId`, `route`, `method`, `status`, `durationMs`).
- **Verdict**: **FALSE POSITIVE / VERIFIED SECURE**. Log hygiene adheres to strict privacy standards.
