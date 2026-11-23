# Asset and repository specification

Status: delivery specification. Direction A has been produced as kit 1.0.0; see [the exact delivered inventory](../../brand/manifest.json), [kit README](../../brand/README.md), and [usage rules](usage.md). Root favicon URLs, dynamic renderers, and application UI were integrated on 24 November 2026 ([verification](verification.md)). The directory/file examples below remain architectural guidance; use the manifest for exact delivered names and staged `targetPath` values. Optional print and illustrative compositions are not claimed as delivered.

## Deliverable principles

“Every size” means a scalable vector source plus a documented export matrix and reproducible arbitrary-size exports. It does not mean committing thousands of redundant rasters. Distinguish layout variants from theme/color variants and from platform-specific crops.

The approved set needs: symbol, optically adjusted micro symbol, wordmark, horizontal lockup, stacked lockup, app tile, one-color dark, one-color white, primary light/dark artwork, and transparent/opaque exports where appropriate. A tagline lockup is supplementary; the core logo must function without it. No stretching, effects-dependent marks, or wordmarks substituted by raster text.

## Proposed repository layout

| Path                                | Owner and contents                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `docs/brand/`                       | Human-readable brief, research, usage rules, QA record, and integration prompt                                   |
| `brand/manifest.json`               | Approved version, direction, approval record, licenses, token/source locations, and exact export inventory       |
| `brand/source/`                     | Editable vector masters: symbol, micro symbol, outlined wordmark, lockups, tile, pattern                         |
| `brand/tokens.json`                 | Canonical literal palette, type roles, spacing/clearspace, and runtime-safe export values                        |
| `brand/templates/`                  | Editable social, launch, README/banner, and email-header compositions                                            |
| `brand/fonts/`                      | Only fonts actually needed for reproducible source/OG rendering, with OFL notices; do not serve this entire tree |
| `brand/exports/`                    | Share/download-only assets, including PDF guidelines and print-ready vector exports when produced                |
| `public/brand/`                     | Small generated runtime SVG/PNG/font assets needed by the app and emails                                         |
| `public/icon.svg`                   | Compatible existing icon URL, generated from the approved small mark                                             |
| `public/favicon.ico`                | Multi-resolution browser fallback, referenced through metadata                                                   |
| `public/apple-touch-icon.png`       | 180 px opaque Apple home-screen export, referenced through metadata                                              |
| `src/config/brand.ts` / `brand.css` | Existing application default/config integration points; preserve override semantics                              |
| `src/components/logo.tsx`           | Existing shared React logo API, consuming canonical geometry rather than a second hand-drawn logo                |
| `scripts/brand/`                    | Future deterministic asset generation/verification scripts                                                       |

No empty placeholder folders are needed during research. Keep source and downloads out of `public/`; the whole public tree is shipped. Do not create a competing `assets/branding/`, root logo folder, and component-owned geometry source. If React and SVG need different representations, generate them from one geometry source and verify consistency.

## Export matrix

Dimensions below are delivery targets for this kit, not claims that every social platform requires exactly that size. Recheck platform-specific upload rules at production time. Retain editable compositions so a new crop does not require a redesign.

| Asset                            | Required size(s)                                                         | Format / variants                                                                         | Proposed destination                                            |
| -------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Symbol + micro symbol            | Resolution independent; inspect at 16, 20, 24, 32, 48, 64 CSS px         | SVG primary, mono dark, reverse white; transparent PNG at 64, 128, 256, 512, 1024 px      | Masters in `brand/source/`; runtime subset `public/brand/logo/` |
| Wordmark                         | Resolution independent; final minimum width set after optical review     | Outlined SVG + vector PDF; transparent PNG at 320, 640, 1280 px wide, proportional height | `brand/source/`, `brand/exports/logo/`                          |
| Horizontal / stacked lockups     | Resolution independent                                                   | SVG/PDF primary, mono, reverse; PNG at 320, 640, 1280 px wide                             | Same logo destinations; public subset only where used           |
| Browser favicon                  | 16, 32, 48 px embedded ICO; scalable SVG                                 | Micro artwork; SVG may adapt to color scheme after browser verification                   | `public/favicon.ico`, `public/icon.svg`                         |
| Apple home-screen icon           | 180×180                                                                  | Opaque PNG; no pre-rounded outer corners                                                  | `public/apple-touch-icon.png`                                   |
| PWA ordinary icons               | 192×192, 512×512                                                         | Opaque PNG `purpose: any`                                                                 | `public/brand/icons/`                                           |
| PWA maskable icons               | 192×192, 512×512                                                         | Separate opaque PNG `purpose: maskable`; crop-safe artwork                                | `public/brand/icons/`                                           |
| Large app/avatar master          | 1024×1024                                                                | SVG master + opaque PNG; circle/square crop checks                                        | `brand/source/`, `brand/exports/icons/`                         |
| Push icon                        | 192×192                                                                  | PNG; test notifications on supported target browsers                                      | `public/brand/icons/notification-192.png`                       |
| Default link preview             | 1200×630                                                                 | PNG, light/dark template variants; localized runtime copy as supported                    | Runtime OG route + `brand/templates/`                           |
| GitHub repository social preview | 1280×640                                                                 | PNG under 1 MB, with safe margin                                                          | `brand/exports/social/github-preview.png`                       |
| README banner                    | 1600×480                                                                 | SVG + PNG; light/dark versions for README picture selection                               | `brand/exports/repository/`                                     |
| Social square                    | 1080×1080                                                                | PNG; reusable static template + existing dynamic stats card                               | `brand/exports/social/`; keep API route                         |
| Portrait feed                    | 1080×1350                                                                | PNG; editable layout                                                                      | `brand/exports/social/`                                         |
| Story                            | 1080×1920                                                                | PNG; editable layout + existing dynamic stats card                                        | `brand/exports/social/`; keep API route                         |
| Landscape post                   | 1200×675                                                                 | PNG; sample launch announcement                                                           | `brand/exports/social/`                                         |
| Profile/organization cover       | 1584×396, 1500×500                                                       | PNG; recomposed per crop rather than stretched                                            | `brand/exports/social/`                                         |
| Email logo                       | 2× and 3× intended display width; initial 160 CSS px → 320/480 px export | Transparent or ground-backed PNG, proportional height; always text fallback               | `public/brand/email/`                                           |
| Email header                     | 1200×320                                                                 | PNG, rendered around 600 CSS px width where needed; optional, not mandatory decoration    | `public/brand/email/`                                           |
| Guidelines                       | Screen-readable + A4 printable                                           | Accessible HTML/Markdown source and a generated PDF                                       | `docs/brand/`, `brand/exports/`                                 |
| Optional print handoff           | Vector, physical dimensions specified per actual use                     | PDF/SVG; true CMYK only with chosen printer/profile, not renamed RGB                      | `brand/exports/print/` when requested                           |

Provide a restrained lane/pacing pattern as an editable SVG, a crop rule, and two or three illustration compositions for booking/working/check-in if they improve the final applications. Keep Lucide for functional UI icons rather than redrawing a large icon library solely for novelty. A mascot, native mobile-store package, merchandise catalog, and 3D mockups are not required for this web product; add them only for an actual use.

## Icon and image engineering

For maskable icons, place all critical artwork within the central circle of radius 40% of image width and extend an opaque background to the edges. A normal icon with transparent padding is not automatically a maskable icon. Test circle, rounded rectangle, and other masks. See [web.dev](https://web.dev/articles/maskable-icon).

Use true vector paths for final outlined logos; keep an editable source and record the typeface origin. Avoid runtime font dependencies in distributed wordmark SVGs. No embedded scripts, remote image dependencies, or editor metadata in runtime SVGs. Do not turn a generated bitmap into a fake SVG by wrapping it in an image element.

Use sRGB for web exports, correct MIME types, explicit dimensions/viewBox, and crisp transparent edges. Verify actual pixel dimensions rather than filenames. Record safe margins for cards and covers, crop overlay examples, minimum logo sizes, clearspace based on the selected geometry, and examples of prohibited distortion or recoloring. Do not invent the final clearspace unit before the geometry exists.

## Tokens and generated artifacts

Separate immutable creative colors from semantic runtime roles: accent, accent ink, ground, surface, text, muted text, borders, timing markers, success, warning, and danger. Supply light/dark values and measured foreground/background pairs. Keep typography, timer tabular numerals, spacing, radii, and reduced-motion behavior in the system.

The generation process must emit CSS values for the UI and literal values for OG/email. Do not import server-only app configuration into a browser-safe token module. Keep deployment identity resolution in `src/config/app.ts`.

Record the renderer versions, font revisions, generation command, and source digest. The future scripts should support one normal generation command, an arbitrary-size symbol export, and a read-only verification command. Suggested API, to be implemented rather than assumed present: `pnpm brand:generate`, `pnpm brand:export -- --asset symbol --size 2048`, `pnpm brand:check`.

Verification should find missing/extra exports, actual dimensions/MIME types, invalid SVGs, unexpected external dependencies, contrast pairs, missing font notices, and differences between committed outputs and regeneration. Commit intended runtime assets so ordinary contributors do not need design software to run the application. Avoid nondeterministic timestamps in generated binaries when checking reproducibility.

## Approval and license record

The future manifest needs a schema version, status (`draft` or `approved`), identity version, direction, explicit owner selection reference/date, source and token locations, source digests, font names/revisions/notices, and an export list. Each export needs its path, role, format, dimensions when raster, theme/color variant, source identity, and checksum. Only list files that actually exist. Do not treat a directory of concepts as an approved kit.

The repository currently declares `AGPL-3.0-only`; preserve that. Record original artwork authorship and third-party licenses. Vendored font binaries must retain their own OFL notices rather than being relabeled as AGPL. A separate trademark/brand-use policy is an owner decision: draft a clearly marked proposal if wanted, but do not silently impose new restrictions or imply trademark registration/clearance. At release, say exactly what applies to code, original art, fonts, and third-party imagery.

GitHub's repository social-preview setting requires a separate upload; committing `github-preview.png` alone does not apply the setting. Account avatars, social covers, and OAuth/provider brand settings are also separate external actions. The kit should include an upload checklist and report which actions are still outstanding without claiming to have updated them.
