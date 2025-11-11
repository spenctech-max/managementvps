# Medicine Man - Unraid Deployment Guide

**Quick Deploy:** Complete step-by-step guide for Unraid deployment

---

## Pre-Deployment Checklist

Before transferring to Unraid, ensure:
- Docker installed on Unraid
- Unraid network accessible from Windows
- Port 8091 and 3000 available
- At least 10GB free space in `/mnt/user/appdata/`

---

## Step 1: Generate Secure Secrets (DO THIS FIRST!)

Run on Windows:
```bash
# Generate 3 secrets (run 3 times):
openssl rand -hex 32
```

Save these 64-character hex strings - you'll need them for .env files!

---

## Step 2: Verify .env Files Exist

Check that these files exist in your project:
- `.env` (root directory)
- `backend/.env`

If missing, I'll help you create them in the next steps.

---

## Step 3: Transfer to Unraid

### Option A: Windows Network Share (Easiest)
1. Open Windows Explorer
2. Navigate to: `\\YOUR-UNRAID-IP\appdata`
3. Create folder: `medicine-man`
4. Copy entire `medicine-man` folder there

### Option B: Zip and SCP
```bash
# On Windows - I'll help create the zip
# Then:
scp medicine-man-deploy.zip root@YOUR-UNRAID-IP:/mnt/user/appdata/
```

---

## Step 4: Deploy on Unraid

SSH to Unraid:
```bash
ssh root@YOUR-UNRAID-IP
cd /mnt/user/appdata/medicine-man

# Set permissions
chmod +x deploy-to-unraid.sh backend/docker-entrypoint.sh

# Build images (5-10 minutes)
docker-compose build

# Start database services
docker-compose up -d postgres redis

# Wait for them to be ready
sleep 30

# Verify healthy
docker-compose ps
```

---

## Step 5: Initialize Database

```bash
# Start backend
docker-compose up -d backend

# Wait 20 seconds
sleep 20

# Run migrations
docker-compose exec backend npm run migrate

# Create admin user
docker-compose exec backend npm run setup:users
# Enter username: admin
# Enter email: your@email.com
# Enter password: (strong password)
# Select role: admin
```

---

## Step 6: Start Frontend

```bash
# Start all services
docker-compose up -d

# Verify all healthy
docker-compose ps

# Check logs
docker-compose logs backend | tail -20
```

---

## Step 7: Access Application

Open browser: `http://YOUR-UNRAID-IP:8091`

Login with admin credentials you created.

**IMMEDIATELY:**
1. Change admin password (Settings > Profile)
2. Enable 2FA
3. Add your first server

---

## Troubleshooting

### Container won't start
```bash
docker-compose logs backend
docker-compose logs frontend
```

### Can't connect to database
```bash
docker-compose exec postgres psql -U medicine_user -d medicine_man -c "SELECT 1;"
```

### Frontend shows errors
```bash
# Check backend health
docker-compose exec frontend curl http://backend:3000/health
```

### Permission errors
```bash
# Fix ownership (use your Unraid UID/GID, typically 99:100)
chown -R 99:100 /mnt/user/appdata/medicine-man/backend/logs
chown -R 99:100 /mnt/user/appdata/medicine-man/backend/backups
```

---

## Maintenance

### View logs
```bash
docker-compose logs -f backend
```

### Restart services
```bash
docker-compose restart backend
```

### Stop all
```bash
docker-compose down
```

### Backup database
```bash
docker-compose exec postgres pg_dump -U medicine_user medicine_man | gzip > backup-$(date +%Y%m%d).sql.gz
```

---

## Security Checklist

After first login:
- [ ] Change admin password
- [ ] Enable 2FA
- [ ] Create user accounts
- [ ] Configure firewall
- [ ] Test backups
- [ ] Setup notifications

---

**Ready to deploy! Let's create the deployment package...**
