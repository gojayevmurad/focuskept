# Contributing

Bug reports, fixes and translation corrections are welcome. For a larger change, open an issue first so we can agree on the approach.

## Set up

Follow [Getting started](README.md#getting-started). You need Node 24, pnpm and Docker. Without API keys the app still runs: AI features fall back to manual questions and billing stays off.

## Before opening a pull request

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm i18n:check
pnpm format:check
pnpm test:integration
pnpm test:e2e
```

- **Text:** every user-facing string exists in all 24 locales. Add new keys to `messages/` or `content/`, in every locale. `pnpm i18n:check` verifies them.
- **Scope:** keep each pull request to one change and explain why it is needed.
- **Secrets:** never commit keys, `.env` files or real user data.

## Reporting security issues

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## License

Contributions are accepted under the [MIT License](LICENSE), the same license as the project. By opening a pull request, you confirm you have the right to submit the code under it.

The FocusKept name and logo are not covered by the license.
