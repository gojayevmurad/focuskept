# Brand verification / 1.0.0

## Application integration (24 November 2026)

Scope: integration of kit 1.0.0 into the application, authorized by the owner's handoff of the [integration prompt](integration-prompt.md) on 24 November 2026 (recorded in `brand/manifest.json` → `selection.finalArtworkApproval`). Local only: nothing was committed, pushed, published, deployed, or uploaded to an external account.

### What changed

| Surface          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo component   | `src/components/logo.tsx` draws the symbol from `brand/exports/code/logo-geometry.json` (via `src/config/brand-assets.ts`), micro cut below 32px, colors from `--logo-mark` / `--logo-mark-companion` in `src/config/brand.css`. SVG is `aria-hidden`; the name stays live text. `LOGO_URL` still replaces it.                                                                                                                                                   |
| Session room     | Uses the shared `LogoMark`, or the deployment `LOGO_URL` image when set (previously always the built-in mark).                                                                                                                                                                                                                                                                                                                                                   |
| Countdown type   | Room timer and landing demo use `--font-timer` (Figtree 600, `tabular-nums`). Big Shoulders stays for headings and static numbers.                                                                                                                                                                                                                                                                                                                               |
| Icons            | Metadata-based strategy in `app/[locale]/layout.tsx`: `/favicon.ico` (16/32/48 ICO), `/icon.svg` (adaptive micro mark), `/apple-touch-icon.png` (opaque 180px). `app/favicon.ico` was removed so each URL has one source. Root copies equal the kit files byte for byte (`brand:check`, unit test).                                                                                                                                                              |
| Install manifest | 192/512 `any` and separate 192/512 `maskable` PNGs plus the SVG; background/theme `#f4f8fa` (old `#121614`/`#2F6F62` removed). Viewport theme colors read the kit tokens.                                                                                                                                                                                                                                                                                        |
| Push             | `public/sw.js` uses `/brand/icons/notification-192.png`. Origin check, click destinations, permission flow, and payloads are unchanged.                                                                                                                                                                                                                                                                                                                          |
| OG image         | Moved from `app/[locale]/(marketing)/` to `app/[locale]/opengraph-image.tsx`. Inside the route group Next served it only at a build-hashed URL (`/opengraph-image-ds8rmm`), so the `/opengraph-image` URL that page metadata advertised returned 404 before this change. It now answers at `/opengraph-image` and `/<locale>/opengraph-image`, and `pageMetadata()` points each locale at its own image. Local TTFs replace the request-time Google Fonts fetch. |
| Share cards      | `/api/share/<username>/square                                                                                                                                                                                                                                                                                                                                                                                                                                    | story`use the kit mark, palette and fonts, text in the card owner's locale (new`progress.card.*`strings in all 5 catalogs),`Intl`month/number formatting. Private, suspended and unknown-format cases still return 404;`Cache-Control: public, max-age=600` kept. |
| Email            | Auth, notification, lifecycle and support mail share `EmailLayout`: deep-ink header, opaque badge PNG for the FocusKept identity (`/brand/email/logo-badge-480.png`, new kit export), name as text otherwise, literal inline colors, `color-scheme: light only`, styled alt text. Auth mail lost the old purple `#635bff` button and gained a plain-text part; subjects, links and preview-mode storage are unchanged.                                           |
| SEO              | Organization logo falls back to `/brand/icons/icon-any-512.png` (PNG) instead of `/icon.svg`; `LOGO_URL` still wins. Canonical, hreflang and robots output unchanged.                                                                                                                                                                                                                                                                                            |
| Setup            | `scripts/setup.mjs` now edits only the name/description/support defaults in `brand.ts` and the `--accent`/`--logo-*` declarations in `brand.css`, keeps everything else and the SPDX headers. The kit color `#08646b` reproduces the shipped files exactly; `saas.config.json` no longer carries the stale `#2F6F62`. Tested on temporary fixtures only; `pnpm setup` was not run on the checkout.                                                               |
| Kit scripts      | `check.mjs` shapes glyph samples by code point (it failed under a non-UTF-8 shell locale) and, once integrated, verifies the root icon copies. `generate.mjs` centers the SVG favicon (it was 4 units left of center), adds the email badge, keeps `integrationStatus`, and refreshes the root copies when integrated.                                                                                                                                           |

### Commands

| Command                       | Result                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm brand:generate` (twice) | 224 inventoried files; second run byte-identical; approval and integration status preserved                                                                                                                                                                                               |
| `pnpm brand:check`            | Passed: hashes, PNG sizes, SVG XML, ICO frames, PDFs, maskable safe zone, glyphs, timer digit advances, 3 root copies                                                                                                                                                                     |
| `pnpm spdx:check`             | Passed (all covered files)                                                                                                                                                                                                                                                                |
| `pnpm i18n:check`             | Passed                                                                                                                                                                                                                                                                                    |
| `pnpm typecheck`              | Passed                                                                                                                                                                                                                                                                                    |
| `pnpm lint`                   | 0 errors; 7 warnings, all in files this change did not touch                                                                                                                                                                                                                              |
| `pnpm test`                   | 39 files, 387 tests passed                                                                                                                                                                                                                                                                |
| `pnpm build`                  | Passed (Next, migrations, worker, house anchors). `.next/standalone/brand/exports/fonts/` contains the TTFs and OFL notices, and the standalone `server.js` rendered `/nl/opengraph-image` from them. The worker bundle includes the email layout. The Docker image itself was not built. |
| `pnpm test:e2e`               | 8 passed (sign-up/onboarding/booking/upgrade, two-partner room, landing, SEO, auth guard, mobile overflow on `/` and `/blog`, theme switch), isolated `_test` database                                                                                                                    |
| `pnpm test:integration`       | 11 passed, 1 skipped (`paid-access` needs `E2E_GRANT_USER_ID`; unrelated)                                                                                                                                                                                                                 |

New tests: `tests/unit/brand.test.ts` (runtime files exist, root icons equal the kit, React and SVG geometry match, tokens in CSS, service worker icon and origin check, email identity rules and rendered HTML), setup preservation tests in `tests/unit/setup.test.ts`, per-locale OG URLs in `seo-metadata.test.ts`, `LOGO_URL` override in `seo-schema.test.ts`.

### Inspected views

- Rendered symbol at 16/20/24/32/48/64px (micro below 32) on mist and night-water grounds; ink and white one-color marks; transparent PNG edges on a checkerboard; ICO frames 16/32/48 on light and dark; app icon `any` and `maskable` under circle and rounded-square masks with the 40% safe circle drawn; Apple and notification PNGs.
- Dev server, 1024px and 390px: landing (light), dashboard (light and dark), booking at 390px, session room live state (390px light, desktop dark; a temporary local session was inserted in the dev database and deleted afterwards) and ended state. No horizontal overflow (`scrollWidth` equals viewport). Room and demo timers: Figtree 600, `tabular-nums`, all ten digits measured at the same advance width in the browser.
- Same production build started twice with different runtime env: default identity, and `APP_NAME="Northside Study Collective for Night Owls"` plus `LOGO_URL=/brand/logo/symbol-ink.svg`. The custom run shows the custom image and full name in header and sidebar (name wraps in the sidebar, icon-only header below 430px), manifest name, JSON-LD logo, and an OG image with the name as text and no FocusKept mark. German landing at 390px had no overflow.
- OG images for en/de/fr/es/nl (1200×630, `image/png`); French is the longest heading and wraps to two lines. Share cards square 1080×1080 and story 1080×1920 in German and English, from a dev profile whose public-stats flag was switched on for the check and switched back.
- Email HTML for the FocusKept identity and a custom name: normal, image blocked (alt text "FocusKept" in white on the header band), and a simulated full color inversion (CSS invert with images exempt). The transparent white logo became unreadable in that simulation, which is why the opaque badge was added; the badge stays legible.
- Playwright screenshots (Chromium, fake camera) at 390×844 and 1440×900 in light and dark: landing, sign-in (signed out), onboarding (a fresh local dev account, deleted afterwards), dashboard, booking, and live session room. `scrollWidth` equalled the viewport on every page. German landing at 390px. 200% zoom emulated as a 720×450 viewport at 2× density for landing, dashboard and room: no overflow. With `prefers-reduced-motion: reduce`, no element on the landing page had an animation or transition longer than 10ms. The first Tab stop is the skip link with a 2px solid accent outline.
- Head output: one `/favicon.ico` (`sizes="32x32"`), one `/icon.svg` (`image/svg+xml`), one apple-touch icon (180×180); all return 200 with correct MIME types.

### Measured pairs (WCAG relative luminance)

| Pair                                      | Colors                | Ratio   | Kind            |
| ----------------------------------------- | --------------------- | ------- | --------------- |
| Email header name/alt text                | `#ffffff` / `#102f43` | 13.91:1 | Text, 18px bold |
| Email body text                           | `#102f43` / `#ffffff` | 13.91:1 | Text            |
| Email footer and unsubscribe              | `#4e6572` / `#ffffff` | 6.13:1  | Text, 12px      |
| Email button label                        | `#ffffff` / `#08646b` | 6.90:1  | Text, 15px 600  |
| Email button against card                 | `#08646b` / `#ffffff` | 6.90:1  | UI shape        |
| OG/share light: heading, name             | `#102f43` / `#f4f8fa` | 13.02:1 | Text            |
| OG light: note, domain                    | `#465e6b` / `#f4f8fa` | 6.39:1  | Text            |
| Share dark: text                          | `#edf6fa` / `#081c2a` | 15.84:1 | Text            |
| Share dark: muted                         | `#c0d2dc` / `#081c2a` | 11.15:1 | Text            |
| Share dark: chip label on chip            | `#7bcdd2` / `#123543` | 7.12:1  | Large text      |
| Room timer, light                         | `#102f43` / `#f4f8fa` | 13.02:1 | Large text      |
| Room timer, dark                          | `#edf6fa` / `#081c2a` | 15.84:1 | Large text      |
| Logo primary shape on mist                | `#08646b` / `#f4f8fa` | 6.45:1  | Graphic         |
| Logo companion on mist                    | `#3d9fa8` / `#f4f8fa` | 2.92:1  | Graphic         |
| Logo companion on white                   | `#3d9fa8` / `#ffffff` | 3.12:1  | Graphic         |
| Logo primary on light lane (sidebar)      | `#08646b` / `#e9f4f6` | 6.15:1  | Graphic         |
| Logo companion on light lane (sidebar)    | `#3d9fa8` / `#e9f4f6` | 2.79:1  | Graphic         |
| Logo dark primary on night water          | `#7bcdd2` / `#081c2a` | 9.51:1  | Graphic         |
| Logo dark companion on night water        | `#b1e3e6` / `#081c2a` | 12.40:1 | Graphic         |
| Logo dark primary on dark lane (sidebar)  | `#7bcdd2` / `#123543` | 7.12:1  | Graphic         |
| App icon / email badge white on deep ink  | `#ffffff` / `#102f43` | 13.91:1 | Graphic         |
| ICO teal on light tab strip               | `#08646b` / `#f1f3f4` | 6.19:1  | Graphic         |
| ICO teal on dark tab strip                | `#08646b` / `#35363a` | 1.75:1  | Graphic         |
| SVG favicon dark scheme on dark tab strip | `#7bcdd2` / `#35363a` | 6.61:1  | Graphic         |

These are solid-color measurements for the specific pairs above, not an audit of every screen. Logos are exempt from WCAG contrast; the voluntary 3:1 target for the companion shape holds on white (3.12:1) but not on the mist ground (2.92:1) or the light sidebar lane (2.79:1), where the primary shape (6.1–6.5:1) carries recognition. Session state is never shown by hue alone: the phase label and countdown text sit next to the clock.

### Known limits

- Real mail clients (Gmail, Outlook, Apple Mail) were not tested; dark mode was simulated in a browser. In local development `APP_URL` is `localhost`, so email images only load for mail opened on the same machine.
- Real push notifications were not delivered (no VAPID keys locally); the service worker icon path and its unchanged click handling were checked in code and tests. Browsers update `sw.js` on their next check; until then the old worker shows `/icon.svg`, which now also carries the new mark.
- The ICO is single-color pool teal and has low contrast on dark tab strips (1.75:1 on `#35363a`). Browsers that use the SVG favicon get the dark-scheme color instead (6.61:1). Which file a browser picks was not verified per browser.
- No screen reader was run; the accessibility tree was checked instead (the header logo is one link named after the deployment, with the SVG hidden).
- Custom deployments still get FocusKept browser/install icons (static files) and some copy that names FocusKept directly (for example the dashboard first-run title, onboarding "heard from" question, early-access notice, legal pages). That predates this change.
- README screenshots in `docs/screenshots/` still show the previous logo.
- `generated_images/` holds the original concept board image; it is untracked and is not part of the kit.

### Outstanding external uploads

None of these were changed; each needs the owner's own upload:

| Where                                                       | File                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| GitHub repository Settings → Social preview                 | `brand/exports/social/github-preview-light.png` (or `-dark`), 1280×640, under 1MB   |
| GitHub/organization avatar, other profile avatars           | `brand/exports/icons/avatar-1024.png`                                               |
| X and LinkedIn covers                                       | `brand/exports/social/cover-x-*.png` (1500×500), `cover-linkedin-*.png` (1584×396)  |
| Google OAuth consent screen logo                            | a square export such as `brand/exports/logo/symbol-primary-128.png` or the app icon |
| Polar organization/product branding (if billing is enabled) | avatar or symbol PNG                                                                |
| Production                                                  | the new assets reach focuskept.com only after a normal image build and deploy       |

## Kit delivery (23 November 2026)

Date: 23 November 2026. Direction: A / Side by Side. Scope: the delivered vector kit, deterministic authoring scripts, and staged static runtime files. Existing application components and behavior were not integrated in this phase.

### Completed

- `pnpm brand:generate`: 223 inventoried deliverables, with source digests and exact paths in `brand/manifest.json`.
- `pnpm brand:check`: output/source checksums, actual PNG dimensions/formats, XML parsing for all generated SVGs, SVG dependency restrictions, PDF signatures, ICO frame sizes, opaque maskable artwork inside its central safe circle, basic locale glyph samples, and selected light/dark contrast pairs passed.
- Repeated generation produced byte-identical inventoried exports, including vector PDFs; PDF metadata uses a fixed generation identity date rather than a nondeterministic current timestamp.
- Arbitrary export exercised at 2048×2048 with transparent PNG output. The temporary test export was removed after checking actual metadata.
- Original font binaries match their exact upstream Git blob digests. Both notices are included. Static renderer instances are generated from those originals.
- Actual numeral shaping revealed unequal advances in Big Shoulders even with `tnum`; the timer role was refined to Figtree 600. Equal digit advances with `tnum` are checked for the actual timer font. Big Shoulders remains the display face.
- New JavaScript authoring scripts passed ESLint. Covered code files passed the repository SPDX checker. Edited documentation/code/gallery files passed Prettier, and `git diff --check` passed.
- Local Markdown/gallery file links resolve, and the gallery's inline script was syntax-checked.

### Visual inspection

- Reviewed the exact production overview, full-size mark/wordmark, mono and reverse cuts, app tile, and small-size strip.
- Rendered all six guideline PDF pages with Poppler and inspected a contact sheet; re-rendered the changed typography page after the timer font refinement.
- Inspected representative square/story/cropped-cover graphics, ordinary and maskable icons, and an email-header export. A plain Markdown usage source accompanies the outlined visual PDF, which is not a tagged accessible PDF.
- Current static compositions use genuine brand copy and no invented customers, testimonials, or usage statistics. The original image-generated comparison board remains an exploration reference, not an editable master or proof of exact geometry.

### Selected measured pairs

| Pair                          | Contrast |
| ----------------------------- | -------- |
| Light text / ground           | 13.019:1 |
| Light muted / surface         | 6.832:1  |
| Light accent ink / accent     | 6.895:1  |
| Dark text / ground            | 15.840:1 |
| Dark accent ink / accent      | 8.510:1  |
| Companion symbol teal / white | 3.124:1  |

These are solid color-pair measurements and selected font/asset checks, not a whole-application accessibility certification or complete language proof.

### Still outside this delivery

The standalone gallery has not been exercised in a browser in this phase. Existing app light/dark screens, custom deployment names/logos, live email clients, actual browser favicon behavior, push notifications, dynamic OG/share renderers, and Docker asset tracing await integration and its browser/runtime checks. Full app unit/integration/e2e suites and production build were not run for this asset-only delivery; the integration handoff explicitly requires the affected checks.

GitHub/social/OAuth brand settings were not changed. Nothing was committed, pushed, published, or deployed. No external skill installation succeeded; that earlier limitation remains documented in `sources-and-tools.md`. Direction selection is recorded; the first production vector artwork remains prepared for review rather than being falsely recorded as previously approved.
