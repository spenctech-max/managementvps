# Medicine Man v1.0 - Implementation Plan with Agent Teams

**Date:** November 5, 2025
**Target:** Production-Ready v1.0 Release
**Estimated Effort:** 18-25 hours critical path
**Recommended Team:** 3-4 developers working in parallel

---

## Phase 1: Critical Fixes (MUST COMPLETE)
**Timeline:** 1-2 days
**Blocks Release:** YES

### Team Alpha: Build & Infrastructure (5-6 hours)

#### Agent: Build Engineer
**Tasks:**
1. Fix workspace dependencies
   ```bash
   cd /c/Users/Spenc/MMVPS/medicine-man
   rm -rf node_modules */node_modules */*/node_modules
   npm install
   ```
   - **Effort:** 5 minutes
   - **Validates:** `ls -la backend/node_modules/@medicine-man/shared`

2. Fix backend tsconfig.json
   ```json
   // backend/tsconfig.json - Add to compilerOptions:
   "rootDir": "./src"
   ```
   - **Effort:** 30 minutes (test build after)
   - **Validates:** `npm run build` outputs to `dist/index.js` not `dist/backend/src/index.js`

3. Update backend Dockerfile CMD
   ```dockerfile
   # backend/Dockerfile line 68:
   CMD ["node", "dist/index.js"]
   ```
   - **Effort:** 15 minutes
   - **Depends:** Complete task #2 first

4. Renumber migration file
   ```bash
   mv backend/migrations/015_add_ssh_key_columns.sql backend/migrations/016_add_ssh_key_columns.sql
   ```
   - **Effort:** 5 minutes
   - **Critical:** Must be done before any database migrations

5. Fix backend .env.example PORT value
   ```env
   # backend/.env.example line 17:
   PORT=3000  # Was 3001
   ```
   - **Effort:** 2 minutes

6. Standardize @types/node version
   ```json
   // shared/package.json:
   "@types/node": "^20.10.6"  // Was ^24.10.0
   ```
   - **Effort:** 5 minutes + `npm install`

**Total Alpha Team Effort:** 5-6 hours (including testing)

---

### Team Bravo: Backend Critical Features (8-10 hours)

#### Agent: Backend Developer #1 - Scanner Integration
**File:** `backend/src/queues/workers/scanWorker.ts`

**Current Issue (lines 101-107):**
```typescript
if (scanType === 'full') {
  summary = await this.performFullScan(server, job, options);  // Returns mock data!
}
```

**Fix Required:**
```typescript
import { BackupScanner } from '../../services/scanner';

class ScanWorker {
  private scanner: BackupScanner;

  constructor(pool, logger) {
    this.pool = pool;
    this.logger = logger;
    this.scanner = new BackupScanner(pool, logger);
  }

  async performFullScan(server, job, options) {
    // Remove mock data logic
    // Call real scanner:
    const scanResult = await this.scanner.scanServer(server.id, {
      scanType: 'full',
      checkServices: true,
      checkFilesystems: true,
      ...options
    });

    return scanResult;
  }
}
```

**Steps:**
1. Import BackupScanner service
2. Instantiate in worker constructor
3. Replace mock logic in `performFullScan()`, `performQuickScan()`, etc.
4. Update job progress callbacks
5. Test with real server

**Effort:** 3-4 hours
**Testing:** Create test server, trigger scan, verify real data returned

---

#### Agent: Backend Developer #2 - Manual Backup Endpoint
**File:** `backend/src/routes/backups.ts`

**Missing Endpoint:** `POST /api/backups`

**Implementation:**
```typescript
// Add to backups.ts
router.post(
  '/',
  validateRequest({
    body: z.object({
      server_id: z.string().uuid(),
      backup_paths: z.array(z.string()).min(1),
      description: z.string().optional(),
      options: z.object({
        compression: z.enum(['none', 'gzip', 'bzip2']).optional(),
        exclude_patterns: z.array(z.string()).optional(),
      }).optional(),
    }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { server_id, backup_paths, description, options } = req.body;
    const userId = req.user!.id;

    // Verify server ownership
    const server = await pool.query(
      'SELECT * FROM servers WHERE id = $1 AND user_id = $2',
      [server_id, userId]
    );

    if (server.rows.length === 0) {
      throw new NotFoundError('Server not found');
    }

    // Create backup job using BackupOrchestrator
    const orchestrator = new BackupOrchestrator(pool, logger, queueManager);
    const backup = await orchestrator.createManualBackup({
      serverId: server_id,
      userId,
      paths: backup_paths,
      description,
      options,
    });

    res.status(201).json({
      success: true,
      message: 'Backup job created',
      data: { backup },
    });
  })
);
```

**Steps:**
1. Add endpoint with Zod validation
2. Add server ownership check
3. Call BackupOrchestrator.createManualBackup()
4. Return job ID and initial status
5. Add Swagger documentation

**Effort:** 2-3 hours
**Testing:** cURL test + Postman collection

---

### Team Charlie: Frontend Critical Features (5-7 hours)

#### Agent: Frontend Developer #1 - Manual Backup UI
**File:** `frontend/src/pages/Backups.tsx`

**Add Component:**
```tsx
const CreateBackupDialog = ({ isOpen, onClose, servers }) => {
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [backupPaths, setBackupPaths] = useState<string[]>(['/']);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      await api.post('/backups', {
        server_id: selectedServer,
        backup_paths: backupPaths,
        description,
      });
      toast.success('Backup job created successfully');
      onClose();
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      {/* Modal UI with server select, path input, description */}
    </Dialog>
  );
};
```

**Add Button to Backups.tsx:**
```tsx
<button
  onClick={() => setShowCreateDialog(true)}
  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
>
  <Plus className="w-4 h-4 mr-2 inline" />
  Create Backup
</button>
```

**Effort:** 2-3 hours
**Testing:** Manual test with UI, verify backend call

---

#### Agent: Frontend Developer #2 - Backup Restore UI
**File:** `frontend/src/components/RestoreDialog.tsx` (NEW) + `frontend/src/pages/Backups.tsx`

**Create New Component:**
```tsx
// frontend/src/components/RestoreDialog.tsx
export const RestoreDialog = ({ backup, isOpen, onClose }) => {
  const [restorePath, setRestorePath] = useState(backup.backup_path);
  const [targetServer, setTargetServer] = useState(backup.server_id);
  const [options, setOptions] = useState({
    overwrite: false,
    preservePermissions: true,
  });

  const handleRestore = async () => {
    try {
      const response = await api.post(`/backups/${backup.id}/restore`, {
        target_server_id: targetServer,
        restore_path: restorePath,
        options,
      });

      toast.success('Restore job started');
      // Poll for status
      pollRestoreStatus(response.data.data.job_id);
    } catch (err) {
      toast.error(handleApiError(err));
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="bg-slate-900 p-6 rounded-lg max-w-2xl">
        <h2 className="text-xl font-bold mb-4">Restore Backup</h2>

        <div className="space-y-4">
          <div>
            <label>Target Server</label>
            <select value={targetServer} onChange={(e) => setTargetServer(e.target.value)}>
              {/* Server options */}
            </select>
          </div>

          <div>
            <label>Restore Path</label>
            <input
              type="text"
              value={restorePath}
              onChange={(e) => setRestorePath(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.overwrite}
                onChange={(e) => setOptions({...options, overwrite: e.target.checked})}
              />
              <span className="ml-2">Overwrite existing files</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.preservePermissions}
                onChange={(e) => setOptions({...options, preservePermissions: e.target.checked})}
              />
              <span className="ml-2">Preserve file permissions</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={handleRestore} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
            Start Restore
          </button>
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded">
            Cancel
          </button>
        </div>
      </div>
    </Dialog>
  );
};
```

**Add to Backups.tsx:**
```tsx
// Add restore button to each backup row
<button
  onClick={() => setRestoreBackup(backup)}
  className="text-green-400 hover:text-green-300"
  title="Restore backup"
>
  <RotateCcw className="w-4 h-4" />
</button>

{/* Add dialog at bottom */}
{restoreBackup && (
  <RestoreDialog
    backup={restoreBackup}
    isOpen={!!restoreBackup}
    onClose={() => setRestoreBackup(null)}
  />
)}
```

**Effort:** 4-5 hours
**Testing:** Create backup, restore to different path, verify files

---

### Team Delta: Security Critical (6-8 hours)

#### Agent: Security Engineer #1 - HTTPS Configuration
**Files:** `frontend/nginx.conf`, `docker-compose.yml`, certificate generation

**Steps:**

1. Generate self-signed certificates (development):
```bash
mkdir -p frontend/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout frontend/ssl/nginx-selfsigned.key \
  -out frontend/ssl/nginx-selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

2. Update `frontend/nginx.conf`:
```nginx
server {
    listen 8080;
    listen 8443 ssl http2;

    ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Redirect HTTP to HTTPS
    if ($scheme = http) {
        return 301 https://$server_name$request_uri;
    }

    # Existing configuration...
}
```

3. Update `frontend/Dockerfile`:
```dockerfile
COPY ssl/ /etc/nginx/ssl/
RUN chmod 644 /etc/nginx/ssl/nginx-selfsigned.crt && \
    chmod 600 /etc/nginx/ssl/nginx-selfsigned.key
```

4. Update `docker-compose.yml`:
```yaml
frontend:
  ports:
    - "8091:8080"
    - "8443:8443"  # Add HTTPS port
```

5. Production: Use Let's Encrypt with certbot (documented for later)

**Effort:** 4-6 hours (including testing)
**Testing:** Access https://localhost:8443, verify certificate

---

#### Agent: Security Engineer #2 - Command Injection Fix
**File:** `backend/src/services/backupOrchestrator.ts:435-487`

**Current Vulnerable Code:**
```typescript
const command = `docker exec ${containerName} mysqldump -u root -p"${password}" ...`;
await conn.exec(command);
```

**Fixed Code:**
```typescript
// Use array-based execution instead of string interpolation
const sanitizedContainer = containerName.replace(/[^a-zA-Z0-9_-]/g, '');
if (sanitizedContainer !== containerName) {
  throw new ValidationError('Invalid container name');
}

const args = [
  'docker', 'exec', sanitizedContainer,
  'mysqldump',
  '-u', 'root',
  `-p${password}`,
  '--all-databases',
];

// Use SSH2's exec with properly escaped arguments
const escapedCommand = args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ');
await conn.exec(escapedCommand);
```

**Steps:**
1. Add container name validation (allowlist characters)
2. Use array-based command building
3. Properly escape all arguments
4. Add unit tests for injection attempts
5. Apply same pattern to all shell command executions

**Locations to Fix:**
- `backupOrchestrator.ts:435-487` (MySQL backup)
- `backupOrchestrator.ts:490-540` (PostgreSQL backup)
- `backupOrchestrator.ts:545-595` (MongoDB backup)
- `routes/servers.ts:924-966` (service updates)

**Effort:** 3-4 hours
**Testing:** Unit tests with malicious input, integration test

---

## Phase 2: High-Priority Fixes (SHOULD COMPLETE)
**Timeline:** 3-5 days
**Blocks Release:** NO (but strongly recommended)

### Security Hardening (8-10 hours)

#### Agent: Security Engineer #3 - JWT to httpOnly Cookies
**Files:** `backend/src/routes/auth.ts`, `frontend/src/contexts/AuthContext.tsx`, `frontend/src/lib/api.ts`

**Backend Changes:**
```typescript
// backend/src/routes/auth.ts - login endpoint
res.cookie('auth_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 3600000, // 1 hour
});

res.json({
  success: true,
  message: 'Login successful',
  data: { user }, // Don't send token in response
});
```

**Frontend Changes:**
```typescript
// frontend/src/lib/api.ts
// Remove token from localStorage
// Cookies automatically sent with requests
axios.defaults.withCredentials = true;

// Remove Authorization header interceptor
// Backend will read from cookie
```

**Effort:** 6-8 hours (includes testing)
**Testing:** Verify cookies set, CSRF implications, logout flow

---

#### Agent: Security Engineer #4 - Additional Security

**Tasks:**
1. Add Content Security Policy header (`frontend/index.html`) - 1 hour
2. Fix WebSocket token exposure (send in message after connect) - 2-3 hours
3. Strengthen WebSocket origin validation - 30 minutes
4. Add CSRF tokens for state-changing operations - 2-3 hours

**Effort:** 6-7 hours

---

### Frontend Enhancements (4-6 hours)

#### Agent: Frontend Developer #3 - Quick Wins

**Tasks:**
1. Add Notification Settings to Settings page - 1-2 hours
   - Import existing NotificationSettings component
   - Add tab to Settings.tsx

2. Fix accessibility issues - 3-4 hours
   - Add ARIA labels to all buttons
   - Add role="dialog" to modals
   - Ensure keyboard navigation
   - Test with screen reader

**Effort:** 4-6 hours

---

## Phase 3: Testing & Validation (2-3 days)

### Team Echo: QA & Testing (12-16 hours)

#### Agent: QA Engineer #1 - Integration Testing
**Tasks:**
1. Test complete backup workflow (create, list, restore) - 2 hours
2. Test scanner integration with real servers - 2 hours
3. Test authentication flows (login, 2FA, logout) - 2 hours
4. Test WebSocket terminal sessions - 2 hours
5. Test error handling and edge cases - 2 hours

**Effort:** 10 hours

---

#### Agent: QA Engineer #2 - Security Testing
**Tasks:**
1. Verify HTTPS configuration - 1 hour
2. Test command injection fixes - 2 hours
3. Verify JWT/cookie security - 1 hour
4. Test rate limiting - 1 hour
5. Penetration testing (basic) - 3 hours

**Effort:** 8 hours

---

#### Agent: DevOps Engineer - Deployment Testing
**Tasks:**
1. Build Docker images - 30 minutes
2. Test docker-compose startup - 1 hour
3. Run database migrations - 30 minutes
4. Test health checks - 30 minutes
5. Test backup persistence across restarts - 1 hour
6. Document deployment process - 2 hours

**Effort:** 5-6 hours

---

## Phase 4: Documentation & Release (1-2 days)

### Team Foxtrot: Documentation (4-6 hours)

#### Agent: Technical Writer
**Tasks:**
1. Update README.md with v1.0 features - 1 hour
2. Consolidate deployment guides into one - 1 hour
3. Update CLAUDE.md with fixes - 1 hour
4. Write CHANGELOG.md for v1.0 - 30 minutes
5. Create UPGRADING.md guide - 1-2 hours

**Effort:** 4-6 hours

---

## Critical Path Summary

```
Day 1 (8-10 hours):
├─ Team Alpha: Build fixes (parallel)
├─ Team Bravo: Scanner integration (parallel)
└─ Team Charlie: Manual backup UI (parallel)

Day 2 (8-10 hours):
├─ Team Charlie: Restore UI
├─ Team Delta: HTTPS setup
└─ Team Delta: Command injection fixes

Day 3 (8-10 hours):
├─ Team Echo: Integration testing
└─ Team Delta: Additional security

Day 4-5 (8-12 hours):
├─ Team Echo: Security testing
├─ Team Echo: Deployment testing
└─ Team Foxtrot: Documentation

RELEASE v1.0
```

**Total Effort:** 32-42 hours
**With 3-4 developers:** 2-3 days calendar time

---

## Parallel Execution Plan

To minimize calendar time, tasks should run in parallel:

**Parallel Set 1 (Can run simultaneously):**
- Build fixes (Alpha)
- Scanner integration (Bravo #1)
- Manual backup endpoint (Bravo #2)
- Manual backup UI (Charlie #1)

**Parallel Set 2 (After Set 1):**
- Restore UI (Charlie #2)
- HTTPS setup (Delta #1)
- Command injection fixes (Delta #2)

**Parallel Set 3 (After Set 2):**
- All testing tasks (Echo team)
- Security hardening (Delta #3, #4)

**Final (After Set 3):**
- Documentation (Foxtrot)

---

## Risk Mitigation

### High-Risk Items
1. **Scanner Integration** - Most complex, test thoroughly
2. **HTTPS Configuration** - Certificate issues can block deployment
3. **JWT Migration** - Breaking change, requires frontend + backend coordination

### Mitigation Strategies
1. Create feature branches for each team
2. Test each feature independently before integration
3. Maintain rollback procedures
4. Use staging environment for integration testing
5. Keep backup of current working state

---

## Success Criteria

### v1.0 Release Checklist

**Build & Configuration:**
- [ ] `npm install` completes without errors
- [ ] All workspaces build successfully
- [ ] Docker images build without errors
- [ ] Migrations run successfully
- [ ] No TypeScript compilation errors

**Features:**
- [ ] Scanner returns real SSH scan data (not mock)
- [ ] Manual backups can be created via UI
- [ ] Backups can be restored via UI
- [ ] All existing features still work

**Security:**
- [ ] HTTPS enabled and tested
- [ ] Command injection vulnerabilities fixed
- [ ] JWT moved to httpOnly cookies (or documented for v1.1)
- [ ] Security headers verified

**Testing:**
- [ ] Integration tests pass
- [ ] Security tests pass
- [ ] Deployment tests pass
- [ ] No critical bugs found

**Documentation:**
- [ ] README.md updated
- [ ] CHANGELOG.md created
- [ ] Deployment guide consolidated
- [ ] Known issues documented

---

## Post-Release Plan

### v1.1 (1-2 weeks after v1.0)
- Token refresh mechanism
- Improved accessibility
- Higher test coverage
- Performance optimizations

### v1.2 (1 month after v1.0)
- Audit log viewer
- Job queue monitoring UI
- Export functionality connected
- Additional security hardening

### v2.0 (2-3 months after v1.0)
- Horizontal scaling support
- Load balancer integration
- Read replicas
- APM integration
- API versioning

See V2-ROADMAP.md for detailed future plans.

---

**Plan Created:** November 5, 2025
**Next Action:** Begin Phase 1 with Team Alpha (build fixes)
**Estimated v1.0 Release:** November 8-10, 2025 (3-5 days from now)
