# Sprint 02 — Core Feature Development (Jobs & Inventory)

## Sprint Goal

Deliver the central operational modules of ServiceSync: job registration with
cryptographic IDs, customer management, inventory tracking with low-stock alerts,
smart reuse logic (compatible parts suggestion), and all associated frontend UIs.

---

## Task Allocation Matrix

### M.N.H.T.M. Kavindya — UWU/IIT/22/034

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Develop backend business logic for Job Registration module | `app/services/job_service.py` — `create_job()`, `update_status()`, `assign_technician()` |
| 2 | Implement standardized fault categorization (8 categories) | `fault_category` enum enforced via Pydantic schema `app/schemas/job.py` |
| 3 | Implement cryptographic Job ID generation | `_generate_job_id()` using `secrets.token_hex(4)` → IDs like `SS-A3F9C2E1` |
| 4 | Build Job Status History tracking | `JobStatusHistory` inserted on every `POST /jobs/` and `PATCH /jobs/{id}/status` |

**API endpoints owned:**
- `POST /jobs/` — register new job
- `GET /jobs/` — list all jobs (with joined customer + technician names)
- `GET /jobs/{id}` — get single job
- `PATCH /jobs/{id}/status` — update status (logs to history)
- `PATCH /jobs/{id}/assign` — assign technician

---

### G.A.N.L. Gajaweera — UWU/IIT/22/050 ← **You**

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Implement Job Management UI with status filter tabs | `src/pages/admin/JobManagement.jsx` |
| 2 | Build Create Job form (3-section: customer search, device/fault, assignment) | Multi-section modal in `JobManagement.jsx` |
| 3 | Integrate Smart Parts Panel into job creation | `SmartPartsPanel` component — calls `GET /inventory/suggest?brand=&model=` |
| 4 | Implement Customer Registry page with add-customer modal | `src/pages/admin/CustomerRegistry.jsx` |
| 5 | Build Technician Panel with add-technician modal | `src/pages/admin/TechnicianPanel.jsx` |
| 6 | Update Admin Dashboard with live KPI stats | `AdminDashboard.jsx` — fetches real job/inventory counts |
| 7 | Build Technician Job Queue page with status update | `src/pages/technician/JobQueue.jsx` |
| 8 | Update Tech Dashboard to show live assigned jobs | `TechDashboard.jsx` — calls `GET /jobs/mine` |

**UI components owned:**
- `src/components/JobStatusBadge.jsx` — coloured status pill used everywhere
- All `ComingSoon` stubs replaced for Sprint 2 pages in `App.jsx`

---

### R.J.A.S.D. Ranathunga — UWU/IIT/22/064

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Build Inventory Tracking backend for factory-new spare parts | `app/services/inventory_service.py` — CRUD + stock adjustment |
| 2 | Implement automated low-stock threshold alerts | `GET /inventory/low-stock` — returns items where `quantity ≤ min_stock_threshold` |
| 3 | Build Customer CRUD backend | `app/services/customer_service.py` + `app/routers/customers.py` |

**API endpoints owned:**
- `POST /inventory/` — add inventory part
- `GET /inventory/` — list all parts (with search)
- `GET /inventory/low-stock` — low stock items only
- `PATCH /inventory/{id}/stock` — adjust quantity (delta positive/negative)
- `POST /customers/` — register customer
- `GET /customers/` — list customers (with search)

---

### K.D.B. Shavindi — UWU/IIT/22/025

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Implement Smart Reuse Logic using PostgreSQL JSONB operators | `suggest_compatible_parts()` in `inventory_service.py` — uses `@>` JSONB containment |
| 2 | Register and track donor devices in the system | `app/services/donor_service.py` + `app/routers/donors.py` |
| 3 | Implement public job tracking endpoint | `GET /jobs/track/{public_id}` — no auth required, used by customer tracking page |

**API endpoints owned:**
- `GET /inventory/suggest?brand=&model=` — returns compatible inventory + donor parts
- `POST /donors/` — register donor device
- `GET /donors/` — list donor devices
- `POST /donors/{id}/parts` — add extracted donor part
- `GET /jobs/track/{public_id}` — public tracking (no JWT required)

---

## Definition of Done — Sprint 2

| Check | Status |
|-------|--------|
| `POST /jobs/` creates a job with a unique `SS-XXXXXXXX` ID | ✅ |
| `GET /jobs/mine` returns only jobs assigned to the logged-in technician | ✅ |
| `GET /jobs/track/{id}` is publicly accessible (no auth) | ✅ |
| `TrackingPage` at `/track` resolves real job status | ✅ |
| `GET /inventory/low-stock` returns items where qty ≤ threshold | ✅ |
| `GET /inventory/suggest` returns compatible parts using JSONB `@>` | ✅ |
| Admin Dashboard shows live job and low-stock counts | ✅ |
| Customer Registry shows real customers, supports search | ✅ |
| Job Management table shows all jobs with status filter tabs | ✅ |
| Create Job modal: 3 sections, customer search, smart parts panel | ✅ |
| Technician Panel lists all technicians, supports adding new | ✅ |
| Inventory Manager lists parts, shows low-stock banner, adjust-stock modal | ✅ |
| Technician Job Queue shows own jobs with status update | ✅ |

---

## Sprint 2 File Tree

```
backend/app/
├── schemas/
│   ├── customer.py        ← NEW
│   ├── job.py             ← NEW
│   ├── inventory.py       ← NEW
│   └── donor.py           ← NEW
├── services/
│   ├── customer_service.py ← NEW
│   ├── job_service.py      ← NEW  (cryptographic ID + joins)
│   ├── inventory_service.py ← NEW  (JSONB smart reuse)
│   └── donor_service.py    ← NEW
├── routers/
│   ├── customers.py       ← NEW
│   ├── jobs.py            ← NEW  (public track + auth routes)
│   ├── inventory.py       ← NEW
│   └── donors.py          ← NEW
└── main.py                ← UPDATED (4 new routers registered)

frontend/src/
├── components/
│   └── JobStatusBadge.jsx ← NEW
├── pages/
│   ├── admin/
│   │   ├── AdminDashboard.jsx    ← UPDATED (live stats)
│   │   ├── JobManagement.jsx     ← NEW
│   │   ├── CustomerRegistry.jsx  ← NEW
│   │   ├── TechnicianPanel.jsx   ← NEW
│   │   └── InventoryManager.jsx  ← NEW
│   └── technician/
│       ├── TechDashboard.jsx     ← UPDATED (live data)
│       └── JobQueue.jsx          ← NEW
└── App.jsx                       ← UPDATED (Sprint 2 routes wired)
```

---

## Sprint 2 → Sprint 3 Handoff

Next sprint scope:
- **Gajaweera**: Unclaimed Device Management UI + Web Scraper integration
- **Kavindya**: Invoice Generation module (PDF + QR code)
- **Ranathunga**: Real-time Job Status Notification (SMS/email)
- **Shavindi**: Salvage Assessment Engine + market price scraper
