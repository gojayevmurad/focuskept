# Brand research and repository audit

Research date: 23 November 2026. Baseline: `636f992`. Facts below come from the current repository unless linked to an external source. Creative conclusions are recommendations.

## Product truth

FocusKept is an open-source virtual coworking and body doubling application. A person books 25, 50, or 75 minutes, meets a partner on video, shares a goal, works quietly, and checks back at the end. Hosted groups, personal booking links, favorite partners, referrals, progress, and challenges extend that loop.

This is a new repository. Decision D2 explicitly says the previous study timer was retired and archived. A todo-app identity based on older project history would miss the current product.

The customer is someone who needs help starting and sustaining work. The first audience hypothesis is remote workers, independent builders, students, and writers; body doubling also serves some neurodivergent adults. This prioritization is a design hypothesis, not customer interview evidence. Developers and self-hosters form a second audience with different needs: understandable source, configuration, contributor guidance, and predictable deployment.

The primary marketing promise should explain the session. Open source is supporting proof and an independent developer-facing entry point. The first screen should help a new person understand what they will book before asking them to care about the implementation.

## Audit coverage and limits

The repository inventory contains 499 files outside dependency, Git, build, and test-result trees: 144 in `app/`, 143 in `src/`, 28 content files, 5 translation catalogs, 48 test files, 8 existing documentation files, and 2 public files. This count is an inventory, not a claim that every source line was manually read.

Detailed reading covered the README, architecture, decisions, design system, product progress, contribution/self-hosting guidance, package/configuration files, setup generator, branding components, global CSS, marketing composition, metadata, manifest, SEO schemas, notifications/auth/lifecycle/support email paths, share-card renderer, push path, Dockerfile, CI, and representative related tests. All three committed screenshots were visually inspected. Route and source inventories were searched for brand and legacy color references. Database/matching/video internals were reviewed through the architecture and relevant call sites rather than line by line; they do not define the identity.

The screenshots are committed examples, not a fresh browser verification of the running application. No production deployment, account, analytics, external brand settings, or live customer data was inspected or changed. Competitor research below concerns their current stated positioning; it is not an exhaustive visual or trademark audit.

## Existing visual assets worth retaining

Decision D19 already chooses the **Lanes** world. The interface connects parallel working to swimming lanes: separate workspaces, a shared pace clock, restrained lane ropes, and a schedule board. The committed landing and calendar screenshots show that this language has been implemented coherently.

| Existing element                           | Evidence                                  | Assessment                                                      |
| ------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------- |
| Teal / deep water palette                  | `src/config/brand.css`, `app/globals.css` | Strong usable foundation; consolidate cross-channel values      |
| Big Shoulders display + Figtree text       | `app/[locale]/layout.tsx`                 | Distinct rhythm; reserve condensed type for display and numbers |
| Pace clock and lane rope                   | `src/components/lanes/`                   | Useful signature devices grounded in the actual session         |
| Horizontal lanes and schedule board        | `docs/DESIGN.md`, screenshots             | More specific to this product than generic feature cards        |
| Light/dark themes and reduced-motion rules | `app/globals.css`                         | Preserve and test; a new logo must work in both                 |
| Configurable deployment identity           | `src/config/app.ts`, `brand.ts`, `env.ts` | Essential open-source capability; extend rather than replace    |

The room screenshot uses the browser's green test camera. It is suitable as technical evidence, but should be replaced by a clearly labeled, consent-safe product demonstration before becoming a launch graphic.

## Inconsistencies and integration seams

| Surface               | Current observation                                                                                    | Required outcome                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Site/app logo         | `src/components/logo.tsx` draws two lanes, colored rope details, and a red marker                      | One approved geometry system, including a simpler small-size cut                          |
| Favicon               | `public/icon.svg` still draws overlapping green/gold circles                                           | Replace with the same approved identity, including an appropriate micro version           |
| Session room          | `room.tsx` imports `LogoMark` directly                                                                 | Use the shared brand component; inspect custom deployment behavior too                    |
| Install manifest      | `app/manifest.ts` has old `#121614` / `#2F6F62` colors and only one SVG icon                           | Coherent colors plus real PNG `any` and dedicated `maskable` exports                      |
| Push notifications    | `public/sw.js` points to the old SVG                                                                   | Use a tested notification PNG; keep the old URL compatible if consumers still use it      |
| OG preview            | Marketing `opengraph-image.tsx` follows Lanes, but has separate colors and no symbol                   | Approved mark, shared literal tokens, verified wrapping, robust font loading              |
| Public progress cards | `app/api/share/[username]/[format]/route.tsx` still has circles, green/gold gradients, and system type | Bring square/story output into the approved system, preserving public-stats authorization |
| Auth email            | `src/lib/email/send.tsx` has a separate template and purple `#635bff` CTA                              | Use the same email identity as product mail without changing auth-link behavior           |
| Product email         | `src/lib/notifications/email-layout.tsx` uses old green `#2F6F62` and beige background                 | One email-safe design used by notifications, lifecycle, and support                       |
| Setup generator       | `scripts/setup.mjs` rewrites `brand.ts` and `brand.css`; `saas.config.json` still has old green        | Setup must not erase newly approved token contracts; verify in a temporary fixture        |
| SEO organization      | `src/lib/seo/schema.ts` falls back to `/icon.svg`, supports `LOGO_URL`                                 | Correct approved logo, absolute URLs, and preserved custom deployment override            |
| OG localization       | `pageMetadata()` currently points to `/opengraph-image` for every locale                               | Verify intended localized image routing; do not assume nesting solves it                  |
| Repository            | README has screenshots but no complete identity download/usage entry point                             | Discoverable brand docs, banner, social preview, and contributor instructions             |

## Technical constraints that affect the design

- Next.js 16.4.6 / React 19, strict TypeScript, next-intl, CSS tokens and scoped modules. The installed `node_modules/next/dist/docs/` is the implementation reference, as required by `AGENTS.md`.
- Names and URLs resolve at request time so the same Docker image works for self-hosters. Preserve `APP_NAME`, `APP_URL`, `LOGO_URL`, `SUPPORT_EMAIL`, and marketing/billing flags.
- Existing UI strings live in `messages/{en,de,fr,nl,es}.json`. Do not bake the hosted product name into localized application labels or images intended for custom deployments.
- `getAppConfig()` imports server-only configuration. A browser-safe brand token/geometry module must not import it or expose the environment.
- `next/og` uses a restricted renderer. Browser CSS variables, CSS grid, and arbitrary modern CSS are not a reliable shared design API for it. Use literal values and supported layout primitives.
- Current OG generation fetches font CSS and binary data from Google at request time. Prefer licensed local renderer-compatible fonts, traced into the standalone image and verified in Docker. UI WOFF2 and OG TTF/OTF requirements differ.
- Notification and lifecycle emails also render in the bundled worker. Shared email brand data must be usable without a browser, DOM, or Next-only asset loader.
- SVG logos are appropriate for web/vector use; email needs PNG fallback and meaningful text when images are blocked. Existing custom logo URLs are arbitrary HTTPS images, not guaranteed PNG.
- No project API, data model, booking behavior, billing plan, or privacy policy change is required to implement the brand.

## Measured starting palette

WCAG relative-luminance ratios were calculated directly from the current solid hex values. These are color-pair measurements, not a complete rendered accessibility audit.

| Foreground / background | Ratio    | Interpretation                                                                             |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `#08646b` / `#ffffff`   | 6.895:1  | Passes AA normal-text contrast                                                             |
| `#7bcdd2` / `#082735`   | 8.510:1  | Passes AA normal-text contrast                                                             |
| `#102f43` / `#f4f8fa`   | 13.019:1 | Strong main-copy contrast                                                                  |
| `#4e6572` / `#ffffff`   | 6.125:1  | Passes AA normal-text contrast                                                             |
| `#d23b4e` / `#ffffff`   | 4.692:1  | Passes normal-text threshold for this pair; retain its timing role                         |
| `#f3cc45` / `#ffffff`   | 1.552:1  | Decorative accent only on this background; insufficient as meaningful UI information alone |

Follow [W3C text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Logo text has an exemption, but our voluntary design target is still a clearly visible mark on every specified ground. Use labels and shape in addition to color for session state.

## Competitor positioning

| Product                                 | Current official emphasis                                               | Implication for FocusKept                                              |
| --------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Focusmate](https://www.focusmate.com/) | Partner-based coworking, supportive community, 25/50/75-minute sessions | Session lengths and partner matching alone do not differentiate us     |
| [Flow Club](https://www.flow.club/)     | Virtual coworking, productive flow, community and hosts                 | A generic flow/community story is crowded                              |
| [Caveday](https://www.caveday.org/)     | Guided focus sessions within a memorable “Cave” world                   | A coherent metaphor can connect language and experience; build our own |

Recommended positioning: **quiet company, a clear rhythm, and an open foundation**. Differentiate through a consistent product experience and visible self-hosting/contribution pathway. Do not imply that competitors record calls or lack privacy without direct evidence. Do not promise matching availability, clinical outcomes, productivity gains, or user counts that have not been verified.

## Decision

Evolve Lanes rather than replacing the implemented UI world. The missing work is a complete identity system and consistent distribution: a more ownable mark and wordmark, properly engineered small-size variants, a single token contract, all app/email/social assets, and a repeatable open-source handoff. Final distinctiveness must be judged on actual concept boards and applications, not on adjectives or the popularity of an installed skill.
