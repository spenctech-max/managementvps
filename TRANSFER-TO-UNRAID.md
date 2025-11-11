# Transferring Medicine Man to Unraid

## Quick Start Guide

This guide walks you through packaging and deploying Medicine Man to your Unraid server at **192.168.4.21**.

---

## Step 1: Create the Package (Windows)

From your Windows machine, run the packaging script:

```bash
# Make script executable (if using Git Bash or WSL)
chmod +x package-for-unraid.sh

# Run the packager
./package-for-unraid.sh
```

**For Windows Command Prompt/PowerShell users:**

The script uses bash, so you'll need:
- **Option A:** Use Git Bash (included with Git for Windows)
- **Option B:** Use WSL (Windows Subsystem for Linux)
- **Option C:** Create the package manually (see Manual Packaging section below)

The script will create: `medicine-man-unraid-1.0.0.tar.gz`

---

## Step 2: Transfer to Unraid

### Option A: Using SCP (Recommended)

```bash
scp medicine-man-unraid-1.0.0.tar.gz root@192.168.4.21:/mnt/user/appdata/
```

### Option B: Using WinSCP (Windows GUI)

1. Download and install [WinSCP](https://winscp.net/)
2. Connect to 192.168.4.21 using root credentials
3. Navigate to `/mnt/user/appdata/`
4. Upload `medicine-man-unraid-1.0.0.tar.gz`

### Option C: Using Unraid Web Interface

1. Open Unraid web interface: http://192.168.4.21
2. Go to: Main → appdata share
3. Upload the tar.gz file

---

## Step 3: Extract on Unraid

SSH into your Unraid server:

```bash
ssh root@192.168.4.21
```

Then extract the package:

```bash
cd /mnt/user/appdata
tar -xzf medicine-man-unraid-1.0.0.tar.gz
cd medicine-man
ls -la
```

You should see:
- `backend/` - Backend application
- `frontend/` - Frontend application
- `shared/` - Shared types
- `docker-compose.yml` - Docker configuration
- `deploy-to-unraid.sh` - Deployment script
- `maintenance.sh` - Maintenance script
- `DEPLOYMENT.md` - Full deployment guide
- `.env` - Environment variables

---

## Step 4: Deploy Application

Run the automated deployment script:

```bash
chmod +x deploy-to-unraid.sh
./deploy-to-unraid.sh
```

The script will:
1. ✓ Verify environment files
2. ✓ Create necessary directories
3. ✓ Make scripts executable
4. ✓ Build Docker containers
5. ✓ Start all services
6. ✓ Wait for services to be healthy

**Expected Output:**
```
================================
Medicine Man - Unraid Deployment
================================

[1/6] Verifying environment files...
✓ Environment files found
[2/6] Creating required directories...
✓ Directories created
[3/6] Making scripts executable...
✓ Scripts are executable
[4/6] Building Docker containers...
✓ Containers built
[5/6] Starting services...
✓ Services started
[6/6] Waiting for services to be healthy...
✓ All services healthy

================================
Deployment Complete!
================================

Access the application at: http://192.168.4.21:8091
```

---

## Step 5: Access the Application

Open your browser to: **http://192.168.4.21:8091**

**Default Admin Login:**
- **Username:** `admin`
- **Password:** `sEbEdas7!`

**⚠️ IMPORTANT:** Change the admin password immediately after first login!

---

## Verification

### Check Container Status

```bash
docker compose ps
```

Expected output:
```
NAME                      STATUS          PORTS
medicine_man_postgres     Up (healthy)
medicine_man_redis        Up (healthy)
medicine_man_backend      Up (healthy)    0.0.0.0:3000->3000/tcp
medicine_man_frontend     Up (healthy)    0.0.0.0:8091->8080/tcp
```

### Check Logs

```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs backend -f
```

### Test Health Endpoints

```bash
# Backend API
curl http://localhost:3000/health

# Frontend
curl http://localhost:8080/health
```

---

## Common Issues

### Issue: "docker-compose: command not found"

**Solution:** Use `docker compose` (with space) instead:

```bash
# In deploy-to-unraid.sh, the script automatically handles both syntaxes
# But if running commands manually, use:
docker compose ps
docker compose logs -f
```

### Issue: Port 8091 Already in Use

**Solution:** Check what's using the port:

```bash
netstat -tulpn | grep 8091
```

Stop the conflicting service or change the port in `docker-compose.yml`:

```yaml
frontend:
  ports:
    - "8092:8080"  # Changed from 8091 to 8092
```

Then update `backend/.env`:
```
CORS_ORIGIN=http://192.168.4.21:8092
```

### Issue: Containers Keep Restarting

**Check logs:**
```bash
docker compose logs --tail 50
```

**Common causes:**
- Out of memory: Increase RAM or reduce container limits
- Database connection failed: Wait longer for PostgreSQL to start
- Missing environment variables: Verify `.env` files exist

### Issue: Cannot Connect from Other Machines

**Check firewall:**
```bash
# Unraid typically doesn't block local network by default
# But verify iptables rules:
iptables -L -n | grep 8091
```

**Verify Docker network:**
```bash
docker network inspect medicine_man_network
```

---

## Manual Packaging (Windows Without Bash)

If you can't run the bash script on Windows, create the package manually:

### 1. Create Package Structure

```
medicine-man/
├── backend/
├── frontend/
├── shared/
├── docker-compose.yml
├── postgres-custom.conf
├── maintenance.sh
├── .env (copy from .env.production)
├── OPTIMIZATION.md
├── DEPLOYMENT.md
└── deploy-to-unraid.sh
```

### 2. Clean Directories

Remove these from all locations:
- `node_modules/`
- `dist/`
- `build/`
- `.git/`
- `*.log` files

### 3. Copy Environment Files

- Copy `.env.production` to `.env`
- Copy `backend/.env.production` to `backend/.env`

### 4. Create ZIP Archive

Use 7-Zip or WinRAR to create a compressed archive of the directory.

### 5. Convert to .tar.gz (on Unraid)

After uploading to Unraid:
```bash
# If you uploaded a .zip
unzip medicine-man.zip
cd medicine-man
```

---

## Post-Deployment

### Setup Maintenance Cron Job

Add to Unraid User Scripts:

```bash
#!/bin/bash
cd /mnt/user/appdata/medicine-man
./maintenance.sh
```

Schedule: Weekly on Sunday at 2:00 AM

### Configure Backups

The application has built-in backup functionality accessible via the web interface:
1. Login as admin
2. Go to Servers page
3. Configure backup schedules for your servers

### Monitor Resources

```bash
# Real-time resource usage
docker stats

# Disk usage
df -h /mnt/user/appdata/medicine-man

# Docker volumes
docker system df -v
```

---

## Updating Later

To update to a new version:

1. **Backup current data:**
   ```bash
   cd /mnt/user/appdata/medicine-man
   docker compose down
   tar -czf ../medicine-man-backup-$(date +%Y%m%d).tar.gz .
   ```

2. **Extract new version:**
   ```bash
   cd /mnt/user/appdata
   tar -xzf medicine-man-unraid-X.X.X.tar.gz
   cd medicine-man
   ```

3. **Redeploy:**
   ```bash
   ./deploy-to-unraid.sh
   ```

---

## Uninstalling

To completely remove Medicine Man:

```bash
cd /mnt/user/appdata/medicine-man
docker compose down -v  # -v removes volumes (DATA WILL BE DELETED!)
cd ..
rm -rf medicine-man
```

**⚠️ WARNING:** This deletes all data including databases, backups, and configuration!

---

## Need Help?

**Check Documentation:**
- `DEPLOYMENT.md` - Full deployment guide
- `OPTIMIZATION.md` - Performance tuning
- `CLAUDE.md` - Architecture and development guide

**View Logs:**
```bash
cd /mnt/user/appdata/medicine-man
docker compose logs -f
```

**Container Status:**
```bash
docker compose ps
docker stats
```

---

## Resource Monitoring

The application is optimized for 4-core/16GB systems:

**Memory Allocation:**
- PostgreSQL: 2GB limit
- Redis: 768MB limit
- Backend: 3GB limit
- Frontend: 512MB limit
- **Total:** ~6.3GB (leaves 9.7GB for system)

**CPU Allocation:**
- PostgreSQL: 1 core
- Redis: 0.5 cores
- Backend: 2 cores
- Frontend: 0.5 cores
- **Total:** 4 cores

Monitor usage:
```bash
docker stats --no-stream
```

---

## Security Checklist

After deployment:

- [ ] Changed admin password
- [ ] Reviewed and updated passwords in `.env`
- [ ] Confirmed CORS origin is correct (192.168.4.21:8091)
- [ ] Verified firewall rules
- [ ] Scheduled automated maintenance
- [ ] Tested backup functionality
- [ ] Documented custom changes

---

**Congratulations!** Medicine Man is now running on your Unraid server.

Access at: **http://192.168.4.21:8091**
