# Medicine Man - AI Coding Instructions

## Project Architecture

**Medicine Man** is a full-stack server management and backup recommendation system with SSH scanning capabilities. The architecture follows a traditional separation with PostgreSQL/Redis backend and React frontend.

### Core Components
- **Backend**: Express.js + TypeScript API server on port 3001
- **Frontend**: React + Vite SPA with Tailwind CSS on port 3000  
- **Database**: PostgreSQL 15+ for primary data, Redis 7+ for sessions/caching
- **Communication**: REST API + WebSocket for real-time terminal access

## Development Workflow

### Environment Setup
1. **Database First**: Run `docker-compose up postgres redis` to start databases
2. **Backend Setup**: `npm run setup:db` to initialize schema, then `npm run dev`
3. **Frontend**: `npm run dev` (auto-proxies `/api` and `/ws` to backend)
4. **Full Stack**: Use the `setup.sh` script for complete environment setup

### Key Commands
```bash
# Backend
npm run dev              # Development with hot reload
npm run setup:db         # Initialize database schema
npm run migrate          # Run database migrations

# Frontend  
npm run dev              # Vite dev server with proxy
npm run build            # TypeScript + Vite build
```

## Project-Specific Patterns

### Authentication & Security
- **JWT-based auth** with HttpOnly cookies and Redis sessions
- **Role system**: First user becomes `admin`, others default to `viewer`
- **Encrypted credentials**: SSH passwords/keys stored using AES-256-GCM (`utils/crypto.ts`)
- **Session management**: Uses `connect-redis` with configurable expiry

### Database Patterns
- **Transaction wrapper**: Use `withTransaction()` from `config/database.ts` for atomic operations
- **UUID primary keys**: All tables use UUID v4 with `uuid-ossp` extension
- **Audit fields**: Standard `created_at`/`updated_at` on all entities
- **Migration system**: SQL files in `backend/migrations/` run via `node-pg-migrate`

### API Structure
- All routes prefixed with `/api`
- **Validation**: Zod schemas in `utils/validation.ts` with `validateRequest` middleware
- **Error handling**: Centralized with `AppError` class and `asyncHandler` wrapper
- **Rate limiting**: 100 requests per 15 minutes per IP
- **Security headers**: Helmet.js with CORS for cross-origin requests

### SSH & Scanning Service
- **Scanner service** (`services/scanner.ts`): Core SSH client using `ssh2` library
- **Scan types**: `quick`, `full`, `services`, `filesystems` with different command sets
- **Service detection**: Auto-discovers Docker, PostgreSQL, MySQL, Redis, MongoDB, etc.
- **Backup recommendations**: Priority-based suggestions from detected services

### Frontend Architecture  
- **React 18** with TypeScript and functional components
- **Styling**: Tailwind CSS with dark theme (`bg-slate-950`)
- **Terminal integration**: xterm.js for WebSocket-based SSH terminals
- **API client**: Axios with base URL configuration

### WebSocket Terminal
- Real-time terminal access via WebSocket on `/ws` endpoint
- Connection handling for multiple concurrent SSH sessions
- Integrated with xterm.js on frontend for full terminal emulation

## File Organization

### Backend Structure
- `src/config/`: Database, Redis, and logger configuration
- `src/routes/`: Express route handlers by feature (`auth`, `servers`, `scans`)
- `src/services/`: Business logic (SSH scanner, backup recommendations)
- `src/middleware/`: Authentication, error handling, validation
- `src/utils/`: Crypto utilities, validation schemas
- `migrations/`: SQL schema files executed by setup scripts

### Frontend Structure  
- `src/`: React components and main application logic
- Vite configuration with proxy to backend API and WebSocket

## Development Notes

- **Environment variables**: Backend uses `.env` for database/Redis credentials and encryption keys
- **Docker support**: Full PostgreSQL and Redis setup via `docker-compose.yml`
- **Logging**: Winston logger with structured logging throughout backend
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Security**: Encrypted SSH credentials, rate limiting, and proper session management