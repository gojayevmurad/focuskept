import * as Sentry from "@sentry/nextjs";
// One image serves staging and production, so the environment comes from the host.
function environment() {
  const host = window.location.hostname;
  if (host.startsWith("staging.")) return "staging";
  if (host === "localhost" || host === "127.0.0.1") return "development";
  return "production";
}
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: environment(),
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: 0.05,
  beforeSend(event) {
    delete event.user;
    delete event.request;
    event.breadcrumbs = [];
    return event;
  },
});
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
