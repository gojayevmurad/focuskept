# FocusKept

A focus timer that also helps you remember what you studied. You work in timed sessions, explain the topic in your own words, and get review questions on day 5, 10 and 30.

Runs at [focuskept.com](https://focuskept.com). Web app and PWA, available in 24 languages.

## Features

- **Timer:** 25/5, 52/17, Flowtime, Deep Work 90, timeboxing or custom. Works without an account; sessions stay on the device until you sign up.
- **Learning:** explain a topic, get AI feedback and editable questions, or write your own.
- **Reviews:** cards come back on a spaced schedule. Open answers are graded by AI, with self-grading as a fallback.
- **Tasks:** a one-page day board with frog of the day, 1-3-5, Eisenhower and Ivy Lee.
- **Stats:** streaks, weekly goal, retention, and which technique works best for you.
- **Reminders:** daily digest email, web push, weekly report.

## Stack

Next.js 16, PostgreSQL with Drizzle, Better Auth, next-intl, Polar for billing, Resend for email, OpenAI for AI features.

## Getting started

You need Node 24, pnpm and Docker.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm setup
pnpm local:up
pnpm local:migrate
pnpm dev:seed
```

Open the URL printed by `pnpm setup` (`http://localhost:7515` by default) and sign in with the seeded account `dev@focuskept.test`. The password is in `scripts/dev-seed.mjs`.

API keys are optional. Without `OPENAI_API_KEY` the app offers manual questions, and without Polar keys billing stays off. `pnpm email:inbox` shows emails sent locally.

## Commands

| Command                 | What it does                               |
| ----------------------- | ------------------------------------------ |
| `pnpm local:up`         | Start the app, database and scheduler      |
| `pnpm local:stop`       | Stop containers and keep the data          |
| `pnpm local:migrate`    | Apply migrations                           |
| `pnpm local:test-db`    | Start the database used by the tests below |
| `pnpm test`             | Unit tests                                 |
| `pnpm test:integration` | Integration tests                          |
| `pnpm test:e2e`         | Playwright tests                           |
| `pnpm lint`             | ESLint                                     |
| `pnpm typecheck`        | TypeScript                                 |
| `pnpm i18n:check`       | Validate all locale files                  |
| `pnpm db:generate`      | Generate a SQL migration                   |

## Docs

- [Architecture](ARCHITECTURE.md)
- [Deployment](DEPLOYMENT.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## License

[MIT](LICENSE). The license covers the code. The FocusKept name and logo are not licensed for use by other products or services. See also [third-party notices](THIRD_PARTY_NOTICES.md).
