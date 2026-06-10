# MooMetrics — 2-Day Production Launch Plan

**Date:** 2026-06-08 · **Launch target:** within 2 working days (~2026-06-10)
**Deploy reality:** rural Zimbabwe farms, unstable/often-absent internet · **Team:** 1 developer, ~8h/day
**Decision:** Ship **online-first with honest connectivity UX** (Option A). True offline write-back is a tested **week-1 fast-follow**, not a 48-hour scramble.

> Source: multi-agent readiness audit — 81 findings, 53 confirmed serious against the real code (2 refuted), 26 medium/low. This plan is the deduped, prioritized subset that gates a *safe* launch.

---

## 1. Verdict

A **fully offline-capable** MooMetrics cannot be shipped safely in 2 days. A **safe, honest, online-first** MooMetrics can. The launch blockers below total **~17 hours** and fit two days with a smoke-test pass. A real offline write-queue is a *separate* ~17–18h of stateful, conflict-prone code that would ship **untested** — and a buggy queue silently drops or duplicates death records, which is precisely the fraud-audit data this product exists to protect.

**Guiding principle: silent data loss is worse than an honest "can't save right now."** We launch honest, then make it offline-capable once, correctly, with tests.

---

## 2. The offline decision (recorded)

**Chosen: Option A — online-first + honest UX.**

- The PWA shell + read cache already work (`vite.config.ts` caches GET `animals`/`dashboard`/`deaths`). Workers can **view** cached records offline.
- We add: a persistent offline banner, form-data retention on failed submit, an explicit **"NOT saved — retry when online"** message, and upload timeouts. Workers are **never lied to** about whether a write succeeded.
- **Why not build the queue now (Option B):** the offline-write work (IndexedDB outbox + image-blob persistence + client-side SHA-256 + `/check-hash` endpoint + tag-conflict handling + JWT-refresh-on-reconnect + sync UI) is ~17–18h **by itself** — it consumes the entire budget, leaving no time for the genuine safety blockers, and ships with zero tests. Every offline-write piece is entangled with an unsolved secondary problem (multipart blobs, hash-dedup 409s on replay, duplicate tags, expired tokens); shipping one without the others produces silent corruption.

---

## 3. Launch blockers (must fix)

Issues that make a launch to real farms unsafe, lossy, or non-functional. The offline write-queue is intentionally **excluded** (see §2); honest UX (#12/#14/#11) is its safe substitute.

| # | Issue | File | Fix | Hrs |
|---|-------|------|-----|-----|
| 1 | Death report writes image to disk **before** commit; no rollback → orphan files + 500s | [deaths.py:77-93](backend/app/routers/deaths.py#L77-L93), [image_service.py:65-66](backend/app/services/image_service.py#L65-L66) | Wrap `db.add`→`commit()` in `try/except`; on `IntegrityError` → `rollback()` + delete just-written image + raise 409. Make a reusable `IntegrityError→409` helper. | 1.5 |
| 2 | Uploaded images on Render **ephemeral disk** → wiped every redeploy | [render.yaml:26](render.yaml#L26) | Add a Render **Persistent Disk** mounted at the uploads path (1GB). Config-only. R2/S3 is week-1. | 0.5 |
| 3 | No DB backup; free-tier Postgres has none → total farm-data loss on one failure | [render.yaml:30-35](render.yaml#L30-L35) | Move `moometrics-db` off free tier to enable daily backups; document `pg_dump` restore in README. | 1.0 |
| 4 | Render Blueprint has **no frontend service** + `FRONTEND_URL` unset → can't serve app / CORS dies | [render.yaml](render.yaml) | Add a `static` frontend service (build `frontend`, publish `frontend/build`); set `FRONTEND_URL`. Pick **Render + Render-static**; quarantine `vercel.json` + the CI docker job (kills the 3-conflicting-paths trap). | 2.5 |
| 5 | `VITE_BACKEND_URL` baked at build time → points at `api.example.com`, all API calls fail in prod | [api.ts:1](frontend/src/services/api.ts#L1), [Dockerfile:10-13](frontend/Dockerfile#L10-L13) | Build frontend with the real Render API URL as a build arg in the static service. Verify with one curl + one browser load. | 0.5 |
| 6 | `admin/admin123` seeded **unconditionally** on every startup, never rotated | [main.py:75-89](backend/app/main.py#L75-L89) | Guard seed to non-prod; in prod seed from `ADMIN_INITIAL_PASSWORD` env (strong, set in Render). | 1.0 |
| 7 | FastAPI `/docs`, `/redoc`, `/openapi.json` exposed in prod | [main.py:27-31](backend/app/main.py#L27-L31) | `docs_url`/`redoc_url`/`openapi_url = None if is_production else default`. | 0.25 |
| 8 | No rate limiting on `/api/auth/login` + signup → brute force on a guessable admin | [auth.py:27-70](backend/app/routers/auth.py#L27-L70) | Add `slowapi`; 5/min/IP on login + signup. Account lockout is week-1. | 1.5 |
| 9 | Health check returns hardcoded `healthy` → Render keeps DB-down container in rotation | [main.py:114-116](backend/app/main.py#L114-L116) | Execute `SELECT 1`; return 503 on failure. | 0.5 |
| 10 | Empty `upgrade()` in initial migration → re-deploy fails; `create_all` fallback corrupts migration state | [022a3aaa…py:21-23](backend/alembic/versions/022a3aaa1668_initial_schema.py#L21-L23) | Delete the broken migration; regenerate a real `--autogenerate` initial; verify the chain applies clean twice. | 1.0 |
| 11 | 401 on expired token silently ignored; user stays "logged in", writes fail with generic errors | [api.ts:33](frontend/src/services/api.ts#L33) | In `apiFetch`, on 401 clear stored user + redirect to login (~15 lines). | 0.75 |
| 12 | No offline/network indicator + no "report NOT saved" feedback → worker believes data captured when lost | [App.tsx](frontend/src/App.tsx), [Header.tsx](frontend/src/components/Header.tsx), death/animal forms | `navigator.onLine` listener + persistent banner; on submit failure keep form data + explicit "NOT saved — retry when online". | 3.0 |
| 13 | `LivestockManagement` (809 LOC) is dead code that accepts input and silently discards it | [LivestockManagement.tsx](frontend/src/features/livestock/components/LivestockManagement.tsx) | Delete (not in section registry — confirmed). | 0.25 |
| 14 | Image upload has no timeout/abort → hangs forever on 2G/3G dropouts | [DeathManagement.tsx:92-128](frontend/src/features/deaths/components/DeathManagement.tsx#L92-L128) | `AbortController` + 60s timeout through `apiFetch`; on `AbortError` → "Upload timed out — not saved, retry". | 1.5 |
| 15 | `animal tag_number` uniqueness unchecked on update → 500 instead of 409 | [animals.py:75-108](backend/app/routers/animals.py#L75-L108) | Mirror create-path uniqueness check; reuse the #1 `IntegrityError→409` helper. | 0.5 |
| 16 | CI doesn't type-check; strict TS errors ship undetected | [ci.yml](.github/workflows/ci.yml), [package.json](frontend/package.json) | Add `"typecheck": "tsc --noEmit"` + CI step (**advisory** for launch). | 0.5 |

**Blocker total: ~16.75 hours.**

> **#16 note:** adding the gate is 0.5h; *clearing* the strict-TS errors is not a launch blocker (SWC ships working JS today). Add the gate as advisory now; fix errors week-1.
>
> **Tests:** the "zero tests" findings are real but full pytest/vitest suites compete with shipping the blockers. For launch we use **2 manual smoke scripts** (Day 2, step 14). A real pytest suite for auth + death-dedup is the **highest-value week-1 item**.

---

## 4. Day 1 / Day 2 schedule

Front-loaded with the backend data-integrity + deploy blockers (the *irreversible* ones), then frontend honesty UX, then verification on the live stack.

### Day 1 (~8h) — backend safety + a deploy that actually works
1. **(1.0h)** #1 Death-report transaction wrapper + reusable `IntegrityError→409` helper; apply to deaths, animal-update (#15), users, auth commits.
2. **(0.5h)** #15 tag_number uniqueness on update (reuses helper).
3. **(1.0h)** #10 Regenerate initial Alembic migration; apply twice on a scratch DB to prove clean re-deploy.
4. **(0.5h)** #9 Real DB health check (`SELECT 1` → 503).
5. **(0.25h)** #7 Disable docs in prod.
6. **(1.5h)** #8 slowapi rate limiting on login/signup.
7. **(1.0h)** #6 Env-injected admin password + non-prod seed guard.
8. **(2.0h)** #4 render.yaml frontend static service + `FRONTEND_URL`; #5 build-time API URL wired; #2 persistent disk; #3 DB tier with backups. **Kick a deploy.**

*End of Day 1: backend hardened, a real two-service stack deploying.*

### Day 2 (~8h) — frontend honesty UX + verify the whole flow
9. **(0.25h)** #13 Delete dead `LivestockManagement`.
10. **(0.75h)** #11 401 → logout/redirect in `apiFetch`.
11. **(3.0h)** #12 Offline banner + form-data retention + "NOT saved, retry" across death + animal forms.
12. **(1.5h)** #14 `AbortController` upload timeout + messaging.
13. **(0.5h)** #16 Add `tsc --noEmit` + advisory typecheck CI step.
14. **(1.0h)** **Manual smoke pass on the deployed Render stack:** login with rotated admin → add animal → submit death (verify `status=dead`) → resubmit same image (expect 409) → airplane mode → confirm banner + "not saved" → redeploy → confirm a previously-uploaded image still loads (proves the disk).
15. **(1.0h)** Buffer / fix whatever the smoke pass breaks.

**Achievable for this scope** with ~1h slack. **Not** achievable if the offline outbox or a full test suite is added — each is 1.5–2+ days. Hold the line on scope.

---

## 5. Cut list (NOT done in 2 days — and why that's safe)

- **True offline write queue / IndexedDB outbox** — deferred. Honest "not saved" UX makes online-first safe; a rushed, untested queue risks silent corruption of death records. **Top week-1 priority.**
- **httpOnly-cookie auth migration (XSS hardening, ~6h)** — deferred. localStorage JWT + disabled-docs + rate-limiting + short-lived tokens is an acceptable launch posture for a low-public-exposure farm tool; the rewrite touches every API call.
- **Full pytest + vitest suites in CI** — cut to manual smoke scripts for launch. Real auth + death-dedup integration tests are week-1.
- **Clearing strict-TS errors** — gate added as advisory; fixes week-1.
- **S3/R2 object storage for images** — replaced by Render Persistent Disk for launch (cheaper, zero code). Migrate to R2 week-1.
- **Audit trail table, structured JSON logging + Sentry** — real gaps, but not day-1-lossy once commits roll back cleanly and health checks are honest. Week-1.
- **CSV export, password-change UI, account lockout, login timing-attack fix, cascade-delete on user removal, dashboard N+1 query** — medium/low; week-1+.

None cause *silent, irreversible* data loss at launch once §3 lands — the only bar that truly gates shipping to real farms.

---

## 6. Week-1 fast-follow

1. **Offline write outbox (the deferred Option B), built properly with tests** — Dexie store, image-blob persistence, client-side SHA-256 + `/check-hash` endpoint, tag-conflict + token-refresh handling, sync-status UI. The headline feature; done once, correctly.
2. **Refresh-token endpoint + short access token** — prerequisite for the outbox surviving overnight-offline sync.
3. **pytest integration suite in CI** — auth (login/role/403), death-dedup 409, animal-status transition, tag-uniqueness; then a frontend smoke E2E.
4. **Migrate images to Cloudflare R2** + verify DB backup restore in <30 min.
5. **Structured JSON logging + Sentry + AuditLog table** (who created/deleted what) for dispute resolution.
6. **httpOnly-cookie auth + account lockout + CSRF**; clear strict-TS errors and flip the typecheck gate to blocking.
7. **CSV export + password-change UI** — trust-builders for the rural user base.

---

**Bottom line:** ship online-first and *honest* in 2 days; offline capability is real and earns its place in week 1 with tests — not a 48-hour scramble that risks corrupting the death records the whole product exists to protect.
