# Backup Restore Testing Guide

## Overview

This document provides a comprehensive testing approach for the backup restore functionality, including unit tests, integration tests, and manual testing procedures.

## Test Environment Setup

### Prerequisites

1. PostgreSQL database with schema migrated (run migration 011_restore_jobs.sql)
2. Test server with SSH access
3. Test backup files
4. Valid JWT authentication token

### Database Setup

```bash
# Run migration
psql -U postgres -d medicine_man < migrations/011_restore_jobs.sql

# Verify tables created
psql -U postgres -d medicine_man -c "\dt restore*"
```

## Unit Testing

### Test Cases for BackupRestoreService

#### 1. Backup Validation Tests

**Test: validateBackup - Valid backup**
```typescript
it('should validate backup exists and user has access', async () => {
  const backup = await restoreService.validateBackup(backupId, userId);
  expect(backup).toBeDefined();
  expect(backup.id).toBe(backupId);
  expect(backup.user_id).toBe(userId);
});
```

**Test: validateBackup - Invalid backup ID**
```typescript
it('should return null for non-existent backup', async () => {
  const backup = await restoreService.validateBackup('invalid-uuid', userId);
  expect(backup).toBeNull();
});
```

**Test: validateBackup - Unauthorized access**
```typescript
it('should return null when user does not own backup', async () => {
  const backup = await restoreService.validateBackup(backupId, 'other-user-id');
  expect(backup).toBeNull();
});
```

#### 2. Integrity Verification Tests

**Test: verifyBackupIntegrity - Valid backup file**
```typescript
it('should verify backup file integrity successfully', async () => {
  const isValid = await restoreService.verifyBackupIntegrity(mockBackup);
  expect(isValid).toBe(true);
});
```

**Test: verifyBackupIntegrity - Missing file**
```typescript
it('should fail verification for missing backup file', async () => {
  const backupWithMissingFile = { ...mockBackup, file_path: '/nonexistent/path' };
  const isValid = await restoreService.verifyBackupIntegrity(backupWithMissingFile);
  expect(isValid).toBe(false);
});
```

**Test: verifyBackupIntegrity - Size mismatch**
```typescript
it('should fail verification when file size does not match', async () => {
  const backupWithWrongSize = { ...mockBackup, file_size: 99999 };
  const isValid = await restoreService.verifyBackupIntegrity(backupWithWrongSize);
  expect(isValid).toBe(false);
});
```

#### 3. Restore Job Creation Tests

**Test: createRestoreJob - Full restore**
```typescript
it('should create restore job with correct parameters', async () => {
  const jobId = await restoreService.createRestoreJob(
    backupId,
    serverId,
    userId,
    { restoreType: 'full', verifyIntegrity: true }
  );
  expect(jobId).toBeDefined();

  // Verify job in database
  const job = await pool.query('SELECT * FROM restore_jobs WHERE id = $1', [jobId]);
  expect(job.rows[0].restore_type).toBe('full');
  expect(job.rows[0].status).toBe('pending');
});
```

**Test: createRestoreJob - Selective restore**
```typescript
it('should create selective restore job with selected services', async () => {
  const options = {
    restoreType: 'selective' as const,
    selectedServices: ['mysql', 'nginx']
  };
  const jobId = await restoreService.createRestoreJob(backupId, serverId, userId, options);

  const job = await pool.query('SELECT * FROM restore_jobs WHERE id = $1', [jobId]);
  expect(job.rows[0].restore_type).toBe('selective');
  expect(JSON.parse(job.rows[0].metadata).selectedServices).toEqual(['mysql', 'nginx']);
});
```

#### 4. Service Management Tests

**Test: stopServices - Success**
```typescript
it('should stop all services in correct order', async () => {
  const services = [
    { serviceName: 'nginx', serviceType: 'docker', dependencies: [] },
    { serviceName: 'mysql', serviceType: 'docker', dependencies: [] }
  ];

  const stoppedServices = await restoreService.stopServices(mockSSHConnection, services);
  expect(stoppedServices).toHaveLength(2);
  expect(stoppedServices).toContain('nginx');
  expect(stoppedServices).toContain('mysql');
});
```

**Test: restartServices - Success with health checks**
```typescript
it('should restart services and verify health', async () => {
  const services = [
    {
      serviceName: 'mysql',
      serviceType: 'docker',
      healthCheck: 'docker exec mysql mysqladmin ping',
      dependencies: []
    }
  ];

  const restartedServices = await restoreService.restartServices(
    mockSSHConnection,
    services,
    true // performHealthChecks
  );

  expect(restartedServices).toContain('mysql');
});
```

#### 5. Rollback Tests

**Test: createRollbackPoint - Success**
```typescript
it('should create rollback point successfully', async () => {
  const services = [
    { serviceName: 'mysql', serviceType: 'docker', dependencies: [] }
  ];

  const rollbackPath = await restoreService.createRollbackPoint(
    mockSSHConnection,
    mockServer,
    services
  );

  expect(rollbackPath).toBeDefined();
  expect(rollbackPath).toMatch(/^\/backup\/rollback_\d+\.tar\.gz$/);
});
```

**Test: performRollback - Success**
```typescript
it('should rollback to previous state successfully', async () => {
  const rollbackPath = '/backup/rollback_123456789.tar.gz';
  const services = [
    { serviceName: 'mysql', serviceType: 'docker', dependencies: [] }
  ];

  await expect(
    restoreService.performRollback(mockSSHConnection, mockServer, rollbackPath, services, restoreJobId)
  ).resolves.not.toThrow();

  // Verify audit log entry
  const logs = await pool.query(
    'SELECT * FROM restore_audit_logs WHERE restore_job_id = $1 AND step_name = $2',
    [restoreJobId, 'rollback']
  );
  expect(logs.rows).toHaveLength(2); // started and completed
});
```

### Test Cases for API Routes

#### 1. POST /api/backups/:id/restore

**Test: Full restore - Success**
```typescript
it('should restore backup successfully', async () => {
  const response = await request(app)
    .post(`/api/backups/${backupId}/restore`)
    .set('Authorization', `Bearer ${validToken}`)
    .send({
      restoreType: 'full',
      verifyIntegrity: true,
      createRollbackPoint: true
    })
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.restoreJobId).toBeDefined();
  expect(response.body.data.servicesRestored).toBeInstanceOf(Array);
});
```

**Test: Selective restore - Success**
```typescript
it('should restore selected services only', async () => {
  const response = await request(app)
    .post(`/api/backups/${backupId}/restore`)
    .set('Authorization', `Bearer ${validToken}`)
    .send({
      restoreType: 'selective',
      selectedServices: ['mysql']
    })
    .expect(200);

  expect(response.body.data.servicesRestored).toEqual(['mysql']);
});
```

**Test: Invalid restore type**
```typescript
it('should reject invalid restore type', async () => {
  const response = await request(app)
    .post(`/api/backups/${backupId}/restore`)
    .set('Authorization', `Bearer ${validToken}`)
    .send({
      restoreType: 'invalid'
    })
    .expect(400);

  expect(response.body.success).toBe(false);
});
```

**Test: Selective restore without services**
```typescript
it('should reject selective restore without selected services', async () => {
  const response = await request(app)
    .post(`/api/backups/${backupId}/restore`)
    .set('Authorization', `Bearer ${validToken}`)
    .send({
      restoreType: 'selective'
    })
    .expect(400);

  expect(response.body.success).toBe(false);
});
```

**Test: Unauthorized access**
```typescript
it('should reject restore without authentication', async () => {
  await request(app)
    .post(`/api/backups/${backupId}/restore`)
    .send({ restoreType: 'full' })
    .expect(401);
});
```

#### 2. GET /api/backups/restore-jobs

**Test: List restore jobs - Success**
```typescript
it('should list restore jobs for authenticated user', async () => {
  const response = await request(app)
    .get('/api/backups/restore-jobs')
    .set('Authorization', `Bearer ${validToken}`)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data).toBeInstanceOf(Array);
  expect(response.body.count).toBeGreaterThanOrEqual(0);
});
```

**Test: Limit parameter**
```typescript
it('should respect limit parameter', async () => {
  const response = await request(app)
    .get('/api/backups/restore-jobs?limit=5')
    .set('Authorization', `Bearer ${validToken}`)
    .expect(200);

  expect(response.body.data.length).toBeLessThanOrEqual(5);
});
```

#### 3. GET /api/backups/restore-jobs/:id

**Test: Get restore job status - Success**
```typescript
it('should return detailed restore job status', async () => {
  const response = await request(app)
    .get(`/api/backups/restore-jobs/${restoreJobId}`)
    .set('Authorization', `Bearer ${validToken}`)
    .expect(200);

  expect(response.body.data.id).toBe(restoreJobId);
  expect(response.body.data.audit_logs).toBeInstanceOf(Array);
});
```

**Test: Non-existent job**
```typescript
it('should return 404 for non-existent restore job', async () => {
  await request(app)
    .get('/api/backups/restore-jobs/00000000-0000-0000-0000-000000000000')
    .set('Authorization', `Bearer ${validToken}`)
    .expect(404);
});
```

#### 4. POST /api/backups/:id/verify

**Test: Verify valid backup**
```typescript
it('should verify backup successfully', async () => {
  const response = await request(app)
    .post(`/api/backups/${backupId}/verify`)
    .set('Authorization', `Bearer ${validToken}`)
    .expect(200);

  expect(response.body.data.isValid).toBe(true);
  expect(response.body.data.backupId).toBe(backupId);
});
```

#### 5. GET /api/backups/:id/restore-preview

**Test: Generate restore preview**
```typescript
it('should generate restore preview successfully', async () => {
  const response = await request(app)
    .get(`/api/backups/${backupId}/restore-preview?restoreType=full`)
    .set('Authorization', `Bearer ${validToken}`)
    .expect(200);

  expect(response.body.data.backup).toBeDefined();
  expect(response.body.data.services).toBeInstanceOf(Array);
  expect(response.body.data.servicesCount).toBeGreaterThan(0);
});
```

## Integration Testing

### End-to-End Restore Flow

```typescript
describe('Complete Restore Workflow', () => {
  it('should complete full restore workflow', async () => {
    // Step 1: Create a test backup
    const backup = await createTestBackup(serverId);

    // Step 2: Verify backup integrity
    const verifyResponse = await request(app)
      .post(`/api/backups/${backup.id}/verify`)
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(verifyResponse.body.data.isValid).toBe(true);

    // Step 3: Preview restore
    const previewResponse = await request(app)
      .get(`/api/backups/${backup.id}/restore-preview`)
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(previewResponse.body.data.servicesCount).toBeGreaterThan(0);

    // Step 4: Execute restore
    const restoreResponse = await request(app)
      .post(`/api/backups/${backup.id}/restore`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        restoreType: 'full',
        verifyIntegrity: true,
        createRollbackPoint: true
      })
      .expect(200);

    const restoreJobId = restoreResponse.body.data.restoreJobId;

    // Step 5: Monitor progress
    const statusResponse = await request(app)
      .get(`/api/backups/restore-jobs/${restoreJobId}`)
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(statusResponse.body.data.status).toMatch(/^(pending|preparing|completed)$/);

    // Step 6: Verify audit logs
    const auditResponse = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${validToken}`)
      .query({ action: 'BACKUP_RESTORE_START' })
      .expect(200);

    expect(auditResponse.body.data.logs.length).toBeGreaterThan(0);
  });
});
```

## Manual Testing

### Test Scenario 1: Full Restore with Verification

**Prerequisites:**
- Running server with MySQL and Nginx containers
- Valid backup file in `/backups` directory

**Steps:**
1. Get backup ID from list endpoint
2. Verify backup integrity
3. Preview what will be restored
4. Execute full restore
5. Monitor progress via status endpoint
6. Verify services are running
7. Check data integrity

**Expected Results:**
- All services stopped and restarted successfully
- Data restored correctly
- Health checks pass
- Audit logs created

### Test Scenario 2: Selective Restore (Database Only)

**Prerequisites:**
- Running server with multiple services
- Backup containing multiple services

**Steps:**
1. Preview restore to see available services
2. Execute selective restore for MySQL only
3. Monitor progress
4. Verify only MySQL was stopped/restarted
5. Verify MySQL data restored

**Expected Results:**
- Only MySQL service affected
- Other services remain running
- MySQL data restored correctly

### Test Scenario 3: Restore with Automatic Rollback

**Prerequisites:**
- Running server
- Corrupted backup file (simulate failure)

**Steps:**
1. Execute restore with createRollbackPoint enabled
2. Let restore fail due to corrupted backup
3. Monitor status and verify rollback triggered
4. Check that services are in original state

**Expected Results:**
- Restore fails as expected
- Rollback executes automatically
- Services restored to pre-restore state
- Restore job status is 'rolled_back'

### Test Scenario 4: Large Backup Restore

**Prerequisites:**
- Large backup file (>1GB)
- Server with sufficient resources

**Steps:**
1. Execute full restore
2. Monitor progress percentage
3. Check audit logs for detailed step timing
4. Verify restore completes within expected timeframe

**Expected Results:**
- Progress updates correctly throughout restore
- All steps logged with timing
- Restore completes successfully
- No timeouts or connection issues

## Performance Testing

### Metrics to Measure

1. **Restore Duration**: Time from start to completion
2. **Service Downtime**: Time services are stopped
3. **Rollback Creation Time**: Time to create rollback point
4. **Health Check Time**: Time for all health checks to pass
5. **Database Operations**: Query performance for restore job updates

### Load Testing

```bash
# Concurrent restore operations
for i in {1..5}; do
  curl -X POST https://api.example.com/api/backups/${BACKUP_ID}/restore \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"restoreType": "full"}' &
done
wait
```

## Failure Testing

### Scenarios to Test

1. **SSH Connection Lost**: Disconnect SSH during restore
2. **Disk Space Full**: Fill disk during restore
3. **Service Start Failure**: Break service configuration before restore
4. **Database Connection Lost**: Kill database connection during job update
5. **Corrupted Backup File**: Use intentionally corrupted backup
6. **Missing Rollback Point**: Delete rollback file during rollback

### Expected Behaviors

- Graceful error handling
- Comprehensive error messages
- Audit logs capture failure details
- No data corruption
- Services can be manually recovered

## Security Testing

### Test Cases

1. **Authorization**: Attempt to restore another user's backup
2. **SQL Injection**: Send malicious service names
3. **Path Traversal**: Attempt to restore to unauthorized paths
4. **Rate Limiting**: Exceed restore operation limits
5. **JWT Validation**: Use expired/invalid tokens

## Regression Testing

### Test After Code Changes

1. Run full unit test suite
2. Execute integration tests
3. Perform manual smoke tests
4. Check audit logs for anomalies
5. Verify database schema migrations
6. Review error logs

## Test Data Setup

### Creating Test Backups

```bash
# Create test backup with known data
docker exec mysql mysqldump test_db > /tmp/test_backup.sql
tar czf test_backup.tar.gz /tmp/test_backup.sql

# Insert into database
psql -U postgres -d medicine_man << EOF
INSERT INTO backups (server_id, backup_type, status, file_path, file_size, metadata)
VALUES (
  '${SERVER_ID}',
  'full',
  'completed',
  '/backups/test_backup.tar.gz',
  $(stat -f%z test_backup.tar.gz),
  '{"test": true}'
);
EOF
```

## Monitoring During Tests

### Key Metrics to Watch

1. **Database Connections**: Monitor active connections
2. **Memory Usage**: Track memory consumption
3. **CPU Usage**: Monitor CPU during restore
4. **Network I/O**: Track data transfer rates
5. **Disk I/O**: Monitor disk read/write operations

### Logging

```bash
# Tail restore service logs
tail -f /var/log/medicine-man/restore.log | grep -E "(ERROR|WARN|INFO)"

# Monitor database logs
tail -f /var/log/postgresql/postgresql.log

# Watch restore job status
watch -n 2 'psql -U postgres -d medicine_man -c "SELECT id, status, progress_percentage, current_step FROM restore_jobs ORDER BY created_at DESC LIMIT 5"'
```

## Cleanup After Tests

```bash
# Remove test backups
rm -f /backups/test_backup_*.tar.gz

# Clean up test restore jobs
psql -U postgres -d medicine_man << EOF
DELETE FROM restore_audit_logs WHERE restore_job_id IN (
  SELECT id FROM restore_jobs WHERE metadata->>'test' = 'true'
);
DELETE FROM restore_jobs WHERE metadata->>'test' = 'true';
EOF
```

## Continuous Integration

### CI Pipeline Steps

1. Run unit tests
2. Run integration tests
3. Run security tests
4. Generate test coverage report
5. Deploy to staging environment
6. Run smoke tests on staging
7. Generate test report

### Test Coverage Goals

- Unit tests: >80% code coverage
- Integration tests: All critical paths
- Manual tests: All user scenarios
- Security tests: All endpoints

## Test Report Template

```markdown
## Restore Feature Test Report

**Date**: 2025-11-04
**Tester**: [Name]
**Environment**: [Staging/Production]

### Summary
- Total Tests: 45
- Passed: 43
- Failed: 2
- Skipped: 0

### Failed Tests
1. **Test Name**: Large backup restore
   **Reason**: Timeout after 10 minutes
   **Action**: Increase timeout threshold

2. **Test Name**: Concurrent restores
   **Reason**: Database connection pool exhausted
   **Action**: Increase pool size

### Performance Metrics
- Average restore time: 3m 45s
- Rollback creation time: 45s
- Service downtime: 2m 30s

### Recommendations
1. Optimize rollback creation for large datasets
2. Add more detailed progress updates
3. Improve error messages for network failures
```
