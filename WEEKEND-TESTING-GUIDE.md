# Weekend Testing Guide - Medicine Man Backups & Scheduling

**Goal:** Get Medicine Man running locally on Windows Docker Desktop for weekend backup testing.

---

## ⚡ Prerequisites

- ✅ Docker Desktop installed and running
- ✅ Git Bash or PowerShell
- ✅ 10GB free disk space
- ✅ 8GB+ RAM

---

## 🚀 Quick Start (5 Steps)

### Step 1: Generate Secrets

```bash
cd C:\Users\Spenc\MMVPS\medicine-man

# Generate 5 secrets (copy and save these!)
openssl rand -hex 32  # Copy this for JWT_SECRET
openssl rand -hex 32  # Copy this for SESSION_SECRET
openssl rand -hex 32  # Copy this for ENCRYPTION_KEY
openssl rand -hex 32  # Copy this for DB_PASSWORD
openssl rand -hex 32  # Copy this for REDIS_PASSWORD
```

### Step 2: Create Root .env File

Create a new file: `C:\Users\Spenc\MMVPS\medicine-man\.env`

```env
DB_USER=medicine_user
DB_PASSWORD=<paste_your_generated_db_password_here>
DB_NAME=medicine_man
REDIS_PASSWORD=<paste_your_generated_redis_password_here>
PUID=1000
PGID=1000
```

### Step 3: Update Backend .env

Edit: `C:\Users\Spenc\MMVPS\medicine-man\backend\.env`

**Replace these lines:**
```env
DB_HOST=postgres
DB_PASSWORD=<paste_your_db_password>
REDIS_HOST=redis
REDIS_PASSWORD=<paste_your_redis_password>
JWT_SECRET=<paste_your_jwt_secret>
SESSION_SECRET=<paste_your_session_secret>
ENCRYPTION_KEY=<paste_your_encryption_key>
DATABASE_URL=postgresql://medicine_user:<your_db_password>@postgres:5432/medicine_man
```

**Important:** Change `localhost` to `postgres` and `redis` for Docker networking.

### Step 4: Build & Start

```bash
# Build containers (5-10 min first time)
docker compose build

# Start all services
docker compose up -d

# Check status (wait for all to show "healthy")
docker compose ps
```

### Step 5: Initialize Database & Create Admin

```bash
# Run migrations
docker compose exec backend npm run migrate

# Create admin user (interactive)
docker compose exec backend npm run setup:users
```

**Done!** Access at **http://localhost:8091**

---

## 🧪 Testing Backup Features

### 1. Add Test Server

1. Open http://localhost:8091 and login
2. Go to **Servers** → **Add Server**
3. Fill in:
   - Name: `Test Server`
   - Hostname: (your server IP)
   - SSH Port: `22`
   - Username: (SSH username)
   - Password/SSH Key
4. Click **Test Connection**
5. Click **Save**

### 2. Manual Backup

1. Select your server
2. Click **Backup** button
3. Choose paths to backup
4. Click **Create Backup**
5. Monitor progress

### 3. Schedule Backup

1. Select server → **Schedule**
2. Set frequency (Daily/Weekly)
3. Choose backup paths
4. Set retention policy
5. Click **Save Schedule**

### 4. Orchestrated Backup (Multi-Server)

1. Add 2+ servers
2. Click **Orchestrated Backup**
3. Select servers
4. Configure options
5. Click **Start**

---

## 📊 Monitoring

```bash
# View all logs
docker compose logs -f

# Backend only
docker compose logs -f backend

# Check health
curl http://localhost:3000/health

# Database access
docker compose exec postgres psql -U medicine_user -d medicine_man
```

---

## 🔧 Troubleshooting

### Backend won't start
```bash
docker compose logs backend
# Wait 60 seconds - backend retries database connection
```

### Can't access web UI
```bash
# Check frontend status
docker compose ps frontend

# Restart if needed
docker compose restart frontend
```

### Database errors
```bash
# Retry migrations
docker compose exec backend npm run migrate

# Check DATABASE_URL
docker compose exec backend env | grep DATABASE_URL
```

### Permission errors
```bash
# Fix log/backup permissions
docker compose exec backend chown -R appuser:appgroup /app/logs /app/backups
```

---

## 🛠️ Useful Commands

```bash
# Stop all
docker compose down

# Restart
docker compose restart

# Rebuild after code changes
docker compose up -d --build backend

# View container stats
docker stats

# Reset everything (DELETES DATA!)
docker compose down -v
docker compose up -d --build
docker compose exec backend npm run migrate
docker compose exec backend npm run setup:users
```

---

## ✅ Weekend Testing Checklist

- [ ] All containers healthy
- [ ] Admin user created
- [ ] Can login to web UI
- [ ] Add test server
- [ ] Manual backup works
- [ ] View backup in UI
- [ ] Schedule backup created
- [ ] Scheduled backup executes
- [ ] Orchestrated backup (2+ servers)
- [ ] Check logs are written
- [ ] Backup restore works

---

## 🎯 Quick Reference

| Component | URL | Credentials |
|-----------|-----|-------------|
| Web UI | http://localhost:8091 | (your admin user) |
| API | http://localhost:3000 | N/A |
| Health | http://localhost:3000/health | N/A |

**Logs:** `backend/logs/application-*.log`
**Backups:** `backend/backups/`
**Database Backups:** `backend/db-backups/`

---

**Happy Testing!** 🎉

For issues, check `docker compose logs -f` first.
