# Medicine Man - Unraid Deployment Guide (Optimized)

## Overview

This guide covers deploying Medicine Man on Unraid with optimizations specifically tailored for Unraid's unique storage architecture (parity array with optional SSD cache).

## What's Optimized for Unraid

### ✅ Storage Configuration
- **Array-friendly PostgreSQL settings**: Tuned for spinning disk performance
- **Proper appdata paths**: Uses `/mnt/user/appdata` structure
- **Reduced write frequency**: Longer checkpoint intervals to reduce array writes
- **Conservative memory**: Optimized for typical Unraid servers (16-32GB RAM)

### ✅ Resource Limits
- **PostgreSQL**: 1.5GB RAM limit, 1.5 CPU cores
- **Backend**: 2GB RAM limit, 1.5 CPU cores  
- **Redis**: 512MB RAM limit, 0.5 CPU cores
- **Frontend**: 256MB RAM limit, 0.5 CPU cores
- **Total**: ~4GB RAM, ~4 CPU cores maximum

### ✅ Permissions
- **PUID/PGID support**: Runs as `nobody:users` (99:100) by default
- **Proper file permissions**: All data owned by correct Unraid user

### ✅ Reliability
- **Log rotation**: Prevents log files from filling up array
- **Health checks**: Proper startup detection with longer timeouts
- **Graceful restarts**: `unless-stopped` policy

---

## System Requirements

### Minimum
- **RAM**: 8GB total (4GB available for Medicine Man)
- **CPU**: 4 cores
- **Storage**: 10GB free on appdata share
- **Unraid**: 6.9.0 or newer
- **Docker**: Included with Unraid

### Recommended
- **RAM**: 16GB+ total
- **CPU**: 6+ cores
- **Storage**: 20GB+ on SSD cache (appdata on cache is highly recommended)
- **Network**: Gigabit ethernet

### Important Notes
- ⚠️ **SSD Cache Recommended**: If appdata is on the array (spinning disks), performance will be significantly slower
- ⚠️ **Database on Cache**: PostgreSQL performance requires low-latency storage (SSD cache strongly recommended)

---

## Quick Start (Automated)

### Option 1: Automated Deployment Script

1. **Download the application**:
```bash
cd /mnt/user/appdata
git clone <repository-url> medicine-man
cd medicine-man
```

2. **Make deployment script executable**:
```bash
chmod +x deploy-unraid.sh
```

3. **Run deployment**:
```bash
./deploy-unraid.sh
```

The script will:
- Create all necessary directories
- Generate secure passwords
- Build Docker images
- Start all services
- Apply database migrations
- Create admin user
- Display access information

4. **Access the application**:
   - **Medicine Man Frontend**: `http://YOUR_UNRAID_IP:8091`
   - **Portainer (Docker Management)**: `https://YOUR_UNRAID_IP:9443`
   - **Backend API**: `http://YOUR_UNRAID_IP:3000`
   - Default login: `admin` / `Admin123!`
   - **⚠️ Change the password immediately!**
   - **Note**: Portainer requires initial setup on first access

---

## Manual Deployment

### Step 1: Prepare Directory Structure

```bash
# Create application directory
mkdir -p /mnt/user/appdata/medicine-man
cd /mnt/user/appdata/medicine-man

# Download or copy application files here
# (via git clone, rsync, or upload)

# Create data directories
mkdir -p postgres redis logs backups

# Set permissions
chown -R 99:100 /mnt/user/appdata/medicine-man
chmod -R 755 /mnt/user/appdata/medicine-man
```

### Step 2: Configure Environment

```bash
# Copy template
cp .env.unraid .env

# Generate secure secrets
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 24)
REDIS_PASSWORD=$(openssl rand -base64 24)

# Update .env file with generated values
nano .env
```

**Required changes in `.env`**:
```env
# Change these!
DB_PASSWORD=<generated_db_password>
REDIS_PASSWORD=<generated_redis_password>
JWT_SECRET=<generated_jwt_secret>
SESSION_SECRET=<generated_session_secret>
ENCRYPTION_KEY=<generated_encryption_key>

# Adjust timezone
TZ=America/New_York

# Adjust if port conflicts exist
FRONTEND_PORT=8091
BACKEND_PORT=3000
```

Also update `backend/.env` with the same credentials.

### Step 3: Build and Start

```bash
# Build images (takes 5-10 minutes)
docker-compose build --no-cache

# Start services
docker-compose up -d

# Monitor startup
docker-compose logs -f
```

### Step 4: Apply Missing Migrations

```bash
# Wait for database to be healthy (check with: docker ps)
sleep 30

# Apply 2FA migration
docker exec medicine_man_postgres psql -U medicine_user -d medicine_man -c "
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS twofa_secret TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS twofa_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS twofa_backup_codes TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS twofa_enabled_at TIMESTAMP DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_twofa_enabled 
ON users(twofa_enabled) WHERE twofa_enabled = true;
"

# Apply user_id migration
docker exec medicine_man_postgres psql -U medicine_user -d medicine_man -c "
ALTER TABLE servers ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers(user_id);
"
```

### Step 5: Create Admin User

```bash
# Generate password hash
ADMIN_HASH=$(docker exec medicine_man_backend node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('Admin123!', 10).then(hash => console.log(hash));")

# Create user
docker exec medicine_man_postgres psql -U medicine_user -d medicine_man -c "
INSERT INTO users (username, email, password_hash, is_active) 
VALUES ('admin', 'admin@medicine-man.local', '${ADMIN_HASH}', true) 
RETURNING id;
"

# Get user ID and add admin role
ADMIN_ID=$(docker exec medicine_man_postgres psql -U medicine_user -d medicine_man -t -c "SELECT id FROM users WHERE username='admin';")

docker exec medicine_man_postgres psql -U medicine_user -d medicine_man -c "
INSERT INTO user_roles (user_id, role) 
VALUES ('${ADMIN_ID}', 'admin');
"
```

---

## Performance Optimization

### If Appdata is on Cache (SSD)

Update `postgres-custom.conf` for better performance:

```ini
# Change these values for SSD
random_page_cost = 1.1          # Was 4.0
effective_io_concurrency = 200  # Was 2
```

Then restart PostgreSQL:
```bash
docker-compose restart postgres
```

### If Appdata is on Array (HDD)

Keep default settings. Optionally increase checkpoint intervals to reduce writes:

```ini
# In postgres-custom.conf
checkpoint_timeout = 30min      # Was 15min
```

### Memory Tuning

If your Unraid server has more RAM available:

**In `docker-compose.yml`**:
```yaml
postgres:
  mem_limit: 3G          # Increase from 1.5G
  mem_reservation: 2G    # Increase from 768M

backend:
  mem_limit: 4G          # Increase from 2G
  mem_reservation: 2G    # Increase from 1G
```

**In `postgres-custom.conf`**:
```ini
shared_buffers = 512MB           # Increase from 256MB
effective_cache_size = 2GB       # Increase from 1GB
maintenance_work_mem = 128MB     # Increase from 64MB
max_connections = 100            # Increase from 50
```

---

## Monitoring

### Check Container Health

```bash
# View all containers
docker ps

# Check specific logs
docker logs medicine_man_backend -f
docker logs medicine_man_postgres --tail 50

# Check resource usage
docker stats --no-stream
```

### Health Endpoints

- Backend health: `http://YOUR_IP:3000/health`
- Frontend health: `http://YOUR_IP:8091/`

Expected response:
```json
{
  "success": true,
  "message": "Server is healthy",
  "uptime": 12345.67,
  "environment": "production"
}
```

---

## Maintenance

### Backups

**Database Backup**:
```bash
# Manual backup
docker exec medicine_man_postgres pg_dump -U medicine_user medicine_man > /mnt/user/backups/medicine-man-$(date +%Y%m%d).sql

# Restore from backup
docker exec -i medicine_man_postgres psql -U medicine_user medicine_man < /mnt/user/backups/medicine-man-20251111.sql
```

**Complete Backup**:
```bash
# Stop containers
docker-compose stop

# Backup appdata
tar -czf /mnt/user/backups/medicine-man-complete-$(date +%Y%m%d).tar.gz /mnt/user/appdata/medicine-man

# Restart
docker-compose start
```

### Updates

```bash
cd /mnt/user/appdata/medicine-man

# Pull latest code
git pull

# Rebuild images
docker-compose build --no-cache

# Restart services
docker-compose down
docker-compose up -d
```

### Log Rotation

Logs are automatically rotated (max 10MB per file, 3 files retained).

To manually clean:
```bash
docker-compose down
rm -rf /mnt/user/appdata/medicine-man/logs/*
docker-compose up -d
```

---

## Troubleshooting

### Container Won't Start

**Check logs**:
```bash
docker logs medicine_man_backend
```

**Common issues**:
- Port conflicts: Change `FRONTEND_PORT` or `BACKEND_PORT` in `.env`
- Permission issues: Ensure `chown -R 99:100 /mnt/user/appdata/medicine-man`
- Memory: Increase Docker memory allocation in Unraid settings

### Database Connection Failed

```bash
# Check PostgreSQL is running and healthy
docker ps | grep postgres

# Check if listening on network
docker exec medicine_man_postgres netstat -tuln | grep 5432

# Should show: tcp  0.0.0.0:5432
```

### Slow Performance

1. **Check if appdata is on cache**:
```bash
ls -la /mnt/user/appdata/medicine-man
# Look for "cache" in output
```

2. **Move to cache if not**:
```bash
# In Unraid UI: Shares > appdata > Primary storage = Cache
# Then run: mover
```

3. **Check disk I/O**:
```bash
iostat -x 2
# High %util on array disks = slow
```

### Out of Memory

```bash
# Check current usage
docker stats --no-stream

# Reduce limits if needed
# Edit docker-compose.yml mem_limit values
docker-compose down
docker-compose up -d
```

---

## Unraid Community Apps Template

For easier installation via Unraid's Community Applications:

**Template Location**: `my-medicine-man.xml`

```xml
<?xml version="1.0"?>
<Container version="2">
  <Name>Medicine-Man</Name>
  <Repository>medicine-man</Repository>
  <Registry>https://registry.hub.docker.com/</Registry>
  <Network>bridge</Network>
  <Privileged>false</Privileged>
  <Support>https://github.com/your-repo/medicine-man</Support>
  <Overview>Server and infrastructure management platform with automated backups and monitoring</Overview>
  <Category>Tools:System Management</Category>
  <WebUI>http://[IP]:[PORT:8091]</WebUI>
  <Icon>https://raw.githubusercontent.com/your-repo/medicine-man/main/logo.png</Icon>
  <Config Name="WebUI Port" Target="8080" Default="8091" Mode="tcp" Description="Frontend web interface port" Type="Port" Display="always" Required="true" Mask="false">8091</Config>
  <Config Name="API Port" Target="3000" Default="3000" Mode="tcp" Description="Backend API port" Type="Port" Display="always" Required="true" Mask="false">3000</Config>
  <Config Name="AppData" Target="/config" Default="/mnt/user/appdata/medicine-man" Mode="rw" Description="Application data directory" Type="Path" Display="advanced" Required="true" Mask="false">/mnt/user/appdata/medicine-man</Config>
  <Config Name="PUID" Target="PUID" Default="99" Description="User ID" Type="Variable" Display="advanced" Required="false" Mask="false">99</Config>
  <Config Name="PGID" Target="PGID" Default="100" Description="Group ID" Type="Variable" Display="advanced" Required="false" Mask="false">100</Config>
  <Config Name="TZ" Target="TZ" Default="America/New_York" Description="Timezone" Type="Variable" Display="advanced" Required="false" Mask="false">America/New_York</Config>
</Container>
```

---

## Security Recommendations

1. **Change default admin password** immediately after first login
2. **Use strong passwords** for all database and Redis credentials
3. **Enable HTTPS** via reverse proxy (e.g., nginx-proxy-manager, Swag)
4. **Restrict access** via firewall rules or VPN
5. **Regular backups** of database and configuration
6. **Keep updated** - pull latest images regularly

---

## Resource Planning

### Typical Usage (Idle)
- CPU: < 1% per container
- RAM: ~3.5GB total
- Disk I/O: Minimal (< 1MB/s)

### Typical Usage (Active)
- CPU: 5-15% total
- RAM: ~4-5GB total
- Disk I/O: 2-10MB/s (array), 50-200MB/s (cache)

### During Scans/Backups
- CPU: 20-40% total
- RAM: ~5-6GB total
- Disk I/O: 10-50MB/s

### Plan for ~6GB RAM and 6 CPU cores for comfortable operation

---

## Support

- **Issues**: Open a GitHub issue with logs
- **Logs**: `docker-compose logs > logs.txt`
- **Forum**: Unraid community forums

---

## License

See main README.md for license information.
