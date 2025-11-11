# Medicine Man

A comprehensive server management and backup recommendation system with SSH scanning capabilities, web-based terminal, and automated service detection.

## Description

Medicine Man is a full-stack application designed to help system administrators manage multiple servers, perform automated SSH-based scanning, detect running services and filesystems, and receive intelligent backup recommendations. The system provides a modern web interface with real-time WebSocket-based terminal access, server health monitoring, and detailed scan reporting.

## Features

### Core Features
- **Server Management**: Add, edit, and monitor multiple servers with SSH connectivity
- **Automated SSH Scanning**: Perform quick, full, service-specific, or filesystem scans on remote servers
- **Service Detection**: Automatically detect and catalog running services (Docker, PostgreSQL, MySQL, Redis, MongoDB, etc.)
- **Filesystem Analysis**: Scan and analyze filesystem usage, mount points, and storage capacity
- **Intelligent Backup Recommendations**: Receive prioritized backup suggestions based on detected services and data
- **Web-Based Terminal**: Real-time WebSocket terminal access to servers via browser
- **User Authentication & Authorization**: Secure JWT-based authentication with role-based access control
- **Activity Logging**: Track all user actions and system events
- **Health Monitoring**: Real-time server status and connectivity checks
- **Redis Caching**: Optimized performance with Redis-based session management and caching

### Security Features
- Rate limiting on API endpoints
- Helmet.js security headers
- CORS protection
- Encrypted credential storage
- Session management with Redis
- HTTP-only secure cookies
- SQL injection prevention
- Input validation with Zod
- Error handling middleware

## Tech Stack

### Backend
- **Node.js** 22+ - JavaScript runtime (LTS)
- **Express** 4.21+ - Web application framework
- **TypeScript** 5.7+ - Type-safe JavaScript
- **PostgreSQL** 17+ - Primary database
- **Redis** 7+ - Session store and caching
- **SSH2** - SSH client for server scanning
- **WebSocket (ws)** - Real-time terminal communication
- **Winston** - Logging framework
- **Helmet** - Security middleware
- **Zod** - Schema validation
- **JWT** - Authentication tokens
- **Bcrypt** - Password hashing
- **BullMQ** - Queue management

### Frontend
- **React** 18.3+ - UI framework
- **TypeScript** 5.7+ - Type safety
- **Vite** 6+ - Build tool and dev server
- **TailwindCSS** 3.4+ - Utility-first CSS framework
- **Axios** - HTTP client
- **XTerm.js** 5.5+ - Terminal emulator
- **Lucide React** - Icon library

## 🚀 Quick Start (Recommended)

**The fastest way to get Medicine Man running on Unraid or any Linux system:**

```bash
./deploy.sh
```

This automated deployment script will:
- ✅ Run the interactive setup wizard (generates secure passwords automatically)
- ✅ Start PostgreSQL and Redis containers
- ✅ Run database migrations
- ✅ Create your admin user

**See [QUICK-START.md](QUICK-START.md) for detailed quick-start guide.**

---

For manual installation or advanced configuration, continue with the sections below.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 22.x or higher (LTS recommended)
- **PostgreSQL** 17.x or higher
- **Redis** 7.x or higher
- **npm** or **yarn** package manager
- **Git** for version control

### Recommended System Requirements
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 20GB minimum
- **CPU**: 2 cores minimum, 4 cores recommended

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd medicine-man
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

## Setup Wizard (Recommended)

Medicine Man includes an interactive setup wizard that makes configuration easy and secure.

### Running the Setup Wizard

**Option 1: Using the shell script (Linux/Mac/Unraid)**
```bash
./setup-wizard.sh
```

**Option 2: Using the batch script (Windows)**
```batch
setup-wizard.bat
```

**Option 3: Using npm directly**
```bash
cd backend
npm install
npm run setup
```

### What the Wizard Does

The setup wizard will:

- Generate secure random secrets (encryption keys, JWT secrets, passwords)
- Guide you through configuration options
- Create a properly formatted `.env` file
- Backup your existing configuration (if any)
- Validate all inputs
- Set privacy-focused defaults (no IP/user-agent logging)

### Wizard Features

- **Auto-Generated Secrets**: All security-critical values are generated using cryptographically secure random generators
- **Smart Defaults**: Production-ready defaults for all settings
- **User-Friendly**: Clear prompts and explanations for each setting
- **Safe**: Backs up existing configuration before making changes
- **Privacy-Focused**: Disables IP and user-agent logging by default for anonymous operation

### After Running the Wizard

Once the wizard completes:

1. Start the application with Docker Compose:
   ```bash
   docker-compose up -d
   ```

2. Run database migrations:
   ```bash
   cd backend
   npm run migrate
   ```

3. Access the application at the configured CORS origin (default: http://localhost:8091)

### Manual Configuration (Alternative)

If you prefer to configure manually, continue with the Environment Configuration section below.

## Environment Configuration

**Note:** The Setup Wizard (above) is the recommended way to configure Medicine Man. The following manual configuration steps are provided as an alternative.

### Backend Configuration

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3001

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medicine_man
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Security
JWT_SECRET=your_jwt_secret_at_least_32_characters_long_random_string
SESSION_SECRET=your_session_secret_at_least_32_characters_long_random_string
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# CORS
CORS_ORIGIN=http://localhost:8091

# Logging
LOG_LEVEL=info
```

**Important Security Notes:**
- Generate secure random strings for `JWT_SECRET` and `SESSION_SECRET` (minimum 32 characters)
- Use a 64-character hexadecimal string for `ENCRYPTION_KEY` (used for encrypting server credentials)
- Never commit your `.env` file to version control

**Generate secure secrets manually:**
```bash
# Generate JWT_SECRET and SESSION_SECRET
openssl rand -hex 32

# Generate ENCRYPTION_KEY (64 hex characters)
openssl rand -hex 32
```

### Frontend Configuration

Create a `.env` file in the `frontend` directory:

```bash
cd ../frontend
touch .env
```

Add the following configuration:

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## Database Setup

### 1. Create the Database

Connect to PostgreSQL and create the database:

```bash
psql -U postgres
```

```sql
CREATE DATABASE medicine_man;
\q
```

### 2. Run Migrations

Navigate to the backend directory and run migrations:

```bash
cd backend
npm run migrate
```

This will:
- Enable UUID extension
- Create all necessary tables (users, servers, scans, backups, etc.)
- Set up indexes for optimal query performance
- Create triggers for automatic timestamp updates

### 3. Verify Database Schema

Connect to the database and verify tables were created:

```bash
psql -U postgres -d medicine_man -c "\dt"
```

You should see tables: `users`, `user_roles`, `servers`, `server_scans`, `detected_services`, `detected_filesystems`, `backup_recommendations`, `backups`, `user_activity_logs`

## Running the Application

### Development Mode

#### Start Backend Server

```bash
cd backend
npm run dev
```

The backend API will be available at `http://localhost:3001`

#### Start Frontend Development Server

Open a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:8091`

### Production Mode

#### Build Backend

```bash
cd backend
npm run build
npm start
```

#### Build Frontend

```bash
cd frontend
npm run build
npm run preview
```

For production deployment, serve the built files from `frontend/dist` using a static file server like Nginx or serve through the Express backend.

## Project Structure

```
medicine-man/
├── backend/
│   ├── src/
│   │   ├── config/           # Database, Redis, Logger configuration
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   └── logger.ts
│   │   ├── middleware/       # Express middleware
│   │   │   ├── auth.ts
│   │   │   └── errorHandler.ts
│   │   ├── routes/           # API route handlers
│   │   │   ├── auth.ts       # Authentication endpoints
│   │   │   ├── users.ts      # User management
│   │   │   ├── servers.ts    # Server CRUD operations
│   │   │   ├── scans.ts      # Scan management
│   │   │   └── backups.ts    # Backup operations
│   │   ├── services/         # Business logic
│   │   │   └── scanner.ts    # SSH scanning service
│   │   ├── utils/            # Utility functions
│   │   │   ├── crypto.ts     # Encryption/Decryption
│   │   │   └── validation.ts # Input validation
│   │   ├── types/            # TypeScript type definitions
│   │   └── index.ts          # Application entry point
│   ├── migrations/           # Database migrations
│   │   └── 001_initial_schema.sql
│   ├── logs/                 # Application logs
│   ├── .env.example          # Environment template
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Main application component
│   │   ├── main.tsx          # Application entry point
│   │   └── index.css         # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── README.md
```

## API Endpoints Overview

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### Users
- `GET /api/users` - List all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

### Servers
- `GET /api/servers` - List all servers
- `GET /api/servers/:id` - Get server details
- `POST /api/servers` - Add new server
- `PUT /api/servers/:id` - Update server
- `DELETE /api/servers/:id` - Delete server
- `POST /api/servers/:id/test` - Test server connectivity

### Scans
- `GET /api/scans` - List all scans
- `GET /api/scans/:id` - Get scan details
- `POST /api/scans` - Start new scan
- `GET /api/scans/:id/services` - Get detected services
- `GET /api/scans/:id/filesystems` - Get detected filesystems
- `GET /api/scans/:id/recommendations` - Get backup recommendations

### Backups
- `GET /api/backups` - List all backups
- `GET /api/backups/:id` - Get backup details
- `POST /api/backups` - Create new backup
- `DELETE /api/backups/:id` - Delete backup

### System
- `GET /health` - Health check endpoint
- `GET /api` - API information and version

### WebSocket
- `WS /ws` - WebSocket connection for terminal access

## Security Features Implemented

### Authentication & Authorization
- JWT-based authentication with secure token generation
- Role-based access control (admin, user, viewer)
- Session management with Redis store
- HTTP-only secure cookies
- Password hashing with bcrypt (10 rounds)

### API Security
- Helmet.js security headers (XSS, CSRF protection)
- CORS configuration with origin whitelisting
- Rate limiting (100 requests per 15 minutes per IP)
- Request size limits (10MB JSON/URL-encoded bodies)
- Input validation using Zod schemas

### Data Security
- Encrypted server credentials using AES-256-CBC
- SQL injection prevention via parameterized queries
- Sanitized error messages (no stack traces in production)
- Secure credential storage in PostgreSQL

### Network Security
- HTTPS enforcement in production
- SameSite cookie protection
- WebSocket connection validation
- IP address logging for audit trails

### Error Handling
- Centralized error handling middleware
- Structured error logging with Winston
- Graceful shutdown handling
- Unhandled rejection/exception handlers

## Known Issues and Fixes

### Issues Identified in Code Review

1. **Session Configuration** (Fixed)
   - Issue: Missing `sameSite` attribute in session cookies
   - Fix: Added `sameSite: 'lax'` to session configuration

2. **CORS Configuration** (Fixed)
   - Issue: `methods` property incorrectly placed in origin callback
   - Fix: Moved `methods` array to top-level CORS options

3. **Rate Limiter Headers** (Fixed)
   - Issue: Using both `standardHeaders` and legacy headers
   - Fix: Set `legacyHeaders: false` for modern rate limit headers

4. **WebSocket Terminal** (In Progress)
   - Issue: Terminal session handling not fully implemented
   - Status: Basic WebSocket connection working, SSH terminal integration pending

5. **Backup Execution** (Planned)
   - Issue: Backup creation endpoint defined but execution logic incomplete
   - Status: Recommendations generated, actual backup execution in development

6. **Input Validation** (Enhanced)
   - Enhancement: Added comprehensive Zod schemas for all endpoints
   - Validates: Email formats, password strength, IP addresses, port numbers

7. **Error Messages** (Secured)
   - Enhancement: Sanitized error responses to prevent information disclosure
   - Stack traces hidden in production environment

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow ESLint configuration
- Use async/await for asynchronous operations
- Implement proper error handling with try-catch blocks
- Add JSDoc comments for complex functions

### Testing
```bash
# Backend tests
cd backend
npm test
npm run test:watch
```

### Linting
```bash
# Backend linting
cd backend
npm run lint

# Frontend linting
cd frontend
npm run lint
```

### Database Migrations

Create a new migration:
```bash
cd backend
npm run migrate:create <migration-name>
```

Run migrations:
```bash
npm run migrate
```

Rollback last migration:
```bash
npm run migrate:down
```

## Contributing

Contributions are welcome! Please follow these guidelines:

### Getting Started
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Pull Request Guidelines
- Write clear, descriptive commit messages
- Update documentation for any changed functionality
- Add tests for new features
- Ensure all tests pass before submitting
- Follow the existing code style and conventions
- Keep PRs focused on a single feature or fix

### Code Review Process
- All PRs require at least one review
- Address reviewer feedback promptly
- Keep PRs reasonably sized for easier review
- Update PR description with any significant changes

### Bug Reports
When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Relevant logs or error messages

### Feature Requests
For feature requests, please provide:
- Clear use case and problem statement
- Proposed solution or approach
- Any alternative solutions considered
- Potential impact on existing features

## Troubleshooting

### Common Issues

**Database Connection Fails**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify connection settings in .env
psql -U postgres -d medicine_man
```

**Redis Connection Fails**
```bash
# Check Redis is running
sudo systemctl status redis

# Test Redis connection
redis-cli ping
```

**Port Already in Use**
```bash
# Find process using port 3001
lsof -i :3001
netstat -ano | findstr :3001  # Windows

# Kill the process or change PORT in .env
```

**Migration Errors**
```bash
# Check migration status
npm run migrate:down
npm run migrate
```

## License

This project is licensed under the MIT License.

```
MIT License

Copyright (c) 2024 Medicine Man

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Support

For support, please open an issue in the GitHub repository or contact the development team.

## Roadmap

### Upcoming Features
- [ ] Complete WebSocket terminal implementation with SSH session management
- [ ] Automated backup scheduling and execution
- [ ] Multi-server parallel scanning
- [ ] Backup restoration interface
- [ ] Email notifications for scan results and backup status
- [ ] Dashboard with server metrics and statistics
- [ ] Docker container support for easier deployment
- [ ] Mobile-responsive UI improvements
- [ ] Export scan reports to PDF/CSV
- [ ] Integration with cloud storage providers (S3, Azure Blob, etc.)

### Long-term Goals
- Kubernetes deployment support
- Multi-tenancy for managed service providers
- Advanced analytics and reporting
- Automated backup testing and verification
- Integration with monitoring tools (Prometheus, Grafana)

---

**Built with dedication to making server management and backups simple and reliable.**
