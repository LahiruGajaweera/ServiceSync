# Docker Setup Guide for Beginners
## ServiceSync — Step-by-Step First Run

> This guide assumes you have **zero Docker experience**. Follow every step in order and you will have all three services (database, backend, frontend) running locally.

---

## What is Docker? (30-second explanation)

Think of Docker like a **portable lunchbox for your app**. Instead of installing Python, Node.js, and PostgreSQL separately on your computer — and having version conflicts with your teammates — Docker packages everything the app needs into **containers** that run the same way on everyone's machine.

| Concept | Analogy |
|---------|---------|
| **Image** | A recipe (blueprint for a container) |
| **Container** | The actual running dish made from the recipe |
| **docker-compose.yml** | The meal plan that coordinates all dishes together |
| **Volume** | A USB drive that saves data even when the container is off |

---

## Step 1 — Install Docker Desktop

1. Go to [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. Download **Docker Desktop for Windows**
3. Run the installer (it may ask you to enable WSL 2 — click **Yes**)
4. Restart your computer when prompted

**Verify it worked:** After restart, look for the **whale icon** 🐋 in your taskbar (bottom-right). When you hover over it and it says _"Docker Desktop is running"_ — you're ready.

---

## Step 2 — Verify Docker in VS Code Terminal

Open VS Code, then open the integrated terminal: **Ctrl + `** (backtick)

Run these two commands:

```bash
docker --version
```
Expected output: `Docker version 26.x.x, build ...`

```bash
docker compose version
```
Expected output: `Docker Compose version v2.x.x`

If either command says "not found", restart VS Code and try again.

---

## Step 3 — Set Up Your Environment File

Docker reads secret values (passwords, keys) from a `.env` file. This file is **never committed to Git**.

In the VS Code terminal, navigate to your project:

```bash
cd "e:\Project II\ServiceSync"
```

Copy the template file:

```bash
# On Windows PowerShell:
Copy-Item .env.example .env

# OR on Git Bash:
cp .env.example .env
```

Open the new `.env` file in VS Code and you will see:

```
DB_USER=servicesync_user
DB_PASSWORD=change_me_please_123
DB_NAME=servicesync_db
SECRET_KEY=generate_a_64_character_random_string_here
```

---

## Step 4 — Generate a Secure SECRET_KEY

The `SECRET_KEY` is used to sign JWTs. Run this command to generate a secure one:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output (it will look like `a3f9c2e1b...`) and paste it as the value of `SECRET_KEY` in your `.env` file. Also update the DB password to something memorable.

Your final `.env` should look like this (values are examples — use your own):

```
DB_USER=servicesync_user
DB_PASSWORD=MySecurePass123
DB_NAME=servicesync_db
SECRET_KEY=a3f9c2e1b4d87f6e53c2a1908b4e7d3f6a2c9e8b1d4f7a0c3e6b9d2f5a8c1e4
```

---

## Step 5 — First Run (Build + Start All Services)

In the VS Code terminal, make sure you are in the project root:

```bash
cd "e:\Project II\ServiceSync"
```

Run this command — the `--build` flag tells Docker to build the images from your Dockerfiles:

```bash
docker compose up --build
```

**What you will see:**
- Docker will download the base images (Python 3.11, Node 20, PostgreSQL 16) — this takes a few minutes only on the **first run**
- It will install your Python packages (`requirements.txt`) and Node packages (`package.json`)
- Three containers will start up in order: `db` → `backend` → `frontend`

**The output is ready when you see lines like these (in any order):**
```
servicesync_db       | database system is ready to accept connections
servicesync_backend  | INFO:     Application startup complete.
servicesync_frontend | VITE v5.x.x  ready in xxx ms
```

---

## Step 6 — Verify Everything is Working

Open your browser and check all three services:

| Service | URL | What you should see |
|---------|-----|---------------------|
| **Frontend** | http://localhost:5173 | "ServiceSync" heading on a blue+white page |
| **Backend API** | http://localhost:8000/health | `{"status":"ok","app":"ServiceSync"}` |
| **API Docs** | http://localhost:8000/docs | FastAPI Swagger UI — interactive API explorer |
| **API ReDoc** | http://localhost:8000/redoc | Clean API reference documentation |

If all four URLs work → **Sprint 1 Docker setup is complete.**

---

## Step 7 — Daily Workflow Commands

After the first `--build`, you don't need to build again unless you change `requirements.txt` or `package.json`.

```bash
# Start all services (normal daily use)
docker compose up

# Start in background (frees up your terminal)
docker compose up -d

# Stop all services (data is preserved in the volume)
docker compose down

# View live logs from a specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Restart just one service (e.g., after changing Python code outside Docker)
docker compose restart backend

# Force rebuild (use after changing requirements.txt or package.json)
docker compose up --build
```

---

## Step 8 — Connecting to the Database (Optional but Useful)

To inspect the database visually, install **DBeaver** (free) or **pgAdmin**.

Connection settings:

| Field | Value |
|-------|-------|
| Host | `localhost` |
| Port | `5432` |
| Database | `servicesync_db` (your DB_NAME) |
| Username | `servicesync_user` (your DB_USER) |
| Password | (whatever you set in .env) |

---

## Common Problems & Fixes

### "Port already in use"
Another app is using port 5432, 8000, or 5173.

Fix: Stop that app, or change the port in `docker-compose.yml`. For example, to change the backend port to 8001:
```yaml
ports:
  - "8001:8000"   # host:container
```

### "Cannot connect to the Docker daemon"
Docker Desktop is not running. Open it from the Start Menu and wait for the whale icon.

### "Module not found" in backend
You added a package to `requirements.txt` but the image hasn't been rebuilt. Run:
```bash
docker compose up --build
```

### "npm: not found" or missing node_modules
Same issue — rebuild the frontend image:
```bash
docker compose up --build
```

### Want to wipe the database and start fresh?
```bash
docker compose down -v
```
The `-v` flag deletes the named volume (`postgres_data`). **All database data will be lost.** Only use this during development when you need a clean slate.

---

## Project Folder Reference

```
ServiceSync/
├── backend/
│   ├── app/
│   │   ├── core/          ← config, database connection, JWT/security helpers
│   │   ├── models/        ← SQLAlchemy ORM table definitions
│   │   ├── schemas/       ← Pydantic request/response models (Sprint 2+)
│   │   ├── routers/       ← FastAPI route handlers (Sprint 2+)
│   │   ├── services/      ← Business logic layer (Sprint 2+)
│   │   └── main.py        ← FastAPI app entry point
│   ├── requirements.txt   ← Python dependencies
│   └── Dockerfile         ← How to build the backend image
├── frontend/
│   ├── src/
│   │   ├── App.jsx        ← Root React component + router
│   │   ├── main.jsx       ← React entry point
│   │   └── index.css      ← Tailwind CSS imports
│   ├── index.html         ← HTML shell
│   ├── package.json       ← Node dependencies
│   ├── vite.config.js     ← Vite dev server configuration
│   ├── tailwind.config.js ← Tailwind CSS configuration
│   └── Dockerfile         ← How to build the frontend image
├── docker-compose.yml     ← Orchestrates all 3 services
├── .env                   ← Your local secrets (NEVER commit this)
├── .env.example           ← Template for teammates
├── .gitignore             ← Files Git will ignore
├── ARCHITECTURE.md        ← Mermaid diagrams (open + Ctrl+Shift+V to preview)
└── SPRINT_01_TASKS.md     ← Sprint 1 task allocation for all 4 members
```
