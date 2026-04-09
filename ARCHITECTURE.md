# MooMetrics — Architectural Context & PWA Readiness

> Last updated: 2026-04-09 | Branch: `core` | Version: 1.0.0

---

## System Architecture

```
                    ┌──────────────────────────────────┐
                    │           Client Browser          │
                    │  ┌────────────────────────────┐   │
                    │  │   React 18 SPA (Vite)      │   │
                    │  │   Port 3000                │   │
                    │  │                            │   │
                    │  │  AuthContext ← localStorage │   │
                    │  │  apiFetch() → Bearer JWT   │   │
                    │  └────────────┬───────────────┘   │
                    └───────────────┼───────────────────┘
                                    │ HTTP (JSON / multipart)
                                    ▼
                    ┌──────────────────────────────────┐
                    │   FastAPI + Uvicorn               │
                    │   Port 8000                       │
                    │                                   │
                    │  ┌─────────┐  ┌───────────────┐  │
                    │  │ Routers │→ │   Services    │  │
                    │  │ (HTTP)  │  │ (auth, image) │  │
                    │  └────┬────┘  └───────┬───────┘  │
                    │       │               │          │
                    │  ┌────▼───────────────▼───────┐  │
                    │  │  SQLAlchemy ORM            │  │
                    │  │  SQLite (moometrics.db)    │  │
                    │  └───────────────────────────┘  │
                    │                                   │
                    │  /uploads/deaths/ (static files)  │
                    └──────────────────────────────────┘
```

---

## Frontend Architecture

### Stack
| Layer | Tech | Purpose |
|-------|------|---------|
| Framework | React 18.3 + TypeScript (strict) | UI components |
| Bundler | Vite 6 + SWC | Dev server & builds |
| Styling | Tailwind CSS + CVA | Utility-first styles |
| Components | Radix UI (30+ primitives) | Accessible base components |
| Forms | React Hook Form + Zod | Validation |
| Charts | Recharts | Dashboard pie chart |
| Icons | Lucide React | Icon set |
| Dark mode | next-themes | Theme switching |
| Toasts | Sonner | Notifications |

### Module Structure

```
frontend/src/
├── app/
│   └── section-registry.tsx    # Lazy section → component map
├── types/
│   └── navigation.ts           # AppSection union type
├── constants/
│   └── app-constants.ts        # Nav items + role permissions
├── services/
│   └── api.ts                  # apiFetch<T>() + ApiError
├── components/
│   ├── AppSidebar.tsx           # Role-filtered sidebar
│   ├── Header.tsx               # Theme toggle, user info, logout
│   ├── MooMetricsLogo.tsx       # SVG logo component
│   └── ui/                      # 45+ Radix wrappers (shadcn style)
└── features/
    ├── auth/
    │   ├── components/Login.tsx
    │   └── context/AuthContext.tsx   # JWT + localStorage persistence
    ├── dashboard/components/Dashboard.tsx
    ├── animals/components/AnimalManagement.tsx
    ├── deaths/components/DeathManagement.tsx
    ├── livestock/components/LivestockManagement.tsx
    └── users/components/UserManagement.tsx
```

### State Management
- **Auth state**: React Context → localStorage (`moometrics_user`)
- **Feature state**: Local component state (no global store)
- **No data caching layer** — every navigation triggers fresh API calls

### Build Output
- `npm run build` → `build/` directory
- Vite content-hashes all assets automatically
- No public directory or static assets (icons, manifest, etc.)

---

## Backend Architecture

### Stack
| Layer | Tech | Purpose |
|-------|------|---------|
| Framework | FastAPI 0.109 | REST API |
| Server | Uvicorn | ASGI server |
| ORM | SQLAlchemy 2.0 | DB access |
| Database | SQLite | Persistence |
| Auth | python-jose (JWT HS256) + passlib (bcrypt) | Authentication |
| Validation | Pydantic v2 + pydantic-settings | Request/response schemas |
| Images | Pillow | Upload validation |
| Config | pydantic-settings + @lru_cache | Environment management |

### Layer Responsibilities

```
Routers (HTTP boundary)
  → Services (business logic: auth, image hashing)
    → Models
        db_models.py  — SQLAlchemy ORM (User, Animal, DeathRecord)
        schemas.py    — Pydantic request/response DTOs
    → Database
        database.py   — engine, session factory, get_db()
```

### Key Backend Behaviors
- **Auto-seed**: Creates `admin/admin123` (manager) on first startup
- **CORS**: Allows `localhost:3000` + `FRONTEND_URL` env var
- **Image dedup**: SHA-256 hash check before saving death report images
- **Static serving**: `/uploads/{path}` serves death report images

---

## Database Schema

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    User      │       │     Animal       │       │   DeathRecord    │
├──────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)      │◄──┐   │ id (PK)          │◄──┐   │ id (PK)          │
│ username (U) │   │   │ name             │   │   │ animal_id (FK,U) │──► Animal
│ password_hash│   │   │ animal_type      │   │   │ reported_by (FK) │──► User
│ role         │   │   │ tag_number (U?)  │   │   │ cause_of_death   │
│ created_at   │   │   │ breed            │   │   │ date_of_death    │
└──────────────┘   │   │ date_of_birth    │   │   │ image_path       │
                   │   │ status           │   │   │ image_hash (U)   │
                   │   │ notes            │   │   │ notes            │
                   ├───│ added_by (FK)    │   │   │ created_at       │
                   │   │ created_at       │   └───┴──────────────────┘
                   │   │ updated_at       │
                   │   └──────────────────┘
                   │
                   U = unique, FK = foreign key, ? = nullable
```

---

## Auth Flow

```
Login form → POST /api/auth/login
                 │
                 ▼
         Verify bcrypt hash
                 │
                 ▼
         Issue JWT (HS256)
                 │
                 ▼
     Return {id, username, role, token}
                 │
                 ▼
  Store in React state + localStorage
                 │
                 ▼
  apiFetch() attaches Authorization: Bearer <token>
```

---

## Current Deployment Story

Docker Compose is configured for local and production use:

| Concern | Status |
|---------|--------|
| Containerization (Docker) | Backend + Frontend Dockerfiles |
| Reverse proxy (nginx) | Frontend container serves via nginx with API proxy |
| Docker Compose | PostgreSQL + Backend + Frontend orchestrated |
| Database migrations | Alembic initialized, auto-runs on startup |
| PostgreSQL support | `database.py` handles both SQLite and Postgres |
| CI/CD pipeline | Not configured |
| HTTPS/TLS | Not configured (add via Cloudflare or reverse proxy) |
| Domain / DNS | Not configured |
| Hosting platform | Not selected |

### Running with Docker Compose

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET and POSTGRES_PASSWORD

# Start all services
docker compose up --build

# Frontend: http://localhost (port 80)
# Backend:  http://localhost:8000
# API docs: http://localhost:8000/docs
```

---

## PWA Gap Analysis

### What a PWA Requires

| Requirement | Current State | Gap |
|-------------|--------------|-----|
| **Web App Manifest** (`manifest.json`) | Missing | Need to create with app name, icons, theme color, display mode |
| **App Icons** (multiple sizes) | Missing | Need 192x192 and 512x512 PNG icons minimum |
| **Service Worker** | Missing | Need for caching, offline support, install prompt |
| **HTTPS** | Not configured | Required for service workers (localhost exempt for dev) |
| **Viewport meta tag** | Present | Already set in `index.html` |
| **Responsive design** | Partial (Tailwind) | Needs audit for mobile breakpoints |
| **Offline fallback page** | Missing | Need a cached fallback when network unavailable |
| **`<link rel="manifest">` in HTML** | Missing | Need to add to `index.html` |
| **Theme color meta tag** | Missing | Need `<meta name="theme-color">` |
| **Apple touch icon** | Missing | Need `<link rel="apple-touch-icon">` |
| **Maskable icon** | Missing | Recommended for Android adaptive icons |

### Recommended PWA Implementation Plan

#### Phase 1 — Installable PWA (minimum viable)

1. **Install `vite-plugin-pwa`**
   ```bash
   cd frontend && npm install -D vite-plugin-pwa
   ```

2. **Create app icons**
   - Generate from the `MooMetricsLogo` SVG component
   - Sizes: 64, 192, 512 (PNG) + maskable variant

3. **Configure the plugin in `vite.config.ts`**
   ```ts
   import { VitePWA } from 'vite-plugin-pwa'

   plugins: [
     react(),
     VitePWA({
       registerType: 'autoUpdate',
       manifest: {
         name: 'MooMetrics',
         short_name: 'MooMetrics',
         description: 'Farm Animal Record-Keeping System',
         theme_color: '#16a34a',
         background_color: '#ffffff',
         display: 'standalone',
         scope: '/',
         start_url: '/',
         icons: [ /* icon entries */ ]
       },
       workbox: {
         globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
         runtimeCaching: [
           {
             urlPattern: /^https?:\/\/.*\/api\//,
             handler: 'NetworkFirst',
             options: { cacheName: 'api-cache', expiration: { maxEntries: 50 } }
           }
         ]
       }
     })
   ]
   ```

4. **Update `index.html`** — add theme-color meta tag and apple-touch-icon link

**Result**: App becomes installable on mobile/desktop. Basic asset caching works.

#### Phase 2 — Offline Capability

5. **Offline fallback page** — cached HTML shown when network is down
6. **API response caching** — NetworkFirst strategy for read endpoints (`GET /api/animals`, `/api/dashboard/stats`)
7. **Offline indicator** — UI banner when `navigator.onLine` is false
8. **Background sync for writes** — queue `POST`/`PUT`/`DELETE` operations when offline, replay when online

#### Phase 3 — Advanced PWA Features

9. **Push notifications** — requires backend push subscription management
10. **Periodic background sync** — refresh animal data in background
11. **Share target** — allow sharing death report images directly to the app
12. **Image upload queue** — store death report images in IndexedDB when offline, upload on reconnect

### Complexity Estimate

| Phase | Scope | What changes |
|-------|-------|-------------|
| Phase 1 | Small | `vite.config.ts`, `index.html`, add icon files, install 1 dependency |
| Phase 2 | Medium | Service worker config, new offline UI components, API layer changes |
| Phase 3 | Large | Backend push endpoints, IndexedDB storage, sync conflict resolution |

---

## Deployment Prerequisites (for PWA to work in production)

Before the PWA is useful to real users, you also need:

1. **HTTPS** — service workers require it (use Let's Encrypt / Cloudflare)
2. **Backend hosting** — FastAPI on a server (Render, Railway, Fly.io, VPS)
3. **Frontend hosting** — static build served via CDN or same server (Vercel, Netlify, or nginx)
4. **Database** — migrate from SQLite to PostgreSQL for concurrent access
5. **Image storage** — move from local filesystem to S3/Cloudflare R2 for persistence
6. **Environment config** — production env vars for JWT secret, DB URL, CORS origins
7. **Domain name** — required for proper PWA install experience

### Suggested Deployment Stack (lightweight)

```
┌────────────────────────────┐
│  Vercel / Netlify          │  ← Frontend static build
│  (CDN + HTTPS free)        │
└─────────────┬──────────────┘
              │ API calls
              ▼
┌────────────────────────────┐
│  Railway / Render          │  ← FastAPI backend
│  (free tier available)     │
│  PostgreSQL addon          │
│  S3-compatible storage     │
└────────────────────────────┘
```

---

## What Is Not Implemented (full list)

| Category | Missing |
|----------|---------|
| Testing | No frontend tests (Vitest), no backend tests (pytest) |
| CI/CD | No GitHub Actions or equivalent |
| Migrations | Alembic configured, initial migration created |
| Pagination | Animal/death lists load everything |
| Export | No CSV/PDF export |
| Password management | No change password / reset flow |
| Multi-tenancy | Single-farm only |
| Error tracking | No Sentry or equivalent |
| Analytics | No usage tracking |
| Rate limiting | No API rate limits |
| Input sanitization | Basic Pydantic validation only |
| API docs | Swagger at `/docs` (dev only, not exposed) |
| Logging | Minimal (no structured logging) |
| Health check | `GET /health` exists |

---

## Summary: Where We Stand

```
[###############...............] ~50% to deployable PWA

Done:
  ✓ Full CRUD for animals
  ✓ Role-based auth (manager/employee)
  ✓ Death reporting with image dedup
  ✓ Dashboard with stats
  ✓ Dark mode
  ✓ Responsive layout (Tailwind)
  ✓ Clean feature-based code structure
  ✓ Health check endpoint
  ✓ Dockerized (backend + frontend + Postgres)
  ✓ Alembic migrations initialized
  ✓ PostgreSQL-ready database layer
  ✓ nginx reverse proxy with SPA fallback

Needed for PWA (Phase 1 — installable):
  ○ Web app manifest
  ○ App icons (192px, 512px)
  ○ Service worker (vite-plugin-pwa)
  ○ Meta tags in index.html

Needed for production deployment:
  ○ HTTPS + domain
  ○ Deploy to hosting platform
  ○ Object storage for images
  ○ CI/CD pipeline
```
