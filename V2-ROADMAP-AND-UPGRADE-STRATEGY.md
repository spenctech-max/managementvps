# Medicine Man - Product Roadmap & Upgrade Strategy

**Document Version:** 1.0
**Last Updated:** November 5, 2025
**Roadmap Horizon:** 12-18 months

---

## Product Vision

Medicine Man will evolve from a single-instance server management tool into an enterprise-grade, horizontally-scalable infrastructure management platform with advanced automation, multi-tenancy, and comprehensive observability.

---

## Release Strategy

### Version Numbering: Semantic Versioning (SemVer)
- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR:** Breaking changes, requires migration
- **MINOR:** New features, backwards compatible
- **PATCH:** Bug fixes, security patches

### Release Cadence
- **Major Releases:** Every 6-12 months
- **Minor Releases:** Every 4-6 weeks
- **Patch Releases:** As needed (security: immediate)

---

## Version 1.0 - Foundation Release
**Target Date:** November 8-10, 2025
**Status:** In Development (85% complete)

### Core Features
✅ Server management (SSH-based)
✅ Automated SSH scanning with service detection
✅ WebSocket terminal access
✅ Backup orchestration (Docker, MySQL, PostgreSQL, MongoDB)
✅ Scheduled backups (cron-based)
⚠️ Manual backup creation (UI missing)
⚠️ Backup restore (UI missing)
✅ User management with RBAC
✅ 2FA authentication
✅ Health monitoring
✅ Notification system (email, Slack, in-app)
✅ BitLaunch VPS integration
✅ Audit logging
✅ Queue system (BullMQ)

### Critical Fixes for v1.0
1. Scanner integration (remove mock data)
2. Backup restore UI
3. Manual backup creation
4. HTTPS/TLS configuration
5. Build configuration fixes
6. Security vulnerabilities patched

**Effort:** 18-25 hours
**Target Users:** Small teams (10-50 users), 10-100 servers, internal use

---

## Version 1.1 - Polish & Security
**Target Date:** November 20-25, 2025 (2 weeks after v1.0)
**Focus:** Security hardening, UX improvements

### New Features
- **Token Refresh Mechanism** (6-8 hours)
  - Implement refresh tokens
  - Silent re-authentication before expiry
  - Graceful session management

- **Enhanced Accessibility** (8-12 hours)
  - Comprehensive ARIA labels
  - Keyboard navigation for all modals
  - Screen reader support
  - WCAG 2.1 AA compliance

- **Performance Optimizations** (4-6 hours)
  - React.memo for large lists
  - useMemo for expensive operations
  - Request cancellation on unmount
  - Bundle size optimization

- **Notification Settings UI** (1-2 hours)
  - Connect existing component to Settings page
  - Configure email/Slack preferences
  - Notification frequency controls

### Improvements
- Higher test coverage (70%+ target)
- Improved error messages
- Better loading states
- Mobile responsiveness improvements

**Effort:** 34-46 hours
**Breaking Changes:** None (backwards compatible)

---

## Version 1.2 - Observability & Monitoring
**Target Date:** December 20-31, 2025 (1 month after v1.1)
**Focus:** Visibility into system operations

### New Features
- **Audit Log Viewer** (4-6 hours)
  - Filterable audit trail UI
  - Export audit logs (CSV/JSON)
  - User activity timeline
  - Security event highlighting

- **Job Queue Monitoring** (6-8 hours)
  - Real-time queue status dashboard
  - Job failure investigation
  - Queue metrics (throughput, latency)
  - Retry and cancel job controls

- **Export Functionality** (2-3 hours)
  - Connect export buttons (servers, backups, users)
  - CSV and JSON formats
  - Scheduled exports

- **Advanced Search** (4-6 hours)
  - Global search across servers, backups, logs
  - Saved searches
  - Search history

- **Dashboard Enhancements** (3-4 hours)
  - Customizable widgets
  - Time-range selectors
  - Drill-down capabilities

### Infrastructure
- Prometheus metrics dashboard (Grafana)
- Structured logging with ELK/Loki
- Error tracking (Sentry integration)

**Effort:** 44-66 hours
**Breaking Changes:** None

---

## Version 2.0 - Enterprise Scale
**Target Date:** Q1 2026 (February-March)
**Focus:** Horizontal scaling, multi-tenancy, advanced features

### Scalability Features
- **Horizontal Scaling Support** (8-12 hours)
  - Move in-memory state to Redis
  - Stateless application architecture
  - Shared session store (already using Redis)
  - Distributed WebSocket state

- **Load Balancer Integration** (4-6 hours)
  - Nginx load balancer configuration
  - Sticky sessions for WebSockets
  - Health check-based routing
  - SSL/TLS termination at LB

- **Database Read Replicas** (8-12 hours)
  - Read/write splitting
  - Automatic failover
  - Replica lag monitoring

- **Worker Service Separation** (8-12 hours)
  - Extract BullMQ workers to separate service
  - Independent worker scaling
  - Worker health monitoring
  - Dead letter queue handling

- **Redis Sentinel/Cluster** (6-8 hours)
  - High availability for Redis
  - Automatic failover
  - Sentinel monitoring

### New Features
- **Multi-Tenancy** (20-30 hours)
  - Organization/team isolation
  - Resource quotas per tenant
  - Tenant-specific configurations
  - Billing integration hooks

- **API Versioning** (6-8 hours)
  - `/api/v1/` and `/api/v2/` support
  - Deprecation warnings
  - Migration guide

- **Advanced Backup Features** (12-16 hours)
  - Incremental backups
  - Deduplication
  - Compression improvements
  - Cloud storage backends (S3, Azure Blob, GCS)

- **SSH Key Rotation** (4-6 hours)
  - Automated key rotation
  - Key lifecycle management
  - Rotation scheduling

- **Webhook System** (6-8 hours)
  - Webhook endpoints for events
  - Webhook retries and DLQ
  - Signature verification

### Infrastructure
- APM integration (DataDog/New Relic)
- Distributed tracing (OpenTelemetry)
- Advanced rate limiting (per-tenant)
- Circuit breakers for external services

**Effort:** 90-140 hours
**Breaking Changes:** YES
- API versioning changes
- Database schema migrations
- Configuration file format changes

---

## Version 2.1 - Automation & Intelligence
**Target Date:** Q2 2026 (April-June)
**Focus:** AI-powered features, advanced automation

### New Features
- **Smart Scheduling** (12-16 hours)
  - ML-based backup scheduling
  - Analyze server load patterns
  - Optimize backup windows

- **Anomaly Detection** (16-20 hours)
  - Detect unusual server behavior
  - Predict disk space issues
  - Alert on anomalies

- **Automated Remediation** (12-16 hours)
  - Auto-healing for common issues
  - Playbook execution
  - Approval workflows

- **Backup Recommendations** (8-10 hours)
  - Suggest backup frequency
  - Identify critical data
  - Optimize retention policies

- **Compliance Reporting** (10-12 hours)
  - SOC 2 compliance checks
  - GDPR data mapping
  - Compliance dashboards

### Infrastructure
- Machine learning model serving
- Data pipeline for analytics
- Compliance audit trail

**Effort:** 60-80 hours
**Breaking Changes:** None

---

## Version 2.2 - Advanced Features
**Target Date:** Q3 2026 (July-September)
**Focus:** Enterprise integrations, advanced workflows

### New Features
- **Terraform Integration** (10-12 hours)
  - Import infrastructure from Terraform
  - Export to Terraform
  - Sync state

- **Ansible Integration** (10-12 hours)
  - Execute Ansible playbooks
  - Inventory management
  - Role execution

- **LDAP/Active Directory** (12-16 hours)
  - LDAP authentication
  - Group sync
  - SSO support

- **Custom Scripts** (8-10 hours)
  - Run custom scripts on servers
  - Script library
  - Execution history

- **Advanced RBAC** (12-16 hours)
  - Custom roles
  - Permission templates
  - Resource-level permissions

- **Disaster Recovery** (16-20 hours)
  - DR plan creation
  - DR testing automation
  - RTO/RPO monitoring

**Effort:** 68-86 hours
**Breaking Changes:** None

---

## Version 3.0 - Cloud Native
**Target Date:** Q4 2026 (October-December)
**Focus:** Kubernetes, cloud-native architecture

### New Features
- **Kubernetes Support** (40-60 hours)
  - Manage Kubernetes clusters
  - Pod/deployment management
  - Helm chart backups
  - Namespace isolation

- **Container Registry Integration** (8-10 hours)
  - Docker Hub, ECR, GCR integration
  - Image scanning
  - Vulnerability detection

- **Serverless Support** (12-16 hours)
  - Lambda/Cloud Functions backup
  - Serverless monitoring
  - Cost tracking

- **Multi-Cloud Management** (20-30 hours)
  - AWS, Azure, GCP support
  - Cloud resource discovery
  - Cross-cloud backups

- **GitOps Integration** (10-12 hours)
  - Configuration as code
  - Git-based workflows
  - Automatic reconciliation

### Infrastructure
- Kubernetes deployment (Helm charts)
- Service mesh integration (Istio/Linkerd)
- Cloud-native storage (PVC, StatefulSets)

**Effort:** 90-128 hours
**Breaking Changes:** YES
- New deployment model
- Configuration changes
- Migration to Kubernetes

---

## Upgrade Strategy & Mechanism

### Automated Upgrade System

#### 1. Pre-Upgrade Checks
```typescript
// backend/src/scripts/pre-upgrade-check.ts
export async function preUpgradeCheck(targetVersion: string) {
  const checks = [
    checkDatabaseVersion(),
    checkDiskSpace(),
    checkBackupExists(),
    checkDependencies(),
    checkConfigurationCompatibility(targetVersion),
  ];

  const results = await Promise.all(checks);

  if (results.some(r => !r.passed)) {
    throw new Error('Pre-upgrade checks failed');
  }

  return { ready: true, warnings: results.filter(r => r.warnings) };
}
```

#### 2. Database Migration Strategy

**Migration Files:**
```
backend/migrations/
├── 001_initial_schema.sql (v1.0)
├── 002_performance_indexes.sql (v1.0)
├── ...
├── 017_add_refresh_tokens.sql (v1.1)
├── 018_audit_log_indexes.sql (v1.2)
├── 019_multi_tenancy_schema.sql (v2.0) ⚠️ BREAKING
└── ...
```

**Upgrade Command:**
```bash
npm run upgrade -- --from=1.0.0 --to=2.0.0
```

**Upgrade Script:**
```typescript
// backend/src/scripts/upgrade.ts
export async function upgrade(fromVersion: string, toVersion: string) {
  // 1. Backup current database
  await backupDatabase();

  // 2. Run pre-upgrade checks
  await preUpgradeCheck(toVersion);

  // 3. Stop application services
  await stopServices();

  // 4. Run migrations
  await runMigrations(fromVersion, toVersion);

  // 5. Update configuration
  await updateConfiguration(toVersion);

  // 6. Start application services
  await startServices();

  // 7. Run post-upgrade validation
  await postUpgradeValidation();

  // 8. Clean up old data (if applicable)
  await cleanup(fromVersion);
}
```

#### 3. Breaking Change Handling

**For v2.0 (API Versioning):**
```typescript
// Support both v1 and v2 APIs during transition period
app.use('/api/v1', v1Routes); // Legacy, deprecated
app.use('/api/v2', v2Routes); // New API

// Redirect /api/* to /api/v1/* with deprecation warning
app.use('/api', (req, res, next) => {
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('X-API-Sunset', '2026-06-01');
  req.url = `/v1${req.url}`;
  next();
});
```

**Deprecation Timeline:**
- v2.0 released → v1 API deprecated, still supported
- v2.2 (6 months) → v1 API sunset warning
- v3.0 (12 months) → v1 API removed

#### 4. Configuration Migration

```typescript
// backend/src/scripts/migrate-config.ts
export function migrateConfig(fromVersion: string, config: any) {
  const migrations = {
    '1.x': to2_0,
    '2.x': to3_0,
  };

  let currentVersion = fromVersion;
  let newConfig = { ...config };

  // Apply migrations sequentially
  for (const [version, migrate] of Object.entries(migrations)) {
    if (semver.satisfies(currentVersion, version)) {
      newConfig = migrate(newConfig);
      currentVersion = semver.inc(currentVersion, 'major');
    }
  }

  return newConfig;
}

function to2_0(config: any) {
  // Migrate 1.x config to 2.0
  return {
    ...config,
    tenant: {
      id: 'default',
      name: 'Default Organization',
    },
    api: {
      version: 'v2',
    },
  };
}
```

#### 5. Rollback Mechanism

```bash
# Automatic rollback if upgrade fails
npm run upgrade:rollback
```

```typescript
export async function rollback() {
  // 1. Stop services
  await stopServices();

  // 2. Restore database backup
  await restoreDatabase();

  // 3. Restore configuration
  await restoreConfiguration();

  // 4. Start services
  await startServices();

  // 5. Verify system health
  await healthCheck();
}
```

#### 6. Docker Upgrade Strategy

**Blue-Green Deployment:**
```bash
# 1. Pull new images
docker-compose pull

# 2. Start new stack (blue)
docker-compose -f docker-compose.yml -f docker-compose.blue.yml up -d

# 3. Wait for health checks
./scripts/wait-for-health.sh

# 4. Switch traffic to blue
./scripts/switch-traffic.sh blue

# 5. Stop old stack (green)
docker-compose -f docker-compose.green.yml down

# 6. If issues, rollback
./scripts/switch-traffic.sh green
```

---

## Feature Flags System

For gradual rollout and A/B testing:

```typescript
// backend/src/config/features.ts
export const features = {
  MULTI_TENANCY: {
    enabled: process.env.FEATURE_MULTI_TENANCY === 'true',
    rollout: 0.1, // 10% of users
    requiredVersion: '2.0.0',
  },
  ML_SCHEDULING: {
    enabled: process.env.FEATURE_ML_SCHEDULING === 'true',
    rollout: 0.0, // Beta, opt-in only
    requiredVersion: '2.1.0',
  },
};

export function isFeatureEnabled(feature: string, userId?: string): boolean {
  const config = features[feature];
  if (!config) return false;

  // Check version requirement
  if (!semver.gte(APP_VERSION, config.requiredVersion)) {
    return false;
  }

  // Check global enable
  if (!config.enabled) return false;

  // Check rollout percentage
  if (userId && config.rollout < 1.0) {
    const hash = hashUserId(userId);
    return (hash % 100) < (config.rollout * 100);
  }

  return true;
}
```

---

## Deprecation Policy

### Deprecation Process
1. **Announce:** Document deprecation in release notes
2. **Warning:** Add deprecation warnings in responses
3. **Sunset:** Set sunset date (minimum 6 months)
4. **Remove:** Remove feature in next major version

### Example Deprecation Notice
```typescript
// Deprecated endpoint
router.get('/api/old-endpoint', (req, res) => {
  res.setHeader('X-Deprecated', 'true');
  res.setHeader('X-Sunset-Date', '2026-06-01');
  res.setHeader('X-Replacement', '/api/v2/new-endpoint');

  // Still functional, but logged
  logger.warn('Deprecated endpoint accessed', {
    endpoint: req.path,
    userId: req.user?.id,
  });

  // ... existing logic
});
```

---

## Backward Compatibility

### API Compatibility Matrix

| Version | v1 API | v2 API | v3 API |
|---------|--------|--------|--------|
| 1.x     | ✅     | ❌     | ❌     |
| 2.0-2.2 | ✅ ⚠️  | ✅     | ❌     |
| 2.3+    | ⚠️ 🕐  | ✅     | ❌     |
| 3.0+    | ❌     | ✅ ⚠️  | ✅     |

**Legend:**
- ✅ Fully supported
- ⚠️ Deprecated, still functional
- 🕐 Sunset warning
- ❌ Removed

### Database Schema Compatibility
- All migrations are **forward-compatible**
- Rollback migrations provided for **major versions**
- No data loss during upgrades
- Automatic backups before migrations

---

## Release Checklist Template

### Pre-Release
- [ ] All features implemented and tested
- [ ] Security vulnerabilities patched
- [ ] Performance benchmarks meet targets
- [ ] Documentation updated
- [ ] CHANGELOG.md written
- [ ] Migration scripts tested
- [ ] Rollback procedure tested
- [ ] Breaking changes documented

### Release
- [ ] Tag version in git
- [ ] Build Docker images
- [ ] Push to container registry
- [ ] Update Helm charts (v3.0+)
- [ ] Deploy to staging
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Monitor for issues

### Post-Release
- [ ] Announce release (email, blog, Twitter)
- [ ] Update documentation site
- [ ] Monitor error rates
- [ ] Gather user feedback
- [ ] Plan hotfix if needed

---

## Support Policy

### Version Support Timeline
- **Current Major Version:** Full support (features + security + bugs)
- **Previous Major Version:** Security + critical bugs (12 months)
- **Older Versions:** Security only (6 months)

### Example:
- v3.0 released: v3.x (full), v2.x (security + critical), v1.x (security)
- v3.6 released (6 months later): v3.x (full), v2.x (security), v1.x (EOL)
- v4.0 released (12 months later): v4.x (full), v3.x (security + critical), v2.x (security), v1.x (EOL)

---

## Success Metrics

### KPIs by Version

**v1.0:**
- 50+ active users
- 200+ servers managed
- 1000+ backups created
- 99% uptime

**v2.0:**
- 500+ active users
- 2000+ servers managed
- 10+ enterprise customers
- 99.9% uptime
- <100ms API response time (p95)

**v3.0:**
- 5000+ active users
- 20,000+ servers managed
- 100+ enterprise customers
- 99.95% uptime
- <50ms API response time (p95)

---

## Conclusion

This roadmap provides a clear path from the current v1.0 foundation to a fully-featured enterprise platform. The upgrade mechanism ensures smooth transitions with minimal downtime and zero data loss. Feature flags allow gradual rollouts, and the deprecation policy provides ample time for users to migrate.

**Key Principles:**
1. **Backward Compatibility:** Maintain for 12 months minimum
2. **Zero Downtime Upgrades:** Blue-green deployments
3. **Automatic Rollback:** Safety net for failed upgrades
4. **Transparent Communication:** Clear deprecation warnings
5. **Data Safety:** Automatic backups before migrations

**Next Steps:**
1. Complete v1.0 implementation (see V1-IMPLEMENTATION-PLAN.md)
2. Gather user feedback during v1.0 beta
3. Refine v1.1 priorities based on feedback
4. Begin v2.0 architecture planning in Q4 2025

---

**Roadmap Maintained By:** Product Team
**Review Frequency:** Quarterly
**Next Review:** February 2026
