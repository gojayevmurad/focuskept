#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Fills runtime.env with third-party credentials. Run it yourself on the server,
# in the deployment directory:
#
#   bash configure-runtime.sh <app-url> <image> [old-runtime.env]
#
#   app-url          https://your.domain (where this instance is served)
#   image            the image to deploy, used to generate web push keys
#   old-runtime.env  optional: an existing runtime.env to copy shared keys from
#
# Secrets are read with hidden prompts or copied file to file; nothing is printed.
set -euo pipefail
cd "$(dirname "$0")"
app_url="${1:?Pass the public URL, e.g. https://example.com}"
image="${2:?Pass the image, e.g. local/app:<git sha>}"
old="${3:-}"
file=runtime.env
[[ -f "$file" ]] || { echo "runtime.env is missing; copy the generated bundle first" >&2; exit 1; }
[[ "$app_url" =~ ^https://[a-z0-9.-]+$ ]] || { echo "Use https://host without a path" >&2; exit 1; }
umask 077

set_var() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp "$file.XXXX")"
  grep -v "^${key}=" "$file" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$file"
}
old_value() { [[ -n "$old" && -f "$old" ]] && sed -n "s/^$1=//p" "$old" | tail -n 1 || true; }
copy_var() {
  local value
  value="$(old_value "$1")"
  if [[ -n "$value" ]]; then set_var "$1" "$value"; echo "  $1 copied"; else echo "  $1 not found in $old"; fi
}
ask() { local answer; read -r -p "$1 " answer; printf '%s' "$answer"; }
ask_secret() { local answer; read -r -s -p "$1 " answer; echo >&2; printf '%s' "$answer"; }
confirm() { [[ "$(ask "$1 [y/N]")" =~ ^[Yy] ]]; }

set_var APP_URL "$app_url"
set_var EMAIL_MODE send
set_var MARKETING_ENABLED true
set_var SIGNUPS_MODE open

echo "== Email (Resend), Google sign-in, PostHog and Sentry"
if [[ -n "$old" ]] && confirm "Copy these from $old?"; then
  for key in RESEND_API_KEY EMAIL_FROM GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET NEXT_PUBLIC_POSTHOG_KEY NEXT_PUBLIC_POSTHOG_HOST SENTRY_DSN NEXT_PUBLIC_SENTRY_DSN; do copy_var "$key"; done
else
  set_var RESEND_API_KEY "$(ask_secret "Resend API key:")"
  set_var EMAIL_FROM "$(ask "Sender, e.g. FocusKept <no-reply@example.com>:")"
  if confirm "Set up Google sign-in?"; then
    set_var GOOGLE_CLIENT_ID "$(ask "Google client ID:")"
    set_var GOOGLE_CLIENT_SECRET "$(ask_secret "Google client secret:")"
  fi
fi
if [[ -n "$(sed -n 's/^NEXT_PUBLIC_POSTHOG_KEY=//p' "$file")" ]]; then set_var ANALYTICS_ENABLED true; else set_var ANALYTICS_ENABLED false; fi

echo "== Video (Cloudflare Realtime)"
set_var VIDEO_PROVIDER cloudflare
set_var CLOUDFLARE_REALTIME_APP_ID "$(ask "Realtime app ID:")"
set_var CLOUDFLARE_REALTIME_APP_TOKEN "$(ask_secret "Realtime app token:")"
set_var CLOUDFLARE_TURN_KEY_ID "$(ask "TURN key ID:")"
set_var CLOUDFLARE_TURN_KEY_TOKEN "$(ask_secret "TURN key API token:")"
if confirm "Watch monthly video usage (needs an account ID and an Analytics read token)?"; then
  set_var CLOUDFLARE_ACCOUNT_ID "$(ask "Cloudflare account ID:")"
  set_var CLOUDFLARE_ANALYTICS_TOKEN "$(ask_secret "Analytics API token:")"
fi

echo "== Billing (Polar)"
if confirm "Turn on billing now?"; then
  set_var BILLING_ENABLED true
  set_var POLAR_ENVIRONMENT "$(ask "Polar environment (production or sandbox):")"
  if [[ -n "$old" ]] && confirm "Copy the Polar token and webhook secret from $old?"; then
    copy_var POLAR_ACCESS_TOKEN
    copy_var POLAR_WEBHOOK_SECRET
  else
    set_var POLAR_ACCESS_TOKEN "$(ask_secret "Polar access token:")"
    set_var POLAR_WEBHOOK_SECRET "$(ask_secret "Polar webhook secret:")"
  fi
  set_var POLAR_MONTHLY_PRODUCT_ID "$(ask "Plus monthly product ID:")"
  set_var POLAR_YEARLY_PRODUCT_ID "$(ask "Plus yearly product ID:")"
  set_var POLAR_PRO_BENEFIT_ID "$(ask "Plus benefit ID:")"
  set_var POLAR_LIFETIME_PRODUCT_ID ""
else
  set_var BILLING_ENABLED false
fi

echo "== Admins and web push"
set_var ADMIN_EMAILS "$(ask "Admin email addresses (comma separated):")"
if [[ -z "$(sed -n 's/^VAPID_PUBLIC_KEY=//p' "$file")" ]]; then
  # P-256 key pair in the web push (VAPID) encoding, made with Node's built-in crypto.
  keys="$(docker run --rm --entrypoint node "$image" -e 'const c=require("node:crypto");const {privateKey}=c.generateKeyPairSync("ec",{namedCurve:"prime256v1"});const j=privateKey.export({format:"jwk"});const pub=Buffer.concat([Buffer.from([4]),Buffer.from(j.x,"base64url"),Buffer.from(j.y,"base64url")]).toString("base64url");console.log(pub+" "+j.d)')"
  set_var VAPID_PUBLIC_KEY "${keys% *}"
  set_var VAPID_PRIVATE_KEY "${keys#* }"
  echo "  generated new VAPID keys"
fi

chmod 600 "$file"
echo "Done. Keys set (values hidden):"
grep -o '^[A-Z_]*=.' "$file" | sed 's/=.$//' | tr '\n' ' '
echo
