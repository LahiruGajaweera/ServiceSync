# Sprint 01 — Requirement Analysis & Framework Design
## Task Allocation Matrix

> **Sprint Goal:** Establish the system architecture, database schema, Docker environment, and UI/UX foundations so every subsequent sprint has a working scaffold to build on.

---

## Team Task Breakdown

### K.D.B. Shavindi — UWU/IIT/22/025

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Set up the Python (FastAPI) backend environment inside a Docker container | `backend/Dockerfile` + `docker-compose.yml` backend service running |
| 2 | Design the initial RESTful API routing architecture | Folder structure: `app/routers/`, `app/services/`, `app/schemas/` with stub files |
| 3 | Verify backend health endpoint returns `{"status": "ok"}` at `GET /health` | Confirmed in browser at `http://localhost:8000/health` |

---

### M.N.H.T.M. Kavindya — UWU/IIT/22/034

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Set up the React.js + Vite + Tailwind CSS frontend environment inside a Docker container | `frontend/Dockerfile` + `docker-compose.yml` frontend service running |
| 2 | Develop responsive wireframes for the **Admin Dashboard** | Figma/Canva wireframe file covering: job list, inventory summary, technician workload, revenue cards |
| 3 | Verify React dev server loads at `http://localhost:5173` with no console errors | Confirmed in browser |

---

### G.A.N.L. Gajaweera — UWU/IIT/22/050 ← **You**

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Design complete UI/UX layouts for the **Technician Dashboard** | Figma/Canva wireframe: assigned jobs list, job detail view, status update panel, repair notes input |
| 2 | Design complete UI/UX layouts for the **Customer Tracking Page** | Figma/Canva wireframe: job ID input, live progress bar, status timeline, estimated completion |
| 3 | Implement **User Authentication** frontend + backend | Login page (React), `POST /auth/login` endpoint (FastAPI), JWT stored in `localStorage`, protected route wrapper |
| 4 | Implement **Role-Based Access Control (RBAC)** in React | `ProtectedRoute` component that reads the JWT role claim and redirects unauthorized users |

---

### R.J.A.S.D. Ranathunga — UWU/IIT/22/064

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Lead overall system architecture planning | Architecture decision log (can be a shared doc), agreed folder structure, API naming conventions |
| 2 | Design the centralised relational database schema in PostgreSQL | ERD diagram (see `ARCHITECTURE.md`) reviewed and approved by team |
| 3 | Create the PostgreSQL database service in Docker | `docker-compose.yml` `db` service with health check, volume persistence, and environment variables |
| 4 | Implement RBAC database structures | `users` table with `role ENUM('admin', 'technician')`, seed script for first admin account |

---

## Sprint 01 — Definition of Done

- [ ] `docker compose up --build` starts all 3 services without errors
- [ ] `http://localhost:8000/docs` shows FastAPI Swagger UI
- [ ] `http://localhost:5173` loads the React app in the browser
- [ ] `http://localhost:8000/health` returns `{"status": "ok"}`
- [ ] A test user (`admin@servicesync.lk`) can log in and receive a JWT
- [ ] Calling a protected route without a token returns HTTP 401
- [ ] Database schema ERD is reviewed and signed off by all 4 members
- [ ] Technician + Customer dashboard wireframes are shared in the team group

---

## Sprint 01 — Timeline

| Day | Focus |
|-----|-------|
| 1–2 | Docker environment setup (Shavindi + Kavindya), DB schema design (Ranathunga), wireframe drafts (Gajaweera) |
| 3–4 | Backend API structure + auth endpoint (Shavindi), Auth frontend + RBAC (Gajaweera) |
| 5–6 | Integration testing, wireframe reviews, fix blockers |
| 7   | Sprint Review + Retrospective, commit to main branch |

---

## Useful Commands

```bash
# Start all services
docker compose up --build

# Stop all services (keeps database data)
docker compose down

# Stop and wipe the database (fresh start)
docker compose down -v

# View logs for a specific service
docker compose logs backend
docker compose logs frontend
docker compose logs db

# Run backend independently (outside Docker, for debugging)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
