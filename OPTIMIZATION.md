# Medicine Man - Resource Optimization Guide

## System Requirements

**Optimized for:**
- 4 CPU cores
- 16GB RAM
- Unraid Docker environment
- SSD storage recommended

## Resource Allocation

### Current Allocation

| Service    | Memory Limit | Memory Reserved | CPU Limit | Purpose                          |
|------------|--------------|-----------------|-----------|----------------------------------|
| PostgreSQL | 2GB          | 1GB             | 1.0       | Database                         |
| Redis      | 768MB        | 512MB           | 0.5       | Cache & Sessions                 |
| Backend    | 3GB          | 2GB             | 2.0       | Node.js API                      |
| Frontend   | 512MB        | 256MB           | 0.5       | Nginx static server              |
| **Total**  | **6.3GB**    | **3.8GB**       | **4.0**   | Leaves 9.7GB for system overhead |

### Why These Limits?

- **PostgreSQL (2GB)**: Sufficient for typical workload with 512MB shared buffers
- **Redis (768MB)**: 512MB max memory + overhead for operations
- **Backend (3GB)**: Node.js with 2GB heap + overhead for workers
- **Frontend (512MB)**: Nginx is very lightweight, only serves static files

## Performance Optimizations

### PostgreSQL Tuning

1. **Shared Buffers**: 512MB (25% of allocated RAM)
2. **Effective Cache Size**: 1536MB (assumes OS will cache frequently accessed data)
3. **Work Memory**: 4MB per operation (prevents OOM on complex queries)
4. **Parallel Workers**: 4 max (matches CPU count)
5. **WAL Settings**: Optimized for reliability and performance balance
6. **Autovacuum**: Configured to run frequently with low cost

### Redis Tuning

1. **Max Memory**: 512MB with LRU eviction
2. **Persistence**: AOF + RDB for data safety
3. **Connection Pool**: Max 1000 clients
4. **Timeout**: 5-minute idle connection timeout

### Node.js Backend

1. **Heap Size**: Limited to 2GB (`--max-old-space-size=2048`)
2. **Thread Pool**: 4 threads (matches CPU count)
3. **Cluster Workers**: 2 (allows handling concurrent requests)
4. **Process Limits**: 200 max PIDs to prevent fork bombs

### Nginx Frontend

1. **Worker Processes**: 2 (half of CPU count)
2. **Worker Connections**: 1024 per worker
3. **Gzip**: Enabled with level 6 compression
4. **Buffer Sizes**: Optimized for typical web traffic
5. **Process Limits**: 50 max PIDs

## Monitoring Resources

### Check Container Resource Usage

```bash
# Real-time resource usage
docker stats

# Specific container stats
docker stats medicine_man_backend

# Memory usage by container
docker compose ps -q | xargs docker inspect --format='{{.Name}}: {{.HostConfig.Memory}}'
```

### Check PostgreSQL Performance

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U medicine_user -d medicine_man

# Check cache hit ratio (should be >99%)
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 AS cache_hit_ratio
FROM pg_statio_user_tables;

# Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

# Check table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Redis Performance

```bash
# Connect to Redis
docker compose exec redis redis-cli -a your_password_here

# Check memory usage
INFO memory

# Check stats
INFO stats

# Check connected clients
CLIENT LIST
```

## Maintenance

### Automated Maintenance Script

Run the maintenance script weekly:

```bash
# Make executable
chmod +x maintenance.sh

# Run manually
./maintenance.sh

# Or add to crontab (run every Sunday at 2 AM)
0 2 * * 0 /path/to/medicine-man/maintenance.sh >> /path/to/medicine-man/maintenance.log 2>&1
```

### Manual Maintenance Tasks

#### 1. Rotate Logs

```bash
# Rotate backend logs
cd backend/logs
for log in *.log; do
  if [ -f "$log" ] && [ $(stat -c%s "$log") -gt 104857600 ]; then
    mv "$log" "$log.$(date +%Y%m%d)"
    touch "$log"
  fi
done
```

#### 2. Clean Old Data

```bash
# Clean scans older than 30 days
docker compose exec postgres psql -U medicine_user -d medicine_man -c "
  DELETE FROM detected_services WHERE scan_id IN (
    SELECT id FROM scans WHERE started_at < NOW() - INTERVAL '30 days'
  );
  DELETE FROM scans WHERE started_at < NOW() - INTERVAL '30 days';
"

# Vacuum database
docker compose exec postgres psql -U medicine_user -d medicine_man -c "VACUUM ANALYZE;"
```

#### 3. Docker Cleanup

```bash
# Remove unused containers, networks, images
docker system prune -a -f --filter "until=168h"

# Remove unused volumes (BE CAREFUL!)
docker volume prune -f
```

## Performance Tuning Tips

### If Backend is Using Too Much Memory

1. Reduce `NODE_OPTIONS` max-old-space-size to 1536 or 1024
2. Reduce `NODE_CLUSTER_WORKERS` to 1
3. Reduce backend `mem_limit` to 2G

### If PostgreSQL is Slow

1. Check slow query log: `backend/logs/postgresql-*.log`
2. Analyze query plans:
   ```sql
   EXPLAIN ANALYZE SELECT ...;
   ```
3. Add indexes for frequently queried columns
4. Increase `shared_buffers` if you have RAM to spare

### If Redis is Evicting Too Often

1. Check eviction stats:
   ```bash
   docker compose exec redis redis-cli -a password INFO stats | grep evicted
   ```
2. Increase `maxmemory` in docker-compose.yml
3. Review cache usage - may need to be more selective

### If System is Running Out of RAM

1. Check which container is using most:
   ```bash
   docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}"
   ```
2. Reduce limits for the heaviest containers
3. Consider disabling BitLaunch sync if not needed
4. Reduce backup frequency or simultaneous backups

## Scaling Recommendations

### For More Servers (>50)

- Increase PostgreSQL to 3-4GB
- Increase backend to 4-5GB
- Consider adding read replicas for PostgreSQL

### For Heavy Backup Workloads

- Increase backend memory
- Add dedicated backup worker container
- Use external storage for backups

### For Many Concurrent Users (>20)

- Increase Redis maxmemory to 1GB
- Increase backend cluster workers to 3-4
- Add reverse proxy with caching (Traefik, Nginx)

## Troubleshooting

### Container Keeps Restarting

```bash
# Check logs
docker compose logs backend --tail 100

# Check if OOM killed
dmesg | grep -i "out of memory"
docker inspect medicine_man_backend | grep OOMKilled
```

### High CPU Usage

```bash
# Check which process
docker compose exec backend top

# Profile Node.js
docker compose exec backend node --prof app.js
```

### Slow Database Queries

```bash
# Enable slow query log (already enabled for queries > 1s)
# Check the log
docker compose exec postgres tail -f /var/lib/postgresql/data/log/postgresql-*.log
```

## Unraid-Specific Tips

1. **Use Cache Drive**: Place Docker volumes on cache drive (SSD) for better performance
2. **Monitor Array**: Keep array utilization < 80% for optimal Docker performance
3. **Memory Pressure**: Watch `docker system df` - Unraid can struggle with memory pressure
4. **Network**: Use bridge mode for better isolation and performance
5. **Backups**: Point backup directories to array, not cache, for long-term storage

## Performance Benchmarks

Expected performance on 4-core/16GB system:

- **API Response Time**: < 100ms for most endpoints
- **Concurrent Users**: 10-20 simultaneous users
- **Scans**: 5-10 concurrent SSH scans
- **Backups**: 2-3 simultaneous backup jobs
- **Database**: < 10ms for indexed queries
- **Cache Hit Ratio**: > 95%

Monitor these metrics and adjust resource limits as needed based on your actual workload.
