# Technical SEO, Structured Data, and AI Search (GEO)

This guide documents FocusKept's search architecture, metadata conventions, structured data, AI search discovery (GEO), and operations.

---

## 1. Overview & Architecture

FocusKept is built with a search-first and agent-first architecture:

1. **Server-Side Rendering (SSR)**:
   - Next.js 16 App Router renders complete HTML on the server.
   - AI and search crawlers receive complete headings, copy, internal links, and structured data without executing client-side JavaScript.
2. **Robots Policy (`app/robots.ts`)**:
   - Allows search discovery and AI answer crawlers on all public pages:
     `Googlebot`, `Bingbot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `ClaudeBot`, `Claude-User`, `Claude-SearchBot`, `Applebot`, `DuckDuckBot`.
   - Allows training and grounding crawlers that directly power consumer answer engines:
     `GPTBot` (ChatGPT browsing and citations), `Google-Extended` (Gemini grounding and AI Overviews).
   - Blocks aggressive bulk training scrapers that do not provide referral traffic or search citations:
     `CCBot` (Common Crawl).
   - Disallows private, app, and authenticated paths across all locales:
     `/api/`, `/dashboard`, `/book`, `/session`, `/settings`, `/admin`, `/onboarding`, `/people`, `/progress`, `/billing`, `/invite`, `/groups`, `/challenges`, `/hosting`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/r/`.
   - Advertises the sitemap at `https://<domain>/sitemap.xml`.
3. **XML Sitemap (`app/sitemap.ts`)**:
   - Dynamically lists every public page across all supported locales (`en`, `de`, `fr`, `nl`, `es`).
   - Generates full reciprocal `<xhtml:link>` alternates including `x-default`.
   - Includes accurate ISO `lastModified` timestamps derived from content updates and blog dates.
   - Automatically excludes noindex and private routes.
4. **AI Context Files (`llms.txt` and `llms-full.txt`)**:
   - `https://<domain>/llms.txt`: A concise markdown summary following the [llmstxt.org](https://llmstxt.org) standard. Contains product description, key facts, pricing details, and links to how-it-works, FAQ, pricing, use-case hubs, comparison pages, and blog posts.
   - `https://<domain>/llms-full.txt`: Comprehensive reference including full text of How It Works stages, all FAQ questions and answers, and complete Markdown bodies of all blog posts.
   - Served with `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`.
5. **Structured Data (`src/lib/seo/schema.ts`)**:
   - Standardized Schema.org JSON-LD structured data.
   - Emits a single `@graph` per page to connect entity relationships cleanly.
   - Implements `Organization`, `WebSite`, `WebApplication`, `BreadcrumbList`, `FAQPage`, `HowTo`, `BlogPosting`, and `ProfilePage`.
6. **Search Engine Verification (`src/components/seo/verification.tsx`)**:
   - Renders Google and Bing verification tags based on runtime environment variables.
7. **Instant Indexing (`src/lib/seo/indexnow.ts`, `scripts/indexnow.mjs`)**:
   - Implements the IndexNow protocol to instantly alert Bing, Yandex, and Seznam to updated URLs.

---

## 2. Adding a New Page

### Marketing & Landing Pages
When creating a new public marketing page:
1. Define page metadata with `pageMetadata` or `translatedMetadata` from `@/src/lib/content/marketing`:
   ```ts
   import { translatedMetadata, type LocaleProps } from "@/src/lib/content/marketing";

   export async function generateMetadata({ params }: LocaleProps) {
     return translatedMetadata(params, "myNamespace", "/my-page");
   }
   ```
2. Adhere to character limits:
   - **Title**: Maximum 60 characters (including branding). Primary topic first.
   - **Description**: Maximum 155 characters. Clear value proposition and intent match.
3. Metadata guarantees:
   - Self-referencing canonical URL.
   - Complete reciprocal hreflang annotations with `x-default`.
   - Open Graph card with `type: "website"`, title, description, and `/opengraph-image`.
   - Twitter card with `card: "summary_large_image"`.
   - Robots header: `max-image-preview: "large"`.
   - Trailing slashes consistently stripped.

### Structured Data (`@graph`)
Every page with structured data must output exactly one `<script type="application/ld+json">` tag containing a `@graph` array:
```tsx
import { JsonLd } from "@/src/components/marketing/json-ld";
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildGraph,
} from "@/src/lib/seo/schema";

<JsonLd
  data={buildGraph([
    buildBreadcrumbSchema([
      { name: "Home", url: absoluteUrl("/") },
      { name: "My Page", url: absoluteUrl("/my-page") },
    ]),
    buildFaqSchema(faqs),
  ])}
/>
```

### Adding a Blog Post
1. Add a new markdown file in `content/blog/<slug>.md`.
2. Include required frontmatter:
   ```yaml
   ---
   title: "Practical Guide to Body Doubling"
   description: "How quiet video focus sessions help remote workers overcome task paralysis."
   date: "2026-11-22"
   author: "FocusKept Team"
   ---
   ```
3. Blog posts are automatically:
   - Added to `/blog` and `/blog/<slug>`.
   - Listed in `sitemap.xml` with `lastModified: post.date`.
   - Included in `llms.txt` and `llms-full.txt`.
   - Marked up with `BlogPosting` and `BreadcrumbList` schemas.

### Adding a Programmatic SEO Page
1. Add the page definition to the appropriate template in `content/seo/<template>.json` (e.g. `body-doubling-for.json`, `study-with-me.json`, `virtual-coworking-for.json`, or `alternatives.json`).
2. Include localized translations in `content/seo/<locale>/<template>.json`.
3. Provide:
   - `slug`: kebab-case unique slug
   - `title`: ≤ 60 characters with `{app}` placeholder
   - `description`: ≤ 155 characters
   - `h1`: descriptive heading
   - `intro`: introductory context
   - `sections`: structured H2 sections and paragraphs
   - `faq`: question and answer pairs
   - `cta`: heading and body
   - `keywords`: target search queries
4. Pages are automatically integrated into routes, sitemaps, breadcrumbs, and `llms.txt`.

---

## 3. Search Engine Verification

### Google Search Console
1. In Search Console, select **Add property** → **URL prefix** (e.g. `https://focuskept.com`).
2. Choose **HTML tag** as the verification method.
3. Copy the `content` token from the tag `<meta name="google-site-verification" content="TOKEN" />`.
4. In `runtime.env`, add:
   ```env
   GOOGLE_SITE_VERIFICATION=TOKEN
   ```
5. Deploy or restart the application.
6. Click **Verify** in Search Console.

### Bing Webmaster Tools
1. In Bing Webmaster Tools, add the site URL.
2. Select **HTML Meta Tag** verification.
3. Copy the token from `<meta name="msvalidate.01" content="TOKEN" />`.
4. In `runtime.env`, add:
   ```env
   BING_SITE_VERIFICATION=TOKEN
   ```
5. Deploy or restart the application.
6. Click **Verify** in Bing Webmaster Tools.

---

## 4. Submitting Sitemaps

The XML sitemap is generated dynamically at:
`https://<domain>/sitemap.xml`

### Google Search Console
1. Go to **Sitemaps** in the left sidebar.
2. Enter `sitemap.xml` under **Add a new sitemap**.
3. Click **Submit**.

### Bing Webmaster Tools
1. Go to **Sitemaps** in the left navigation.
2. Click **Submit sitemap**.
3. Enter `https://<domain>/sitemap.xml`.
4. Click **Submit**.

---

## 5. IndexNow Integration

IndexNow allows instant notification of URL changes to Bing, Yandex, and Seznam. When a page is published or updated, search engines crawl it within minutes.

### Configuration
1. Generate a random key (8 to 128 hexadecimal characters):
   ```sh
   openssl rand -hex 16
   ```
2. Set the key in `runtime.env`:
   ```env
   INDEXNOW_KEY=0123456789abcdef0123456789abcdef
   ```
3. Verification is served automatically at:
   `https://<domain>/indexnow-key.txt`

### Post-Deployment Ping
Run the ping script after deploying changes:
```sh
node scripts/indexnow.mjs
```
To submit specific changed URLs:
```sh
node scripts/indexnow.mjs https://focuskept.com/blog/new-post https://focuskept.com/pricing
```
When `INDEXNOW_KEY` is not set, the script exits cleanly without performing requests.

---

## 6. Social Profiles for Knowledge Graph (`sameAs`)

To link FocusKept's Schema.org Organization to external profiles for entity recognition and AI citations:
1. In `runtime.env`, define comma-separated profile URLs:
   ```env
   SOCIAL_PROFILES="https://github.com/gojayevmurad/focuskept,https://twitter.com/focuskept,https://linkedin.com/company/focuskept"
   ```
2. These URLs are merged into the `Organization.sameAs` structured data array across all marketing pages.
