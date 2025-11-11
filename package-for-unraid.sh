#!/bin/bash
# Medicine Man - Package for Unraid Deployment
# This script creates a tar.gz package ready for deployment on Unraid

set -e

echo "================================"
echo "Medicine Man - Unraid Packager"
echo "================================"
echo ""

# Configuration
PACKAGE_NAME="medicine-man-unraid"
PACKAGE_VERSION="1.0.0"
OUTPUT_FILE="${PACKAGE_NAME}-${PACKAGE_VERSION}.tar.gz"
TEMP_DIR="./package-temp"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}[1/8]${NC} Cleaning previous packages..."
rm -rf "${TEMP_DIR}" 2>/dev/null || true
rm -f "${PACKAGE_NAME}"*.tar.gz 2>/dev/null || true
mkdir -p "${TEMP_DIR}"

echo -e "${BLUE}[2/8]${NC} Copying application files..."
# Copy essential files and directories
cp -r backend "${TEMP_DIR}/"
cp -r frontend "${TEMP_DIR}/"
cp -r shared "${TEMP_DIR}/"

# Copy configuration files
cp docker-compose.yml "${TEMP_DIR}/"
cp postgres-custom.conf "${TEMP_DIR}/"
cp maintenance.sh "${TEMP_DIR}/"
cp package.json "${TEMP_DIR}/"
cp package-lock.json "${TEMP_DIR}/"
cp tsconfig.json "${TEMP_DIR}/"

# Copy documentation
cp README.md "${TEMP_DIR}/" 2>/dev/null || echo "README.md not found, skipping"
cp OPTIMIZATION.md "${TEMP_DIR}/"
cp CLAUDE.md "${TEMP_DIR}/" 2>/dev/null || echo "CLAUDE.md not found, skipping"

echo -e "${BLUE}[3/8]${NC} Setting up production environment files..."
# Copy production env files
cp .env.production "${TEMP_DIR}/.env"
cp backend/.env.production "${TEMP_DIR}/backend/.env"

echo -e "${BLUE}[4/8]${NC} Creating deployment directories..."
# Create necessary directories
mkdir -p "${TEMP_DIR}/backend/logs"
mkdir -p "${TEMP_DIR}/backend/backups"
mkdir -p "${TEMP_DIR}/backend/db-backups"

echo -e "${BLUE}[5/8]${NC} Removing development files..."
# Remove node_modules from all locations
find "${TEMP_DIR}" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find "${TEMP_DIR}" -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
find "${TEMP_DIR}" -name "build" -type d -exec rm -rf {} + 2>/dev/null || true
find "${TEMP_DIR}" -name ".git" -type d -exec rm -rf {} + 2>/dev/null || true
find "${TEMP_DIR}" -name ".vscode" -type d -exec rm -rf {} + 2>/dev/null || true
find "${TEMP_DIR}" -name ".idea" -type d -exec rm -rf {} + 2>/dev/null || true

# Remove test files
find "${TEMP_DIR}" -name "*.test.ts" -delete 2>/dev/null || true
find "${TEMP_DIR}" -name "*.test.tsx" -delete 2>/dev/null || true
find "${TEMP_DIR}" -name "*.spec.ts" -delete 2>/dev/null || true
find "${TEMP_DIR}" -name "*.spec.tsx" -delete 2>/dev/null || true

echo -e "${BLUE}[6/8]${NC} Creating deployment script..."
cat > "${TEMP_DIR}/deploy-to-unraid.sh" << 'DEPLOY_SCRIPT'
#!/bin/bash
# Medicine Man - Unraid Deployment Script
# Run this script after extracting the tar.gz on your Unraid server

set -e

echo "================================"
echo "Medicine Man - Unraid Deployment"
echo "================================"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed or not in PATH"
    exit 1
fi

# Check if docker-compose is available (try both variants)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    echo "ERROR: docker-compose is not available"
    exit 1
fi

echo "Using Docker Compose: $DOCKER_COMPOSE"
echo ""

# Navigate to script directory
cd "$(dirname "$0")"

echo "[1/6] Verifying environment files..."
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found"
    exit 1
fi
if [ ! -f "backend/.env" ]; then
    echo "ERROR: backend/.env file not found"
    exit 1
fi
echo "✓ Environment files found"

echo "[2/6] Creating required directories..."
mkdir -p backend/logs
mkdir -p backend/backups
mkdir -p backend/db-backups
chmod 755 backend/logs backend/backups backend/db-backups
echo "✓ Directories created"

echo "[3/6] Making scripts executable..."
chmod +x maintenance.sh
chmod +x deploy-to-unraid.sh
echo "✓ Scripts are executable"

echo "[4/6] Building Docker containers..."
$DOCKER_COMPOSE build --no-cache
echo "✓ Containers built"

echo "[5/6] Starting services..."
$DOCKER_COMPOSE up -d
echo "✓ Services started"

echo "[6/6] Waiting for services to be healthy..."
sleep 10

# Check service health
echo "Checking service health..."
$DOCKER_COMPOSE ps

echo ""
echo "================================"
echo "Deployment Complete!"
echo "================================"
echo ""
echo "Access the application at: http://192.168.4.21:8091"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: sEbEdas7!"
echo ""
echo "IMPORTANT: Change the admin password after first login!"
echo ""
echo "Useful commands:"
echo "  View logs:       $DOCKER_COMPOSE logs -f"
echo "  Stop services:   $DOCKER_COMPOSE down"
echo "  Restart:         $DOCKER_COMPOSE restart"
echo "  Check status:    $DOCKER_COMPOSE ps"
echo "  Run maintenance: ./maintenance.sh"
echo ""
DEPLOY_SCRIPT

chmod +x "${TEMP_DIR}/deploy-to-unraid.sh"

echo -e "${BLUE}[7/8]${NC} Creating DEPLOYMENT.md documentation..."
cat > "${TEMP_DIR}/DEPLOYMENT.md" << 'DEPLOYMENT_DOC'
# Medicine Man - Unraid Deployment Guide

## Prerequisites

- Unraid 6.10 or higher
- Docker enabled
- 16GB RAM minimum (4GB recommended free)
- 4 CPU cores
- 10GB free disk space
- Network access to 192.168.4.21

## Deployment Steps

### 1. Extract the Package

```bash
cd /mnt/user/appdata
tar -xzf medicine-man-unraid-*.tar.gz
cd medicine-man
```

### 2. Review Configuration

**Important Files to Check:**

- `.env` - Main environment variables
- `backend/.env` - Backend configuration (CORS, database, Redis)
- `docker-compose.yml` - Resource limits and port mappings

**Default Configuration:**
- Frontend Port: 8091 (host) → 8080 (container)
- Backend Port: 3000 (host and container)
- Target IP: 192.168.4.21

### 3. Customize Environment (Optional)

Edit `.env` and `backend/.env` to change:
- Database passwords
- Redis password
- CORS origin
- Log levels

**IMPORTANT:** Keep the JWT_SECRET, SESSION_SECRET, and ENCRYPTION_KEY values secure!

### 4. Run Deployment Script

```bash
chmod +x deploy-to-unraid.sh
./deploy-to-unraid.sh
```

The script will:
1. Verify environment files
2. Create necessary directories
3. Build Docker containers
4. Start all services
5. Wait for services to be healthy

### 5. Access the Application

Open your browser to: **http://192.168.4.21:8091**

**Default Admin Credentials:**
- Username: `admin`
- Password: `sEbEdas7!`

**CHANGE THE PASSWORD IMMEDIATELY AFTER FIRST LOGIN!**

## Resource Allocation

The application is optimized for a 4-core, 16GB RAM Unraid server:

| Service    | Memory Limit | Memory Reserved | CPU Limit |
|------------|--------------|-----------------|-----------|
| PostgreSQL | 2GB          | 1GB             | 1.0       |
| Redis      | 768MB        | 512MB           | 0.5       |
| Backend    | 3GB          | 2GB             | 2.0       |
| Frontend   | 512MB        | 256MB           | 0.5       |
| **Total**  | **6.3GB**    | **3.8GB**       | **4.0**   |

This leaves approximately 9.7GB for system operations and other containers.

## Verification

### Check Container Status

```bash
docker compose ps
```

All containers should show "Up" status with "(healthy)" indicator.

### Check Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs backend -f
docker compose logs frontend -f
docker compose logs postgres -f
docker compose logs redis -f
```

### Test Health Endpoints

```bash
# Backend health
curl http://localhost:3000/health

# Frontend health
curl http://localhost:8080/health
```

## Troubleshooting

### Containers Won't Start

```bash
# Check Docker logs
docker compose logs

# Rebuild containers
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Out of Memory Errors

Check `docker stats` to see resource usage:

```bash
docker stats --no-stream
```

If a service is using too much memory, adjust limits in `docker-compose.yml`.

### Database Connection Errors

```bash
# Check PostgreSQL logs
docker compose logs postgres

# Verify database is accessible
docker compose exec postgres pg_isready -U medicine_user
```

### Cannot Access Frontend

1. Verify port 8091 is not in use: `netstat -an | grep 8091`
2. Check firewall rules allow access to port 8091
3. Verify frontend container is running: `docker compose ps frontend`
4. Check frontend logs: `docker compose logs frontend`

## Maintenance

### Automated Maintenance

The package includes a maintenance script that should be run weekly:

```bash
./maintenance.sh
```

This script:
- Cleans logs older than 7 days
- Rotates large log files (>100MB)
- Removes old scan results (>30 days)
- Removes old audit logs (>30 days)
- Vacuums database
- Prunes Docker system

### Schedule with Cron

Add to Unraid crontab (via User Scripts plugin):

```bash
0 2 * * 0 /mnt/user/appdata/medicine-man/maintenance.sh >> /mnt/user/appdata/medicine-man/maintenance.log 2>&1
```

This runs maintenance every Sunday at 2 AM.

## Backup & Restore

### Backup Application Data

```bash
# Stop containers
docker compose down

# Backup volumes
docker run --rm -v medicine-man_postgres_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/postgres-data-$(date +%Y%m%d).tar.gz -C /data .
docker run --rm -v medicine-man_redis_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/redis-data-$(date +%Y%m%d).tar.gz -C /data .

# Restart containers
docker compose up -d
```

### Restore Application Data

```bash
# Stop containers
docker compose down

# Remove old volumes
docker volume rm medicine-man_postgres_data medicine-man_redis_data

# Restore from backup
docker run --rm -v medicine-man_postgres_data:/data -v $(pwd)/backups:/backup alpine sh -c "tar xzf /backup/postgres-data-YYYYMMDD.tar.gz -C /data"
docker run --rm -v medicine-man_redis_data:/data -v $(pwd)/backups:/backup alpine sh -c "tar xzf /backup/redis-data-YYYYMMDD.tar.gz -C /data"

# Restart containers
docker compose up -d
```

## Updating

### Update to New Version

1. Stop current containers: `docker compose down`
2. Backup data (see above)
3. Extract new version over existing directory
4. Run deployment script: `./deploy-to-unraid.sh`

### Rebuild Containers

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Uninstallation

### Remove Containers and Volumes

```bash
cd /mnt/user/appdata/medicine-man
docker compose down -v
cd ..
rm -rf medicine-man
```

**WARNING:** This will delete all data including databases and backups!

## Support

For issues and documentation, see:
- OPTIMIZATION.md - Performance tuning guide
- README.md - General application documentation
- Backend logs: `backend/logs/`

## Security Notes

1. **Change default passwords** immediately after deployment
2. **Keep JWT/SESSION/ENCRYPTION secrets secure** - never share these
3. **Use HTTPS** if exposing to the internet (requires reverse proxy)
4. **Enable firewall rules** to restrict access to trusted IPs
5. **Regular backups** - automate database backups
6. **Keep Docker updated** - run `docker system prune` regularly
DEPLOYMENT_DOC

echo -e "${BLUE}[8/8]${NC} Creating tar.gz package..."
# Rename temp directory to final package name
mv "${TEMP_DIR}" "medicine-man"

# Create tar with proper directory structure
tar -czf "${OUTPUT_FILE}" "medicine-man"

# Cleanup
rm -rf "medicine-man"

# Get file size
FILE_SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Package Created Successfully!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "Package: ${BLUE}${OUTPUT_FILE}${NC}"
echo -e "Size: ${BLUE}${FILE_SIZE}${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Transfer this file to your Unraid server:"
echo "   scp ${OUTPUT_FILE} root@192.168.4.21:/mnt/user/appdata/"
echo ""
echo "2. On Unraid, extract and deploy:"
echo "   cd /mnt/user/appdata"
echo "   tar -xzf ${OUTPUT_FILE}"
echo "   cd medicine-man"
echo "   ./deploy-to-unraid.sh"
echo ""
echo "3. Access at: http://192.168.4.21:8091"
echo ""
echo -e "${BLUE}Package Contents:${NC}"
echo "  - Backend application (Node.js/Express)"
echo "  - Frontend application (React/Vite)"
echo "  - Shared types library"
echo "  - Docker Compose configuration"
echo "  - PostgreSQL custom configuration"
echo "  - Maintenance scripts"
echo "  - Deployment script"
echo "  - Documentation (DEPLOYMENT.md, OPTIMIZATION.md)"
echo ""
