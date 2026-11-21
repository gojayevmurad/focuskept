# Decisions

Changes to defaults from the project brief, and choices the brief left open. Newest last.

## D1. Product name: FocusKept (brief default: "Odaq")

We already own `focuskept.com`, the GitHub repository and working Polar, Google OAuth and Resend accounts under that name. "Odaq" is hard to say and spell for the US audience we launch with. The name only comes from config (`APP_NAME`), so this is cheap to change.

## D2. Fresh repository

The previous FocusKept app (a study timer) was retired. Its repository was renamed to a private, archived `focuskept-legacy`, and this repository was created from the boilerplate template with a single initial commit. Nothing from the old code base is reused.

## D3. Table names

- Focus sessions are `focus_session` because Better Auth already owns `session`.
- Groups are `community` / `community_member` because `group` is a reserved SQL word.

## D4. Background jobs: pg-boss

pg-boss runs on the PostgreSQL we already have, supports cron schedules, retries and singleton jobs, and needs no extra service. BullMQ would add Redis for no benefit at our size.

## D5. Realtime: Postgres LISTEN/NOTIFY + SSE

The boilerplate has no realtime layer. SSE runs in normal route handlers (no custom server), works through Caddy and Cloudflare, and reconnects on its own. LISTEN/NOTIFY lets the worker push events without another broker. Messages that need two-way exchange (SDP, track names) go over normal POST requests.

## D6. Free trial lives in Polar

The 7 day Plus trial is configured on the Polar subscription products (Polar supports trial periods natively), so a trial is just an active entitlement. No separate trial bookkeeping in our database.

## D7. Referral reward

When the invited person completes their first session, both people get a single-use Polar discount: 100% off Plus for one month. If someone already pays, the discount is applied to their current subscription; otherwise it is attached to their next checkout. With billing disabled there is nothing to reward, so referrals only count.

## D8. Personal link also attributes referrals

`/u/<username>` sets the same referral attribution as an invite link. It is the link people actually share, and the brief counts both as growth loops.

## D9. Direct bookings

Booking "with" someone sets `preferred_partner_id`. If that person already has a free booking in the slot, both are matched together at T-5. If not, they get an invitation to join; if they never accept, the booker is matched normally, and the UI says so up front.

## D10. `VIDEO_PROVIDER=none` for development and tests

Local work and CI cannot depend on Cloudflare credentials. `none` shows the local camera only and is rejected at startup when `NODE_ENV=production`.

## D11. B2B group licence is managed by admins

A community gets Plus seats and an end date from the admin panel. Invoicing for groups happens through Polar invoices or manually for now; there is no self-serve seat checkout until there is demand.

## D12. Host perk threshold

Hosts get Plus for a month after hosting at least `HOST_PERK_SESSIONS` group sessions (default 8) in the previous calendar month.

## D13. The microphone follows the session rhythm

The mic is on during the intro (if the person's default is on), muted automatically when focus starts, and the person is prompted (not forced) to unmute for the wrap-up. Unmuting someone automatically felt intrusive. Anyone can change it at any time with one click, and once they do we stop changing it for them.

## D14. Pages render per request

All pages are server-rendered on request instead of at build time. One Docker image then works for any `APP_NAME`, `APP_URL` and feature flags set at runtime, which self-hosting needs. Public pages are cheap to render; a CDN (Cloudflare) in front absorbs crawler traffic.

## D15. Prices come from Polar at runtime

The pricing page reads the Plus monthly and yearly prices from Polar and caches them for 10 minutes. Nothing about prices is in the code. If Polar is unreachable the page says the price is shown at checkout.

## D16. Reporting also blocks

A report always blocks the reported person for the reporter as well. An account reported by three different people within 30 days (two for "underage" or "inappropriate") is paused until an admin reviews it.

## D17. Next.js 16.4.6

The boilerplate pinned 16.4.2, which has a published security issue. Upgraded to the patched 16.4.6.

## D18. Private by default

Focus stats on the public page and share cards are off until the person turns them on (onboarding or Settings). Work types like "ADHD" are used for matching but never shown on public pages, since they can reveal health information.
