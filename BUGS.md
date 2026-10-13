# Bug Report – User Management API

Discrepancies between the running service (`ghcr.io/danielsilva-loanpro/sdet-interview-challenge`)
and the contract in [`sdet_challenge_api.yml`](sdet_challenge_api.yml).
Each bug is exposed by an automated test tagged `@bug` (they fail on purpose until the bug is fixed).

Run only the bug tests: `npm run test:bugs` (dev) · `npx cross-env TEST_ENV=prod playwright test --grep @bug`

| ID | Endpoint | Expected | Actual | Dev | Prod | Severity |
|----|----------|----------|--------|:---:|:----:|----------|
| [BUG-001](#bug-001) | `GET /users/{email}` (unknown / deleted user) | 404 | 500 | ❌ | ❌ | High |
| [BUG-002](#bug-002) | `POST /users` (duplicate email) | 409 | 500 | ❌ | ❌ | High |
| [BUG-003](#bug-003) | `PUT /users/{email}` | Changes persisted | 200 returned, nothing saved | ❌ | ❌ | Critical |
| [BUG-004](#bug-004) | `POST /users` (invalid email) | 400 | Dev: 500 · Prod: 201 | ❌ | ❌ | Medium |
| [BUG-005](#bug-005) | `POST /users` (non-string `name`) | 400 | 201, value stored as string | ❌ | ❌ | Medium |
| [BUG-006](#bug-006) | `DELETE /users/{email}` (no / invalid token) | 401 | 204 – user deleted | ❌ | ✅ | Critical (security) |

Result of the latest run: **dev → 11 failing `@bug` tests, prod → 7 failing `@bug` tests. Every non-bug test passes in both.**

---

## BUG-001
**`GET /users/{email}` returns 500 instead of 404 for a user that does not exist** (also after the user was deleted).

- **Spec:** `GET /users/{email}` → `404` with `ErrorResponse` (`sdet_challenge_api.yml` lines 77‑82).
- **Environments:** dev, prod
- **Reproduce:**
  ```bash
  curl -i http://localhost:3000/dev/users/nobody@example.com
  ```
- **Expected:** `404 {"error":"User not found"}`
- **Actual:** `500 {"error":"Internal server error"}`
- **Side effect:** any lookup of a missing email crashes the handler, including right after `DELETE`.
- **Tests:**
  - `GET /users/{email} › [BUG-001] returns 404 for a non-existent user`
  - `DELETE /users/{email} › [BUG-001] returns 404 on GET after delete`

## BUG-002
**Creating a user with an email that already exists returns 500 instead of 409.**

- **Spec:** `POST /users` → `409` "Duplicate email" (lines 51‑56).
- **Environments:** dev, prod
- **Reproduce:**
  ```bash
  curl -s -X POST http://localhost:3000/dev/users -H "Content-Type: application/json" \
       -d '{"name":"Jane","email":"dup@example.com","age":30}'
  curl -i -X POST http://localhost:3000/dev/users -H "Content-Type: application/json" \
       -d '{"name":"Jane","email":"dup@example.com","age":30}'
  ```
- **Expected:** `409 {"error":"Email already exists"}` (this is what `PUT` returns for the same situation)
- **Actual:** `500 {"error":"Internal server error"}`
- **Test:** `POST /users › [BUG-002] rejects a duplicate email with 409`

## BUG-003
**`PUT /users/{email}` reports success but does not persist anything.**

- **Spec:** `PUT /users/{email}` → `200` with the updated `User` (lines 83‑98).
- **Environments:** dev, prod
- **Reproduce:**
  ```bash
  curl -s -X POST http://localhost:3000/dev/users -H "Content-Type: application/json" \
       -d '{"name":"Jane","email":"put@example.com","age":30}'
  curl -i -X PUT http://localhost:3000/dev/users/put@example.com -H "Content-Type: application/json" \
       -d '{"name":"Jane Updated","email":"put@example.com","age":31}'   # 200, shows new values
  curl -i http://localhost:3000/dev/users/put@example.com               # still "Jane", age 30
  ```
- **Expected:** the follow-up `GET` returns `Jane Updated`, age 31.
- **Actual:** the `PUT` response echoes the new data, but `GET` still returns the original record.
- **Email change variant:** after `PUT` changes the email to `new@example.com`, `GET /users/new@example.com` → `500` and the old email still returns the old record.
- **Tests:**
  - `PUT /users/{email} › [BUG-003] persists the update (GET returns new values)`
  - `PUT /users/{email} › [BUG-003] email change: new email is retrievable`

## BUG-004
**`POST /users` does not validate the email format.**

- **Spec:** `email` has `format: email` and the endpoint documents a `400` validation error (lines 45‑50, 175‑178).
- **Environments:** dev, prod (different symptom)
- **Reproduce:**
  ```bash
  curl -i -X POST http://localhost:3000/prod/users -H "Content-Type: application/json" \
       -d '{"name":"X","email":"not-an-email","age":30}'
  ```
- **Expected:** `400 {"error":"Invalid email format"}` (this is what `PUT` returns)
- **Actual:**
  - **prod:** `201 Created`; the invalid record is stored and appears in `GET /users`.
  - **dev:** `500 Internal server error`.
- **Inconsistency:** `PUT` validates the email correctly, `POST` does not.
- **Test:** `POST /users › [BUG-004] rejects an invalid email format with 400`

## BUG-005
**`POST /users` accepts a non-string `name`.**

- **Spec:** `name` is `type: string` (line 172‑173).
- **Environments:** dev, prod
- **Reproduce:**
  ```bash
  curl -i -X POST http://localhost:3000/dev/users -H "Content-Type: application/json" \
       -d '{"name":123,"email":"num@example.com","age":30}'
  ```
- **Expected:** `400`
- **Actual:** `201` – the response echoes the number `123`, but `GET /users` returns it as the string `"123"` (inconsistent type).
- **Test:** `POST /users › [BUG-005] rejects a non-string name with 400`

## BUG-006
**Dev allows `DELETE /users/{email}` without a valid `Authentication` token.**

- **Spec:** `Authentication` header is **required**; missing or invalid → `401` (lines 120‑135). The spec also states both environments behave identically.
- **Environments:** **dev only** (prod correctly returns `401`).
- **Reproduce:**
  ```bash
  curl -i -X DELETE http://localhost:3000/dev/users/someone@example.com          # no header
  curl -i -X DELETE http://localhost:3000/dev/users/someone@example.com -H "Authentication: wrong"
  ```
- **Expected:** `401 {"error":"Authentication required"}` and the user remains.
- **Actual:**
  - No header → `204` and the user **is deleted**.
  - Invalid token / token in the wrong header (`Authorization`) → treated as an authenticated request (user deleted, or `404` when it doesn't exist).
- **Prod behaviour (correct):** missing, invalid, or wrong-header token → `401`; only `Authentication: mysecrettoken` → `204`.
- **Impact:** an unauthenticated caller can delete any user in dev.
- **Tests (fail on dev, pass on prod):**
  - `[BUG-006] rejects DELETE without the Authentication header (401)`
  - `[BUG-006] rejects DELETE with an invalid token (401)`
  - `[BUG-006] rejects a valid token sent in the wrong header "Authorization" (401)`
  - `[BUG-006] a rejected DELETE leaves the user intact`

---

## Observations (not asserted – the spec does not define the behaviour)

- `GET /` returns `500`.
- Emails are case-sensitive: `POST` accepts `JANE@X.COM` even if `jane@x.com` exists, and `GET` with a different case returns `500` (BUG-001).
- `age: 30.5` and `age: "30"` return the generic message `Age must be between 1 and 150`, which is misleading for a type error.
- The service keeps state between runs. The suite creates unique users per test and deletes them afterwards; restart the container to reset data.
