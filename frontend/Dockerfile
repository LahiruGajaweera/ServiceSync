# ── Stage 1: node builder (dev) ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Default target is dev (hot-reload). Production uses Dockerfile.prod.
CMD ["npm", "run", "dev", "--", "--host"]
