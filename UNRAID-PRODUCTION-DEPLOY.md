# Medicine Man - Production Deployment Guide for Unraid
**Target Server:** 192.168.4.21:8091
**Resources:** 16GB RAM, 4 CPU Cores
**External Access:** Cloudflare Tunnel

---

## 📋 Pre-Deployment Checklist

- [  ] Unraid server accessible at 192.168.4.21
- [ ] Docker installed and running on Unraid
- [ ] 20GB+ free space on /mnt/user/appdata
- [ ] Cloudflare tunnel configured for external access
- [ ] SSH access to Unraid server

---

## 🚀 Quick Deployment (10 Minutes)

### Step 1: Transfer Files to Unraid

```bash
# From your Windows machine
cd C:\Users\Spenc\MMVPS

# Create tarball (faster transfer)
tar -czf medicine-man.tar.gz medicine-man/

# Transfer to Unraid
scp medicine-man.tar.gz root@192.168.4.21:/mnt/user/appdata/

# SSH into Unraid
ssh root@192.168.4.21

# Extract
cd /mnt/user/appdata
tar -xzf medicine-man.tar.gz
cd medicine-man
```

### Step 2: Generate Production Secrets

```bash
# Generate 5 secure secrets (run this 5 times, save each output)
openssl rand -hex 32
```

**Save these for next step!**

### Step 3: Create Production .env Files

#### Root .env
Create `/mnt/user/appdata/medicine-man/.env`:

```env
# Database Credentials
DB_USER=medicine_user
DB_PASSWORD=<paste_secret_1_here>
DB_NAME=medicine_man

# Redis Credentials
REDIS_PASSWORD=<paste_secret_2_here>

# Unraid User/Group (typically 99:100 for nobody:users)
PUID=99
PGID=100
```

#### Backend .env
Create `/mnt/user/appdata/medicine-man/backend/.env`:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration (internal Docker network)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=medicine_man
DB_USER=medicine_user
DB_PASSWORD=<paste_secret_1_here>
DATABASE_URL=postgresql://medicine_user:<secret_1>@postgres:5432/medicine_man

# Redis Configuration (internal Docker network)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<paste_secret_2_here>

# Security Secrets (CRITICAL - use different secrets!)
JWT_SECRET=<paste_secret_3_here>
SESSION_SECRET=<paste_secret_4_here>
ENCRYPTION_KEY=<paste_secret_5_here>

# JWT Token Expiry
JWT_EXPIRES_IN=24h

# CORS Configuration (Unraid server IP)
CORS_ORIGIN=http://192.168.4.21:8091

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_IP=false
LOG_USER_AGENT=false

# Cache
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300

# Authentication
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_DURATION=1800000
SESSION_TIMEOUT=3600000

# WebSocket
WS_IDLE_TIMEOUT=600000

# HTTPS (set to true if behind Cloudflare)
REQUIRE_HTTPS=false

# Notifications (optional - configure if needed)
NOTIFICATIONS_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@medicine-man.local

# Slack (optional)
SLACK_WEBHOOK_URL=
SLACK_CHANNEL=#alerts
```

### Step 4: Build and Start

```bash
cd /mnt/user/appdata/medicine-man

# Build containers (10-15 minutes first time)
docker compose build

# Start all services
docker compose up -d

# Check status (wait for all "healthy")
docker compose ps
```

**Expected output:**
```
NAME                        STATUS
medicine_man_backend        Up (healthy)
medicine_man_frontend       Up (healthy)
medicine_man_postgres       Up (healthy)
medicine_man_redis          Up (healthy)
```

### Step 5: Initialize Database

```bash
# Run migrations
docker compose exec backend npm run migrate

# Verify migrations
docker compose exec backend npm run migrate -- list
```

### Step 6: Create Initial Users

```bash
# Interactive user creation
docker compose exec backend npm run setup:users
```

**Follow prompts to create passwords for:**
- **admin** (admin) - Primary administrator
- **Kaos** (admin) - Secondary administrator
- **zeus** (user) - Standard user
- **marlon** (user) - Standard user
- **s3rpant** (user) - Standard user

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Step 7: Access Application

**Local Access:** http://192.168.4.21:8091
**Backend API:** http://192.168.4.21:3000
**Health Check:** http://192.168.4.21:3000/health

**Login with your created credentials!**

---

## 🔧 Post-Deployment Configuration

### Configure Cloudflare Tunnel

Your existing Cloudflare tunnel should forward:
- External URL → `http://192.168.4.21:8091`

Update backend CORS:
```bash
# Edit backend/.env
CORS_ORIGIN=https://your-domain.com
```

Then restart:
```bash
docker compose restart backend
```

### Set Up Notifications (Optional)

1. **Email Notifications:**
   - Use Gmail with App Password: https://myaccount.google.com/apppasswords
   - Or configure your SMTP server
   - Update `SMTP_*` variables in `backend/.env`

2. **Slack Notifications:**
   - Create webhook: https://api.slack.com/messaging/webhooks
   - Update `SLACK_WEBHOOK_URL` in `backend/.env`

3. **Restart backend:**
   ```bash
   docker compose restart backend
   ```

---

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Overall health
curl http://192.168.4.21:3000/health

# System metrics (requires admin auth)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://192.168.4.21:3000/api/metrics/system
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Database Backup

```bash
# Create backup
docker compose exec postgres pg_dump -U medicine_user medicine_man | \
  gzip > /mnt/user/backups/medicine-man-db-$(date +%Y%m%d-%H%M%S).sql.gz

# Restore backup
gunzip < /mnt/user/backups/medicine-man-db-20250105-120000.sql.gz | \
  docker compose exec -T postgres psql -U medicine_user -d medicine_man
```

### Update Application

```bash
cd /mnt/user/appdata/medicine-man

# Pull latest code
git pull  # if using git

# Rebuild
docker compose build

# Restart with new images
docker compose up -d --force-recreate

# Run any new migrations
docker compose exec backend npm run migrate
```

---

## 🔒 Security Hardening

### 1. Firewall Rules (Unraid)

Only expose necessary ports:
- Port 8091 (frontend) - accessible from LAN + Cloudflare
- Port 3000 (backend API) - internal only if using Cloudflare

### 2. Enable HTTPS

If using Cloudflare tunnel with SSL:
```env
# backend/.env
REQUIRE_HTTPS=true
CORS_ORIGIN=https://your-domain.com
```

### 3. Rotate Secrets Regularly

```bash
# Generate new secrets
openssl rand -hex 32

# Update .env files
# Restart services
docker compose restart
```

### 4. Monitor Audit Logs

Check admin panel → Audit Logs for suspicious activity.

### 5. Regular Backups

Set up automated backups:
```bash
# Add to Unraid cron (Settings → User Scripts)
# Run daily at 2 AM

#!/bin/bash
cd /mnt/user/appdata/medicine-man
docker compose exec postgres pg_dump -U medicine_user medicine_man | \
  gzip > /mnt/user/backups/medicine-man-db-$(date +%Y%m%d).sql.gz

# Keep only last 30 days
find /mnt/user/backups -name "medicine-man-db-*.sql.gz" -mtime +30 -delete
```

---

## 🚨 Troubleshooting

### Backend Won't Start

```bash
# Check logs
docker compose logs backend

# Common issues:
# 1. Database not ready - backend retries automatically (wait 60s)
# 2. Missing .env values - check backend/.env has all required variables
# 3. Port 3000 in use - stop other services using this port
```

### Frontend Shows 502 Bad Gateway

```bash
# Check backend is running
docker compose ps backend

# Check backend logs
docker compose logs backend

# Restart backend
docker compose restart backend
```

### Database Connection Errors

```bash
# Verify database is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Test connection
docker compose exec backend npm run migrate -- list
```

### Permission Errors on Logs/Backups

```bash
# Fix permissions
docker compose exec backend chown -R appuser:appgroup /app/logs /app/backups

# Or from Unraid host
cd /mnt/user/appdata/medicine-man/backend
chown -R 99:100 logs backups
```

### WebSocket Connection Fails

Check CORS and WebSocket URL:
```javascript
// Frontend should use:
ws://192.168.4.21:3000/ws  // Local
wss://your-domain.com/ws    // Cloudflare
```

---

## 📈 Resource Usage

**Expected Usage (4 servers, moderate activity):**

| Container | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Backend | 20-30% (1 core) | 2-3GB | 1GB logs |
| Frontend | 5-10% | 512MB | 100MB |
| PostgreSQL | 10-20% | 1-2GB | 5GB+ data |
| Redis | 5-10% | 256MB | 100MB |
| **Total** | **~50%** | **~6GB** | **~10GB** |

**Your Unraid server (16GB RAM, 4 cores) has plenty of headroom!**

---

## ✅ Post-Deployment Verification

Run through this checklist:

### Basic Functionality
- [ ] Access frontend at http://192.168.4.21:8091
- [ ] Login with admin credentials
- [ ] All 5 users can login
- [ ] Dashboard loads without errors

### Server Management
- [ ] Can add a test server
- [ ] SSH connection test works
- [ ] Can view server details

### Scanning
- [ ] Can trigger a scan
- [ ] Scan completes successfully
- [ ] Scan results show real data (services, filesystems)
- [ ] Backup recommendations appear

### Backups
- [ ] Can create manual backup
- [ ] Backup job appears in backups list
- [ ] Can create backup schedule
- [ ] Schedule shows next run time

### Advanced Features
- [ ] SSH terminal works
- [ ] Can view logs
- [ ] Health monitoring shows data
- [ ] Notifications work (if configured)

### External Access (via Cloudflare)
- [ ] Can access via your domain
- [ ] HTTPS works
- [ ] Login works externally
- [ ] WebSocket terminal works externally

---

## 🎯 Production Readiness Checklist

### CRITICAL (Must Complete)
- [ ] All environment secrets generated and unique
- [ ] Database backups configured
- [ ] Initial users created
- [ ] Firewall configured
- [ ] Cloudflare tunnel configured

### RECOMMENDED
- [ ] Email notifications configured
- [ ] Slack notifications configured (if using)
- [ ] Automated database backups scheduled
- [ ] Log rotation configured
- [ ] Monitoring alerts set up

### OPTIONAL
- [ ] 2FA enabled for admin accounts
- [ ] Custom domain configured
- [ ] SSL certificate installed
- [ ] Backup verification scheduled
- [ ] Performance monitoring (Prometheus/Grafana)

---

## 📞 Support & Documentation

**Application Health:**
```bash
docker compose ps
docker compose logs -f
```

**Database Status:**
```bash
docker compose exec postgres psql -U medicine_user -d medicine_man -c "\dt"
```

**Check Migrations:**
```bash
docker compose exec backend npm run migrate -- list
```

**Container Stats:**
```bash
docker stats
```

---

## 🎉 You're Done!

Medicine Man is now running in production on your Unraid server at:
- **Local:** http://192.168.4.21:8091
- **External:** https://your-domain.com (via Cloudflare)

**Next Steps:**
1. Add your first production server
2. Configure backup schedules
3. Set up notification preferences
4. Test backup creation and restoration

**Happy Managing!** 🚀
