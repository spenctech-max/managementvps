# Medicine Man - Unraid Deployment Guide

## 📋 Prerequisites

Before starting, ensure your Unraid server has:
- Docker installed (comes pre-installed with Unraid)
- Docker Compose plugin installed
- At least 2GB free RAM
- At least 5GB free disk space

## Port Configuration

### Default Ports
| Service | Host Port | Container Port | Access |
|---------|-----------|----------------|--------|
| Frontend | 8091 | 8080 | http://your-unraid-ip:8091 |
| Backend API | 3000 | 3000 | http://your-unraid-ip:3000 |
| PostgreSQL | - | 5432 | Internal only |
| Redis | - | 6379 | Internal only |

### API Endpoints
- **Frontend UI:** `http://your-unraid-ip:8091`
- **Backend API:** `http://your-unraid-ip:3000`
- **API Health:** `http://your-unraid-ip:3000/health`
- **API Docs:** `http://your-unraid-ip:3000/api-docs`
- **Metrics:** `http://your-unraid-ip:3000/metrics` (admin only)

## 📤 Upload to Unraid

### Method 1: SMB Share (Recommended)
1. From Windows, navigate to `\\YOUR_UNRAID_IP\appdata`
2. Copy the entire `medicine-man` folder
3. Wait for transfer to complete

### Method 2: SCP Command
```bash
# From your local machine
scp -r medicine-man root@your-unraid-ip:/mnt/user/appdata/
```

### Method 3: Git Clone
```bash
# On Unraid terminal
ssh root@your-unraid-ip
cd /mnt/user/appdata
git clone https://github.com/your-username/medicine-man.git
```

## 🚀 Complete Deployment Steps

### Step 1: Navigate to Directory
```bash
ssh root@your-unraid-ip
cd /mnt/user/appdata/medicine-man
```

### Step 2: Set Permissions
```bash
chmod +x *.sh
chmod 755 backend frontend shared
```

### Step 3: Create Required Directories
```bash
mkdir -p backend/logs backend/backups backend/db-backups
chmod 777 backend/logs backend/backups backend/db-backups
```

### Step 4: Install Backend Dependencies
```bash
cd backend
npm install --production=false
cd ..
```

### Step 5: Run Setup Wizard
```bash
./setup-wizard.sh
```

**Follow the prompts to:**
- Set environment (choose `production`)
- Configure database credentials
- Configure Redis password
- Set JWT secrets
- Set encryption key
- Configure CORS origin (use `http://YOUR_UNRAID_IP:8091`)

### Step 6: Create Root .env for Docker Compose

Option A - Manual creation:
```bash
cat > .env << 'EOF'
# Database Configuration
DB_USER=medicine_user
DB_PASSWORD=<use the password from backend/.env>
DB_NAME=medicine_man

# Redis Configuration
REDIS_PASSWORD=<use the password from backend/.env>

# Ports
BACKEND_PORT=3000
FRONTEND_PORT=8080
EOF
```

Option B - Auto-extract from backend/.env:
```bash
DB_PASS=$(grep "^DB_PASSWORD=" backend/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
REDIS_PASS=$(grep "^REDIS_PASSWORD=" backend/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")

cat > .env << EOF
# Database Configuration
DB_USER=medicine_user
DB_PASSWORD=$DB_PASS
DB_NAME=medicine_man

# Redis Configuration
REDIS_PASSWORD=$REDIS_PASS

# Ports
BACKEND_PORT=3000
FRONTEND_PORT=8080
EOF

echo "✅ Root .env created successfully!"
```

### Step 7: Update Backend CORS Configuration
```bash
# Get your Unraid IP
UNRAID_IP=$(hostname -I | awk '{print $1}')

# Update CORS_ORIGIN in backend/.env
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://$UNRAID_IP:8091|g" backend/.env

echo "✅ CORS updated to: http://$UNRAID_IP:8091"
```

### Step 8: Update Frontend API URL
```bash
# Create/update frontend .env
cat > frontend/.env << EOF
VITE_API_URL=http://$UNRAID_IP:3000
VITE_WS_URL=ws://$UNRAID_IP:3000
EOF

echo "✅ Frontend API URL configured!"
```

### Step 9: Build and Start All Services
```bash
docker compose up -d --build
```

This will:
- Build the backend Docker image (Node.js 20)
- Build the frontend Docker image (Nginx)
- Start PostgreSQL 15
- Start Redis 7
- Start the backend API
- Start the frontend web server

### Step 10: Wait for Services to be Healthy
```bash
# Watch services start (Ctrl+C to exit)
watch -n 2 'docker compose ps'
```

Wait until all services show "healthy" status (30-60 seconds).

### Step 11: Run Database Migrations
```bash
docker compose exec backend sh -c "cd /app && npm run migrate"
```

Expected output: Migration files executed successfully (001-014).

### Step 12: Create Initial Admin User
```bash
docker compose exec backend npm run setup:users
```

Follow the prompts to create your first admin user account.

### Step 13: Verify Deployment
```bash
# Check all containers
docker compose ps

# Check backend logs
docker compose logs backend | tail -20

# Test backend health
curl http://localhost:3000/health

# Test frontend
curl http://localhost:8091
```

## 🌐 Access Your Application

Navigate to: `http://YOUR_UNRAID_IP:8091`

Login with the admin credentials you created in Step 12.

## Pre-Deployment Checklist

Before uploading to Unraid:
- ✅ All sensitive .env files excluded (handled by .gitignore)
- ✅ Node modules will install fresh on Unraid
- ✅ Build artifacts generated on Unraid
- ✅ No personal data or credentials in source code
- ✅ Security secrets will be generated during setup

Post-Deployment verification:
- ✅ Strong, unique passwords in .env files
- ✅ CORS_ORIGIN matches frontend URL
- ✅ PostgreSQL not exposed externally
- ✅ Redis not exposed externally
- ✅ All services show "healthy" status
- ✅ Can login successfully

## 🔧 Useful Commands

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
docker compose logs -f redis
```

### Stop Services
```bash
docker compose down
```

### Restart Services
```bash
docker compose restart

# Or specific service
docker compose restart backend
```

### Stop and Remove Everything (including data)
```bash
docker compose down -v
```

### Rebuild After Code Changes
```bash
docker compose down
docker compose up -d --build
```

### Check Service Health
```bash
docker compose ps
```

### Access Backend Shell
```bash
docker compose exec backend sh
```

### Access Database
```bash
docker compose exec postgres psql -U medicine_user -d medicine_man
```

### Backup Database
```bash
docker compose exec postgres pg_dump -U medicine_user medicine_man > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
cat backup_20241104.sql | docker compose exec -T postgres psql -U medicine_user medicine_man
```

### Monitor Resources
```bash
# One-time check
./monitor-resources.sh

# Continuous monitoring
./monitor-resources.sh --watch
```

## 🐛 Troubleshooting

### Services Won't Start
```bash
# Check logs for errors
docker compose logs

# Check if ports are already in use
netstat -tlnp | grep -E ':(3000|8091|5432|6379)'

# Check Docker daemon
docker ps
```

### Database Connection Failed
```bash
# Check postgres is running
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Verify credentials match
grep DB_PASSWORD backend/.env
grep DB_PASSWORD .env
```

### Frontend Can't Connect to Backend
```bash
# Verify backend is accessible
curl http://localhost:3000/health

# Check frontend .env
cat frontend/.env

# Check CORS settings in backend
grep CORS_ORIGIN backend/.env

# Rebuild frontend with correct .env
docker compose up -d --build frontend
```

### CORS Errors
If you see CORS errors in browser console:

1. Update backend .env with correct IP:
   ```bash
   # Get your IP
   hostname -I | awk '{print $1}'

   # Update CORS_ORIGIN
   nano backend/.env
   # Set: CORS_ORIGIN=http://YOUR_ACTUAL_IP:8091
   ```

2. Restart backend:
   ```bash
   docker compose restart backend
   ```

3. Clear browser cache and reload

### Permission Denied Errors
```bash
# Fix directory permissions
chmod 777 backend/logs backend/backups backend/db-backups

# Fix file permissions
chmod 644 backend/.env frontend/.env .env
chmod +x *.sh
```

### Port Already in Use
```bash
# Find what's using the port
lsof -i :3000
lsof -i :8091

# Change ports in docker-compose.yml if needed
nano docker-compose.yml
# Edit the ports section, then:
docker compose down
docker compose up -d
```

### Migrations Failed
```bash
# Check if database is ready
docker compose exec postgres pg_isready -U medicine_user

# Try running migrations again
docker compose exec backend sh -c "cd /app && npm run migrate"

# Check migration files exist
docker compose exec backend ls -la /app/migrations
```

### Container Stuck in "Starting" State
```bash
# Check healthcheck status
docker inspect medicine_man_backend | grep -A 10 Health

# View detailed logs
docker logs medicine_man_backend

# Restart the problematic container
docker compose restart backend
```

## 📊 Resource Usage

Expected resource consumption:
- **Total RAM:** ~2GB
  - PostgreSQL: ~512MB-1GB
  - Redis: ~128MB-256MB
  - Backend: ~512MB-1GB
  - Frontend: ~50MB-100MB
- **CPU:** Low (< 5% idle, < 30% under load)
- **Disk:**
  - Base install: ~1GB
  - Grows with backups and logs (plan for 10-50GB)

Configured limits (in docker-compose.yml):
- **Backend:** 2.0 CPU cores, 8GB RAM max
- **PostgreSQL:** 1.0 CPU core, 4GB RAM max
- **Redis:** 0.5 CPU cores, 2GB RAM max
- **Frontend:** 0.5 CPU cores, 2GB RAM max

## 🔄 Updates

To update Medicine Man to a new version:

```bash
cd /mnt/user/appdata/medicine-man

# Pull new code (if using git)
git pull

# Stop services
docker compose down

# Rebuild and restart
docker compose up -d --build

# Run any new migrations
docker compose exec backend sh -c "cd /app && npm run migrate"

# Check logs
docker compose logs -f
```

## 🔐 Security Recommendations

1. **Change Default Secrets**: Never use example values in production
2. **Use Strong Passwords**: 32+ character random strings for JWT/session secrets
3. **Restrict Network Access**: Use Unraid firewall or VPN
4. **Enable HTTPS**: Set up reverse proxy with SSL/TLS (Nginx Proxy Manager, Traefik)
5. **Regular Updates**: Keep Docker images and dependencies updated
6. **Backup Database**: Schedule regular database backups
7. **Monitor Logs**: Review application logs regularly

## Reverse Proxy Setup (Optional)

If using Nginx Proxy Manager or similar:

```nginx
# Frontend proxy
location / {
    proxy_pass http://localhost:8091;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Backend API proxy
location /api {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# WebSocket proxy for terminal
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
}
```

## Directory Structure

```
medicine-man/
├── backend/               # Node.js/Express API
│   ├── src/              # TypeScript source
│   ├── dist/             # Compiled JavaScript (generated)
│   ├── migrations/       # Database SQL migrations
│   ├── scripts/          # Utility scripts
│   ├── logs/             # Application logs (gitignored)
│   ├── backups/          # Backup files (gitignored)
│   └── db-backups/       # Database backups (gitignored)
├── frontend/             # React/Vite application
│   ├── src/             # TypeScript source
│   └── dist/            # Built static files (generated)
├── shared/              # Shared TypeScript types & Zod schemas
├── docker-compose.yml   # Production Docker configuration
├── .env                 # Docker Compose env vars (created during setup)
├── .env.example         # Environment template
├── setup-wizard.sh      # Interactive setup script
├── monitor-resources.sh # Resource monitoring tool
└── deploy-to-unraid.sh  # Full deployment automation script
```

## 📝 Notes

- All data persists in Docker volumes (survives container restarts)
- Backups stored in `backend/backups/` directory
- Logs stored in `backend/logs/` directory
- Database data in volume `postgres_data`
- Redis data in volume `redis_data`
- First user to register becomes admin automatically
- PostgreSQL and Redis are not exposed to host network (security)

## 🆘 Getting Help

If you encounter issues:
1. Check the logs: `docker compose logs`
2. Verify all services are healthy: `docker compose ps`
3. Review this troubleshooting guide
4. Check the main README.md for detailed documentation
5. Review CLAUDE.md for development guidance

## Features Available After Deployment

✅ Server management with SSH connection
✅ Automated backup scheduling
✅ Server scanning (quick/full/service/filesystem)
✅ Service detection (Docker, PostgreSQL, MySQL, Redis, MongoDB, Nginx, etc.)
✅ Filesystem analysis with backup recommendations
✅ Real-time WebSocket terminal access
✅ Backup orchestration (full and selective)
✅ Health monitoring with notifications
✅ Audit logging
✅ User management (admin/user/viewer roles)
✅ 2FA authentication support
✅ SSH key rotation
✅ Session management with Redis
✅ Rate limiting
✅ Prometheus metrics
✅ Email & Slack notifications
✅ Data export (CSV/JSON/PDF)

---

**Congratulations! Medicine Man is now running on Unraid! 🎉**

**Next Steps:**
1. Login at `http://YOUR_UNRAID_IP:8091`
2. Add your first server
3. Run a scan to detect services
4. Review backup recommendations
5. Schedule automated backups
6. Configure notifications (see NOTIFICATION_SYSTEM.md)
