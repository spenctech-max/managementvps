# BullMQ Queue System - Quick Start Guide

## Overview
This guide provides a quick reference for using the BullMQ job queue system in Medicine Man.

## Installation (Already Complete)
```bash
npm install bullmq
```

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                    Medicine Man API                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │   Backup     │    │    Scan      │    │  Update   │ │
│  │   Routes     │    │   Routes     │    │  Routes   │ │
│  └──────┬───────┘    └──────┬───────┘    └─────┬─────┘ │
│         │                   │                    │       │
│         ├───────────────────┴────────────────────┤       │
│         │          Queue Manager                 │       │
│         │     (BullMQ + Redis)                  │       │
│         └───────────────────┬────────────────────┘       │
│                             │                            │
│  ┌──────────────────────────┴──────────────────────┐    │
│  │                   Workers                        │    │
│  ├──────────────┬──────────────────┬───────────────┤    │
│  │  Backup      │     Scan         │    Update     │    │
│  │  Worker      │     Worker       │    Worker     │    │
│  │  (x2)        │     (x5)         │    (x1)       │    │
│  └──────────────┴──────────────────┴───────────────┘    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

## Quick Reference

### Queue Names
- `backup-queue` - Backup operations
- `scan-queue` - Server scanning operations
- `update-queue` - Server updates

### Job Types
- `backup:manual` - User-initiated backup
- `backup:scheduled` - Scheduled backup
- `scan:full` - Full server scan
- `scan:quick` - Quick connectivity scan
- `update:server` - Server software update

### API Endpoints

#### Job Management
```http
GET    /api/jobs/:id              # Get job status
GET    /api/jobs                  # List all jobs
DELETE /api/jobs/:id              # Remove job
POST   /api/jobs/:id/retry        # Retry failed job
GET    /api/jobs/stats/all        # Job statistics
```

#### Queue Metrics
```http
GET    /api/metrics/queues        # Queue statistics
GET    /api/metrics/system        # System health (includes queues)
```

## Common Operations

### 1. Trigger a Backup
```bash
curl -X POST http://localhost:3000/api/servers/{serverId}/backup \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_type": "full",
    "compression": true,
    "encryption": false
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "backupId": "uuid",
    "jobId": "123",
    "status": "pending"
  }
}
```

### 2. Trigger a Scan
```bash
curl -X POST http://localhost:3000/api/servers/{serverId}/scan \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"scan_type": "full"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scanId": "uuid",
    "jobId": "456",
    "status": "pending"
  }
}
```

### 3. Check Job Status
```bash
curl http://localhost:3000/api/jobs/123 \
  -H "Authorization: Bearer {token}"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123",
    "state": "active",
    "progress": 45,
    "attempts": 1,
    "maxAttempts": 3
  }
}
```

### 4. List All Jobs
```bash
# All jobs
curl http://localhost:3000/api/jobs \
  -H "Authorization: Bearer {token}"

# Filter by queue
curl http://localhost:3000/api/jobs?queue=backup \
  -H "Authorization: Bearer {token}"

# Filter by state
curl http://localhost:3000/api/jobs?state=failed \
  -H "Authorization: Bearer {token}"

# Combined filters
curl http://localhost:3000/api/jobs?queue=backup&state=completed&limit=20 \
  -H "Authorization: Bearer {token}"
```

### 5. Get Queue Metrics
```bash
curl http://localhost:3000/api/metrics/queues \
  -H "Authorization: Bearer {token}"
```

**Response:**
```json
{
  "success": true,
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
    "health": {
      "status": "healthy",
      "message": "All queues operating normally"
    }
  }
}
```

### 6. Retry Failed Job
```bash
curl -X POST http://localhost:3000/api/jobs/123/retry \
  -H "Authorization: Bearer {token}"
```

### 7. Remove Completed Job
```bash
curl -X DELETE http://localhost:3000/api/jobs/123 \
  -H "Authorization: Bearer {token}"
```

## Job States

Jobs progress through these states:

```
waiting → active → completed
                 → failed → [retry] → active
                                    → failed (permanent)
```

- **waiting**: Job queued, waiting for worker
- **active**: Job currently being processed
- **completed**: Job finished successfully
- **failed**: Job failed (may retry)
- **delayed**: Job scheduled for future execution

## Progress Tracking

Jobs report progress from 0-100:

**Backup Progress:**
- 10% - Job started
- 20% - Server verified
- 30% - Backup record created
- 40% - Backup execution started
- 90% - Backup completed
- 100% - Record updated

**Scan Progress:**
- 10% - Job started
- 20% - Server verified
- 30% - Scan record created
- 40-80% - Scan execution (varies by type)
- 90% - Results stored
- 100% - Scan complete

## Error Handling

### Automatic Retries
- Jobs automatically retry 3 times
- Exponential backoff: 5s → 10s → 20s
- After 3 failures, job marked as permanently failed

### Manual Retry
```bash
# Retry a failed job
POST /api/jobs/{jobId}/retry
```

### Check Failed Jobs
```bash
# List all failed jobs
GET /api/jobs?state=failed

# Get specific failed job details
GET /api/jobs/{jobId}
```

## Monitoring

### Health Check
```bash
# Quick health check
curl http://localhost:3000/health

# Detailed system metrics (includes queues)
curl http://localhost:3000/api/metrics/system \
  -H "Authorization: Bearer {token}"
```

### Log Monitoring
```bash
# View all logs
docker logs medicine-man-backend

# Filter queue logs
docker logs medicine-man-backend | grep "queue"

# Filter worker logs
docker logs medicine-man-backend | grep "worker"

# Filter job logs
docker logs medicine-man-backend | grep "job"
```

### Redis Monitoring
```bash
# Connect to Redis
docker exec -it medicine-man-redis redis-cli

# Check queue keys
KEYS *bull:backup-queue*
KEYS *bull:scan-queue*

# Check memory usage
INFO memory

# Check connected clients
CLIENT LIST
```

## Troubleshooting

### Jobs Stuck in Waiting
```bash
# Check queue stats
curl http://localhost:3000/api/metrics/queues \
  -H "Authorization: Bearer {token}"

# Check logs for worker errors
docker logs medicine-man-backend | grep "worker"

# Restart server to restart workers
docker restart medicine-man-backend
```

### High Failure Rate
```bash
# List failed jobs
curl http://localhost:3000/api/jobs?state=failed&limit=50 \
  -H "Authorization: Bearer {token}"

# Check specific failure
curl http://localhost:3000/api/jobs/{failedJobId} \
  -H "Authorization: Bearer {token}"

# Review logs
docker logs medicine-man-backend | grep "failed"
```

### Queue Too Large
```bash
# Check queue size
curl http://localhost:3000/api/metrics/queues \
  -H "Authorization: Bearer {token}"

# Pause queue (admin only)
# Requires direct QueueManager access

# Resume queue
# Requires direct QueueManager access
```

## Configuration

### Worker Concurrency
Located in worker files:
- `src/queues/workers/backupWorker.ts` - Set `CONCURRENCY = 2`
- `src/queues/workers/scanWorker.ts` - Set `CONCURRENCY = 5`

### Retry Configuration
Located in `src/queues/queueManager.ts`:
```typescript
defaultJobOptions: {
  attempts: 3,              // Number of retries
  backoff: {
    type: 'exponential',
    delay: 5000,            // Initial delay (ms)
  },
  removeOnComplete: {
    age: 86400 * 7,         // 7 days
    count: 1000,            // Keep last 1000
  },
  removeOnFail: {
    age: 86400 * 7,         // 7 days
  },
}
```

### Queue Priorities
Located in `src/queues/queueManager.ts`:
```typescript
export enum JobPriority {
  CRITICAL = 1,   // Updates
  HIGH = 2,       // Backups
  NORMAL = 3,     // Scans
  LOW = 4,        // Cleanup
}
```

## Performance Tuning

### Increase Throughput
1. Increase worker concurrency:
   ```typescript
   const CONCURRENCY = 5; // Increase from 2
   ```

2. Deploy multiple worker instances (horizontal scaling)

3. Optimize Redis:
   ```conf
   # redis.conf
   maxmemory 2gb
   maxmemory-policy allkeys-lru
   ```

### Reduce Memory Usage
1. Decrease job retention:
   ```typescript
   removeOnComplete: {
     age: 86400 * 3,  // 3 days instead of 7
     count: 500,      // 500 jobs instead of 1000
   }
   ```

2. Clean old jobs regularly:
   ```typescript
   await QueueManager.cleanOldJobs();
   ```

## Integration Examples

### TypeScript/JavaScript

```typescript
import { backupQueue, JobType, JobPriority } from './queues/queueManager';

// Enqueue a backup job
const job = await backupQueue.add(
  JobType.BACKUP_MANUAL,
  {
    serverId: 'server-uuid',
    backupId: 'backup-uuid',
    userId: 'user-uuid',
    options: {
      backup_type: 'full',
      compression: true,
      encryption: false,
    },
    isScheduled: false,
  },
  {
    priority: JobPriority.HIGH,
    attempts: 3,
  }
);

console.log('Job enqueued:', job.id);

// Check job status
const jobStatus = await job.getState();
const progress = job.progress;
console.log(`Job ${job.id}: ${jobStatus} (${progress}%)`);
```

### REST API (curl)

```bash
# Set your token
TOKEN="your-jwt-token"
BASE_URL="http://localhost:3000"

# Function to trigger backup
trigger_backup() {
  local server_id=$1
  curl -X POST "$BASE_URL/api/servers/$server_id/backup" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"backup_type": "full"}'
}

# Function to check job status
check_job() {
  local job_id=$1
  curl "$BASE_URL/api/jobs/$job_id" \
    -H "Authorization: Bearer $TOKEN"
}

# Usage
trigger_backup "server-uuid-here"
check_job "job-id-here"
```

### Python

```python
import requests
import time

BASE_URL = "http://localhost:3000"
TOKEN = "your-jwt-token"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# Trigger a scan
response = requests.post(
    f"{BASE_URL}/api/servers/server-uuid/scan",
    json={"scan_type": "full"},
    headers=headers
)
data = response.json()
job_id = data['data']['jobId']

# Poll for completion
while True:
    response = requests.get(
        f"{BASE_URL}/api/jobs/{job_id}",
        headers=headers
    )
    job = response.json()['data']

    print(f"Job {job_id}: {job['state']} ({job['progress']}%)")

    if job['state'] in ['completed', 'failed']:
        break

    time.sleep(5)  # Wait 5 seconds before checking again
```

## Best Practices

1. **Monitor Queue Sizes**: Alert if waiting > 100
2. **Track Failed Jobs**: Review failures weekly
3. **Clean Old Jobs**: Run cleanup monthly
4. **Check Worker Health**: Monitor worker logs daily
5. **Use Priorities**: Set appropriate job priorities
6. **Test Retries**: Verify retry logic works
7. **Document Jobs**: Add clear job descriptions
8. **Handle Errors**: Implement proper error handling
9. **Log Everything**: Use structured logging
10. **Monitor Redis**: Track memory and performance

## Support Resources

- Full Documentation: `BULLMQ_IMPLEMENTATION.md`
- Implementation Details: `IMPLEMENTATION_SUMMARY.md`
- BullMQ Docs: https://docs.bullmq.io/
- Redis Docs: https://redis.io/docs/

## Quick Debugging

```bash
# 1. Check if workers are running
docker logs medicine-man-backend | grep "worker ready"

# 2. Check queue initialization
docker logs medicine-man-backend | grep "queue manager"

# 3. Check for errors
docker logs medicine-man-backend | grep "error" | tail -20

# 4. Check Redis connection
docker logs medicine-man-backend | grep "Redis"

# 5. Monitor real-time logs
docker logs -f medicine-man-backend

# 6. Check queue metrics
curl http://localhost:3000/api/metrics/queues \
  -H "Authorization: Bearer $TOKEN" | jq

# 7. Check system health
curl http://localhost:3000/api/metrics/system \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

**Quick Start Version**: 1.0
**Last Updated**: 2025-01-04
**For**: Medicine Man v1.0+
