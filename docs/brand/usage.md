# Side by Side usage

Direction A selected on 23 November 2026. Production vector kit version 1.0.0 was approved for local integration on 24 November 2026 and is used by the app. [Preview](../../brand/exports/preview.png), [guidelines](../../brand/exports/FocusKept-guidelines.pdf), and [inventory](../../brand/manifest.json) describe the delivered artwork.

## Logo

The two companion forms are independent paths separated by a flowing channel. The relationship, proportions, terminal shapes, and negative space are the signature. The engineered geometry follows the selected A concept, with a darker secondary teal for useful small-size visibility. Final artwork is flat and path-based; the initial generated exploration board is not a production source.

| Variant suffix | Use                                                                 |
| -------------- | ------------------------------------------------------------------- |
| `primary`      | Pool teal + companion teal symbol, deep-ink wordmark, light ground  |
| `dark`         | Pale/light teal symbol and light-teal wordmark on dark grounds      |
| `ink`          | Entire mark/wordmark in deep ink for one-color light applications   |
| `white`        | Entire mark/wordmark in white for dark or photographic grounds      |
| `teal`         | Entire mark/wordmark in pool teal when a single brand ink is needed |

The mark, micro mark, horizontal lockup, wordmark, and stacked lockup each have these variants. Transparent PNG exports come in 64/128/256/512/1024 px widths for symbols and 320/640/1280 px widths for wordmark/lockups. Vector masters remain scalable to any size. White transparent artwork appears blank on a white viewer; place it on a dark ground.

Keep at least 20 design units of clearspace around the 108-unit symbol box (approximately one fifth of its height). Use the micro cut below 32 CSS px, with 16 CSS px as the minimum. Use the full mark at 32 px and above. Horizontal lockup minimum width is 144 CSS px; stacked minimum is 120 CSS px. These are kit-specific optical guidelines, not platform laws. The intrinsic SVG canvas is tight; add clearspace in layout.

Do not stretch, tilt, add shadows/gradients, close the channel, recolor individual halves arbitrarily, or put the full wordmark into a tiny avatar. On busy imagery, use a clear single-color version with a suitable backing surface.

## Color and type

| Role                   | Hex       |
| ---------------------- | --------- |
| Primary pool teal      | `#08646b` |
| Companion symbol teal  | `#3d9fa8` |
| Deep ink               | `#102f43` |
| Mist ground            | `#f4f8fa` |
| Night-water ground     | `#081c2a` |
| Pale dark-theme accent | `#7bcdd2` |

`brand/tokens.json` separates creative palette from semantic light/dark roles. Existing success, danger, warning, timing, border, and text roles remain distinct. Red and yellow are optional timing details, not required for logo recognition. Never rely on hue alone to convey session status.

Figtree carries body copy, UI labels, and timers. Big Shoulders carries display headings. The outlined wordmark uses Figtree 750 with custom spacing; application text should still use actual fonts. Timers use Figtree 600 with `font-variant-numeric: tabular-nums`. Production checks found that the supplied Big Shoulders font does not provide equal numeral advances when `tnum` is requested, while Figtree does. A CSS declaration alone cannot add a missing font feature. This is a deliberate refinement of the concept and must be applied to the actual countdown during integration. Use existing localized strings and runtime product-name interpolation rather than baking “FocusKept” into custom self-hosted deployments.

## Icons and metadata

Use the ordinary icon for standard app/avatar treatment. Use the separate maskable icon when manifest purpose is `maskable`; it has an opaque edge-to-edge ground and the critical mark inside the central 40%-radius safe circle. The 180 px Apple export has no pre-rounded outer canvas. Notification PNG is 192 px. The ICO contains real 16/32/48 px PNG frames, and the SVG favicon has a dark-color-scheme override.

In the app, `/favicon.ico`, `/icon.svg` and `/apple-touch-icon.png` are the kit files copied to their manifest `targetPath` and declared in `app/[locale]/layout.tsx` metadata (there are no `app/` icon file conventions, so each URL has one source). `app/manifest.ts` lists the 192/512 `any` and `maskable` PNGs from `/brand/icons/`; the service worker uses `/brand/icons/notification-192.png`.

## Social, email, and repository

The kit contains light/dark 1200×630 OG cards, 1280×640 GitHub previews, 1080×1080 square cards, 1080×1350 portrait cards, 1080×1920 stories, 1200×675 landscape cards, 1584×396 and 1500×500 covers, and 1600×480 README banners. Crop layouts are recomposed, not stretched. The static cards contain no invented customer testimonials or usage statistics.

Email logos are PNGs at 320/480 px wide for an intended 160 CSS px display width. The app sends `logo-badge-480.png` (the white lockup on an opaque deep-ink plate, shown at 160×48) in a deep-ink header band: mail clients that force dark mode recolor backgrounds but not images, so a transparent logo can vanish while the opaque badge cannot. Use the intrinsic ratio and explicit dimensions, absolute deployment URLs, useful text fallback, and email-safe inline styling. The optional header is 1200×320. Do not assume a user-supplied `LOGO_URL` is SVG-safe, a PNG, or a server-fetchable trusted source.

The dynamic OG image (`app/[locale]/opengraph-image.tsx`, one per locale) and the public progress cards (`/api/share/<username>/square|story`) render with the same mark, palette and kit fonts via `src/lib/brand/og.tsx`. Static deliverables do not update those renderers; they share tokens and geometry instead. In email, the white lockup sits on a deep-ink header band so it stays legible when clients darken mail; custom deployment names are shown as text.

Committing a GitHub preview does not apply repository Settings. Account avatars, covers, OAuth provider settings, and external social accounts require separate uploads when instructed.

## Ownership and maintenance

Preserve the existing code license. Original kit artwork is supplied under the repository's AGPL-3.0-only terms, with no new brand-use restrictions added. Original and instantiated font software retains OFL notices. This is no claim that a trademark was registered or cleared.

The glyphs in artwork are outlined; SVG templates are shape-editable but their text is not live text. Edit the text and layout in `scripts/brand/generate.mjs` to regenerate coherent assets. The PDF is a vector visual guide; this Markdown document provides the selectable, readable source guidance.
