# MooMetrics — Claude Context

## Project Overview

MooMetrics is a **Farm Animal Record-Keeping System** with role-based access for farm managers and employees. Core functionality:
- Record and manage animals (cattle, sheep, goat, pig, horse, chicken, other)
- Role-based access: **manager** (full admin) and **employee** (record animals, submit death reports)
- Death reporting with mandatory photo upload and duplicate-image detection (SHA-256 hash)
- SQLite-backed persistence via SQLAlchemy ORM

**Version:** 1.0.0 | **Branch:** `core`

---

## Architecture

Monorepo with frontend/backend split:

```
moometrics/
├── frontend/     # React SPA — port 3000
├── backend/      # Python FastAPI — port 8000
│   └── uploads/deaths/   # Uploaded death report images (auto-created)
│   └── moometrics.db     # SQLite database file (auto-created on startup)
└── CLAUDE.md
```

---

## Tech Stack

### Frontend
- **React 18** + **TypeScript** (strict mode)
- **Vite 6** with `@vitejs/plugin-react-swc`
- **Tailwind CSS** + **Radix UI** primitives (`src/components/ui/`)
- **Zod** — runtime validation of localStorage data in AuthContext
- **Recharts** — pie chart on dashboard
- **Lucide React** — icons
- **next-themes** — dark mode
- Path alias: `@/` → `frontend/src/`

### Backend
- **Python** + **FastAPI 0.109** + **Uvicorn**
- **SQLAlchemy 2.0** ORM + **SQLite** (file: `backend/moometrics.db`)
- **Pydantic v2** + **pydantic-settings** for validation and config
- **python-jose** (JWT, HS256) + **passlib[bcrypt]** (passwords)
- **python-multipart** — multipart/form-data for image uploads
- **Pillow** — image type/size validation
- **Black** + **Flake8** for code quality

---

## Default Credentials (seeded on first startup)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | manager |

---

## Key File Locations

### Backend
- [backend/app/main.py](backend/app/main.py) — FastAPI app, CORS, router registration, startup seed
- [backend/app/config.py](backend/app/config.py) — Settings via `pydantic_settings` + `@lru_cache`
- [backend/app/database.py](backend/app/database.py) — SQLAlchemy engine, session, `Base`, `get_db()`
- [backend/app/models/db_models.py](backend/app/models/db_models.py) — ORM models: `User`, `Animal`, `DeathRecord`
- [backend/app/models/schemas.py](backend/app/models/schemas.py) — Pydantic request/response models
- [backend/app/services/auth_service.py](backend/app/services/auth_service.py) — JWT, bcrypt, FastAPI dependencies
- [backend/app/services/image_service.py](backend/app/services/image_service.py) — SHA-256 hash check + file save
- [backend/app/routers/auth.py](backend/app/routers/auth.py) — `POST /api/auth/login`, `POST /api/auth/register`
- [backend/app/routers/animals.py](backend/app/routers/animals.py) — CRUD `/api/animals`
- [backend/app/routers/deaths.py](backend/app/routers/deaths.py) — `/api/deaths` (multipart form + image)
- [backend/app/routers/users.py](backend/app/routers/users.py) — `/api/users` (manager only)
- [backend/app/routers/dashboard.py](backend/app/routers/dashboard.py) — `GET /api/dashboard/stats`

### Frontend
- [frontend/src/App.tsx](frontend/src/App.tsx) — Root: `AuthProvider` → `AppContent`
- [frontend/src/app/section-registry.tsx](frontend/src/app/section-registry.tsx) — Maps `AppSection` → components
- [frontend/src/types/navigation.ts](frontend/src/types/navigation.ts) — `AppSection` union type
- [frontend/src/constants/app-constants.ts](frontend/src/constants/app-constants.ts) — Nav items with `roles` array
- [frontend/src/services/api.ts](frontend/src/services/api.ts) — `apiFetch<T>()` helper + `ApiError`
- [frontend/src/features/auth/context/AuthContext.tsx](frontend/src/features/auth/context/AuthContext.tsx) — User state + JWT login
- [frontend/src/features/auth/components/Login.tsx](frontend/src/features/auth/components/Login.tsx) — Login form
- [frontend/src/features/dashboard/components/Dashboard.tsx](frontend/src/features/dashboard/components/Dashboard.tsx) — KPIs + charts
- [frontend/src/features/animals/components/AnimalManagement.tsx](frontend/src/features/animals/components/AnimalManagement.tsx) — Animal CRUD
- [frontend/src/features/deaths/components/DeathManagement.tsx](frontend/src/features/deaths/components/DeathManagement.tsx) — Death reporting with image upload
- [frontend/src/features/users/components/UserManagement.tsx](frontend/src/features/users/components/UserManagement.tsx) — User admin (manager only)
- [frontend/src/components/AppSidebar.tsx](frontend/src/components/AppSidebar.tsx) — Role-filtered navigation
- [frontend/src/components/Header.tsx](frontend/src/components/Header.tsx) — Dark mode + user info + logout

---

## API Endpoints

| Method | Route | Auth | Access |
|--------|-------|------|--------|
| `POST` | `/api/auth/login` | None | All |
| `POST` | `/api/auth/register` | Bearer | Manager only |
| `GET` | `/api/animals` | Bearer | Both roles |
| `POST` | `/api/animals` | Bearer | Both roles |
| `GET` | `/api/animals/{id}` | Bearer | Both roles |
| `PUT` | `/api/animals/{id}` | Bearer | Both roles |
| `DELETE` | `/api/animals/{id}` | Bearer | Manager only |
| `GET` | `/api/deaths` | Bearer | Both (manager: all; employee: own) |
| `POST` | `/api/deaths` | Bearer | Both roles |
| `GET` | `/api/deaths/{id}` | Bearer | Both roles |
| `GET` | `/api/users` | Bearer | Manager only |
| `DELETE` | `/api/users/{id}` | Bearer | Manager only |
| `GET` | `/api/dashboard/stats` | Bearer | Both roles |
| `GET` | `/uploads/{path}` | None | Static files |

---

## Database Models

**User** — `id`, `username` (unique), `password_hash`, `role` (manager|employee), `created_at`

**Animal** — `id`, `name`, `animal_type`, `tag_number` (unique, nullable), `breed`, `date_of_birth`, `status` (alive|dead), `notes`, `added_by_user_id` (FK→User), `created_at`, `updated_at`

**DeathRecord** — `id`, `animal_id` (FK→Animal, unique), `reported_by_user_id` (FK→User), `cause_of_death`, `date_of_death`, `image_path`, `image_hash` (unique — SHA-256), `notes`, `created_at`

---

## Image Duplicate Detection

When an employee submits `POST /api/deaths`:
1. Backend reads uploaded file bytes
2. Computes `SHA-256` hash of bytes
3. Queries `DeathRecord.image_hash` for existing match
4. If match found → **HTTP 409** "This image has already been used in a previous death report"
5. If new → saves file to `uploads/deaths/{hash[:8]}_{filename}`, stores hash in DB

---

## Environment Variables

### Frontend (`frontend/.env`)
```
VITE_BACKEND_URL=http://localhost:8000
```

### Backend (`backend/.env`)
```
JWT_SECRET=change-me-in-production
ENVIRONMENT=development
DATABASE_URL=sqlite:///./moometrics.db
UPLOAD_DIR=uploads/deaths
FRONTEND_URL=http://localhost:3000
```

---

## Development Commands

### Frontend
```bash
cd frontend
npm install
npm run dev       # Vite dev server — port 3000
npm run build     # Output to frontend/build/
npm run lint      # ESLint (0 warnings tolerance)
npm run format    # Prettier
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# DB created automatically; admin/admin123 seeded on first run
# Swagger docs at http://localhost:8000/docs
```

---

## Important Patterns & Conventions

### Adding a New Section
1. Add key to `AppSection` union in [frontend/src/types/navigation.ts](frontend/src/types/navigation.ts)
2. Create feature folder under `frontend/src/features/<name>/components/`
3. Add to `sectionRegistry` in [frontend/src/app/section-registry.tsx](frontend/src/app/section-registry.tsx)
4. Add nav item with `roles` array to [frontend/src/constants/app-constants.ts](frontend/src/constants/app-constants.ts)

### Role-Based Access
- **Frontend:** AppSidebar filters nav items by `user.role`. Components check `user?.role === 'manager'` for manager-only UI.
- **Backend:** Use `Depends(get_current_user)` for auth, `Depends(require_manager)` for manager-only endpoints.

### API Calls from Frontend
Always use `apiFetch<T>(path, options, user?.token)` from [frontend/src/services/api.ts](frontend/src/services/api.ts).
- For multipart/form-data (image upload), pass `FormData` as body — do not set `Content-Type` manually.
- `ApiError` carries `.status` (HTTP code) and `.message` (detail from backend).

### Authentication Flow
- `AuthContext.login()` → `POST /api/auth/login` → stores `{id, username, role, token}` in state + localStorage
- Token validated through Zod `UserSchema` on page load
- All API calls send `Authorization: Bearer <token>` header

### Backend Layer Rules
- **Routers** — HTTP only, delegate to services or query DB directly for simple ops
- **Services** — business logic, external calls (`auth_service`, `image_service`)
- **Models** — keep `db_models.py` (SQLAlchemy) and `schemas.py` (Pydantic) separate

### Death Report Constraints
- Animal must have `status == "alive"` to accept a death report
- Only one `DeathRecord` per animal (unique `animal_id` constraint)
- Image hash must be globally unique across all death records
- On success, `Animal.status` is automatically set to `"dead"`

---

## What Is Not Implemented
- Password change / profile update
- Pagination for large animal lists
- Export / reporting (CSV, PDF)
- Tests (frontend or backend)
- Multi-farm / multi-tenant support
