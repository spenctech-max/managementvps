# BullMQ Job Queue Implementation

## Overview

This document describes the comprehensive BullMQ job queue system implemented for the Medicine Man backup management system. The implementation provides persistent, reliable job processing with automatic retries, progress tracking, and graceful failure handling.

## Architecture

### Components

1. **Queue Manager** (`src/queues/queueManager.ts`)
   - Central management for all queues
   - Queue configuration and initialization
   - Event monitoring and logging
   - Health checks and statistics

2. **Workers**
   - Backup Worker (`src/queues/workers/backupWorker.ts`) - Processes backup jobs with 2 concurrent jobs
   - Scan Worker (`src/queues/workers/scanWorker.ts`) - Processes scan jobs with 5 concurrent jobs

3. **Job Handlers**
   - Backup Jobs (`src/queues/jobs/backupJobs.ts`) - Backup execution logic
   - Scan Jobs (`src/queues/jobs/scanJobs.ts`) - Scan execution logic

4. **API Routes**
   - Job Status Routes (`src/routes/jobs.ts`) - Job monitoring and management endpoints

### Queue Configuration

#### Connection
- **Redis Host**: `redis:6379` (configurable via environment)
- **Connection Pool**: Shared Redis connection with BullMQ-specific settings

#### Queue Types

1. **Backup Queue** (`backup-queue`)
   - Priority: High
   - Concurrency: 2 jobs
   - Lock Duration: 5 minutes

2. **Scan Queue** (`scan-queue`)
   - Priority: Normal
   - Concurrency: 5 jobs
   - Lock Duration: 2 minutes

3. **Update Queue** (`update-queue`)
   - Priority: Critical
   - Concurrency: 1 job
   - Lock Duration: 10 minutes

#### Job Options

All jobs are configured with:
- **Attempts**: 3 retries
- **Backoff**: Exponential with 5-second initial delay
- **Retention**:
  - Completed jobs: 7 days or last 1000 jobs
  - Failed jobs: 7 days

## Features Implemented

### 1. Job Persistence
- All jobs persist across server restarts
- Redis-backed queue storage ensures no job loss
- Jobs automatically resume after server recovery

### 2. Retry Logic
- 3 automatic retry attempts
- Exponential backoff (5s, 10s, 20s)
- Failed jobs marked permanently after all retries exhausted

### 3. Progress Tracking
- Real-time progress updates (0-100%)
- Progress stored in Redis
- Accessible via job status endpoints

### 4. Concurrency Control
- Backup: Maximum 2 concurrent jobs
- Scan: Maximum 5 concurrent jobs
- Update: Maximum 1 concurrent job
- Prevents resource exhaustion

### 5. Job Monitoring
- GET `/api/jobs/:id` - Get specific job status
- GET `/api/jobs` - List all jobs with filtering
- GET `/api/jobs/stats/all` - Overall statistics
- DELETE `/api/jobs/:id` - Remove completed/failed jobs
- POST `/api/jobs/:id/retry` - Retry failed jobs

### 6. Queue Metrics
- GET `/api/metrics/queues` - Detailed queue statistics
- Integrated into system health monitoring
- Track: waiting, active, completed, failed, delayed jobs

### 7. Automatic Cleanup
- Failed jobs removed after 7 days
- Completed jobs keep last 1000 or 7 days
- Manual cleanup via `QueueManager.cleanOldJobs()`

## API Documentation

### Job Status Endpoints

#### Get Job Status
```http
GET /api/jobs/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Job status retrieved successfully",
  "data": {
    "id": "123",
    "name": "backup:manual",
    "data": {
      "serverId": "uuid",
      "backupId": "uuid",
      "userId": "uuid"
    },
    "state": "completed",
    "progress": 100,
    "attempts": 1,
    "maxAttempts": 3,
    "timestamp": 1699123456789,
    "processedOn": 1699123457000,
    "finishedOn": 1699123460000,
    "result": {
      "backupId": "uuid",
      "status": "completed",
      "duration": 3
    }
  }
}
```

#### List Jobs
```http
GET /api/jobs?queue=backup&state=completed&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `queue` (optional): `backup`, `scan`, or `update`
- `state` (optional): `waiting`, `active`, `completed`, `failed`
- `limit` (optional): Number of jobs to return (max 200, default 50)

**Response:**
```json
{
  "success": true,
  "message": "Jobs retrieved successfully",
  "data": {
    "jobs": [...],
    "count": 10,
    "total": 45
  }
}
```

#### Get Job Statistics
```http
GET /api/jobs/stats/all
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Job statistics retrieved successfully",
  "data": {
    "backup": {
      "waiting": 2,
      "active": 1,
      "completed": 145,
      "failed": 3,
      "total": 151
    },
    "scan": {
      "waiting": 5,
      "active": 3,
      "completed": 289,
      "failed": 7,
      "total": 304
    },
    "update": {
      "waiting": 0,
      "active": 0,
      "completed": 12,
      "failed": 0,
      "total": 12
    }
  }
}
```

#### Remove Job
```http
DELETE /api/jobs/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Job removed successfully",
  "data": null
}
```

**Note:** Active jobs cannot be removed.

#### Retry Failed Job
```http
POST /api/jobs/:id/retry
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Job retry initiated successfully",
  "data": {
    "jobId": "123"
  }
}
```

**Note:** Only failed jobs can be retried.

### Queue Metrics Endpoints

#### Get Queue Metrics
```http
GET /api/metrics/queues
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Queue metrics retrieved",
  "data": {
    "backup": {
      "waiting": 2,
      "active": 1,
      "completed": 145,
      "failed": 3,
      "delayed": 0,
      "paused": 0,
      "total": 151
    },
    "scan": {
      "waiting": 5,
      "active": 3,
      "completed": 289,
      "failed": 7,
      "delayed": 0,
      "paused": 0,
      "total": 304
    },
    "update": {
      "waiting": 0,
      "active": 0,
      "completed": 12,
      "failed": 0,
      "delayed": 0,
      "paused": 0,
      "total": 12
    },
    "health": {
      "status": "healthy",
      "message": "All queues operating normally"
    }
  }
}
```

## Integration Points

### 1. Backup Scheduler
**File:** `src/services/backupScheduler.ts`

**Changes:**
- Scheduled backups now enqueue jobs instead of direct execution
- Job ID tracked in backup record metadata
- Schedule status updated based on job completion

**Usage:**
```typescript
// Old (direct execution)
await backupService.executeBackup(serverId, backupId, options);

// New (enqueued)
await backupQueue.add(JobType.BACKUP_SCHEDULED, jobData, options);
```

### 2. Scan Endpoints
**File:** `src/routes/scans.ts`

**Changes:**
- POST `/api/servers/:id/scan` now enqueues jobs
- Returns `scanId` and `jobId` immediately
- Scan executes asynchronously via worker

**Response:**
```json
{
  "success": true,
  "message": "Scan enqueued successfully",
  "data": {
    "scanId": "uuid",
    "jobId": "123",
    "serverId": "uuid",
    "status": "pending",
    "message": "Scan is queued and will run shortly"
  }
}
```

### 3. Metrics Integration
**File:** `src/routes/metrics.ts`

**Changes:**
- Added GET `/api/metrics/queues` endpoint
- System metrics now include queue health
- Queue statistics in overall health check

## Configuration Requirements

### Environment Variables
```env
# Redis Configuration (existing)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# No additional environment variables required
# Queue system uses existing Redis configuration
```

### Redis Requirements
- Redis 5.0 or higher (for streams support)
- Persistent storage enabled (for job persistence)
- Memory: Allocate sufficient memory for job data

### Resource Requirements
- **CPU**: Queue workers are I/O bound, minimal CPU overhead
- **Memory**: ~50-100MB per queue + job data
- **Disk**: Redis RDB/AOF for persistence

## Migration Guide

### Moving from Direct Execution to Queues

#### Before (Direct Execution)
```typescript
// Backup execution
await backupService.executeBackup(serverId, backupId, options);

// Scan execution
await scanner.scanServer(serverId, scanType);
```

#### After (Queue-Based)
```typescript
// Enqueue backup job
const job = await backupQueue.add(JobType.BACKUP_MANUAL, {
  serverId,
  backupId,
  userId,
  options,
  isScheduled: false
}, {
  priority: JobPriority.HIGH,
  attempts: 3
});

// Enqueue scan job
const job = await scanQueue.add(JobType.SCAN_FULL, {
  serverId,
  scanId,
  userId,
  scanType: 'full'
}, {
  priority: JobPriority.NORMAL,
  attempts: 3
});
```

### Backward Compatibility

All existing API endpoints maintain backward compatibility:
- Response formats unchanged
- Existing database records compatible
- No migration scripts required

**Changes:**
1. Backup/scan operations return immediately with job IDs
2. Status tracking via new `/api/jobs/:id` endpoint
3. Progress updates available in real-time

### Testing Migration

1. **Test Backup Creation:**
   ```bash
   curl -X POST http://localhost:3000/api/servers/{id}/backup \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"backup_type": "full"}'
   ```

2. **Check Job Status:**
   ```bash
   curl http://localhost:3000/api/jobs/{jobId} \
     -H "Authorization: Bearer {token}"
   ```

3. **Monitor Queue Metrics:**
   ```bash
   curl http://localhost:3000/api/metrics/queues \
     -H "Authorization: Bearer {token}"
   ```

## Performance Considerations

### Throughput
- **Backup Queue**: 2 concurrent jobs, ~5-15 min per backup = 8-24 backups/hour
- **Scan Queue**: 5 concurrent jobs, ~1-3 min per scan = 100-300 scans/hour
- **Update Queue**: 1 concurrent job, ~10-30 min per update = 2-6 updates/hour

### Scaling
To increase throughput:
1. Increase worker concurrency in worker files
2. Deploy multiple worker instances (horizontal scaling)
3. Optimize Redis configuration for higher throughput

### Memory Usage
- Each job stores ~1-5KB of data
- 1000 jobs ≈ 1-5MB
- Monitor Redis memory usage: `redis-cli INFO memory`

### Best Practices
1. Monitor queue sizes regularly
2. Set up alerts for high failed job counts
3. Clean up old jobs periodically
4. Use appropriate priorities for job types
5. Monitor worker performance and adjust concurrency

## Troubleshooting

### Common Issues

#### 1. Jobs Stuck in Waiting State
**Cause:** Workers not running or stalled
**Solution:**
```bash
# Check worker status in logs
docker logs medicine-man-backend | grep "worker"

# Restart server to restart workers
docker restart medicine-man-backend
```

#### 2. High Failed Job Rate
**Cause:** Connection issues, resource constraints
**Solution:**
- Check Redis connectivity
- Review failed job reasons: GET `/api/jobs?state=failed`
- Increase retry attempts if needed

#### 3. Queue Growing Too Large
**Cause:** Workers slower than job creation rate
**Solution:**
- Increase worker concurrency
- Add more worker instances
- Optimize job processing time

#### 4. Redis Connection Errors
**Cause:** Redis unavailable or configuration issues
**Solution:**
- Verify Redis is running: `docker ps | grep redis`
- Check Redis logs: `docker logs medicine-man-redis`
- Verify connection settings in environment variables

### Debug Commands

```typescript
// In QueueManager
await QueueManager.logQueueStats();
await QueueManager.cleanOldJobs();
await QueueManager.pauseAll();
await QueueManager.resumeAll();
```

## Monitoring and Alerting

### Recommended Metrics to Monitor
1. **Queue Sizes**: Alert if waiting > 100
2. **Failed Job Rate**: Alert if failed > 10% of total
3. **Worker Utilization**: Active jobs vs. concurrency limit
4. **Job Duration**: Alert on abnormally long jobs
5. **Redis Memory**: Alert if usage > 80%

### Prometheus Integration
Queue metrics are exposed via existing Prometheus endpoint (`/metrics`). Use Grafana to visualize:
- Queue job counts over time
- Job completion rates
- Worker utilization
- Failure rates by queue

## Future Enhancements

Potential improvements for future versions:

1. **Job Priorities**
   - User-defined priorities per job
   - Admin priority override

2. **Advanced Scheduling**
   - Delayed job execution
   - Recurring job patterns
   - Job dependencies

3. **Enhanced Monitoring**
   - Job execution time histograms
   - Real-time WebSocket updates
   - Email notifications on failures

4. **Rate Limiting**
   - Per-user job limits
   - Queue-specific rate limits
   - Throttling controls

5. **Job Chaining**
   - Execute jobs in sequence
   - Conditional job execution
   - Workflow support

## Support and Maintenance

### Regular Maintenance Tasks
1. Review failed jobs weekly
2. Clean old jobs monthly
3. Monitor Redis memory usage
4. Update BullMQ to latest stable version
5. Review and optimize worker concurrency

### Version Compatibility
- BullMQ: 4.x or higher
- Redis: 5.0 or higher
- Node.js: 18.x or higher

### Documentation Updates
This document should be updated when:
- Queue configuration changes
- New job types added
- API endpoints modified
- Performance tuning applied

---

**Document Version**: 1.0
**Last Updated**: 2025-01-04
**Author**: Claude (Anthropic)
