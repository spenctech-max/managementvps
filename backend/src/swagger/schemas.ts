/**
 * Swagger/OpenAPI Schema Definitions
 * Reusable schema components for API documentation
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique user identifier
 *         username:
 *           type: string
 *           description: User's username
 *           example: admin
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *           example: admin@example.com
 *         is_active:
 *           type: boolean
 *           description: Whether the user account is active
 *           example: true
 *         role:
 *           type: string
 *           enum: [admin, operator, viewer]
 *           description: User's role in the system
 *           example: admin
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Account creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *
 *     Server:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique server identifier
 *         name:
 *           type: string
 *           description: Server name
 *           example: Production Web Server
 *         ip:
 *           type: string
 *           description: Server IP address
 *           example: 192.168.1.100
 *         port:
 *           type: integer
 *           description: SSH port
 *           example: 22
 *         username:
 *           type: string
 *           description: SSH username
 *           example: root
 *         auth_type:
 *           type: string
 *           enum: [password, key]
 *           description: Authentication method
 *           example: key
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Server tags for organization
 *           example: [production, web]
 *         description:
 *           type: string
 *           description: Server description
 *           example: Main production web server
 *         is_online:
 *           type: boolean
 *           description: Connection status
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     Scan:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique scan identifier
 *         server_id:
 *           type: string
 *           format: uuid
 *           description: Associated server ID
 *         scan_type:
 *           type: string
 *           enum: [full, quick, custom]
 *           description: Type of scan performed
 *           example: full
 *         status:
 *           type: string
 *           enum: [pending, running, completed, failed]
 *           description: Current scan status
 *           example: completed
 *         started_at:
 *           type: string
 *           format: date-time
 *           description: Scan start time
 *         completed_at:
 *           type: string
 *           format: date-time
 *           description: Scan completion time
 *         scan_duration:
 *           type: integer
 *           description: Scan duration in milliseconds
 *           example: 45000
 *         scan_summary:
 *           type: object
 *           description: Summary of scan results
 *         error_message:
 *           type: string
 *           description: Error message if scan failed
 *         created_at:
 *           type: string
 *           format: date-time
 *
 *     DetectedService:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         scan_id:
 *           type: string
 *           format: uuid
 *         service_name:
 *           type: string
 *           example: nginx
 *         service_type:
 *           type: string
 *           enum: [docker, systemd, process]
 *           example: systemd
 *         status:
 *           type: string
 *           enum: [running, stopped, error]
 *           example: running
 *         process_id:
 *           type: integer
 *           example: 1234
 *         port_bindings:
 *           type: array
 *           items:
 *             type: string
 *           example: ["80:80", "443:443"]
 *         config_paths:
 *           type: array
 *           items:
 *             type: string
 *           example: ["/etc/nginx/nginx.conf"]
 *         data_paths:
 *           type: array
 *           items:
 *             type: string
 *           example: ["/var/www/html"]
 *         log_paths:
 *           type: array
 *           items:
 *             type: string
 *           example: ["/var/log/nginx"]
 *         service_details:
 *           type: object
 *           description: Additional service-specific information
 *         backup_priority:
 *           type: string
 *           enum: [critical, high, medium, low]
 *           example: high
 *         backup_strategy:
 *           type: string
 *           example: snapshot
 *         created_at:
 *           type: string
 *           format: date-time
 *
 *     Backup:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         server_id:
 *           type: string
 *           format: uuid
 *         server_name:
 *           type: string
 *           example: Production Web Server
 *         server_ip:
 *           type: string
 *           example: 192.168.1.100
 *         backup_type:
 *           type: string
 *           enum: [full, incremental, selective, orchestrated_full, orchestrated_selective]
 *           example: full
 *         status:
 *           type: string
 *           enum: [pending, running, completed, failed]
 *           example: completed
 *         size:
 *           type: integer
 *           description: Backup size in bytes
 *           example: 1073741824
 *         duration:
 *           type: integer
 *           description: Backup duration in seconds
 *           example: 300
 *         started_at:
 *           type: string
 *           format: date-time
 *         completed_at:
 *           type: string
 *           format: date-time
 *         created_at:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *           description: Additional backup metadata
 *
 *     Job:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique job identifier
 *         queue:
 *           type: string
 *           enum: [backup, scan, update]
 *           description: Queue name
 *           example: scan
 *         name:
 *           type: string
 *           description: Job type name
 *           example: scan:full
 *         data:
 *           type: object
 *           description: Job data payload
 *         state:
 *           type: string
 *           enum: [waiting, active, completed, failed, delayed]
 *           description: Current job state
 *           example: completed
 *         progress:
 *           type: number
 *           description: Job progress percentage (0-100)
 *           example: 100
 *         attempts:
 *           type: integer
 *           description: Number of attempts made
 *           example: 1
 *         maxAttempts:
 *           type: integer
 *           description: Maximum retry attempts
 *           example: 3
 *         timestamp:
 *           type: integer
 *           description: Job creation timestamp
 *         processedOn:
 *           type: integer
 *           description: Processing start timestamp
 *         finishedOn:
 *           type: integer
 *           description: Completion timestamp
 *         failedReason:
 *           type: string
 *           description: Failure reason if job failed
 *         result:
 *           type: object
 *           description: Job result data
 *
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         notification_type:
 *           type: string
 *           enum: [backup_complete, backup_failed, scan_complete, scan_failed, server_offline, system_alert]
 *           example: backup_complete
 *         severity:
 *           type: string
 *           enum: [info, warning, error, critical]
 *           example: info
 *         title:
 *           type: string
 *           example: Backup Completed Successfully
 *         message:
 *           type: string
 *           example: Server backup completed in 5 minutes
 *         action_url:
 *           type: string
 *           description: Optional action URL
 *         metadata:
 *           type: object
 *           description: Additional notification data
 *         is_read:
 *           type: boolean
 *           example: false
 *         read_at:
 *           type: string
 *           format: date-time
 *         created_at:
 *           type: string
 *           format: date-time
 *
 *     LoginRequest:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           example: admin
 *         password:
 *           type: string
 *           format: password
 *           example: SecurePassword123!
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Login successful
 *         data:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               description: JWT authentication token
 *             user:
 *               $ref: '#/components/schemas/User'
 *
 *     TwoFactorRequiredResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Password verified. Please provide your 2FA code.
 *         data:
 *           type: object
 *           properties:
 *             requires2FA:
 *               type: boolean
 *               example: true
 *             userId:
 *               type: string
 *               format: uuid
 *
 *     CreateServerRequest:
 *       type: object
 *       required:
 *         - name
 *         - ip
 *         - port
 *         - username
 *         - auth_type
 *         - credential
 *       properties:
 *         name:
 *           type: string
 *           example: Production Server
 *         ip:
 *           type: string
 *           example: 192.168.1.100
 *         port:
 *           type: integer
 *           example: 22
 *         username:
 *           type: string
 *           example: root
 *         auth_type:
 *           type: string
 *           enum: [password, key]
 *           example: key
 *         credential:
 *           type: string
 *           description: Password or SSH private key
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           example: [production, web]
 *         description:
 *           type: string
 *           example: Main production web server
 *
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *         - role
 *       properties:
 *         username:
 *           type: string
 *           example: johndoe
 *         email:
 *           type: string
 *           format: email
 *           example: john@example.com
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           example: SecurePass123!
 *         role:
 *           type: string
 *           enum: [admin, operator, viewer]
 *           example: operator
 *
 *     UpdateUserRequest:
 *       type: object
 *       properties:
 *         is_active:
 *           type: boolean
 *           example: true
 *         role:
 *           type: string
 *           enum: [admin, operator, viewer]
 *           example: viewer
 *
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Error message describing what went wrong
 *
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Operation completed successfully
 *         data:
 *           type: object
 *           description: Response data (varies by endpoint)
 *
 *     PaginatedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: array
 *           items:
 *             type: object
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 20
 *             total:
 *               type: integer
 *               example: 100
 *             totalPages:
 *               type: integer
 *               example: 5
 *             hasNext:
 *               type: boolean
 *               example: true
 *             hasPrev:
 *               type: boolean
 *               example: false
 */

// This file only contains JSDoc comments for schema definitions
// No TypeScript code is exported
export {};
