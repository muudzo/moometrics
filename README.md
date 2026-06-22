# MooMetrics

**Multi-tenant farm animal record-keeping** with role-based access, fraud-auditable
death reporting, and true offline capture for low-connectivity environments.

[![CI](https://github.com/affaan-m/moometrics/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)

---

## What it does

- **Animals** — record cattle, sheep, goat, pig, horse, chicken, and other livestock
  with per-farm-unique tag numbers, breed, DOB, and notes.
- **Death reporting** — mandatory photo evidence with **per-farm SHA-256 duplicate
  detection**; one immutable record per animal, status auto-transitions to `dead`.
- **Multi-tenancy** — every user, animal, and death record is scoped to a **Farm**;
  tenants are fully isolated. Self-serve signup creates a farm with you as manager.
- **Roles** — *manager* (full admin, user management, audit log) and *employee*
  (record animals, submit death reports for their own farm).
- **Audit trail** — append-only log of every create/update/delete and sign-in.
- **Offline-first** — animal and death-report writes captured offline are queued in
  IndexedDB and synced automatically on reconnect, with client-side image hashing.
- **Exports** — CSV download of animals and death reports.

## Architecture

```
moometrics/
├── frontend/   React 18 + TypeScript + Vite 6 + Tailwind + Radix (PWA)
├── backend/    FastAPI + SQLAlchemy 2 + Alembic (SQLite dev / PostgreSQL prod)
└── docs/       Setup, runbook, testing
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design and
[docs/RUNBOOK.md](docs/RUNBOOK.md) for operations.

## Security posture

- Short-lived (15 min) JWT access tokens held **in memory**; revocable refresh
  tokens delivered as **httpOnly, Secure, SameSite cookies** with silent refresh.
- bcrypt password hashing, account lockout, timing-safe login (no user enumeration).
- Rate-limited auth endpoints, security headers, CORS locked to the frontend origin,
  API docs disabled in production, fail-fast config that refuses weak secrets/SQLite/
  default admin password in production.
- Pluggable image storage (local disk or S3/Cloudflare R2).
- CI gates: pytest (≥85% coverage), flake8, black, **bandit**, **pip-audit**,
  ESLint, tsc, vitest, **npm audit**, and **CodeQL**.

## Quick start

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000     # migrates + seeds admin/admin123
# Swagger at http://localhost:8000/docs (dev only)
```

### Frontend
```bash
cd frontend
npm install
echo "VITE_BACKEND_URL=http://localhost:8000" > .env
npm run dev                                    # http://localhost:3000
```

Default login (dev): `admin` / `admin123`.

## Testing

```bash
# Backend — 45 tests, ≥85% coverage gate
cd backend && pytest --cov=app --cov-report=term-missing

# Frontend — vitest unit/integration
cd frontend && npm run test

# E2E (needs the backend running on :8000)
cd frontend && npm run e2e
```

## Deploy

One canonical path: the [Render Blueprint](render.yaml) (`render blueprint apply`)
provisions the API, a static frontend, and a backed-up PostgreSQL database.
Full steps and backup/restore in [docs/RUNBOOK.md](docs/RUNBOOK.md).

**Version:** 2.0.0 · MIT-style internal project.
