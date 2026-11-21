# Contributing

Questions belong in [GitHub Discussions](https://github.com/gojayevmurad/focuskept/discussions) or [issues](https://github.com/gojayevmurad/focuskept/issues). Report security issues privately as described in [SECURITY.md](SECURITY.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Local setup

Install Node 24, pnpm 11 (the version pinned in `package.json`), and Docker with Compose. Fork and clone the repository, then run:

```sh
pnpm install
pnpm setup -- --name "My Coworking" --slug my-coworking --domain coworking.example.com --repository yourname/yourrepo
pnpm local:up
pnpm local:migrate
pnpm worker
```

Setup generates environment files and credentials. Keep them private. Run the worker in its own terminal. For host-side Next.js, stop the Docker app with `docker compose --env-file .env.local stop app`, then run `pnpm dev` in another terminal. PostgreSQL stays in Docker.

## Changes and checks

Use `feat/`, `fix/`, `chore/`, or `docs/` for branch names. Write commit messages as short imperative sentences, such as “Fix session reminder timing”; prefixes are optional.

Before opening a pull request, run:

```sh
pnpm spdx
pnpm spdx:check
pnpm typecheck
pnpm lint
pnpm test
pnpm local:test-db
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
```

Integration and browser tests must use an isolated database ending in `_test`. Database-dependent integration tests are skipped if no test database is configured. Stop the app on port 3000 before running browser tests.

For schema changes, run `pnpm db:generate` and review the generated SQL before applying it with `pnpm local:migrate`. Never edit an applied migration; create a new one.

Keep pull requests focused. Explain what changed, why, and how you tested it. Include screenshots for UI changes.

## Contributor agreement

External contributors sign the [CLA](CLA.md) through the bot on their first pull request. You keep your copyright; the agreement lets the project owner distribute and relicense your contributions.
