#!/bin/bash
# Medicine Man Maintenance Script
# Optimized for limited resources - cleans up old logs and data

set -e

echo "================================"
echo "Medicine Man Maintenance Script"
echo "================================"
echo "Started at: $(date)"
echo ""

# Configuration
DAYS_TO_KEEP_LOGS=7
DAYS_TO_KEEP_SCANS=30
DAYS_TO_KEEP_BACKUPS=90
DAYS_TO_KEEP_AUDIT_LOGS=30

# Navigate to script directory
cd "$(dirname "$0")"

echo "[1/6] Cleaning old application logs..."
find backend/logs -name "*.log" -type f -mtime +${DAYS_TO_KEEP_LOGS} -delete 2>/dev/null || true
find backend/logs -name "*.log.*" -type f -mtime +${DAYS_TO_KEEP_LOGS} -delete 2>/dev/null || true
echo "✓ Old logs cleaned"

echo "[2/6] Rotating current logs..."
if [ -f "backend/logs/combined.log" ] && [ $(stat -f%z "backend/logs/combined.log" 2>/dev/null || stat -c%s "backend/logs/combined.log" 2>/dev/null || echo 0) -gt 104857600 ]; then
    mv backend/logs/combined.log "backend/logs/combined.log.$(date +%Y%m%d-%H%M%S)"
    touch backend/logs/combined.log
fi
if [ -f "backend/logs/error.log" ] && [ $(stat -f%z "backend/logs/error.log" 2>/dev/null || stat -c%s "backend/logs/error.log" 2>/dev/null || echo 0) -gt 104857600 ]; then
    mv backend/logs/error.log "backend/logs/error.log.$(date +%Y%m%d-%H%M%S)"
    touch backend/logs/error.log
fi
echo "✓ Logs rotated (if > 100MB)"

echo "[3/6] Cleaning old scan results from database..."
docker compose exec -T postgres psql -U "${DB_USER}" -d medicine_man -c "
    DELETE FROM detected_services WHERE scan_id IN (
        SELECT id FROM scans WHERE started_at < NOW() - INTERVAL '${DAYS_TO_KEEP_SCANS} days'
    );
    DELETE FROM scans WHERE started_at < NOW() - INTERVAL '${DAYS_TO_KEEP_SCANS} days';
" 2>/dev/null || echo "⚠ Could not clean old scans (database may not be running)"

echo "[4/6] Cleaning old audit logs from database..."
docker compose exec -T postgres psql -U "${DB_USER}" -d medicine_man -c "
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '${DAYS_TO_KEEP_AUDIT_LOGS} days';
    DELETE FROM bitlaunch_audit WHERE created_at < NOW() - INTERVAL '${DAYS_TO_KEEP_AUDIT_LOGS} days';
" 2>/dev/null || echo "⚠ Could not clean audit logs"

echo "[5/6] Vacuuming database..."
docker compose exec -T postgres psql -U "${DB_USER}" -d medicine_man -c "VACUUM ANALYZE;" 2>/dev/null || echo "⚠ Could not vacuum database"

echo "[6/6] Cleaning Docker system..."
docker system prune -f --filter "until=168h" 2>/dev/null || echo "⚠ Could not prune Docker system"

echo ""
echo "================================"
echo "Maintenance completed successfully!"
echo "Finished at: $(date)"
echo "================================"

# Display disk usage
echo ""
echo "Current disk usage:"
echo "-------------------"
df -h . || true
echo ""
echo "Docker volumes:"
docker system df -v 2>/dev/null | head -20 || true
