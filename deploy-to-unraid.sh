#!/bin/bash

# Medicine Man - Automated Unraid Deployment Script
# This script handles the complete deployment process automatically

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="${SCRIPT_DIR}/backend"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_step() {
    echo ""
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD} $1${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Display banner
clear
echo -e "${MAGENTA}${BOLD}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              🏥 MEDICINE MAN DEPLOYMENT 🏥                ║
║                                                           ║
║         Automated Unraid Server Deployment                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

log_info "Starting automated deployment process..."
sleep 2

# Step 1: Check prerequisites
log_step "Step 1/10: Checking Prerequisites"

log_info "Checking for Docker..."
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed!"
    exit 1
fi
log_success "Docker is installed: $(docker --version)"

log_info "Checking for Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed!"
    exit 1
fi
log_success "Docker Compose is installed: $(docker-compose --version)"

log_info "Checking for Node.js..."
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed! Needed for setup wizard."
    exit 1
fi
log_success "Node.js is installed: $(node --version)"

# Step 2: Check if already deployed
log_step "Step 2/10: Checking Existing Deployment"

if [ -f "${BACKEND_DIR}/.env" ] && [ -f "${SCRIPT_DIR}/.env" ]; then
    log_warning "Existing deployment detected!"
    echo -e "${YELLOW}Backend .env and root .env files already exist.${NC}"
    echo ""
    echo "Options:"
    echo "  1) Keep existing configuration (skip setup)"
    echo "  2) Reconfigure (run setup wizard again)"
    echo "  3) Exit"
    echo ""
    read -p "Choose option [1-3]: " choice

    case $choice in
        1)
            log_info "Keeping existing configuration..."
            SKIP_SETUP=true
            ;;
        2)
            log_warning "Backing up existing configuration..."
            cp "${BACKEND_DIR}/.env" "${BACKEND_DIR}/.env.backup.$(date +%Y%m%d_%H%M%S)"
            cp "${SCRIPT_DIR}/.env" "${SCRIPT_DIR}/.env.backup.$(date +%Y%m%d_%H%M%S)"
            SKIP_SETUP=false
            ;;
        3)
            log_info "Exiting..."
            exit 0
            ;;
        *)
            log_error "Invalid choice. Exiting."
            exit 1
            ;;
    esac
else
    SKIP_SETUP=false
fi

# Step 3: Run setup wizard (if needed)
if [ "$SKIP_SETUP" = false ]; then
    log_step "Step 3/10: Running Setup Wizard"

    log_info "Installing backend dependencies for setup wizard..."
    cd "${BACKEND_DIR}"
    npm install --production=false --silent

    log_info "Starting interactive setup wizard..."
    echo ""
    echo -e "${YELLOW}${BOLD}Please answer the following questions:${NC}"
    echo ""

    ./setup-wizard.sh || npm run setup

    log_success "Setup wizard completed!"
    cd "${SCRIPT_DIR}"
else
    log_step "Step 3/10: Skipping Setup Wizard (using existing config)"
    log_success "Using existing configuration"
fi

# Step 4: Extract passwords for root .env
log_step "Step 4/10: Configuring Root Environment"

if [ ! -f "${SCRIPT_DIR}/.env" ] || [ "$SKIP_SETUP" = false ]; then
    log_info "Extracting credentials from backend/.env..."

    if [ ! -f "${BACKEND_DIR}/.env" ]; then
        log_error "Backend .env file not found! Setup wizard may have failed."
        exit 1
    fi

    DB_PASS=$(grep "^DB_PASSWORD=" "${BACKEND_DIR}/.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    REDIS_PASS=$(grep "^REDIS_PASSWORD=" "${BACKEND_DIR}/.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'")

    if [ -z "$DB_PASS" ] || [ -z "$REDIS_PASS" ]; then
        log_error "Failed to extract passwords from backend/.env"
        exit 1
    fi

    log_info "Creating root .env file..."
    cat > "${SCRIPT_DIR}/.env" << EOF
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

    log_success "Root .env created successfully"
else
    log_success "Using existing root .env"
fi

# Step 5: Get Unraid IP and configure URLs
log_step "Step 5/10: Configuring Network URLs"

log_info "Detecting Unraid IP address..."
UNRAID_IP=$(hostname -I | awk '{print $1}')

if [ -z "$UNRAID_IP" ]; then
    log_warning "Could not auto-detect IP address"
    read -p "Enter your Unraid IP address: " UNRAID_IP
fi

log_success "Using IP address: ${UNRAID_IP}"

# Update backend CORS
log_info "Updating backend CORS configuration..."
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://$UNRAID_IP:8080|g" "${BACKEND_DIR}/.env"
log_success "Backend CORS updated"

# Create/update frontend .env
log_info "Configuring frontend API URLs..."
cat > "${FRONTEND_DIR}/.env" << EOF
VITE_API_URL=http://$UNRAID_IP:3000
VITE_WS_URL=ws://$UNRAID_IP:3000
EOF
log_success "Frontend URLs configured"

# Step 6: Create required directories
log_step "Step 6/10: Creating Required Directories"

log_info "Creating backend directories..."
mkdir -p "${BACKEND_DIR}/logs"
mkdir -p "${BACKEND_DIR}/backups"
mkdir -p "${BACKEND_DIR}/db-backups"
chmod 750 "${BACKEND_DIR}/logs"
chmod 750 "${BACKEND_DIR}/backups"
chmod 750 "${BACKEND_DIR}/db-backups"
log_success "Backend directories created"

# Step 7: Stop any existing containers
log_step "Step 7/10: Stopping Existing Containers"

cd "${SCRIPT_DIR}"
if docker-compose ps -q 2>/dev/null | grep -q .; then
    log_info "Stopping existing containers..."
    docker-compose down
    log_success "Existing containers stopped"
else
    log_info "No existing containers to stop"
fi

# Step 8: Build and start containers
log_step "Step 8/10: Building and Starting Docker Containers"

log_info "This will take 5-10 minutes on first run..."
echo ""
log_warning "Building images (this may take a while)..."

docker-compose up -d --build

log_success "Docker containers started!"

# Step 9: Wait for services to be healthy
log_step "Step 9/10: Waiting for Services to be Ready"

log_info "Waiting for PostgreSQL to be healthy..."
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker-compose ps postgres | grep -q "healthy"; then
        log_success "PostgreSQL is healthy"
        break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -n "."
done
echo ""

if [ $elapsed -ge $timeout ]; then
    log_error "PostgreSQL health check timed out"
    docker-compose logs postgres
    exit 1
fi

log_info "Waiting for Redis to be healthy..."
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker-compose ps redis | grep -q "healthy"; then
        log_success "Redis is healthy"
        break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -n "."
done
echo ""

if [ $elapsed -ge $timeout ]; then
    log_error "Redis health check timed out"
    docker-compose logs redis
    exit 1
fi

log_info "Waiting for Backend to be healthy..."
timeout=120
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker-compose ps backend | grep -q "healthy"; then
        log_success "Backend is healthy"
        break
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    echo -n "."
done
echo ""

if [ $elapsed -ge $timeout ]; then
    log_error "Backend health check timed out"
    docker-compose logs backend
    exit 1
fi

log_info "Waiting for Frontend to be healthy..."
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker-compose ps frontend | grep -q "healthy"; then
        log_success "Frontend is healthy"
        break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -n "."
done
echo ""

if [ $elapsed -ge $timeout ]; then
    log_error "Frontend health check timed out"
    docker-compose logs frontend
    exit 1
fi

log_success "All services are healthy!"

# Step 10: Run database migrations
log_step "Step 10/10: Running Database Migrations"

log_info "Executing database migrations..."
docker-compose exec -T backend sh -c "cd /app && npm run migrate"

if [ $? -eq 0 ]; then
    log_success "Database migrations completed successfully"
else
    log_error "Database migrations failed!"
    log_warning "Check logs with: docker-compose logs backend"
    exit 1
fi

# Display final status
echo ""
echo -e "${GREEN}${BOLD}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              🎉 DEPLOYMENT SUCCESSFUL! 🎉                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${CYAN}${BOLD}📊 Service Status:${NC}"
docker-compose ps

echo ""
echo -e "${CYAN}${BOLD}🌐 Access Your Application:${NC}"
echo -e "  ${GREEN}Frontend:${NC} http://${UNRAID_IP}:8080"
echo -e "  ${GREEN}Backend API:${NC} http://${UNRAID_IP}:3000"
echo -e "  ${GREEN}Health Check:${NC} http://${UNRAID_IP}:3000/health"

echo ""
echo -e "${CYAN}${BOLD}👤 First Time Setup:${NC}"
echo -e "  1. Navigate to ${GREEN}http://${UNRAID_IP}:8080${NC}"
echo -e "  2. Click ${YELLOW}\"Register here\"${NC}"
echo -e "  3. Create your admin account (first user is admin)"
echo -e "  4. Login and start managing servers!"

echo ""
echo -e "${CYAN}${BOLD}📋 Useful Commands:${NC}"
echo -e "  ${YELLOW}View logs:${NC}         docker-compose logs -f"
echo -e "  ${YELLOW}Stop services:${NC}     docker-compose down"
echo -e "  ${YELLOW}Restart:${NC}           docker-compose restart"
echo -e "  ${YELLOW}Monitor resources:${NC} ./monitor-resources.sh --watch"

echo ""
echo -e "${CYAN}${BOLD}📁 Important Files:${NC}"
echo -e "  ${YELLOW}Configuration:${NC}     backend/.env, .env"
echo -e "  ${YELLOW}Logs:${NC}              backend/logs/"
echo -e "  ${YELLOW}Backups:${NC}           backend/backups/"
echo -e "  ${YELLOW}DB Backups:${NC}        backend/db-backups/"
echo -e "  ${YELLOW}Documentation:${NC}     UNRAID-DEPLOYMENT.md"

echo ""
echo -e "${GREEN}${BOLD}✅ Medicine Man is now running!${NC}"
echo ""
