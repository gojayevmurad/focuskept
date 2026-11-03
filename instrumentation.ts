import * as Sentry from "@sentry/nextjs";
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      enabled: !!process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      release:
        process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_SENTRY_RELEASE,
      tracesSampleRate: 0.05,
      beforeSend(event) {
        delete event.user;
        delete event.request;
        event.breadcrumbs = [];
        return event;
      },
    });
  }
}
export const onRequestError = Sentry.captureRequestError;
