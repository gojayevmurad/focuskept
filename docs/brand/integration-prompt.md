# Brand integration prompt

Use the complete block below with an agent that can edit this repository. It is intentionally self-contained and does not depend on a globally installed skill. **Direction A has been selected and kit 1.0.0 has been delivered.** When the owner explicitly gives this prompt to an agent to integrate that kit, it authorizes local integration of the supplied artwork. Reading this document alone is not approval. The current draft status distinguishes the delivered vector artwork from the earlier concept selection; do not invent a final approval or require an extra confirmation after the owner has explicitly requested this concrete integration.

```text
Integrate the approved FocusKept identity throughout this open-source repository.
Complete the implementation and verification; do not stop at recommendations.

START WITH THE REPOSITORY
1. Read AGENTS.md, docs/brand/README.md, docs/brand/research.md,
   docs/brand/creative-brief.md, docs/brand/asset-spec.md, docs/DESIGN.md,
   DECISIONS.md, ARCHITECTURE.md, SELF_HOSTING.md, package.json, and git status.
   Existing code may have changed since the research baseline; inspect current files.
2. Read the installed Next.js guides under node_modules/next/dist/docs/ before
   writing framework code. In particular read app-icons, manifest,
   opengraph-image, generate-metadata, ImageResponse, and fonts guidance.
3. Require brand/manifest.json, direction A selected by the owner, and real
   source/token/export files matching the manifest inventory. Run brand:check.
   If the owner explicitly invoked this handoff to integrate the delivered kit,
   use that instruction as authorization for local integration and record its
   actual date/context/scope in selection.finalArtworkApproval, setting status
   to approved. Do not claim earlier approval of the vector artwork. If files
   or the owner's direction selection are missing/inconsistent, report the exact
   prerequisite. Do not invent a final mark, wrap a concept bitmap in an SVG,
   or fill the manifest with fictional files. No publishing is authorized here.
4. Use the approved kit. Do not redesign it, rename the product, change the code
   license, modify business behavior, or overwrite unrelated working changes.

SOURCE AND CONFIGURATION CONTRACT
5. Keep editable creative masters/tokens/templates in brand/, usage guidance in
   docs/brand/, and only used generated runtime assets in public/brand/.
   Preserve src/config/brand.ts, brand.css, and app.ts as integration boundaries.
   Generate SVG and React-compatible geometry from one source, not independent
   hand-drawn copies. Use the micro mark where specified by the kit.
6. Preserve APP_NAME, APP_URL, LOGO_URL, SUPPORT_EMAIL, locale routing, and all
   feature flags. The same built Docker image must still accept runtime identity
   changes. A custom deployment must not unexpectedly show a FocusKept wordmark
   next to its own name, in the session room, or in generated cards/emails.
   Inspect the existing contract before extending it. If separate icon or email
   fallback options are necessary, add backward-compatible validated settings
   with documented defaults; do not reinterpret an existing LOGO_URL silently.
7. Separate literal browser-safe tokens/geometry from server-only environment
   resolution. No server config or secret may enter a client bundle. Emit usable
   values for browser CSS, OG rendering, and worker-rendered emails. Do not assume
   CSS variables, color-mix, grid, or external stylesheets work in next/og/email.
8. Inspect scripts/setup.mjs and saas.config.json. The generator currently rewrites
   brand.ts/brand.css and uses a stale color. Make setup preserve the new public
   configuration contract and test this on an isolated temporary fixture. Do not
   run pnpm setup on the user's checkout or regenerate deployment credentials.

IMPLEMENT ALL APPLICATION SURFACES
9. Update src/components/logo.tsx and its consumers in site-header, site-footer,
   app-shell, onboarding, and app/[locale]/session/[id]/room.tsx. Retain existing
   accessible names, configurable logos, and navigation. Decorative SVGs should
   not duplicate the spoken product name. Inspect compact mobile layout and
   long custom deployment names.
10. Update public/icon.svg, favicon/Apple metadata, app/manifest.ts, and viewport
    theme colors in app/[locale]/layout.tsx. Choose an explicit file-based or
    metadata-based icon strategy per installed docs. Do not serve two competing
    /icon.svg or /favicon.ico routes. Keep the existing /icon.svg URL compatible.
    Add real 192/512 PNG any icons and separate 192/512 maskable PNGs with the
    specified safe zone. Apple export is opaque 180px, not a renamed SVG.
11. Update public/sw.js to the approved tested PNG notification icon. Inspect
    src/lib/notifications/push.ts if per-deployment icon data is needed. Preserve
    click origin validation, destinations, permission behavior, and notification
    delivery. Test stale icon URL/cache behavior without unrelated service-worker
    feature work.
12. Update app/[locale]/(marketing)/opengraph-image.tsx with the approved identity
    and renderer-safe tokens/fonts. Use licensed local compatible font binaries
    rather than mandatory runtime Google requests where practical; ensure Docker
    standalone tracing/copy includes them. next/og font formats differ from UI
    WOFF2. Verify image endpoint headers, dimensions, and long translated text.
13. Update app/api/share/[username]/[format]/route.tsx for both 1080x1080 square
    and 1080x1920 story. Use the same mark/palette/type system. Preserve private
    stats protection, suspended-user behavior, unsupported-format 404s, cache
    policy, and real data semantics. Use Intl/localized text where supported,
    with no accidental personal data in static samples.
14. Inspect src/lib/content/marketing.ts and src/lib/seo/schema.ts. Verify how
    each locale resolves its OG image (the old helper points all locales to the
    root image), absolute metadata URLs, organization logo override, and existing
    SEO tests. Do not remove canonical/hreflang/robots behavior to simplify branding.
15. Unify auth and product mail visually: src/lib/email/send.tsx and
    src/lib/notifications/email-layout.tsx, including the callers in notifications,
    lifecycle/templates.tsx, and support/email.ts. Use email-safe inline styles,
    PNG artwork via absolute deployment URLs, proportional dimensions, text
    fallback, and robust button contrast. Verify blocked images and dark email
    rendering. Keep secure auth URLs, sending/preview behavior, subjects,
    unsubscribe handling, reminders, and worker compatibility intact. Do not
    silently attempt to convert or server-fetch arbitrary custom logo URLs.
16. Apply approved token changes through src/config/brand.css and app/globals.css
    rather than recoloring every CSS module independently. Preserve semantic
    success/danger/warning colors, timer states, keyboard focus, reduced motion,
    tabular figures, and layout. The delivered timer token deliberately uses
    Figtree 600 with tabular-nums: font shaping verified equal advances there,
    while the supplied Big Shoulders font has no working tabular digits. Update
    actual countdown typography accordingly; keep Big Shoulders for headings.
    Keep page-specific CSS scoped using existing
    repository conventions. Update docs/DESIGN.md when the approved rules change.
17. Change messages/{en,de,fr,nl,es}.json only where actual copy changes require
    it; preserve keys, interpolation, and locale coverage. Keep the product name
    runtime-configurable. No broad rewrite of legal, SEO, or medical content.

OPEN-SOURCE HANDOFF
18. Add the approved README banner and a discoverable brand usage/download link.
    Keep README images local and handle dark backgrounds. Add font notices and
    provenance. Preserve the AGPL-3.0-only code license; do not impose a new
    trademark/artwork license without explicit owner instruction.
19. Use and preserve the delivered brand:generate, brand:export, and brand:check
    commands; inspect their documented tool prerequisites. Verify real file dimensions/MIME types, SVG validity,
    font notices, digests, and manifest completeness. Regeneration must not
    mutate unrelated app files or require a network service during normal use.
    Add the existing SPDX header to new code files covered by scripts/spdx.mjs.
20. The repository GitHub social-preview image is a file deliverable plus a
    separate Settings upload. Account avatars/covers and OAuth provider settings
    are also external. Prepare the assets and list outstanding uploads; do not
    claim those settings changed merely because an image was committed. Do not
    publish, deploy, push, or change external accounts under this local handoff.

VERIFY BEFORE FINISHING
21. Inspect actual renders of the symbol at 16/20/24/32/48/64px, primary and mono
    artwork on light/dark grounds, app icon circle/mask crops, and transparent
    PNG edges. Measure normal text at >=4.5:1 and qualifying large text/meaningful
    UI graphics at >=3:1 for the specified pairs; do not call a whole app compliant
    from a handful of palette measurements. Do not communicate state by hue alone.
22. Inspect 390px and desktop layouts for landing, auth/onboarding, dashboard,
    booking, and session room in light/dark modes. Check one longer locale and
    a long custom APP_NAME/LOGO_URL deployment. Verify 200% zoom, focus visibility,
    reduced motion, no duplicate logo announcements, and no horizontal overflow.
23. Inspect OG and square/story outputs, email HTML/preview, favicon metadata,
    manifest icons, and JSON-LD. Test default and custom deployment identities,
    including the same built image with different runtime config where possible.
24. Run pnpm spdx:check, pnpm i18n:check, pnpm typecheck, pnpm lint, pnpm test,
    and pnpm build after implementation. Use existing related tests and add only
    meaningful coverage for generator preservation, asset integrity, metadata or
    runtime override regressions. Run pnpm test:e2e for affected public/core flows
    using the project's isolated test environment. Run integration tests if email,
    worker/config, or authorization behavior changed. Do not touch production DB.
    If the environment prevents a check, report it as unverified, not passed.
25. Review git diff for obsolete logo geometry/colors and unintended changes.
    Do not globally replace every old hex without checking its semantic purpose.
    Add docs/brand/verification.md with actual commands/results, inspected views,
    measured pairs, known limits, and external uploads outstanding. Update the
    brand entry point and manifest truthfully, then summarize changed behavior,
    validation, and any unresolved limitations.
```
