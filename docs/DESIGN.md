---
name: FocusKept
description: Virtual coworking and body doubling in quiet lap-swimming lanes
colors:
  bg: "#f4f8fa"
  surface: "#ffffff"
  surface-2: "#eaf1f4"
  text: "#102f43"
  text-2: "#465e6b"
  text-3: "#4e6572"
  line: "#d3e0e6"
  line-strong: "#748b98"
  accent: "#08646b"
  accent-ink: "#ffffff"
  lane: "#e9f4f6"
  lane-strong: "#c8e2e7"
  grout: "#dce8ed"
  rope-red: "#d23b4e"
  rope-yellow: "#f3cc45"
  rope-yellow-deep: "#96731a"
  rope-white: "#ffffff"
  warm: "#725922"
  warm-soft: "#f3efdf"
  danger: "#a82c40"
  danger-soft: "#fbeaf0"
  ok: "#22634d"
  ok-soft: "#e5f3ec"
typography:
  display:
    fontFamily: "var(--font-big-shoulders), ui-sans-serif, system-ui, sans-serif"
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "var(--font-big-shoulders), ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "var(--font-big-shoulders), ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "var(--font-figtree), ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "var(--font-figtree), ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 550
rounded:
  sm: "10px"
  md: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
---

# Design System: FocusKept ("Lanes")

## Overview

**Creative North Star: "The Lap Swimming Lanes"**

FocusKept is structured around the physical metaphor of lap swimming lanes in a public pool. In a lap pool, you occupy your own lane while another swimmer works in the lane beside you. You do not talk, socialize, or stare across the water during a set; instead, you sense their steady presence in your peripheral vision, match the quiet rhythm of their effort, and stay committed to your workout without conversational overhead or self-consciousness. A single pace clock mounted on the pool wall governs the interval for everyone at the facility simultaneously.

This dynamic translates directly to virtual coworking and body doubling. Users enter a shared session, state their goal, and work silently on camera in their own designated lane. The pacing is anchored to standard wall-clock intervals (25, 50, or 75 minutes) partitioned into a brief check-in, an extended focus set, and a concluding wrap-up.

The primary aesthetic is light and aquatic: cool daylight falling across clean pool tiles, water-filled lane surfaces, and crisp grout divisions (`#f4f8fa` base ground, `#e9f4f6` lane bed, `#08646b` deep pool tile teal accent). The dark theme evokes a calm "night swim" (`#081c2a` midnight water ground, `#102b3c` surface tiles, `#7bcdd2` luminescent cyan accent).

**Key Characteristics:**

- **Quiet Co-Presence**: Interfaces emphasize calm, uncluttered accountability over social noise or constant notification streams.
- **Rhythmic Wall-Clock Pacing**: Sessions, timers, and schedules align strictly to synchronous intervals governed by the signature PaceClock.
- **Tonal Lane Architecture**: Screens are structured with alternating water-tinted lanes and single-rule boundaries rather than isolated, drop-shadowed card islands.
- **Athletic Industrial Typography**: Condensed display numbers and headings from Big Shoulders paired with legible geometric body copy from Figtree.
- **Tactile Pill Geometry**: Interactive buttons, chips, badges, and lane rope floats feature fully rounded pill contours with a minimum 44px touch target.

---

## Tokens

The design system uses CSS custom properties declared in `app/globals.css` and `src/config/brand.css`. Theme values toggle automatically via `:root` (light) and `[data-theme="dark"]` (dark), with fallback to system preferences via `@media (prefers-color-scheme: dark)`.

| Token                | Light Value                                             | Dark Value                                              | Purpose / Job                                                                   |
| :------------------- | :------------------------------------------------------ | :------------------------------------------------------ | :------------------------------------------------------------------------------ |
| `--bg`               | `#f4f8fa`                                               | `#081c2a`                                               | Root application ground; cool daylight pool deck or midnight water canvas.      |
| `--surface`          | `#ffffff`                                               | `#102b3c`                                               | Elevated surfaces: cards, modals, dropdown menus, table bodies, active inputs.  |
| `--surface-2`        | `#eaf1f4`                                               | `#193747`                                               | Secondary surface: calendar headers, segmented control tracks, disabled inputs. |
| `--text`             | `#102f43`                                               | `#edf6fa`                                               | Primary high-contrast ink for body text, headings, and active values.           |
| `--text-2`           | `#465e6b`                                               | `#c0d2dc`                                               | Secondary ink for descriptions, subtitles, table headers, and metadata.         |
| `--text-3`           | `#4e6572`                                               | `#a8bfcc`                                               | Muted ink for placeholder text, clock tick marks, and half-hour dashed lines.   |
| `--line`             | `#d3e0e6`                                               | `#2d4b5c`                                               | Subtle structural rules, card outlines, table borders, and divider lines.       |
| `--line-strong`      | `#748b98`                                               | `#668595`                                               | Prominent boundary rules, calendar grid edges, input borders, scrollbar thumbs. |
| `--accent`           | `#08646b`                                               | `#7bcdd2`                                               | Primary brand accent: buttons, active tab indicators, links, focus rings.       |
| `--accent-hover`     | `color-mix(in srgb, var(--accent), black 12%)`          | `color-mix(in srgb, var(--accent), white 12%)`          | Computed interactive hover tone for accent buttons and interactive elements.    |
| `--accent-soft`      | `color-mix(in srgb, var(--accent), var(--surface) 90%)` | `color-mix(in srgb, var(--accent), var(--surface) 86%)` | Soft tinted wash for active chips, selected booking slots, and avatars.         |
| `--accent-ink`       | `#ffffff`                                               | `#082735`                                               | High-contrast readable foreground ink for text placed on `--accent` fills.      |
| `--lane`             | `#e9f4f6`                                               | `#123543`                                               | Tinted water lane background: partner tiles, sidebar, table row hovers.         |
| `--lane-strong`      | `#c8e2e7`                                               | `#245060`                                               | Deeper water wash: video container backgrounds, group slot markers.             |
| `--grout`            | `#dce8ed`                                               | `#1e3b4c`                                               | Pool tile grid lines on marketing hero and the inactive PaceClock ring track.   |
| `--rope-red`         | `#d23b4e`                                               | `#ff7182`                                               | Red float on lane ropes, PaceClock hand, live session dot, calendar now-line.   |
| `--rope-yellow`      | `#f3cc45`                                               | `#f5d65d`                                               | Yellow float on lane ropes.                                                     |
| `--rope-yellow-deep` | `#96731a`                                               | `#dfbd45`                                               | Accessible high-contrast yellow for PaceClock intro and wrap-up arcs.           |
| `--rope-white`       | `#ffffff`                                               | `#e6f1f6`                                               | White spacer float between red and yellow lane rope segments.                   |
| `--warm`             | `#725922`                                               | `#dac58e`                                               | Warning status ink for cautionary notices and alerts.                           |
| `--warm-soft`        | `#f3efdf`                                               | `#302f27`                                               | Soft tinted background for warning banners and warning badges.                  |
| `--danger`           | `#a82c40`                                               | `#ffa6b1`                                               | Destructive action buttons, validation errors, invalid field borders.           |
| `--danger-soft`      | `#fbeaf0`                                               | `#402b3a`                                               | Soft tinted wash for destructive button hovers and error notices.               |
| `--ok`               | `#22634d`                                               | `#9bd9be`                                               | Success status ink for confirmation badges and completed states.                |
| `--ok-soft`          | `#e5f3ec`                                               | `#163c37`                                               | Soft tinted wash for success notices and positive state badges.                 |
| `--shadow`           | `0 3px 10px rgb(16 47 67 / 0.06)`                       | `0 3px 12px rgb(0 9 18 / 0.2)`                          | Resting ambient elevation for cards and containers.                             |
| `--shadow-lg`        | `0 12px 36px rgb(16 47 67 / 0.16)`                      | `0 14px 40px rgb(0 9 18 / 0.4)`                         | High elevation for modal dialogs, cookie consent, and floating toasts.          |
| `--radius`           | `14px`                                                  | `14px`                                                  | Standard container corner radius for cards, dialogs, and calendar frames.       |
| `--radius-sm`        | `10px`                                                  | `10px`                                                  | Compact radius for inputs, textareas, selects, notices, and avatar chips.       |
| `--radius-pill`      | `999px`                                                 | `999px`                                                 | Fully rounded pill radius for buttons, chips, badges, and segmented toggles.    |
| `--font-sans`        | `var(--font-figtree), ...`                              | `var(--font-figtree), ...`                              | Primary body typography, form controls, navigation, and metadata copy.          |
| `--font-display`     | `var(--font-big-shoulders), ...`                        | `var(--font-big-shoulders), ...`                        | Athletic condensed display type: headings, clock timers, metrics, prices.       |
| `--font-mono`        | `ui-monospace, Menlo, ...`                              | `ui-monospace, Menlo, ...`                              | Monospaced technical data, tokens, and code blocks.                             |
| `--ease-out`         | `cubic-bezier(0.16, 1, 0.3, 1)`                         | `cubic-bezier(0.16, 1, 0.3, 1)`                         | Standard exponential ease-out timing curve for all transitions.                 |

### Brand Accent Customization

The brand accent is decoupled from application internals and defined in `src/config/brand.css`:

```css
:root {
  --accent: #08646b;
  --accent-hover: color-mix(in srgb, var(--accent), black 12%);
}
[data-theme="dark"] {
  --accent: #7bcdd2;
  --accent-hover: color-mix(in srgb, var(--accent), white 12%);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --accent: #7bcdd2;
    --accent-hover: color-mix(in srgb, var(--accent), white 12%);
  }
}
```

Self-hosters change the visual identity by editing `--accent` in `src/config/brand.css`. The system automatically derives hover states via `color-mix()` and updates button fills, focus rings, link highlights, and calendar indicators throughout the application.

---

## Colors

The palette establishes an aquatic hierarchy: deep pool tile teals for authority and focus, tinted lane water for spatial containers, and intentional pool-equipment accents for temporal awareness.

### Primary

- **Pool Tile Teal** (`#08646b` light / `#7bcdd2` dark): The primary action and focus indicator. Used for primary pill buttons, active navigation, calendar selection badges, and focus rings.

### Rope Accents

- **Rope Red** (`#d23b4e` light / `#ff7182` dark): The pace indicator. Used exclusively for the PaceClock sweep hand and hub, LaneRope floats, the calendar live-time marker, and the active session dot.
- **Rope Yellow** (`#f3cc45` light / `#f5d65d` dark): Lane float accent segment on LaneRope.
- **Rope Yellow Deep** (`#96731a` light / `#dfbd45` dark): High-contrast yellow calibrated for accessible stroke lines on the PaceClock intro and wrap-up arcs.
- **Rope White** (`#ffffff` light / `#e6f1f6` dark): Neutral separator beads between red and yellow lane rope floats.

### Neutral Grounds & Lanes

- **Deck Ground** (`#f4f8fa` light / `#081c2a` dark): The foundational backdrop canvas.
- **Lane Water** (`#e9f4f6` light / `#123543` dark): Container fill for coworking lanes, dashboard summary cards, and alternating rows.
- **Deep Water** (`#c8e2e7` light / `#245060` dark): Video container placeholder fill and group booking indicators.
- **Tile Grout** (`#dce8ed` light / `#1e3b4c` dark): Subtle tile grid background lines and the inactive PaceClock perimeter track.

### Named Rules

**The Accent Override Rule.** The accent hue is configured in `src/config/brand.css`. All functional derivatives (`--accent-soft`, `--accent-hover`, caret colors, selection highlights) compute automatically from `--accent`.

**The Rope Separation Rule.** `--rope-red` and `--rope-yellow` are equipment markers reserved exclusively for temporal progress and lane dividers. They are never used as general interface accents, button colors, or notification backgrounds.

---

## Typography

Typography pairs an athletic condensed display face with a clean, modern geometric sans-serif:

- **Display Font:** `Big Shoulders` (`--font-display`), loaded via `next/font/google` in `app/[locale]/layout.tsx`.
- **Body Font:** `Figtree` (`--font-sans`), loaded via `next/font/google` in `app/[locale]/layout.tsx`.
- **Monospace Font:** System font stack (`--font-mono`: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`).

### Scale and Hierarchy

| Role                    | Weight  | Size / Clamp                | Line Height | Tracking   | Purpose / Usage                                    |
| :---------------------- | :------ | :-------------------------- | :---------- | :--------- | :------------------------------------------------- |
| **Hero Display**        | 750     | `clamp(64px, 7.6vw, 108px)` | `0.93`      | `-0.025em` | Marketing hero titles; uppercase, balanced.        |
| **Pace Timer**          | 650–700 | `clamp(56px, 6vw, 88px)`    | `1.0`       | `-0.025em` | Session room and demo countdown clocks; tabular.   |
| **Page Title (h1)**     | 650–750 | `clamp(40px, 5vw, 64px)`    | `1.05`      | `-0.025em` | Primary view headings, dashboard titles.           |
| **Section Head (h2)**   | 700     | `clamp(36px, 4.5vw, 56px)`  | `1.05`      | `-0.015em` | Major section breaks and marketing headers.        |
| **Card / Subhead (h2)** | 650–700 | `32px`                      | `1.15`      | `-0.015em` | Content section headings and modal titles.         |
| **Title (h3)**          | 650–700 | `24px`–`26px`               | `1.2`       | Normal     | Card headers and timeline milestones.              |
| **Subhead (h4)**        | 650     | `15px`                      | `1.4`       | Normal     | Figtree UI headings and footer headers.            |
| **Stat Metric**         | 650–750 | `30px`–`44px`               | `1.0`–`1.1` | `-0.02em`  | Metric callouts and dashboard streaks; tabular.    |
| **Lead Paragraph**      | 400     | `18px`                      | `1.6`       | Normal     | Introductions and subtitles; max 65ch width.       |
| **Body**                | 400     | `15px`                      | `1.55`      | Normal     | Standard readable prose, inputs, and descriptions. |
| **Small / Meta**        | 400–550 | `13px`–`14px`               | `1.5`       | Normal     | Timestamps, table cells, form hints, badges.       |

### Tabular Numerals

All numbers representing time, session durations, schedule indices, prices, calendar hours, and streak metrics MUST render with tabular figures:

```css
.tabular,
time,
.timer,
.price,
.stat,
.table,
.cal,
.badge {
  font-variant-numeric: tabular-nums;
}
```

### Named Rules

**The Tabular Clock Rule.** Any element presenting elapsed time, remaining minutes, or numeric counts must specify `font-variant-numeric: tabular-nums`. Digits must never cause jitter or horizontal movement during countdowns.

**The No-Eyebrow Rule.** Uppercase tracking overline labels above headings are forbidden globally (`.overline { display: none; }`). Overlines are permitted only in specific form headers or empty state contexts.

---

## Layout

The spatial model organizes screens into horizontal lane bands and asymmetric division lines rather than disconnected islands.

### Dimensions and Containers

- **Standard Container** (`.container`, `.site-header-inner`, `.content`): `max-width: 1200px` centered with `padding: 0 28px` (desktop) and `0 16px` (mobile).
- **Narrow Container** (`.content-narrow`): `max-width: 760px` for reading views and forms.
- **Stage Container** (`.stage`, `.top`, `.controls`, `.bar` in room views): `width: min(100%, 1440px)` centered.

### Application Shell

- **Desktop (≥760px)**: Two-column grid (`.app`: `grid-template-columns: 240px minmax(0, 1fr)`). Sticky lane-toned sidebar on the left with sticky top bar above content.
- **Mobile (<760px)**: Single column with sidebar hidden. Navigation moves to a fixed bottom bar (`.mobile-nav`: 5-column grid, `min-height: 52px` per touch item, with safe-area padding).

### Breakpoints

- **1280px**: Group rooms expand to 3 video columns with desktop lane ropes.
- **1100px**: Site header navigation condenses spacing.
- **960px / 900px**: Marketing desktop navigation collapses; hero grid stacks to a single column.
- **760px**: Primary layout shift: sidebar collapses to bottom nav, calendar shifts time gutters, room ropes change from vertical to horizontal.
- **430px**: Small mobile: header logo text collapses to icon mark only.

---

## Elevation & Depth

FocusKept avoids floating heavy drop shadows. Depth is achieved tonally through crisp surface layering bounded by hairline borders.

### Surface Stacking

1. Base ground: `--bg`
2. Inset / water container: `--lane`
3. Primary interactive surface: `--surface`
4. Raised control or header: `--surface-2`

### Shadow Vocabulary

- **Resting Shadow** (`--shadow: 0 3px 10px rgb(16 47 67 / 0.06)`): Subtle definition for primary cards and content surfaces.
- **Modal Elevation** (`--shadow-lg: 0 12px 36px rgb(16 47 67 / 0.16)`): Dialogs, floating consent banners, toasts, and the interactive pool demo.

### Named Rules

**The Tonal Depth Rule.** Depth is created through contrasting surface fills (`--bg`, `--lane`, `--surface`) separated by 1px solid borders (`--line`, `--line-strong`), never through multi-layered ambient blur shadows.

---

## Shapes

The geometric signature combines fully rounded pill contours for actions with softly rounded rectangles for structural viewports.

- **Pill Contours** (`--radius-pill: 999px`): Applied to all buttons, input chips, status badges, segmented tabs, calendar reservation indicators, and LaneRope float caps.
- **View Containers** (`--radius: 14px`): Structural cards, session room video lane tiles, dialog viewports, and the main calendar container.
- **Sub-surfaces** (`--radius-sm: 10px`): Form inputs, select dropdowns, textareas, and notice banners.

---

## Components

### Signature Components

#### 1. PaceClock (`src/components/lanes/pace-clock.tsx`)

The primary pacing instrument of FocusKept. Renders an SVG swimming pace clock that sweeps continuously across the duration of a session:

```tsx
interface PaceClockProps {
  progress: number; // Completed share of session (0..1)
  focusFrom: number; // Fraction where focus begins (e.g. 0.06 for 3m in 50m)
  wrapFrom: number; // Fraction where wrap-up begins (e.g. 0.94)
  phase: PacePhase; // "waiting" | "intro" | "focus" | "wrap" | "ended"
  size?: number; // Pixel width/height (default: 56)
  label?: string; // Accessible description ("Focus, 18 minutes left")
  className?: string;
}
```

- **Visual Anatomy**:
  - Center face in `var(--surface)`.
  - Outer perimeter track in `var(--grout)` with active phase highlighting.
  - Arcs for intro and wrap-up rendered in `var(--rope-yellow-deep)`.
  - Main focus arc rendered in `var(--accent)`.
  - Cardinal quarter-hour tick marks at 0, 15, 30, and 45 minutes in `var(--text-3)`.
  - Sweeping clock hand and center pivot circle in `var(--rope-red)`.

#### 2. LaneRope (`src/components/lanes/lane-rope.tsx`)

A decorative swimming lane float divider placed between participant workstations:

```tsx
interface LaneRopeProps {
  vertical?: boolean; // Horizontal (default) or vertical divider
  className?: string;
}
```

- **Visual Anatomy**: Rendered as a `span[aria-hidden="true"]` with `height: 8px` (horizontal) or `width: 8px` (vertical), rounded pill terminals (`border-radius: 999px`), and a repeating linear gradient of swimming floats:
  - Red float (`var(--rope-red)`: 14px)
  - White spacer (`var(--rope-white)`: 5px)
  - Yellow float (`var(--rope-yellow)`: 14px)
  - White spacer (`var(--rope-white)`: 5px)

#### 3. The Lane-Schedule List Pattern

Replaces repetitive card grids across dashboards and marketing directories. Entries are laid out as horizontal lanes with a single 1px solid dividing line (`var(--line)`):

- Tabular two-digit index numerals (`.scheduleNumber` in Big Shoulders, e.g. "01", "02").
- Session title and partner info with hover wash (`background: var(--lane)`).
- Pill button or arrow link aligned to the right.

#### 4. The Booking Grid as a Lane Schedule Board

An aquatic facility schedule board (`.cal`, `.cal-scroll`, `.cal-head`, `.cal-time`, `.slot`):

- Time gutter column on the left (`--cal-gutter: 64px` / mobile `76px`) in Big Shoulders.
- Sticky day headers with large day numbers (`strong` in 34px Big Shoulders); current day highlighted in `--accent-soft`.
- Half-hour slot rows with dashed borders (`border-top-style: dashed`).
- Popular slots washed with `--lane`.
- User's booked sessions marked with an inset pill badge in `--accent` (`.mine`).
- Live time indicated by a horizontal line in `--rope-red` (`.cal-now`) spanning the grid with a circular pip.

#### 5. The Session Room Layout (`app/[locale]/session/[id]/room.module.css`)

- **Top Bar**: Session metadata, live PaceClock paired with large countdown timer (`.timer`), and current phase guidance text.
- **Stage**: Video tiles formatted as swimming lanes (`.lane` with 4:3 `.media` video), separated by `LaneRope` (horizontal between stacked lanes on mobile, vertical between columns on desktop).
- **Controls Dock**: Fixed or sticky bottom bar (`.bar`) holding pill buttons for mic, camera, settings, and session exit, with collapsible drawer sections for setting goals and logging outcomes.

### Standard UI Primitives

#### Buttons

Every button is pill-shaped with a minimum 44px touch target:

- **Primary** (`.button`): `background: var(--accent)`, `color: var(--accent-ink)`, `border-radius: var(--radius-pill)`, padding `10px 20px`.
- **Secondary** (`.button.secondary`): `background: var(--surface)`, `color: var(--text)`, `border: 1px solid var(--line-strong)`.
- **Ghost** (`.button.ghost`): `background: transparent`, `color: var(--text)`.
- **Danger** (`.button.danger`): `background: var(--danger)`, `color: var(--surface)`.
- **Icon** (`.button.icon`): `width: 44px`, `min-width: 44px`, `padding: 0`.

#### Inputs & Forms

- Inputs, textareas, and selects use `.input` or `.field input` with `min-height: 44px`, `border: 1px solid var(--line-strong)`, `border-radius: var(--radius-sm)`, and `background: var(--surface)`.
- Caret color set to `var(--accent)`. Focus visible shifts border and draws a 2px solid `var(--accent)` ring.
- Checkboxes use `.check` with 44px touch container and `accent-color: var(--accent)`.
- Chips (`.chip`) use pill geometry (`var(--radius-pill)`), highlighting in `--accent-soft` with `--accent` text when selected.

#### Notices & Badges

- Notices (`.notice`) provide status callouts with `border-radius: var(--radius-sm)`. Variants include `.ok`, `.warn`, and `.error`.
- Badges (`.badge`) display compact pill tags (`min-height: 26px`, padding `3px 10px`) with tabular numerals.

---

## Do's and Don'ts

### Do:

- **Do** format all time displays, session countdowns, stats, prices, and metrics with `font-variant-numeric: tabular-nums`.
- **Do** use `Big Shoulders` for display headings, numbers, timers, schedule indices, and calendar day figures.
- **Do** style all buttons, chips, badges, and segmented toggles as pills (`border-radius: var(--radius-pill)`).
- **Do** ensure all interactive controls satisfy the minimum 44px by 44px touch target requirement (`min-height: 44px`, `min-width: 44px`).
- **Do** limit `--rope-red` to temporal pacing elements: the PaceClock hand, LaneRope floats, live indicators, and calendar now-line.
- **Do** limit `--rope-yellow` / `--rope-yellow-deep` to LaneRope floats and PaceClock intro/wrap arcs.
- **Do** structure depth using tonal lane surfaces (`--lane`) and single 1px borders rather than nested drop-shadowed cards.
- **Do** use `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`) for UI transitions.
- **Do** respect `@media (prefers-reduced-motion: reduce)` by disabling transitions and animations globally.
- **Do** maintain WCAG AA contrast across both light and dark themes.

### Don't:

- **Don't** use eyebrow labels or small uppercase tracking overlines above section titles (`.overline` is hidden by default).
- **Don't** use gradient text or text clipping tricks on headings; display type must remain solid ink.
- **Don't** create identical 3-card or 4-card feature grids; use linear schedule lists or asymmetric 2-column layouts.
- **Don't** use colored side-stripe borders on the left edges of cards, tiles, or notices.
- **Don't** use square or lightly rounded corners on buttons (no 4px or 8px action buttons).
- **Don't** use `--rope-red` for general error states or destructive alerts (use `--danger`).
- **Don't** use `--rope-yellow` for warning banners or caution notices (use `--warm`).
- **Don't** use `:global()` inside CSS modules; the parser rejects it.

---

## Adding a New Screen

When contributing a new view or feature to FocusKept, follow these architectural rules to preserve consistency and build compatibility:

### 1. Reuse Global Classes and Patterns

Before authoring custom CSS, leverage the global utility classes from `app/globals.css`:

- **Shell**: `.app` (grid container), `.sidebar`, `.topbar`, `.topbar-title`, `.content` (1200px max width), `.content-narrow` (760px).
- **Layout**: `.stack` (16px gap), `.stack-sm` (8px gap), `.stack-lg` (28px gap), `.row` (10px flex wrap), `.row-between`, `.grow`.
- **Surfaces**: `.card`, `.card.tight`, `.notice` (`.ok`, `.warn`, `.error`), `.badge` (`.accent`, `.warm`, `.ok`, `.danger`), `.avatar`.
- **Actions**: `.button`, `.button.secondary`, `.button.ghost`, `.button.danger`, `.button.small`, `.button.icon`.
- **Forms**: `.form`, `.field`, `.input`, `.check`, `.chip`, `.chips`, `.segmented`.
- **Typography**: `.muted` (`var(--text-2)`), `.faint` (`var(--text-3)`), `.small` (13px), `.lead` (18px), `.tabular` / `time` (tabular figures).

### 2. CSS Modules Must NOT Use `:global()`

The repository's build pipeline uses a modern CSS parser that rejects the `:global(...)` selector pseudo-class.

To target or modify global utility classes from within a scoped CSS module, **use attribute selectors**:

```css
/* CORRECT: Attribute selector matches global class */
.container [class~="button"] {
  min-height: 48px;
}

.section > article[class~="card"] {
  padding: 24px 0 0;
  border: 0;
  border-top: 1px solid var(--line-strong);
}

/* INCORRECT: The CSS parser rejects this */
.container :global(.button) {
  min-height: 48px;
}
```

### 3. Turbopack CSS Modules Excluded from Tailwind Loader

In `next.config.ts`, CSS modules are explicitly excluded from the Tailwind loader:

```ts
turbopack: {
  rules: {
    "*.css": {
      condition: { not: { path: /\.module\.css$/ } },
      loaders: ["@tailwindcss/turbopack"],
      as: "*.css",
    },
  },
},
```

This configuration ensures CSS modules maintain scoped class names without Tailwind compilation overhead or syntax conflicts. Page-specific modules (`*.module.css`) should reference design system CSS custom properties directly via `var(--...)`. Tailwind utilities remain available across global templates and pages.
