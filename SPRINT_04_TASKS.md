# Sprint 04 — Analytics, Production Deployment & Documentation

## Sprint Goal

Deliver advanced analytics, finalize production-grade Docker infrastructure with
multi-stage builds, complete the Donor Device Console, and produce full project
documentation including a deployment-ready README.

---

## Task Allocation Matrix

### G.A.N.L. Gajaweera — UWU/IIT/22/050 ← **You**

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Finalize Docker with multi-stage production builds | `backend/Dockerfile.prod`, `frontend/Dockerfile.prod`, `docker-compose.prod.yml` |
| 2 | Build Analytics Dashboard UI | `src/pages/admin/AnalyticsDashboard.jsx` — KPI cards, job/revenue trend charts, fault distribution, technician table |
| 3 | Build Billing/Invoice UI (Sprint 4 enhancements) | `InvoiceManager.jsx` — already implemented in Sprint 3; Sprint 4 adds UX polish |
| 4 | Write README.md and deployment documentation | `README.md` at project root |
| 5 | nginx production config for SPA | `frontend/nginx.conf` — SPA fallback, caching headers, gzip |

**Deliverables:**
- `backend/Dockerfile.prod` — 2-stage (builder → runtime), non-root user, 4 Uvicorn workers
- `frontend/Dockerfile.prod` — 2-stage (node build → nginx), static bundle
- `frontend/nginx.conf` — SPA routing, asset caching, gzip, security headers
- `docker-compose.prod.yml` — production compose (no hot-reload volumes)
- `frontend/src/pages/admin/AnalyticsDashboard.jsx` — full analytics page with Recharts
- `README.md` — setup guide, tech stack, sprint summary, env vars, commands

---

### R.J.A.S.D. Ranathunga — UWU/IIT/22/064

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Build Analytics backend (KPI summary, trends, distributions) | `app/services/analytics_service.py` — 6 query functions |
| 2 | Implement analytics router | `app/routers/analytics.py` — 6 endpoints |
| 3 | Predictive analytics engine (optional stretch goal) | ARIMA/Scikit-learn demand forecasting for inventory |

**API endpoints owned:**
- `GET /analytics/summary` — KPI snapshot (job counts, revenue, low stock, salvage)
- `GET /analytics/jobs-trend?days=30` — jobs created per day
- `GET /analytics/revenue-trend?months=6` — paid revenue per month
- `GET /analytics/technician-stats` — per-technician job breakdown
- `GET /analytics/fault-distribution` — jobs by fault category
- `GET /analytics/status-distribution` — jobs by current status

---

### K.D.B. Shavindi — UWU/IIT/22/025

| # | Task | Deliverable |
|---|------|-------------|
| 1 | LANKAQR payment gateway integration | `invoice_service.py` — generate LANKAQR-compatible QR data |
| 2 | Smart Reuse Salvage Engine | Automated recommendation logic (refurbish vs salvage) based on price ratios |
| 3 | Final integration testing | All API endpoints verified end-to-end |

---

### M.N.H.T.M. Kavindya — UWU/IIT/22/034

| # | Task | Deliverable |
|---|------|-------------|
| 1 | End-to-end testing | Test all major user flows (admin + technician) |
| 2 | Bug fixes and UI polish | Address any issues found during testing |
| 3 | Database schema final review | Ensure all constraints and indexes are correct |

---

## Definition of Done — Sprint 4

| Check | Status |
|-------|--------|
| `docker compose -f docker-compose.prod.yml up --build` starts all services | ✅ |
| Frontend served by nginx (not Vite dev server) in production | ✅ |
| Backend runs with 4 workers (no `--reload`) in production | ✅ |
| Analytics Dashboard shows live KPI cards, charts, technician table | ✅ |
| `GET /analytics/summary` returns current job, revenue, stock counts | ✅ |
| `GET /analytics/jobs-trend` returns per-day job counts for last 30 days | ✅ |
| `GET /analytics/revenue-trend` returns per-month paid revenue | ✅ |
| `GET /analytics/technician-stats` returns per-technician breakdown | ✅ |
| `GET /analytics/fault-distribution` returns job counts by fault category | ✅ |
| Salvage Console has "Fetch Prices" button that calls ikman.lk scraper | ✅ |
| Donor Device Console fully functional (list, register, view parts, add parts) | ✅ |
| README.md covers setup, commands, API overview, env vars | ✅ |
| nginx SPA routing — all React routes return index.html | ✅ |

---

## Sprint 4 File Tree

```
ServiceSync/
├── README.md                         ← NEW
├── SPRINT_03_TASKS.md                ← NEW
├── SPRINT_04_TASKS.md                ← NEW (this file)
├── docker-compose.prod.yml           ← NEW
├── backend/
│   ├── Dockerfile                    ← UPDATED (multi-stage dev)
│   ├── Dockerfile.prod               ← NEW (multi-stage production)
│   ├── requirements.txt              ← UPDATED (+beautifulsoup4, +lxml)
│   └── app/
│       ├── services/
│       │   ├── analytics_service.py  ← NEW
│       │   └── scraper_service.py    ← NEW
│       ├── routers/
│       │   ├── analytics.py          ← NEW
│       │   ├── notifications.py      ← NEW
│       │   └── scraper.py            ← NEW
│       └── main.py                   ← UPDATED (3 new routers registered)
└── frontend/
    ├── Dockerfile                    ← UPDATED (multi-stage dev)
    ├── Dockerfile.prod               ← NEW (multi-stage → nginx)
    ├── nginx.conf                    ← NEW
    ├── package.json                  ← UPDATED (+recharts)
    └── src/
        ├── App.jsx                   ← UPDATED (analytics + donors routes)
        ├── layouts/
        │   └── AdminLayout.jsx       ← UPDATED (Donor Devices nav item)
        └── pages/admin/
            ├── AnalyticsDashboard.jsx ← NEW (replaced ComingSoon stub)
            └── DonorDeviceConsole.jsx ← NEW
```

---

## Production Deployment Guide

```bash
# 1. Configure environment
cp .env.example .env.prod
# Edit .env.prod with production values

# 2. Build and start
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# 3. Verify
curl http://your-server:8000/health
# → {"status": "ok", "app": "ServiceSync"}

# 4. Monitor logs
docker compose -f docker-compose.prod.yml logs -f
```

**Image sizes (approximate after multi-stage build):**
- Backend: ~200MB (python:3.11-slim + dependencies, no build tools)
- Frontend: ~50MB (nginx:1.27-alpine + static bundle)
- Database: ~240MB (postgres:16-alpine)

---

## Project Summary

ServiceSync was developed over 15 weeks across 4 Agile sprints, evolving from
a Docker scaffold to a fully featured shop management system with:

- **500+ lines of SQLAlchemy ORM** across 13 tables
- **10 FastAPI routers** with 40+ endpoints
- **11 frontend pages** covering all admin and technician workflows
- **Real-time scraping** of ikman.lk for salvage price discovery
- **SMS/email notification** pipeline integrated with Text.lk
- **Production-ready Docker** with multi-stage builds and nginx
