// SPDX-License-Identifier: AGPL-3.0-only
export type CspDirectives = Record<string, string[]>;

export const CSP_DIRECTIVES: CspDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  "media-src": ["'self'", "blob:"],
  "connect-src": [
    "'self'",
    "https://rtc.live.cloudflare.com",
    "wss:",
  ],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": [
    "'self'",
    "https://accounts.google.com",
    "https://*.polar.sh",
    "https://polar.sh",
  ],
  "object-src": ["'none'"],
  "upgrade-insecure-requests": [],
};

export function buildContentSecurityPolicy(
  directives: CspDirectives = CSP_DIRECTIVES,
): string {
  return Object.entries(directives)
    .map(([directive, sources]) =>
      sources.length > 0 ? `${directive} ${sources.join(" ")}` : directive,
    )
    .join("; ");
}

export const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();

export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Content-Security-Policy",
    value: CONTENT_SECURITY_POLICY,
  },
];

export function getSecurityHeaders() {
  return SECURITY_HEADERS;
}
