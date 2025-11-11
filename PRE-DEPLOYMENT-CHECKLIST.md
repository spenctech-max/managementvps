# Medicine Man - Pre-Deployment Checklist

Use this checklist before packaging and deploying to Unraid.

---

## 📋 Pre-Packaging Checklist

### Environment Configuration
- [ ] `.env.production` created with correct IP (192.168.4.21)
- [ ] `backend/.env.production` created with CORS origin (http://192.168.4.21:8091)
- [ ] Database passwords are secure (not default values)
- [ ] Redis password is secure (not default value)
- [ ] JWT_SECRET, SESSION_SECRET, ENCRYPTION_KEY are generated and secure

### Docker Configuration
- [ ] `docker-compose.yml` has correct port mappings (3000:3000, 8091:8080)
- [ ] Resource limits are set (PostgreSQL: 2GB, Redis: 768MB, Backend: 3GB, Frontend: 512MB)
- [ ] CPU limits are configured (Total: 4.0 cores)
- [ ] Health checks are configured for all services
- [ ] Volumes are properly mounted

### PostgreSQL Configuration
- [ ] `postgres-custom.conf` exists with optimized settings
- [ ] shared_buffers set to 512MB
- [ ] effective_cache_size set to 1536MB
- [ ] max_connections set to 100
- [ ] Parallel workers configured (4 max)

### Scripts
- [ ] `package-for-unraid.sh` is executable
- [ ] `maintenance.sh` is executable
- [ ] `deploy-to-unraid.sh` will be created in package
- [ ] All scripts have proper shebang (#!/bin/bash)

### Documentation
- [ ] `TRANSFER-TO-UNRAID.md` created
- [ ] `DEPLOYMENT.md` will be included in package
- [ ] `OPTIMIZATION.md` is up to date
- [ ] `QUICK-START.md` created
- [ ] This checklist is complete

### Application State
- [ ] Backend builds successfully (`npm run build` in backend/)
- [ ] Frontend builds successfully (`npm run build` in frontend/)
- [ ] Shared package builds successfully (`npm run build` in shared/)
- [ ] All database migrations are present in `backend/migrations/`
- [ ] No critical errors in application logs

---

## 📦 Packaging Steps

1. **Run the packager:**
   ```bash
   chmod +x package-for-unraid.sh
   ./package-for-unraid.sh
   ```

2. **Verify package was created:**
   ```bash
   ls -lh medicine-man-unraid-*.tar.gz
   ```

3. **Expected package size:** ~50-100MB (excluding node_modules and build artifacts)

4. **Package contains:**
   - [ ] backend/ directory (with migrations, without node_modules)
   - [ ] frontend/ directory (without node_modules, without dist)
   - [ ] shared/ directory (without node_modules, without dist)
   - [ ] docker-compose.yml
   - [ ] postgres-custom.conf
   - [ ] maintenance.sh
   - [ ] .env (from .env.production)
   - [ ] backend/.env (from backend/.env.production)
   - [ ] OPTIMIZATION.md
   - [ ] DEPLOYMENT.md (generated)
   - [ ] deploy-to-unraid.sh (generated)

---

## 🚀 Pre-Transfer Checklist

### Unraid Server Preparation
- [ ] Unraid server IP confirmed: 192.168.4.21
- [ ] SSH access to Unraid is working
- [ ] Docker is enabled on Unraid
- [ ] Port 8091 is not in use
- [ ] Port 3000 is not in use
- [ ] At least 10GB free space in /mnt/user/appdata/
- [ ] At least 10GB free RAM (6.3GB for app + overhead)

### Network Configuration
- [ ] Firewall allows access to port 8091
- [ ] Firewall allows access to port 3000 (if external API access needed)
- [ ] Can ping 192.168.4.21 from development machine
- [ ] Can access Unraid web interface

### Backup Existing Data (if upgrading)
- [ ] Existing Medicine Man containers stopped
- [ ] Database backed up
- [ ] Redis data backed up
- [ ] Application configuration backed up

---

## 📤 Transfer Steps

1. **Transfer package to Unraid:**
   ```bash
   scp medicine-man-unraid-1.0.0.tar.gz root@192.168.4.21:/mnt/user/appdata/
   ```

2. **Verify transfer:**
   ```bash
   ssh root@192.168.4.21 "ls -lh /mnt/user/appdata/medicine-man-unraid-*.tar.gz"
   ```

3. **Checksum verification (optional but recommended):**
   ```bash
   # On Windows
   certutil -hashfile medicine-man-unraid-1.0.0.tar.gz SHA256

   # On Unraid
   sha256sum /mnt/user/appdata/medicine-man-unraid-1.0.0.tar.gz
   ```

---

## 🔧 Pre-Deployment Checklist (On Unraid)

### Before Running deploy-to-unraid.sh

1. **Extract package:**
   ```bash
   cd /mnt/user/appdata
   tar -xzf medicine-man-unraid-1.0.0.tar.gz
   cd medicine-man
   ```

2. **Verify extraction:**
   - [ ] All directories present (backend, frontend, shared)
   - [ ] .env file exists
   - [ ] backend/.env file exists
   - [ ] docker-compose.yml exists
   - [ ] deploy-to-unraid.sh exists

3. **Review configuration:**
   ```bash
   cat .env | grep -v "PASSWORD\|SECRET\|KEY"
   cat backend/.env | grep -v "PASSWORD\|SECRET\|KEY"
   ```

4. **Make scripts executable:**
   ```bash
   chmod +x deploy-to-unraid.sh maintenance.sh
   ```

5. **Check Docker:**
   - [ ] Docker daemon is running: `docker ps`
   - [ ] Docker Compose is available: `docker compose version`

---

## 🚀 Deployment Checklist

1. **Run deployment script:**
   ```bash
   ./deploy-to-unraid.sh
   ```

2. **Monitor deployment:**
   - [ ] All build steps complete without errors
   - [ ] All containers start successfully
   - [ ] Health checks pass for all services

3. **Verify containers:**
   ```bash
   docker compose ps
   ```
   - [ ] medicine_man_postgres: Up (healthy)
   - [ ] medicine_man_redis: Up (healthy)
   - [ ] medicine_man_backend: Up (healthy)
   - [ ] medicine_man_frontend: Up (healthy)

4. **Check logs:**
   ```bash
   docker compose logs --tail 50
   ```
   - [ ] No critical errors in logs
   - [ ] PostgreSQL started successfully
   - [ ] Redis connected
   - [ ] Backend API listening on port 3000
   - [ ] Frontend serving on port 8080

---

## ✅ Post-Deployment Verification

### Health Checks

1. **Backend health:**
   ```bash
   curl http://localhost:3000/health
   ```
   Expected: `{"status":"ok","timestamp":"..."}`

2. **Frontend health:**
   ```bash
   curl http://localhost:8080/health
   ```
   Expected: `healthy`

3. **Database connection:**
   ```bash
   docker compose exec postgres pg_isready -U medicine_user
   ```
   Expected: `postgres:5432 - accepting connections`

4. **Redis connection:**
   ```bash
   docker compose exec redis redis-cli -a <password> ping
   ```
   Expected: `PONG`

### Web Interface Testing

- [ ] Can access http://192.168.4.21:8091
- [ ] Login page loads correctly
- [ ] Can login with default credentials (admin / sEbEdas7!)
- [ ] Dashboard loads without errors
- [ ] Sidebar navigation works
- [ ] Can access all admin pages

### Functional Testing

- [ ] Can add a new server
- [ ] Can test SSH connection to a server
- [ ] Can trigger a server scan
- [ ] Can view server details
- [ ] BitLaunch page loads (if admin)
- [ ] Can change admin password
- [ ] Can logout and login again

### Resource Monitoring

1. **Check memory usage:**
   ```bash
   docker stats --no-stream
   ```
   - [ ] PostgreSQL using ~500MB-1GB
   - [ ] Redis using ~100-300MB
   - [ ] Backend using ~500MB-1.5GB
   - [ ] Frontend using ~50-100MB
   - [ ] Total under 6.3GB

2. **Check CPU usage:**
   ```bash
   docker stats --no-stream
   ```
   - [ ] All services under configured CPU limits
   - [ ] No services pegged at 100% CPU

3. **Check disk usage:**
   ```bash
   df -h /mnt/user/appdata/medicine-man
   docker system df
   ```
   - [ ] Application using <10GB total

---

## 🔒 Security Post-Deployment

1. **Change default passwords:**
   - [ ] Admin user password changed (not sEbEdas7!)
   - [ ] Database password changed (not changeme_secure_password_123)
   - [ ] Redis password changed (not changeme_redis_password_456)

2. **Review environment variables:**
   - [ ] JWT_SECRET is secure (64 hex characters)
   - [ ] SESSION_SECRET is secure (64 hex characters)
   - [ ] ENCRYPTION_KEY is secure (64 hex characters)

3. **Network security:**
   - [ ] Firewall rules configured
   - [ ] Only necessary ports exposed
   - [ ] Consider VPN access if exposing to internet

---

## 📅 Maintenance Setup

1. **Schedule maintenance script:**
   - [ ] Add to Unraid User Scripts plugin
   - [ ] Schedule weekly (Sunday 2 AM)
   - [ ] Test manual run: `./maintenance.sh`

2. **Setup monitoring:**
   - [ ] Configure backup schedules in web interface
   - [ ] Review log rotation settings
   - [ ] Consider external monitoring (Uptime Robot, etc.)

---

## 📝 Documentation

1. **Document deployment details:**
   - [ ] Record actual deployment date
   - [ ] Note any configuration changes made
   - [ ] Document any issues encountered and solutions

2. **User training:**
   - [ ] Admin knows how to access application
   - [ ] Admin knows how to check logs
   - [ ] Admin knows how to restart services
   - [ ] Admin knows how to run maintenance

---

## 🎉 Deployment Complete!

Once all items are checked:

✅ **Medicine Man is successfully deployed to Unraid!**

**Access:** http://192.168.4.21:8091
**Default Login:** admin / sEbEdas7! (CHANGE THIS!)

---

## 📞 Support Resources

- **TRANSFER-TO-UNRAID.md** - Complete transfer guide
- **DEPLOYMENT.md** - Full deployment documentation
- **OPTIMIZATION.md** - Performance tuning guide
- **QUICK-START.md** - Quick reference card
- **CLAUDE.md** - Architecture and development docs

**Logs:** `/mnt/user/appdata/medicine-man/backend/logs/`

**Commands:**
```bash
docker compose logs -f      # View logs
docker compose ps           # Check status
docker compose restart      # Restart services
docker stats                # Monitor resources
./maintenance.sh            # Run maintenance
```

---

**Version:** 1.0.0
**Last Updated:** 2025-11-05
**Target:** 192.168.4.21:8091
