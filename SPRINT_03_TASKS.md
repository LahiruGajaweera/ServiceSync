# Sprint 03 — Billing, Notifications & Salvage Engine

## Sprint Goal

Deliver the financial and operational closure features: invoice generation with QR codes,
customer SMS notifications on job status changes, batch inventory tracking with barcode
scanning, and the salvage assessment engine for unclaimed devices.

---

## Task Allocation Matrix

### M.N.H.T.M. Kavindya — UWU/IIT/22/034

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Build Invoice Generation backend | `app/services/invoice_service.py` — create invoice, calculate subtotal/tax/total, QR code data |
| 2 | Build Job Parts tracking backend | `app/services/job_parts_service.py` — log parts consumed per job (inventory or donor) |
| 3 | Implement batch code scanning endpoint | `GET /inventory/scan/{code}` — resolve batch code to item details |

**API endpoints owned:**
- `POST /invoices/` — create invoice for a completed job
- `GET /invoices/` — list all invoices
- `PATCH /invoices/{id}/pay` — mark invoice as paid
- `POST /inventory/consume` — log batch-code part consumption

---

### G.A.N.L. Gajaweera — UWU/IIT/22/050 ← **You**

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Build Invoice Manager UI | `src/pages/admin/InvoiceManager.jsx` — create invoice modal, QR display, mark-paid |
| 2 | Build Salvage Console UI | `src/pages/admin/SalvageConsole.jsx` — assessment list, create modal, approve/reject |
| 3 | Integrate ikman.lk scraper into Salvage Console | `ScraperPanel` component — calls `GET /scrape/price`, shows listings, one-click fill |
| 4 | Build Donor Device Console UI | `src/pages/admin/DonorDeviceConsole.jsx` — list devices, register device, view/add parts |
| 5 | Add barcode scan field to Technician Dashboard | `src/components/ScanField.jsx` + `ConsumePartForm.jsx` |

---

### R.J.A.S.D. Ranathunga — UWU/IIT/22/064

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Implement real-time job status notification (SMS) | `notification_service.notify_ready_for_pickup()` — triggers on `ready_for_pickup` status via `job_service.update_status()` |
| 2 | Implement unclaimed device notification (SMS) | `notification_service.notify_unclaimed()` — triggers on `unclaimed` status |
| 3 | Add `/notifications/` router | `app/routers/notifications.py` — list all, list by job |

**API endpoints owned:**
- `GET /notifications/` — list all SMS/email notification logs
- `GET /notifications/job/{job_id}` — notifications for a specific job

---

### K.D.B. Shavindi — UWU/IIT/22/025

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Build Salvage Assessment backend | `app/services/salvage_service.py` — create, list, approve/reject |
| 2 | Build Donor Device backend | `app/services/donor_service.py` — register device, add parts, list |
| 3 | Implement OTP delivery (SMS + email) | `app/services/otp_delivery.py` — Text.lk for SMS, SMTP for email |

**API endpoints owned:**
- `POST /salvage/` — create assessment
- `GET /salvage/` — list assessments
- `PATCH /salvage/{id}/status` — approve or reject
- `POST /donors/` — register donor device
- `POST /donors/{id}/parts` — add extracted part

---

## Definition of Done — Sprint 3

| Check | Status |
|-------|--------|
| `POST /invoices/` creates invoice with QR code data | ✅ |
| `PATCH /invoices/{id}/pay` updates payment status | ✅ |
| Invoice Manager UI shows all invoices, create modal, mark-paid | ✅ |
| SMS sent to customer when job → `ready_for_pickup` (if Text.lk configured) | ✅ |
| SMS sent to customer when job → `unclaimed` (if Text.lk configured) | ✅ |
| Notification rows logged to DB regardless of SMS delivery | ✅ |
| Salvage assessments can be created, approved, or rejected | ✅ |
| Salvage Console shows market price fetch from ikman.lk | ✅ |
| Donor device registered with condition, source, optional IMEI | ✅ |
| Donor parts extracted and tracked per device | ✅ |
| Donor Device Console UI fully functional | ✅ |
| Batch inventory receive creates batch_code | ✅ |
| `/inventory/scan/{code}` resolves batch code to item | ✅ |
| Technician can log parts consumed via batch code scan | ✅ |

---

## Sprint 3 File Tree

```
backend/app/
├── services/
│   ├── invoice_service.py      ← NEW
│   ├── job_parts_service.py    ← NEW
│   ├── salvage_service.py      ← NEW
│   ├── donor_service.py        ← NEW
│   ├── notification_service.py ← UPDATED (transactional SMS)
│   ├── scraper_service.py      ← NEW (ikman.lk)
│   └── otp_delivery.py         ← UPDATED (send_sms_notification)
├── routers/
│   ├── invoices.py             ← NEW
│   ├── salvage.py              ← NEW
│   ├── donors.py               ← NEW
│   ├── notifications.py        ← NEW
│   └── scraper.py              ← NEW

frontend/src/
├── components/
│   ├── ScanField.jsx           ← NEW
│   └── ConsumePartForm.jsx     ← NEW
├── pages/admin/
│   ├── InvoiceManager.jsx      ← NEW
│   ├── SalvageConsole.jsx      ← NEW (+ ScraperPanel)
│   └── DonorDeviceConsole.jsx  ← NEW
```

---

## Sprint 3 → Sprint 4 Handoff

Next sprint scope:
- **Gajaweera**: Docker multi-stage production builds + Analytics Dashboard UI
- **Kavindya**: Billing UI enhancements (PDF export)
- **Ranathunga**: Predictive analytics backend (ARIMA/Scikit-learn)
- **Shavindi**: LANKAQR payment gateway integration
