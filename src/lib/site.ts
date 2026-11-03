import config from "@/saas.config.json";

/**
 * Public canonical origin, known at build time so statically rendered pages
 * (canonical URLs, hreflang, sitemap, OG images) never bake in a dev host.
 * Runtime-only URLs (email links, checkout returns) use APP_URL from env.
 */
export function appUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || `https://${config.domain}`
  ).replace(/\/$/, "");
}
