# Backup Restore API Documentation

## Overview

The Backup Restore API provides comprehensive functionality for restoring backups to servers, including integrity verification, selective restore, rollback capability, and detailed progress tracking.

## Features

- **Full and Selective Restore**: Restore entire backups or select specific services
- **Integrity Verification**: Verify backup files before restore to ensure data integrity
- **Automatic Rollback**: Create pre-restore snapshots and automatically rollback on failure
- **Progress Tracking**: Real-time progress updates with detailed audit logs
- **Health Checks**: Verify services are healthy after restore
- **Service Dependency Management**: Properly order service shutdown and startup

## API Endpoints

### 1. Restore Backup

Restore a backup to its original server.

**Endpoint:** `POST /api/backups/:id/restore`

**Authentication:** Required (JWT Token)

**Parameters:**
- `id` (path parameter): UUID of the backup to restore

**Request Body:**
```json
{
  "restoreType": "full",
  "selectedServices": ["service1", "service2"],
  "verifyIntegrity": true,
  "createRollbackPoint": true,
  "skipHealthChecks": false
}
```

**Body Fields:**
- `restoreType` (required): Either `"full"` or `"selective"`
- `selectedServices` (optional): Array of service IDs/names to restore (required if `restoreType` is `"selective"`)
- `verifyIntegrity` (optional, default: `true`): Verify backup file integrity before restore
- `createRollbackPoint` (optional, default: `true`): Create a snapshot before restore for rollback capability
- `skipHealthChecks` (optional, default: `false`): Skip post-restore health checks

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "message": "Backup restored successfully",
  "data": {
    "restoreJobId": "uuid-here",
    "servicesRestored": ["service1", "service2"],
    "servicesFailed": [],
    "duration": 45000,
    "rolledBack": false
  }
}
```

**Response (Failure - 500 Internal Server Error):**
```json
{
  "success": false,
  "message": "Restore failed: Service restore failed. System rolled back to previous state.",
  "error": "Internal Server Error"
}
```

**Example cURL:**
```bash
curl -X POST https://api.example.com/api/backups/123e4567-e89b-12d3-a456-426614174000/restore \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "restoreType": "full",
    "verifyIntegrity": true,
    "createRollbackPoint": true
  }'
```

---

### 2. List Restore Jobs

Get a list of all restore jobs for the authenticated user.

**Endpoint:** `GET /api/backups/restore-jobs`

**Authentication:** Required (JWT Token)

**Query Parameters:**
- `limit` (optional, default: 50, max: 100): Maximum number of results to return

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "message": "Restore jobs retrieved successfully",
  "data": [
    {
      "id": "uuid-here",
      "backup_id": "uuid-here",
      "server_id": "uuid-here",
      "restore_type": "full",
      "status": "completed",
      "progress_percentage": 100,
      "current_step": "Restore completed successfully",
      "services_to_restore": ["service1", "service2"],
      "services_restored": ["service1", "service2"],
      "services_failed": [],
      "started_at": "2025-11-04T10:00:00Z",
      "completed_at": "2025-11-04T10:05:30Z",
      "server_name": "Production Server",
      "server_ip": "192.168.1.100"
    }
  ],
  "count": 1
}
```

**Example cURL:**
```bash
curl -X GET "https://api.example.com/api/backups/restore-jobs?limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 3. Get Restore Job Status

Get detailed status and audit logs for a specific restore job.

**Endpoint:** `GET /api/backups/restore-jobs/:id`

**Authentication:** Required (JWT Token)

**Parameters:**
- `id` (path parameter): UUID of the restore job

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "message": "Restore job status retrieved successfully",
  "data": {
    "id": "uuid-here",
    "backup_id": "uuid-here",
    "server_id": "uuid-here",
    "restore_type": "full",
    "status": "completed",
    "progress_percentage": 100,
    "current_step": "Restore completed successfully",
    "services_to_restore": ["mysql", "nginx"],
    "services_restored": ["mysql", "nginx"],
    "services_failed": [],
    "rollback_path": "/backup/rollback_1699084800000.tar.gz",
    "started_at": "2025-11-04T10:00:00Z",
    "completed_at": "2025-11-04T10:05:30Z",
    "backup_type": "full",
    "server_name": "Production Server",
    "server_ip": "192.168.1.100",
    "audit_logs": [
      {
        "step_number": 1,
        "step_name": "verify_integrity",
        "status": "completed",
        "message": "Backup integrity verified successfully",
        "started_at": "2025-11-04T10:00:00Z",
        "completed_at": "2025-11-04T10:00:15Z",
        "duration_ms": 15000
      },
      {
        "step_number": 2,
        "step_name": "create_rollback",
        "status": "completed",
        "message": "Rollback point created: /backup/rollback_1699084800000.tar.gz",
        "started_at": "2025-11-04T10:00:15Z",
        "completed_at": "2025-11-04T10:01:00Z",
        "duration_ms": 45000
      }
    ]
  }
}
```

**Example cURL:**
```bash
curl -X GET https://api.example.com/api/backups/restore-jobs/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 4. Verify Backup Integrity

Verify backup file integrity without performing a restore.

**Endpoint:** `POST /api/backups/:id/verify`

**Authentication:** Required (JWT Token)

**Parameters:**
- `id` (path parameter): UUID of the backup to verify

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "message": "Backup is valid",
  "data": {
    "backupId": "uuid-here",
    "isValid": true,
    "filePath": "/backups/server_1699084800000.tar.gz",
    "fileSize": 1073741824
  }
}
```

**Response (Validation Failed - 200 OK):**
```json
{
  "success": true,
  "message": "Backup verification failed",
  "data": {
    "backupId": "uuid-here",
    "isValid": false,
    "filePath": "/backups/server_1699084800000.tar.gz",
    "fileSize": 1073741824
  }
}
```

**Example cURL:**
```bash
curl -X POST https://api.example.com/api/backups/123e4567-e89b-12d3-a456-426614174000/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 5. Preview Restore

Preview what will be restored without executing the restore operation.

**Endpoint:** `GET /api/backups/:id/restore-preview`

**Authentication:** Required (JWT Token)

**Parameters:**
- `id` (path parameter): UUID of the backup

**Query Parameters:**
- `restoreType` (optional, default: "full"): Either "full" or "selective"
- `selectedServices` (optional): Comma-separated list of service IDs/names (for selective preview)

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "message": "Restore preview generated successfully",
  "data": {
    "backup": {
      "id": "uuid-here",
      "backupType": "full",
      "createdAt": "2025-11-04T09:00:00Z",
      "fileSize": 1073741824,
      "serverName": "Production Server"
    },
    "restoreType": "full",
    "services": [
      {
        "id": "uuid-here",
        "name": "mysql",
        "type": "docker",
        "status": "running",
        "configPaths": ["/etc/mysql"],
        "dataPaths": ["/var/lib/mysql"],
        "backupPriority": 10
      },
      {
        "id": "uuid-here",
        "name": "nginx",
        "type": "docker",
        "status": "running",
        "configPaths": ["/etc/nginx"],
        "dataPaths": ["/var/www"],
        "backupPriority": 5
      }
    ],
    "servicesCount": 2,
    "estimatedDuration": 60
  }
}
```

**Example cURL:**
```bash
curl -X GET "https://api.example.com/api/backups/123e4567-e89b-12d3-a456-426614174000/restore-preview?restoreType=selective&selectedServices=mysql,nginx" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Restore Workflow

The restore process follows these steps:

1. **Validation**: Verify backup exists and user has access
2. **Create Restore Job**: Initialize tracking record in database
3. **Verify Integrity** (optional): Check backup file integrity
4. **Create Rollback Point** (optional): Snapshot current state for rollback
5. **Stop Services**: Gracefully stop services in dependency order
6. **Restore Data**: Extract and restore backup data to services
7. **Restart Services**: Start services in proper dependency order
8. **Health Checks** (optional): Verify services are healthy
9. **Complete or Rollback**: Mark as complete or rollback on failure

## Restore Job States

- `pending`: Job created, not yet started
- `preparing`: Preparing for restore operation
- `stopping_services`: Stopping affected services
- `verifying`: Verifying backup integrity
- `restoring`: Actively restoring data
- `restarting_services`: Restarting services
- `completed`: Restore completed successfully
- `failed`: Restore failed (may not be rolled back)
- `rolled_back`: Restore failed and system rolled back to previous state

## Error Handling

The restore system includes comprehensive error handling:

1. **Pre-flight Validation**: Validates backup exists, is complete, and user has access
2. **Integrity Checks**: Verifies backup files are not corrupted
3. **Rollback on Failure**: Automatically restores previous state if restore fails (when enabled)
4. **Detailed Error Logging**: All errors are logged to audit logs and restore job records
5. **Service Recovery**: Attempts to restart services even if restore fails

## Security Considerations

1. **Authentication**: All endpoints require valid JWT authentication
2. **Authorization**: Users can only restore backups for servers they own
3. **Audit Logging**: All restore operations are logged to audit logs
4. **SSH Security**: Uses existing encrypted SSH credentials
5. **Data Integrity**: Verifies backup integrity before restore

## Best Practices

1. **Always Verify**: Use `verifyIntegrity: true` before restoring critical backups
2. **Create Rollback Points**: Keep `createRollbackPoint: true` for production restores
3. **Test Restores**: Regularly test restore operations on non-production systems
4. **Monitor Progress**: Poll restore job status endpoint for real-time updates
5. **Selective Restore**: Use selective restore for faster recovery of specific services
6. **Health Checks**: Enable health checks to verify successful restoration

## Database Schema

### restore_jobs Table

Tracks restore operations with progress and rollback support.

```sql
CREATE TABLE restore_jobs (
    id UUID PRIMARY KEY,
    backup_id UUID REFERENCES backups(id),
    server_id UUID REFERENCES servers(id),
    user_id UUID REFERENCES users(id),
    restore_type VARCHAR(50),
    status VARCHAR(50),
    progress_percentage INTEGER,
    current_step VARCHAR(255),
    services_to_restore TEXT[],
    services_restored TEXT[],
    services_failed TEXT[],
    rollback_path TEXT,
    error_message TEXT,
    metadata JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP
);
```

### restore_audit_logs Table

Detailed step-by-step logging for restore operations.

```sql
CREATE TABLE restore_audit_logs (
    id UUID PRIMARY KEY,
    restore_job_id UUID REFERENCES restore_jobs(id),
    step_number INTEGER,
    step_name VARCHAR(255),
    status VARCHAR(50),
    message TEXT,
    details JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    created_at TIMESTAMP
);
```

## Example Usage Scenarios

### Scenario 1: Full Restore with Verification

```bash
# Step 1: Preview what will be restored
curl -X GET https://api.example.com/api/backups/${BACKUP_ID}/restore-preview \
  -H "Authorization: Bearer ${TOKEN}"

# Step 2: Verify backup integrity
curl -X POST https://api.example.com/api/backups/${BACKUP_ID}/verify \
  -H "Authorization: Bearer ${TOKEN}"

# Step 3: Perform full restore
curl -X POST https://api.example.com/api/backups/${BACKUP_ID}/restore \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "restoreType": "full",
    "verifyIntegrity": true,
    "createRollbackPoint": true
  }'

# Step 4: Monitor progress
curl -X GET https://api.example.com/api/backups/restore-jobs/${RESTORE_JOB_ID} \
  -H "Authorization: Bearer ${TOKEN}"
```

### Scenario 2: Selective Restore (Database Only)

```bash
# Restore only the MySQL service
curl -X POST https://api.example.com/api/backups/${BACKUP_ID}/restore \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "restoreType": "selective",
    "selectedServices": ["mysql"],
    "verifyIntegrity": true,
    "createRollbackPoint": true
  }'
```

### Scenario 3: Quick Restore (Skip Safety Features)

```bash
# Fast restore without verification or rollback point
# WARNING: Only use in non-critical scenarios
curl -X POST https://api.example.com/api/backups/${BACKUP_ID}/restore \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "restoreType": "full",
    "verifyIntegrity": false,
    "createRollbackPoint": false,
    "skipHealthChecks": true
  }'
```

## Troubleshooting

### Restore Job Stuck in "running" State

**Cause**: Network interruption or SSH connection lost

**Solution**:
1. Check restore job audit logs for last completed step
2. Manually verify server state via SSH
3. Restart failed services manually if needed
4. Create a new restore job for failed services

### Restore Failed with "Backup file not found"

**Cause**: Backup file was deleted or moved

**Solution**:
1. Verify backup file exists on the backup server
2. Check backup record in database for correct file path
3. Use a different backup if file is irretrievable

### Services Won't Start After Restore

**Cause**: Data corruption or configuration issues

**Solution**:
1. Check service logs for specific errors
2. If rollback was created, manually restore from rollback point
3. Verify restored file permissions and ownership
4. Check for disk space issues

## Rate Limits

- Restore operations: 10 per hour per user
- Status checks: 100 per minute per user
- Verification: 20 per hour per user

## Support

For issues or questions:
- Check audit logs: `GET /api/audit`
- Review restore job details: `GET /api/backups/restore-jobs/:id`
- Contact system administrator

## Version History

- **v1.0.0** (2025-11-04): Initial release
  - Full restore functionality
  - Selective restore
  - Integrity verification
  - Automatic rollback
  - Progress tracking
  - Health checks
