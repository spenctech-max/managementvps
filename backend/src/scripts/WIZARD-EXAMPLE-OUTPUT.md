# Setup Wizard Example Output

This document shows what users will see when running the Medicine Man setup wizard.

## Example Terminal Session

```
═══════════════════════════════════════════════════════════════
                   Medicine Man - Setup Wizard
═══════════════════════════════════════════════════════════════

This wizard will help you configure your Medicine Man installation.
Press Ctrl+C at any time to cancel.

The wizard will:
  • Generate secure encryption keys and passwords
  • Configure database and Redis connections
  • Set up security and privacy settings
  • Create your .env configuration file

Ready to begin? (yes/no) [yes]: yes

╔═══════════════════════════════════════════════════════════════╗
║ Step 1: Generating Secure Secrets                            ║
╚═══════════════════════════════════════════════════════════════╝

Generating cryptographically secure keys and passwords...
✓ ENCRYPTION_KEY generated (64 hex characters)
✓ JWT_SECRET generated (64 hex characters)
✓ SESSION_SECRET generated (64 hex characters)
✓ DB_PASSWORD generated (32 characters)
✓ REDIS_PASSWORD generated (32 characters)

Generated secrets preview:
  ENCRYPTION_KEY: a7f3c2e9b4d1f6a8...
  JWT_SECRET: 5d8e2b9c7a4f1e3d...
  SESSION_SECRET: 9b6e4c2a8f1d5e3a...
  DB_PASSWORD: K7m@9Lp#...
  REDIS_PASSWORD: Xq4$wE2@...

Would you like to customize any of these secrets? (yes/no) [no]: no

╔═══════════════════════════════════════════════════════════════╗
║ Step 2: Environment Configuration                            ║
╚═══════════════════════════════════════════════════════════════╝

Choose the environment mode:
  production  - Optimized for production use (recommended)
  development - Enable debugging and verbose logging

Environment (production/development) [production]: production
✓ Environment set to: production

╔═══════════════════════════════════════════════════════════════╗
║ Step 3: Database Configuration                               ║
╚═══════════════════════════════════════════════════════════════╝

Configure PostgreSQL database connection:

Database Host [medicine_man_postgres]:
Database Port [5432]:
Database Name [medicine_man]:
Database User [medicine_user]:
✓ Database configuration complete!
  Connection: medicine_user@medicine_man_postgres:5432/medicine_man

╔═══════════════════════════════════════════════════════════════╗
║ Step 4: Redis Configuration                                  ║
╚═══════════════════════════════════════════════════════════════╝

Configure Redis connection for session storage:

Redis Host [medicine_man_redis]:
Redis Port [6379]:
✓ Redis configuration complete!
  Connection: medicine_man_redis:6379

╔═══════════════════════════════════════════════════════════════╗
║ Step 5: Security Settings                                    ║
╚═══════════════════════════════════════════════════════════════╝

Configure authentication and session security:

Session Timeout in hours [1]: 2
Max Login Attempts [5]:
Login Lockout Duration in minutes [30]:
✓ Security settings configured!
  Session timeout: 2 hour(s)
  Max login attempts: 5
  Lockout duration: 30 minute(s)

╔═══════════════════════════════════════════════════════════════╗
║ Step 6: Application Settings                                 ║
╚═══════════════════════════════════════════════════════════════╝

Configure application network settings:

CORS Origin (frontend URL) [http://localhost:5173]: http://192.168.1.100:5173
Backend Port [3000]:
✓ Application settings configured!
  Backend port: 3000
  CORS origin: http://192.168.1.100:5173

╔═══════════════════════════════════════════════════════════════╗
║ Step 7: Privacy Settings                                     ║
╚═══════════════════════════════════════════════════════════════╝

Medicine Man is designed for anonymous operation.
The following privacy settings will be applied:

✓ IP Address Logging: Disabled
✓ User-Agent Logging: Disabled
✓ Require HTTPS: Enabled (production)
✓ Log Level: warn

═══════════════════════════════════════════════════════════════
                    Configuration Summary
═══════════════════════════════════════════════════════════════

Environment & Application:
  Environment: production
  Backend Port: 3000
  CORS Origin: http://192.168.1.100:5173
  Log Level: warn

Database Configuration:
  Host: medicine_man_postgres
  Port: 5432
  Database: medicine_man
  User: medicine_user
  Password: K7m@9Lp#... (generated)

Redis Configuration:
  Host: medicine_man_redis
  Port: 6379
  Password: Xq4$wE2@... (generated)

Security Settings:
  Session Timeout: 2 hour(s)
  Max Login Attempts: 5
  Lockout Duration: 30 minute(s)
  Require HTTPS: true

Privacy Settings:
  Log IP Addresses: false
  Log User-Agent: false

Generated Secrets (preview):
  ENCRYPTION_KEY: a7f3c2e9b4d1f6a8...
  JWT_SECRET: 5d8e2b9c7a4f1e3d...
  SESSION_SECRET: 9b6e4c2a8f1d5e3a...

Note: Full secret values will be saved to .env file

Save this configuration? (yes/no) [yes]: yes

╔═══════════════════════════════════════════════════════════════╗
║ Saving Configuration                                         ║
╚═══════════════════════════════════════════════════════════════╝

✓ Configuration file created: backend/.env
✓ File permissions set (readable only by owner)

═══════════════════════════════════════════════════════════════
                ✓ Setup Complete Successfully!
═══════════════════════════════════════════════════════════════

Next Steps:

1. Review your configuration:
   cat backend/.env

2. Update docker-compose.yml with the generated passwords:
   - Set POSTGRES_PASSWORD to match DB_PASSWORD
   - Set Redis password to match REDIS_PASSWORD

3. Start the containers:
   docker-compose up -d

4. Wait for services to be ready (30-60 seconds)

5. Run database migrations:
   cd backend && npm run migrate

6. Create your first admin user:
   cd backend && node scripts/create-admin.js

7. Access the application:
   Frontend: http://192.168.1.100:5173
   Backend API: http://localhost:3000

Security Reminders:
  ⚠ Keep your .env file secure and never commit it to git
  ⚠ Use HTTPS in production (set REQUIRE_HTTPS=true)
  ⚠ Regularly rotate your secrets and passwords
  ⚠ Ensure database backups are configured
  ⚠ Review firewall rules to restrict access

For help and documentation, visit:
  https://github.com/yourusername/medicine-man
```

## Example with Existing .env Backup

If you already have a `.env` file:

```
╔═══════════════════════════════════════════════════════════════╗
║ Saving Configuration                                         ║
╚═══════════════════════════════════════════════════════════════╝

✓ Existing .env backed up to: .env.backup.2025-10-29T18-30-45-123Z
✓ Configuration file created: backend/.env
✓ File permissions set (readable only by owner)
```

## Example with Invalid Input

```
Database Port [5432]: 99999
Invalid port. Please enter a number between 1 and 65535.
Database Port [5432]: 5432
```

## Example Cancellation (Ctrl+C)

```
Database Host [medicine_man_postgres]: ^C

Setup cancelled by user.
```

## Color Coding

In the actual terminal, you'll see:
- **Cyan**: Borders and section headers
- **Green**: Success messages and checkmarks
- **Blue**: Information and prompts
- **Yellow**: Warnings and previews
- **Red**: Errors
- **Magenta**: Category headers in summary
- **Dim**: Less important information
- **Bright**: Important highlights

## Terminal Requirements

- Works in any standard terminal (bash, zsh, sh)
- No external dependencies required (uses Node.js built-ins)
- Supports Unraid terminal
- Works over SSH
- Handles Ctrl+C gracefully
