# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Medicine Man is a full-stack server management and backup orchestration system with SSH scanning, service detection, and real-time WebSocket terminal access. The application uses a monorepo structure with three npm workspaces: `shared`, `backend`, and `frontend`.

## Build & Development Commands

### Monorepo Root
```bash
# Build all workspaces in order (shared → backend → frontend)
npm run build

# Development mode (runs backend and frontend concurrently)
npm run dev

# Run tests across all workspaces
npm test

# Lint all workspaces
npm run lint
```

### Backend (Node.js 20 + TypeScript + Express)
```bash
cd backend

# Development with hot reload (ts-node-dev)
npm run dev

# Build TypeScript to dist/
npm run build

# Production server
npm start

# Database migrations (uses node-pg-migrate)
npm run migrate              # Run pending migrations
npm run migrate:down         # Rollback last migration
npm run migrate:create NAME  # Create new migration file

# Setup & initialization
npm run setup               # Interactive setup wizard
npm run setup:db            # Initialize database schema
npm run setup:users         # Create initial admin user

# Code quality
npm run lint                # ESLint check
npm run format              # Prettier format
npm test                    # Jest tests
```

### Frontend (React 18 + Vite + TailwindCSS)
```bash
cd frontend

# Development server with HMR (port 8091)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Code quality
npm run lint
npm run format
```

### Shared Package (TypeScript types + Zod schemas)
```bash
cd shared
npm run build   # Compile TypeScript to dist/
```

## Docker Commands

The application is designed to run in Docker containers on Unraid but can be tested locally:

```bash
# Note: On Windows use "docker compose" (space) instead of "docker-compose"

# Build all containers
docker compose build

# Start all services (postgres, redis, backend, frontend)
docker compose up -d

# Check container status
docker compose ps

# View logs
docker compose logs -f
docker compose logs backend  # Specific service

# Stop and remove containers
docker compose down

# Restart specific service
docker compose restart backend
```

## Architecture

### Monorepo Structure

This is an **npm workspaces monorepo** with shared dependencies. All three packages (`shared`, `backend`, `frontend`) reference `@medicine-man/shared` as a workspace dependency. Always build `shared` first when making type changes.

### Backend Architecture

**Technology Stack:**
- Express.js REST API + WebSocket server
- PostgreSQL (primary database) + Redis (sessions/caching)
- BullMQ for job queues (backup jobs, scan jobs)
- SSH2 for remote server scanning
- Winston for structured logging
- JWT + Redis sessions for authentication

**Key Backend Services:**
- `services/scanner.ts` - SSH scanning engine with service detection (Docker, PostgreSQL, MySQL, Redis, MongoDB, etc.)
- `services/backupOrchestrator.ts` - Orchestrates multi-path backup jobs
- `services/terminal.ts` - WebSocket terminal session manager
- `services/healthCheckService.ts` - Server health monitoring with cron jobs
- `services/bitlaunchService.ts` - BitLaunch API integration for VPS provisioning
- `queues/workers/backupWorker.ts` - BullMQ worker for async backup execution
- `queues/workers/scanWorker.ts` - BullMQ worker for async scan execution

**Database Patterns:**
- All tables use UUID primary keys (`uuid-ossp` extension)
- Standard audit fields: `created_at`, `updated_at`
- Transactions via `withTransaction()` helper in `config/database.ts`
- Migrations in `backend/migrations/*.sql` executed by `node-pg-migrate`

**Security:**
- SSH credentials encrypted with AES-256-GCM (`utils/crypto.ts`)
- JWT tokens with 1-hour expiry
- Rate limiting: 100 req/15min for general API, 20 req/15min for auth
- Helmet.js security headers + CORS
- Input validation with Zod schemas

**API Routes:**
- All routes prefixed with `/api`
- Authentication: `/api/auth/*` (login, register, logout, 2FA)
- Users: `/api/users/*`
- Servers: `/api/servers/*` (CRUD, test connection, orchestrated backups)
- Scans: `/api/scans/*` (trigger scans, view results)
- Backups: `/api/backups/*` (list, create, restore)
- WebSocket: `/ws` (terminal sessions)

### Frontend Architecture

**Technology Stack:**
- React 18 with functional components + hooks
- Vite for fast builds and HMR
- TailwindCSS for styling (dark theme: `bg-slate-950`)
- Axios for API requests
- xterm.js for terminal emulator
- React Router for navigation

**Key Patterns:**
- Axios base URL configured to proxy to backend in development
- WebSocket connection for real-time terminal access
- Toast notifications for user feedback

### Queue System (BullMQ)

The application uses BullMQ with Redis for asynchronous job processing:

- **Backup Queue** (`queues/jobs/backupJobs.ts`): Handles backup creation jobs
- **Scan Queue** (`queues/jobs/scanJobs.ts`): Handles server scanning jobs
- **Workers**: Run in backend process (`queues/workers/`)
- **Queue Manager** (`queues/queueManager.ts`): Centralized queue configuration

Jobs are added to queues when users trigger backups or scans, allowing the API to return immediately while workers process jobs in the background.

## Environment Configuration

### Backend `.env` Requirements

The backend requires a `.env` file with the following critical variables:

```env
# Server
NODE_ENV=development|production
PORT=3000
HOST=0.0.0.0

# PostgreSQL
DB_HOST=localhost|postgres
DB_PORT=5432
DB_NAME=medicine_man
DB_USER=medicine_user
DB_PASSWORD=<secure_password>

# Redis
REDIS_HOST=localhost|redis
REDIS_PORT=6379
REDIS_PASSWORD=<secure_password>

# Security (MUST be 32-byte hex strings)
JWT_SECRET=<64_hex_chars>
SESSION_SECRET=<64_hex_chars>
ENCRYPTION_KEY=<64_hex_chars>

# CORS
CORS_ORIGIN=http://localhost:8091

# Logging
LOG_LEVEL=debug|info|warn|error
```

**Generate secure secrets:**
```bash
openssl rand -hex 32  # Generates 64 hex characters
```

### Frontend `.env` (Optional)

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Docker Compose `.env` (Root)

```env
DB_USER=medicine_user
DB_PASSWORD=<secure_password>
DB_NAME=medicine_man
REDIS_PASSWORD=<secure_password>
```

## Port Configuration

**IMPORTANT:** The application has recently been standardized to use consistent ports:

- **Backend API & WebSocket:** Port `3000` (container and host)
  - `docker-compose.yml`: `ports: ["3000:3000"]`
  - `backend/.env`: `PORT=3000`
  - `backend/Dockerfile`: `EXPOSE 3000`
- **Frontend:** Port `8091` (host) → `8080` (container)
  - `docker-compose.yml`: `ports: ["8091:8080"]`
- **PostgreSQL:** Port `5432` (internal to Docker network)
- **Redis:** Port `6379` (internal to Docker network)

## Database Migrations

Migrations are in `backend/migrations/` numbered sequentially:

- `001_initial_schema.sql` - Core tables (users, servers, scans, backups)
- `002_performance_indexes.sql` - Indexes for common queries
- `003_add_user_id_to_servers.sql` - User ownership tracking
- `004_audit_logs.sql` - Audit trail tables
- `005_ssh_key_rotation.sql` - SSH key rotation tracking
- `006_backup_verification.sql` - Backup verification tables
- `007_backup_schedules.sql` - Scheduled backup support
- `008_fix_password_column_and_setup_users.sql` - Password hash fixes
- `009_add_2fa_fields.sql` - Two-factor authentication
- `010_notifications.sql` - Notification system
- `011_restore_jobs.sql` - Backup restore tracking
- `012_additional_indexes.sql` - Query optimization
- `013_bitlaunch_integration.sql` - BitLaunch VPS integration
- `014_critical_schema_fixes.sql` - Recent schema fixes (assigned_at, options, orchestrated backup types)

**Running migrations:**
```bash
cd backend
npm run migrate
```

Migrations run automatically via `docker-entrypoint-initdb.d` when PostgreSQL container first starts.

## Testing Locally (Before Unraid Deployment)

1. **Prerequisites:** Docker Desktop running on Windows
2. **Build containers:** `docker compose build`
3. **Start services:** `docker compose up -d`
4. **Check status:** `docker compose ps` (all services should show "healthy")
5. **Run migrations:** `docker compose exec backend npm run migrate`
6. **Create admin user:** `docker compose exec backend npm run setup:users`
7. **Access UI:** Open `http://localhost:8091` in browser
8. **Test backend health:** `http://localhost:3000/health`

## SSH Scanning System

The scanner service (`services/scanner.ts`) connects to remote servers via SSH and executes commands to detect:

**Service Detection:**
- Docker containers (via `docker ps`)
- PostgreSQL databases (via `ps aux`, `systemctl`, config files)
- MySQL/MariaDB (process detection, config paths)
- Redis (process detection, port 6379)
- MongoDB (process detection, port 27017)
- Nginx/Apache (config and log paths)
- Node.js applications

**Filesystem Analysis:**
- Mount points and disk usage (`df -h`)
- Filesystem types (ext4, xfs, btrfs, zfs, etc.)
- Size calculations for backup estimates
- Exclusion patterns for system directories

**Scan Types:**
- `quick`: Basic health check and service list
- `full`: Complete service + filesystem scan
- `services`: Service-specific deep scan
- `filesystems`: Filesystem analysis only

## Known Issues & Recent Fixes

**Recently Fixed (Tier 1 & 2 improvements):**
- ✅ Removed `eval()` security vulnerability in `routes/users.ts`
- ✅ Added WebSocket idle timeout (30 minutes) to prevent resource leaks
- ✅ Upgraded nodemailer 6.9.10 → 7.0.10 (security fix)
- ✅ Standardized TypeScript to 5.6.3 across all workspaces
- ✅ Updated 8+ dependencies (pg, winston, ssh2, ws, compression, etc.)
- ✅ Fixed port configuration mismatch (backend now consistently uses port 3000)
- ✅ Added critical schema fixes in migration 014

**Known Issues (Documented but not yet fixed):**
- SQL injection vulnerability in `routes/servers.ts:1076` (dynamic query building)
- Terminal authorization bypass (userId not passed to TerminalSession)
- Scan jobs use placeholder logic instead of real scanner integration
- Pagination data structure mismatch in some endpoints
- Missing global error boundary in frontend

## Development Guidelines

- **Always build `shared` first** when changing types or Zod schemas
- **Use `withTransaction()`** from `config/database.ts` for multi-query operations
- **Encrypt SSH credentials** using `encrypt()`/`decrypt()` from `utils/crypto.ts`
- **Add Zod validation** for all new API endpoints in `utils/validation.ts`
- **Use Winston logger** instead of `console.log` (import from `config/logger.ts`)
- **WebSocket messages** should include `type` field for routing
- **Queue jobs** for long-running operations (backups, scans) instead of blocking HTTP requests

## Unraid Deployment Notes

This application is designed to run on Unraid with Docker. Key Unraid-specific considerations:

- Volume paths should be absolute (e.g., `/mnt/user/appdata/medicine-man`)
- PUID/PGID support needed for file permissions
- Named volumes converted to bind mounts for Unraid
- Database connection retry logic for container startup order
- Resource limits configured in `docker-compose.yml`

Refer to `.github/copilot-instructions.md` for additional architecture details.
