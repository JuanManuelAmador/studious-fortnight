# User API Automation (Playwright + TypeScript + Allure)

Class-based, fully async API test suite for the User Management API
(`sdet_challenge_api.yml`). Known spec discrepancies are in [BUGS.md](BUGS.md).

## Setup

```bash
docker run -p 3000:3000 ghcr.io/danielsilva-loanpro/sdet-interview-challenge
npm install
```

## Run

| Command | What it does |
|---|---|
| `npm run test:dev` | Run everything against `tests/config/.env.dev` |
| `npm run test:prod` | Run everything against `tests/config/.env.prod` |
| `npm run test:dev:stable` / `test:prod:stable` | Skip `@bug` tests (should be 100% green) |
| `npm run test:bugs` | Only the bug-exposing tests (dev) |
| `npm run allure:generate` then `npm run allure:open` | Build and open the Allure report (needs Java) |
| `npm run typecheck` | Strict TypeScript check |

`@bug` tests assert the **spec** behaviour, so they fail until the service is fixed.

## Environments and token

Each environment has its own file in `tests/config/` (`.env.dev`, `.env.prod`) with
`BASE_URL`, `API_TOKEN` and `REQUEST_TIMEOUT_MS`. Change `BASE_URL` to target another host.
The `TEST_ENV` variable (`dev` | `prod`) selects the file.

The token is injected into protected endpoints by the `authToken`/`usersClient` fixtures.
Real environment variables win over the file, so in GitHub the `API_TOKEN` **repository secret** overrides it.

> The `.env.*` files are **git-ignored**. After cloning, copy `tests/config/.env.dev.example` to
> `.env.dev` and `.env.prod.example` to `.env.prod`, then set the token. In GitHub Actions no file is
> needed: the workflow sets `BASE_URL` itself (override with a repository variable `BASE_URL`) and
> requires the `API_TOKEN` secret.

## Structure

```text
tests/
├── api/        specs (assertions live here only)
├── clients/    BaseApiClient + UsersClient (HTTP only, per-worker singleton)
├── config/     env loader, .env.dev/.env.prod, constants, step logger
├── factories/  UserFactory (unique, parallel-safe data)
├── fixtures/   api.fixture.ts (token + client injection, cleanup, step logging)
├── interfaces/ typed contracts
└── schemas/    Ajv JSON schemas + validator
```

## Logs and steps

- Every HTTP call prints `[env|worker] #N ▶ METHOD url` and then `✔ status` (or `✖` on error),
  so the last printed line shows the last executed step.
- Each test prints `===== START/END (status) =====`.
- Every test action is a `test.step` (Arrange / Act / Assert), visible in the Allure report with
  request/response attachments (the token is masked).

## GitHub Actions

`.github/workflows/api-tests.yml` — run manually (choose `dev` or `prod`), on push/PR to `main` (dev).
A nightly prod run at midnight UTC is included **commented out** (`schedule`).
Add the secret under *Settings → Secrets and variables → Actions → `API_TOKEN`*.
The Allure report and raw results are uploaded as artifacts.
