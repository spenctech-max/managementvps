/**
 * Complete Swagger/OpenAPI Endpoint Documentation
 * This file contains JSDoc documentation for all remaining API endpoints
 * Copy these comments to the respective route files above the router definitions
 */

// ============================================================================
// SERVERS ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/servers:
 *   get:
 *     summary: List all servers
 *     description: Returns all servers belonging to the authenticated user with pagination support
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Servers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/servers:
 *   post:
 *     summary: Add a new server
 *     description: Creates a new server entry with encrypted credentials
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateServerRequest'
 *     responses:
 *       201:
 *         description: Server added successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Server'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/servers/{id}/test:
 *   post:
 *     summary: Test server connection
 *     description: Tests SSH connection to the server and updates online status
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Server ID
 *     responses:
 *       200:
 *         description: Connection test result
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         serverId:
 *                           type: string
 *                         isOnline:
 *                           type: boolean
 *                         timestamp:
 *                           type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Server not found
 */

/**
 * @swagger
 * /api/servers/{id}:
 *   delete:
 *     summary: Delete a server
 *     description: Permanently deletes a server and all associated data
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Server deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Server not found
 */

/**
 * @swagger
 * /api/servers/{id}/backup:
 *   post:
 *     summary: Start server backup
 *     description: Initiates a backup job for the server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               backup_type:
 *                 type: string
 *                 enum: [full, incremental]
 *                 default: full
 *               options:
 *                 type: object
 *     responses:
 *       202:
 *         description: Backup started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Server not online
 *       404:
 *         description: Server not found
 */

/**
 * @swagger
 * /api/servers/{id}/scan:
 *   post:
 *     summary: Start server scan
 *     description: Initiates a server scan to detect services and filesystems
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scan_type:
 *                 type: string
 *                 enum: [full, quick, custom]
 *                 default: full
 *     responses:
 *       202:
 *         description: Scan started successfully
 *       404:
 *         description: Server not found
 */

/**
 * @swagger
 * /api/servers/{id}/scans:
 *   get:
 *     summary: List server scans
 *     description: Returns all scans for a specific server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scans retrieved successfully
 *       404:
 *         description: Server not found
 */

/**
 * @swagger
 * /api/servers/{id}/scan-summary:
 *   get:
 *     summary: Get latest scan summary
 *     description: Returns the most recent scan summary for a server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scan summary retrieved
 *       404:
 *         description: Server not found
 */

/**
 * @swagger
 * /api/servers/{serverId}/services/{serviceId}/update:
 *   post:
 *     summary: Update service on server
 *     description: Triggers an update for a specific service
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Service update initiated
 *       404:
 *         description: Server or service not found
 */

/**
 * @swagger
 * /api/servers/{id}/orchestrated-backup:
 *   post:
 *     summary: Start orchestrated backup
 *     description: Performs a comprehensive backup with service shutdown/restart
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - backupType
 *             properties:
 *               backupType:
 *                 type: string
 *                 enum: [full, selective]
 *               selectedServices:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       202:
 *         description: Orchestrated backup started
 *       400:
 *         description: Invalid backup type or missing services
 *       404:
 *         description: Server not found
 */

// ============================================================================
// SCANS ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/scans:
 *   get:
 *     summary: List all scans
 *     description: Returns scans across all servers
 *     tags: [Scans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Scans retrieved successfully
 */

/**
 * @swagger
 * /api/scans/{id}:
 *   get:
 *     summary: Get scan details
 *     description: Returns detailed scan information with services, filesystems, and recommendations
 *     tags: [Scans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scan details retrieved
 *       404:
 *         description: Scan not found
 */

/**
 * @swagger
 * /api/scans/compare:
 *   get:
 *     summary: Compare multiple scans
 *     description: Compares two or more scans to identify changes
 *     tags: [Scans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: scanIds
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Array of scan IDs to compare (minimum 2)
 *     responses:
 *       200:
 *         description: Scan comparison completed
 *       400:
 *         description: Less than 2 scan IDs provided
 *       404:
 *         description: One or more scans not found
 */

// ============================================================================
// BACKUPS ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/backups:
 *   get:
 *     summary: List all backups
 *     description: Returns backups for all user's servers
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backups retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Backup'
 */

/**
 * @swagger
 * /api/backups/{id}:
 *   get:
 *     summary: Get backup details
 *     description: Returns detailed information about a specific backup
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Backup details retrieved
 *       404:
 *         description: Backup not found
 */

/**
 * @swagger
 * /api/backups/servers/{id}/backups:
 *   get:
 *     summary: List server backups
 *     description: Returns all backups for a specific server
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Server backups retrieved
 *       404:
 *         description: Server not found
 */

// ============================================================================
// USERS ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users
 *     description: Returns all users with their roles (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create new user
 *     description: Creates a new user account (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       409:
 *         description: Username or email already exists
 */

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Update user
 *     description: Updates user properties (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Permanently deletes a user (Admin only, cannot delete self)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Cannot delete yourself or admin only
 *       404:
 *         description: User not found
 */

// ============================================================================
// JOBS ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: List all jobs
 *     description: Returns jobs from all queues with optional filtering
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: queue
 *         schema:
 *           type: string
 *           enum: [backup, scan, update]
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *           enum: [waiting, active, completed, failed]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
 */

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     summary: Get job status
 *     description: Returns detailed status and progress of a specific job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 */

/**
 * @swagger
 * /api/jobs/{id}:
 *   delete:
 *     summary: Remove job
 *     description: Removes a job from the queue (cannot remove active jobs)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job removed successfully
 *       400:
 *         description: Cannot remove active job
 *       404:
 *         description: Job not found
 */

/**
 * @swagger
 * /api/jobs/{id}/retry:
 *   post:
 *     summary: Retry failed job
 *     description: Retries a failed job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job retry initiated
 *       400:
 *         description: Only failed jobs can be retried
 *       404:
 *         description: Job not found
 */

/**
 * @swagger
 * /api/jobs/stats/all:
 *   get:
 *     summary: Get job statistics
 *     description: Returns statistics for all job queues
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Job statistics retrieved
 */

// ============================================================================
// METRICS ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/metrics/db-pool:
 *   get:
 *     summary: Get database pool metrics
 *     description: Returns database connection pool statistics (Admin only)
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database pool metrics retrieved
 *       403:
 *         description: Forbidden - Admin only
 */

/**
 * @swagger
 * /api/metrics/cache:
 *   get:
 *     summary: Get cache metrics
 *     description: Returns Redis cache statistics (Admin only)
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache metrics retrieved
 *       403:
 *         description: Forbidden - Admin only
 */

/**
 * @swagger
 * /api/metrics/queues:
 *   get:
 *     summary: Get queue metrics
 *     description: Returns job queue statistics (Admin only)
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue metrics retrieved
 *       403:
 *         description: Forbidden - Admin only
 */

/**
 * @swagger
 * /api/metrics/system:
 *   get:
 *     summary: Get system metrics
 *     description: Returns overall system health and metrics (Admin only)
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System metrics retrieved
 *       403:
 *         description: Forbidden - Admin only
 */

/**
 * @swagger
 * /api/metrics/cache/reset:
 *   post:
 *     summary: Reset cache statistics
 *     description: Resets cache hit/miss counters (Admin only)
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics reset
 *       403:
 *         description: Forbidden - Admin only
 */

export {};
