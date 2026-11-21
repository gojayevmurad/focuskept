import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
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
