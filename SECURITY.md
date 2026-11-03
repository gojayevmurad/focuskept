# Security

Please report vulnerabilities privately to hello@focuskept.com with "Security" in the subject, or through GitHub's private vulnerability reporting. Don't open a public issue, and don't include credentials or personal data in your report.

Only the latest version on `main`, and the service at focuskept.com, are supported.

## How the app handles data

- Every mutation checks the session, an exact same-origin match, a size-limited zod schema, and ownership of the record.
- Plans and limits come from server-side entitlements, never from values sent by the client.
- Topics, notes, explanations and answers are not sent to logs, Sentry or analytics.
- User text sent to AI is treated as data, and AI output is validated against a schema and rendered as plain text.
- Unsubscribe links are signed per user and category.
- Without an account, sessions and tasks stay in the browser until you choose to import them.
- In production, the app refuses to start without HTTPS and a strong auth secret.
