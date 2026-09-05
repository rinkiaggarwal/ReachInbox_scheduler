# ReachInbox Email Scheduler (`reachinbox-scheduler`)

A production-grade, full-stack monorepo for scheduling and processing automated email campaigns with distributed job queues, worker rate-limiting, zero-loss restart reconciliation, Slack alerts, and full-text Elasticsearch search.

![Design Language](https://img.shields.io/badge/Aesthetic-Dark%20Purple%20%2B%20Emerald%20Green-8B5CF6)
![Backend](https://img.shields.io/badge/Backend-Express%20%7C%20TypeScript%20%7C%20Prisma-blue)
![Queue Engine](https://img.shields.io/badge/Queue-BullMQ%20%7C%20Redis-red)
![Search](https://img.shields.io/badge/Search-Elasticsearch-yellow)
![Frontend](https://img.shields.io/badge/Frontend-Next.js%2014%20%7C%20Tailwind-black)

---

## Monorepo Architecture Overview

```
reachinbox-scheduler/
├── backend/                  # Express + TypeScript + Prisma + BullMQ + Elasticsearch
│   ├── prisma/
│   │   └── schema.prisma     # PostgreSQL models (User, ScheduledEmail)
│   ├── src/
│   │   ├── config/           # Type-safe environment variables
│   │   ├── db/               # Prisma client singleton
│   │   ├── queue/            # BullMQ queue, worker, and restart reconciliation
│   │   ├── routes/           # REST API routes (/api/emails, /api/slack)
│   │   ├── services/         # Mail (Ethereal), Elasticsearch, and Slack notification services
│   │   └── server.ts         # Express server & Bull-Board dashboard at /admin/queues
│   └── package.json
├── frontend/                 # Next.js 14 (App Router) + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── app/              # Dashboard (/dashboard), Auth (/login), NextAuth routes
│   │   ├── components/       # Dark purple + emerald green UI system & modals
│   │   ├── lib/              # Typed API client
│   │   └── types/            # Shared DTO & model interfaces
│   └── package.json
├── docker-compose.yml        # PostgreSQL 16, Redis 7, Elasticsearch 8.12
└── README.md
```

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v20+
- **Docker & Docker Compose** (or local Postgres, Redis, Elasticsearch instances)

### Step 1: Clone & Start Infrastructure Containers
```bash
# Spin up PostgreSQL (5432), Redis (6379), and Elasticsearch (9200)
docker compose up -d
```

### Step 2: Set Up & Start Backend Service
```bash
cd backend

# Install dependencies
npm install

# Initialize database schema with Prisma
npm run prisma:push

# Build and start development server (Express API + BullMQ Worker + Bull-Board)
npm run dev
```
- **Backend API**: `http://localhost:5000`
- **Bull-Board Queue Dashboard**: `http://localhost:5000/admin/queues`
- **Health Check**: `http://localhost:5000/health`

### Step 3: Set Up & Start Frontend Dashboard
Open a new terminal tab:
```bash
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
- **Dashboard Interface**: `http://localhost:3000`

---

## Ethereal Email Setup & Previewing Sent Emails

The backend uses **Nodemailer** integrated with **Ethereal Email** (an SMTP sandbox service).
1. By default, if `ETHEREAL_USER` and `ETHEREAL_PASS` are empty in `backend/.env`, the system automatically provisions a dynamic Ethereal test account on startup.
2. Every sent email generates an Ethereal web preview URL (e.g., `https://ethereal.email/message/...`).
3. In the frontend **Sent History** table, click the green **"View Inbox Email"** button next to any sent email to view the formatted email directly inside Ethereal's web viewer!

---

## Core Architecture & Requirements Implementation

### 1. Scheduler Engine & Zero-Cron Guarantee
- **No Cron Jobs**: Scheduling is powered exclusively by **BullMQ delayed jobs**.
- **Deterministic Job IDs**: Every scheduled email receives a deterministic job ID formatted as `email:{emailId}`.
- **Idempotency Guarantee**: In Redis BullMQ, enqueuing an existing job ID is a strict no-op. If a job is re-added, BullMQ ignores the duplicate.

### 2. Restart Persistence & DB Reconciliation (`reconcile.ts`)
- **Survival Across Restarts**: When the backend process or Docker container restarts:
  1. The worker startup hook invokes `reconcileQueueWithDB()`.
  2. Queries PostgreSQL for all email records with `status = 'SCHEDULED'`.
  3. Calculates remaining delay: `Math.max(0, scheduledAt.getTime() - Date.now())`.
  4. Enqueues the jobs back into BullMQ using their deterministic job IDs (`email:{emailId}`).
  5. Re-synchronizes Elasticsearch index.
- **Result**: Zero lost emails and zero duplicate sends regardless of process crashes or server reboots.

### 3. Throughput, Concurrency & Rate Limiting
- **Worker Concurrency**: Configurable via `WORKER_CONCURRENCY` env var (default: `5`).
- **Minimum Send Delay**: Configurable via `MIN_DELAY_MS` (default: `1000ms`). Implemented via BullMQ worker rate limiter (`limiter: { max: 1, duration: MIN_DELAY_MS }`).
- **Hourly Cap per Sender**:
  - Keyed in Redis as `sender:{senderId}:{YYYYMMDDHH}`.
  - Before sending an email, worker executes Redis `INCR`.
  - If `count > MAX_EMAILS_PER_HOUR_PER_SENDER` (or per-campaign limit):
    1. **Do NOT fail the job**.
    2. Compute exact timestamp for the next top of the hour: `nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0)`.
    3. Trigger live Slack rate-limit alert for the sender.
    4. Automatically reschedule the job in BullMQ to `nextHour` (`job.moveToDelayed(nextHourTime)`).

---

## Load Behavior Analysis (1,000+ Emails in 1 Minute)

### Scenario: 1,000 emails scheduled to fire simultaneously in the same minute

1. **API Ingestion Phase**:
   - `POST /api/emails/schedule` accepts the 1,000 lead list, creates PostgreSQL records in `SCHEDULED` status within a single transaction, and enqueues 1,000 delayed jobs into BullMQ with `jobId: email:{id}` in milliseconds.
2. **Backpressure & Concurrency Control**:
   - BullMQ worker concurrency limits active processing to `WORKER_CONCURRENCY` (e.g. 5 worker threads).
   - BullMQ rate limiter enforces `MIN_DELAY_MS` spacing (e.g. 1 email per second per worker).
   - Database and SMTP services are protected from spike overloads.
3. **Hourly Cap Rescheduling**:
   - Sender process checks Redis key `sender:{id}:{YYYYMMDDHH}`.
   - The first $N$ emails (up to `hourlyLimit`, e.g. 10) are sent immediately.
   - Email #11 onwards hits the rate limiter:
     - Worker triggers a Slack alert notification.
     - Reschedules overflow jobs into the next hourly window ($H+1$).
     - If overflow exceeds $H+1$, remaining emails spread into $H+2$, $H+3$, etc.
4. **Result**: All 1,000 emails are delivered gracefully over time without dropping a single job or exceeding rate limits.

---

## Slack Notification Integration
- Supports full **Slack OAuth v2** authorization flow (`GET /api/slack/auth` & `GET /api/slack/callback`).
- Stores bot access tokens and incoming webhook URLs per tenant/user in PostgreSQL.
- On rate-limit trip, fetches credentials from DB on trigger (no memory caching at boot).
- Posts rich formatted alert card (`chat.postMessage` or incoming webhook) containing sender email, hourly limit, current count, and next window timestamp.
- **Silent Skip**: If user has not connected Slack, alert skips silently without crashing.

---

## Elasticsearch Full-Text Search
- On email write or status update, document is indexed into Elasticsearch `emails` index.
- Endpoint `GET /api/emails/search?q=query` performs multi-match fuzzy search across `subject^3`, `recipient^2`, and `body^1`.
- Includes graceful fallback to PostgreSQL ILIKE query if Elasticsearch is starting up or disconnected.

---

## Feature Checklist Mapped to Brief Specs

| Feature Requirement | Status | Implementation Details |
| :--- | :---: | :--- |
| **No Cron Guarantee** | ✅ Completed | BullMQ delayed queue with `jobId: email:{id}` |
| **Restart Reconciliation** | ✅ Completed | PostgreSQL `SCHEDULED` query on boot re-enqueues jobs idempotently |
| **Worker Concurrency** | ✅ Completed | Configurable via `WORKER_CONCURRENCY` env var |
| **Min Send Delay** | ✅ Completed | BullMQ queue limiter (`MIN_DELAY_MS`) |
| **Hourly Rate Cap** | ✅ Completed | Redis counter `sender:{id}:{YYYYMMDDHH}` with auto next-hour rescheduling |
| **Slack Alerts** | ✅ Completed | OAuth + Incoming Webhook saved per tenant in DB |
| **Elasticsearch Search** | ✅ Completed | Auto-indexed on write, exposed via `/api/emails/search?q=` |
| **Bull-Board Dashboard** | ✅ Completed | Mounted live at `/admin/queues` |
| **Dark AI Theme** | ✅ Completed | Modern dark purple `#0B0A12` + emerald green `#10B981` UI system |
| **Google & Quick Auth** | ✅ Completed | NextAuth with Google provider + instant demo credentials |
| **PapaParse Lead Upload** | ✅ Completed | Client-side CSV/text parser with live valid/invalid counters |
| **Ethereal Mail Previews** | ✅ Completed | Direct test preview URLs attached to sent history rows |

---

## 🛠 Tech Stack Summary
- **Backend**: Node.js, TypeScript, Express.js, Prisma ORM, PostgreSQL, Redis, BullMQ, Elasticsearch JS, Nodemailer, Axios, Zod.
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, NextAuth.js, Framer Motion, PapaParse, Lucide Icons, Sonner.
- **Infra**: Docker, Docker Compose.
