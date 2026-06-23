# Contributing to MooMetrics

## Setup

See [README.md](README.md) for backend (Python 3.12 venv) and frontend (Node 20)
setup. Use `backend/.env.example` and `VITE_BACKEND_URL` for configuration.

## Branching & commits

- Branch off `main`; never commit directly to `main`.
- Conventional-commit prefixes: `feat`, `fix`, `chore`, `test`, `docs`, `security`,
  `ci`. Keep commits focused and buildable.

## Quality gates (run before pushing)

**Backend** (`cd backend`, venv active):
```bash
black app/ tests/        # format
flake8 app/              # lint
bandit -r app/ -ll       # security
pip-audit                # dependency CVEs
pytest --cov=app --cov-report=term-missing   # ≥85% coverage gate
```

**Frontend** (`cd frontend`):
```bash
npm run lint             # ESLint flat config, 0 warnings
npm run typecheck        # tsc --noEmit, 0 errors
npm run test             # vitest
npm run build            # production build
```

CI enforces all of the above (plus CodeQL). PRs must be green.

## Conventions

- **Backend**: thin routers, logic in `app/services/`; keep request/update/response
  Pydantic schemas separate; never return secrets in a `response_model`; all queries
  farm-scoped via `current_user.farm_id`; audit mutating actions with `record_audit`.
- **Frontend**: TypeScript strict; no `any`; centralized auth via `useAuth` and
  `apiFetch` (no manual tokens); consume the `Page<T>` envelope for lists; never put
  the session token in `localStorage`.
- **Tests**: add coverage with new behavior. Backend uses the in-memory SQLite
  fixtures in `tests/conftest.py`; frontend uses vitest + Testing Library.

## Database changes

Edit `app/models/db_models.py`, then
`alembic revision --autogenerate -m "..."` and verify `alembic upgrade head`
applies cleanly (and `downgrade` reverses it).
