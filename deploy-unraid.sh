#!/bin/bash
# Medicine Man - Unraid Deployment Script
# Optimized for Unraid Docker deployment with proper permissions and paths

set -e

echo "=================================================="
echo "Medicine Man - Unraid Deployment Script"
echo "=================================================="
echo ""

# Configuration
APP_NAME="medicine-man"
BASE_PATH="${BASE_PATH:-/mnt/user/appdata}"
APP_PATH="${BASE_PATH}/${APP_NAME}"
PUID="${PUID:-99}"
PGID="${PGID:-100}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo "ℹ $1"
}

# Check if running on Unraid
check_unraid() {
    if [ ! -d "/mnt/user" ]; then
        print_warning "This doesn't appear to be an Unraid system (/mnt/user not found)"
        print_info "Continuing anyway, but paths may need adjustment..."
    else
        print_success "Unraid system detected"
    fi
}

# Check Docker
check_docker() {
    print_info "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed!"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed!"
        exit 1
    fi
    
    print_success "Docker and docker-compose are installed"
}

# Create directory structure
create_directories() {
    print_info "Creating directory structure at ${APP_PATH}..."
    
    mkdir -p "${APP_PATH}"/{postgres,redis,logs,backups}
    
    # Set permissions for Unraid (nobody:users)
    chown -R ${PUID}:${PGID} "${APP_PATH}"
    chmod -R 755 "${APP_PATH}"
    
    print_success "Directories created with proper permissions"
}

# Setup environment file
setup_environment() {
    print_info "Setting up environment configuration..."
    
    if [ -f ".env" ]; then
        print_warning ".env file already exists, backing up..."
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    if [ -f ".env.unraid" ]; then
        cp .env.unraid .env
        print_success "Created .env from .env.unraid template"
        print_warning "IMPORTANT: Edit .env and change all passwords and secrets!"
    else
        print_error ".env.unraid template not found!"
        exit 1
    fi
}

# Generate secure secrets
generate_secrets() {
    print_info "Generating secure secrets..."
    
    JWT_SECRET=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
    REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
    
    # Update .env file
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" .env
    sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${ENCRYPTION_KEY}/" .env
    sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${DB_PASSWORD}/" .env
    sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASSWORD}/" .env
    
    # Update DATABASE_URL with new password
    sed -i "s#DATABASE_URL=postgresql://medicine_user:.*@postgres:5432/medicine_man#DATABASE_URL=postgresql://medicine_user:${DB_PASSWORD}@postgres:5432/medicine_man#" .env
    
    # Update backend/.env as well
    if [ -f "backend/.env" ]; then
        sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${DB_PASSWORD}/" backend/.env
        sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASSWORD}/" backend/.env
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" backend/.env
        sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" backend/.env
        sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${ENCRYPTION_KEY}/" backend/.env
        sed -i "s#DATABASE_URL=postgresql://medicine_user:.*@postgres:5432/medicine_man#DATABASE_URL=postgresql://medicine_user:${DB_PASSWORD}@postgres:5432/medicine_man#" backend/.env
    fi
    
    print_success "Secure secrets generated and applied"
}

# Apply missing database migrations
apply_migrations() {
    print_info "Applying missing database migrations..."
    
    # Wait for database to be ready
    sleep 5
    
    # Apply 2FA migration
    docker exec medicine_man_postgres psql -U medicine_user -d medicine_man -c "
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS twofa_secret TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS twofa_enabled BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS twofa_backup_codes TEXT[] DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS twofa_enabled_at TIMESTAMP DEFAULT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_users_twofa_enabled 
        ON users(twofa_enabled) WHERE twofa_enabled = true;
    " 2>/dev/null || print_warning "Could not apply 2FA migration (might already exist)"
    
    # Apply user_id migration
    docker exec medicine_man_postgres psql -U medicine_user -d medicine_man -c "
        ALTER TABLE servers ADD COLUMN IF NOT EXISTS user_id UUID;
        CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers(user_id);
    " 2>/dev/null || print_warning "Could not apply user_id migration (might already exist)"
    
    print_success "Migrations applied"
}

# Create initial admin user
create_admin_user() {
    print_info "Creating initial admin user..."
    
    ADMIN_PASSWORD="Admin123!"
    ADMIN_HASH=$(docker exec medicine_man_backend node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('${ADMIN_PASSWORD}', 10).then(hash => console.log(hash));")
    
    docker exec medicine_man_postgres psql -U medicine_user -d medicine_man -c "
        INSERT INTO users (username, email, password_hash, is_active) 
        VALUES ('admin', 'admin@medicine-man.local', '${ADMIN_HASH}', true) 
        ON CONFLICT (username) DO NOTHING
        RETURNING id;
    " 2>/dev/null && print_success "Admin user created (username: admin, password: Admin123!)" || print_warning "Admin user might already exist"
    
    # Add admin role
    ADMIN_ID=$(docker exec medicine_man_postgres psql -U medicine_user -d medicine_man -t -c "SELECT id FROM users WHERE username='admin' LIMIT 1;" | tr -d ' ')
    
    if [ ! -z "$ADMIN_ID" ]; then
        docker exec medicine_man_postgres psql -U medicine_user -d medicine_man -c "
            INSERT INTO user_roles (user_id, role) 
            VALUES ('${ADMIN_ID}', 'admin') 
            ON CONFLICT DO NOTHING;
        " 2>/dev/null
    fi
}

# Build and deploy
deploy() {
    print_info "Building Docker images (this may take several minutes)..."
    
    docker-compose build --no-cache
    
    print_success "Images built successfully"
    
    print_info "Starting containers..."
    
    docker-compose up -d
    
    print_success "Containers started"
}

# Health check
health_check() {
    print_info "Performing health checks..."
    
    sleep 10
    
    # Check container status
    if docker ps | grep -q "medicine_man_postgres.*healthy"; then
        print_success "PostgreSQL is healthy"
    else
        print_error "PostgreSQL is not healthy"
    fi
    
    if docker ps | grep -q "medicine_man_redis.*healthy"; then
        print_success "Redis is healthy"
    else
        print_error "Redis is not healthy"
    fi
    
    if docker ps | grep -q "medicine_man_backend.*healthy"; then
        print_success "Backend is healthy"
    else
        print_warning "Backend is still starting (this may take up to 90 seconds)..."
    fi
    
    if docker ps | grep -q "medicine_man_frontend.*healthy"; then
        print_success "Frontend is healthy"
    else
        print_warning "Frontend is still starting..."
    fi
}

# Display information
display_info() {
    echo ""
    echo "=================================================="
    echo "Medicine Man Deployment Complete!"
    echo "=================================================="
    echo ""
    echo "Application Access:"
    echo "  Frontend: http://$(hostname -I | awk '{print $1}'):${FRONTEND_PORT:-8091}"
    echo "  Backend API: http://$(hostname -I | awk '{print $1}'):${BACKEND_PORT:-3000}"
    echo ""
    echo "Default Admin Credentials:"
    echo "  Username: admin"
    echo "  Password: Admin123!"
    echo "  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!"
    echo ""
    echo "Data Location:"
    echo "  ${APP_PATH}"
    echo ""
    echo "Useful Commands:"
    echo "  View logs: docker-compose logs -f"
    echo "  Stop: docker-compose stop"
    echo "  Start: docker-compose start"
    echo "  Restart: docker-compose restart"
    echo "  Remove: docker-compose down"
    echo ""
    echo "For more information, see UNRAID-DEPLOYMENT-GUIDE.md"
    echo "=================================================="
}

# Main execution
main() {
    check_unraid
    check_docker
    create_directories
    setup_environment
    generate_secrets
    deploy
    
    print_info "Waiting for services to initialize (90 seconds)..."
    sleep 90
    
    apply_migrations
    create_admin_user
    health_check
    display_info
}

# Run main function
main
