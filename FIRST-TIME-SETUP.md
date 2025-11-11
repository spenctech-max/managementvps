# Medicine Man - First-Time Setup Guide
**Zero-Configuration Security - Interactive Wizard**

This guide will help you set up Medicine Man with **zero hardcoded credentials**. All secrets are generated automatically during first run.

---

## 🚀 Quick Start (5 Minutes)

### Method 1: Using the Setup Wizard (Recommended)

```bash
cd /mnt/user/appdata/medicine-man

# Run the interactive wizard
docker compose run --rm backend npm run setup:wizard

# Follow the prompts to configure:
# - Server IP and port
# - Custom domain (optional)
# - Unraid PUID/PGID
# - Email notifications (optional)
# - Slack notifications (optional)

# All credentials are generated automatically!
```

The wizard will:
- ✅ Generate secure 64-character hex secrets (JWT, Session, Encryption)
- ✅ Generate random 32-character passwords (Database, Redis)
- ✅ Create `.env` files for you
- ✅ Create `SETUP-SUMMARY.txt` with all credentials (SAVE THIS!)
- ✅ No hardcoded credentials anywhere

### Method 2: Manual Setup (Advanced)

If you prefer manual setup:

```bash
# 1. Generate secrets
openssl rand -hex 32  # Run this 5 times for different secrets

# 2. Create .env files manually (see examples below)

# 3. Continue with deployment
```

---

## 📋 What the Wizard Creates

### Root .env (`/mnt/user/appdata/medicine-man/.env`)

```env
# Database Credentials
DB_USER=medicine_user
DB_PASSWORD=<randomly_generated_32_chars>
DB_NAME=medicine_man

# Redis Credentials
REDIS_PASSWORD=<randomly_generated_32_chars>

# Unraid User/Group IDs
PUID=99
PGID=100
```

### Backend .env (`/mnt/user/appdata/medicine-man/backend/.env`)

```env
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database (internal Docker network)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=medicine_man
DB_USER=medicine_user
DB_PASSWORD=<same_as_root_env>
DATABASE_URL=postgresql://medicine_user:<password>@postgres:5432/medicine_man

# Redis (internal Docker network)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<same_as_root_env>

# Security Secrets (64 hex characters each)
JWT_SECRET=<randomly_generated>
SESSION_SECRET=<randomly_generated>
ENCRYPTION_KEY=<randomly_generated>

# Network Configuration
CORS_ORIGIN=http://192.168.4.21:8091  # Or your custom domain

# ... additional settings ...
```

### SETUP-SUMMARY.txt

**IMPORTANT:** The wizard creates this file with ALL your credentials.
**⚠️ BACKUP THIS FILE TO A SECURE LOCATION!**

This file contains:
- All generated passwords
- All secret keys
- Full configuration summary
- Next steps

---

## 🔐 Security Features

### Automatic Secret Generation

- **JWT Secret**: 64 hex characters (256 bits of entropy)
- **Session Secret**: 64 hex characters (256 bits of entropy)
- **Encryption Key**: 64 hex characters (256 bits of entropy)
- **Database Password**: 32 random characters (letters, numbers, special chars)
- **Redis Password**: 32 random characters (letters, numbers, special chars)

### No Default Credentials

- ❌ No "admin/admin123"
- ❌ No "changeme" passwords
- ❌ No hardcoded secrets
- ✅ Every installation has unique credentials
- ✅ Cryptographically secure random generation

### Credential Storage

All credentials stored in:
- `.env` files (gitignored, never committed)
- `SETUP-SUMMARY.txt` (backup to secure location)
- Environment variables (runtime only)

---

## 📝 Full Deployment Steps

### 1. Transfer Application to Unraid

```bash
# From Windows
scp -r C:\Users\Spenc\MMVPS\medicine-man root@192.168.4.21:/mnt/user/appdata/

# Or create tarball first (faster)
tar -czf medicine-man.tar.gz medicine-man/
scp medicine-man.tar.gz root@192.168.4.21:/mnt/user/appdata/
ssh root@192.168.4.21
cd /mnt/user/appdata
tar -xzf medicine-man.tar.gz
```

### 2. Run Setup Wizard

```bash
cd /mnt/user/appdata/medicine-man

# Interactive configuration (5 minutes)
docker compose run --rm backend npm run setup:wizard
```

**Wizard Prompts:**

```
═══ Network Configuration ═══
Server IP address (e.g., 192.168.4.21): 192.168.4.21
Frontend port (default: 8091): 8091
Do you have a custom domain? (yes/no): no

═══ Unraid Configuration ═══
PUID (default: 99): 99
PGID (default: 100): 100

═══ Database Configuration ═══
Database user (default: medicine_user): [ENTER]
Database name (default: medicine_man): [ENTER]
✓ Generated database password: a3k9s2... (saved to .env)

═══ Redis Configuration ═══
✓ Generated Redis password: x7m4p9... (saved to .env)

═══ Security Secrets ═══
✓ Generated JWT secret: 3f1d7666...
✓ Generated session secret: 812d4985...
✓ Generated encryption key: cd602456...

═══ Notifications (Optional) ═══
Configure email notifications? (yes/no): no

═══ Configuration Summary ═══
Server IP: 192.168.4.21:8091
CORS Origin: http://192.168.4.21:8091
Database: medicine_user@medicine_man
Notifications: Disabled
Unraid UID:GID: 99:100

Save this configuration? (yes/no): yes

✓ Created: /mnt/user/appdata/medicine-man/.env
✓ Created: /mnt/user/appdata/medicine-man/backend/.env
✓ Created backups with timestamp
✓ Created setup summary: SETUP-SUMMARY.txt
```

### 3. Backup Your Credentials

**⚠️ CRITICAL STEP ⚠️**

```bash
# Copy SETUP-SUMMARY.txt to a secure location
cp SETUP-SUMMARY.txt /mnt/user/secure-backups/medicine-man-credentials.txt

# Or email it to yourself
cat SETUP-SUMMARY.txt | mail -s "Medicine Man Credentials" your@email.com

# Or copy to USB drive
cp SETUP-SUMMARY.txt /mnt/usb/medicine-man-backup/
```

**Store this file:**
- ✅ Password manager (1Password, Bitwarden, etc.)
- ✅ Encrypted USB drive
- ✅ Secure cloud storage (encrypted)
- ✅ Printed and stored in safe
- ❌ NOT in the same directory
- ❌ NOT committed to git

### 4. Build and Start Containers

```bash
# Build containers (10-15 minutes first time)
docker compose build

# Start all services
docker compose up -d

# Wait for all services to be healthy (60 seconds)
watch docker compose ps

# When all show "healthy", proceed
```

### 5. Initialize Database

```bash
# Run migrations
docker compose exec backend npm run migrate

# Verify all migrations applied
docker compose exec backend npm run migrate -- list
```

**Expected output:**
```
> 001_initial_schema.sql
> 002_performance_indexes.sql
... (all migrations should show as applied)
```

### 6. Create User Accounts

```bash
# Interactive user creation
docker compose exec backend npm run setup:users
```

**Follow prompts to create:**
- **admin** (admin role)
- **Kaos** (admin role)
- **zeus** (user role)
- **marlon** (user role)
- **s3rpant** (user role)

**Password requirements automatically enforced:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### 7. Verify Deployment

```bash
# Check all containers
docker compose ps

# Check logs
docker compose logs --tail=50

# Test health endpoint
curl http://192.168.4.21:3000/health
```

**Expected:**
```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2025-01-05T10:30:00.000Z",
  "uptime": 45.123
}
```

### 8. Access Application

**Open browser:** http://192.168.4.21:8091

**Login with created credentials**

---

## 🔄 Reconfiguration

If you need to change configuration later:

```bash
cd /mnt/user/appdata/medicine-man

# Re-run wizard (will prompt to overwrite)
docker compose run --rm backend npm run setup:wizard

# Or manually edit .env files
nano backend/.env
nano .env

# Restart services
docker compose restart
```

---

## 🆘 Troubleshooting

### "Configuration files already exist"

The wizard detected existing `.env` files:

```bash
# Option 1: Overwrite (wizard will ask)
docker compose run --rm backend npm run setup:wizard
# Answer "yes" when prompted

# Option 2: Backup and start fresh
mv .env .env.old
mv backend/.env backend/.env.old
docker compose run --rm backend npm run setup:wizard
```

### "Cannot connect to database"

Database credentials may be incorrect:

```bash
# Check credentials match in both .env files
cat .env | grep DB_PASSWORD
cat backend/.env | grep DB_PASSWORD

# Should be identical!

# If different, fix and restart
docker compose restart postgres backend
```

### "Permission denied" errors

PUID/PGID may be wrong:

```bash
# For Unraid, use 99:100
# Edit .env
PUID=99
PGID=100

# Recreate containers
docker compose down
docker compose up -d
```

---

## 📊 What Gets Created

After wizard completion, you'll have:

```
medicine-man/
├── .env                          # Root environment (DB, Redis, PUID/PGID)
├── .env.backup.2025-01-05...     # Timestamped backup
├── SETUP-SUMMARY.txt             # ALL CREDENTIALS (backup this!)
├── backend/
│   ├── .env                      # Backend environment (secrets, config)
│   └── .env.backup.2025-01-05... # Timestamped backup
└── ... (application files)
```

**Security notes:**
- ✅ All `.env` files are in `.gitignore`
- ✅ Backups created with timestamps
- ✅ SETUP-SUMMARY contains everything for disaster recovery
- ⚠️ **Backup SETUP-SUMMARY.txt immediately!**

---

## ✅ Post-Setup Checklist

- [ ] Wizard completed successfully
- [ ] SETUP-SUMMARY.txt backed up to secure location
- [ ] All containers showing "healthy"
- [ ] Database migrations completed
- [ ] User accounts created
- [ ] Can login to http://192.168.4.21:8091
- [ ] Health endpoint responds
- [ ] Cloudflare tunnel configured (if using)
- [ ] Email notifications tested (if configured)
- [ ] First backup schedule created

---

## 🎉 You're Ready!

Medicine Man is now running with unique, cryptographically secure credentials.

**Next steps:**
1. Add your first server
2. Run a test scan
3. Create a backup schedule
4. Configure notifications

**Important:**
- ✅ SETUP-SUMMARY.txt is in a safe place
- ✅ `.env` files are never committed to git
- ✅ Change your user passwords if desired (Settings → Change Password)

---

## 📞 Need Help?

**Check logs:**
```bash
docker compose logs -f backend
```

**Verify configuration:**
```bash
cat SETUP-SUMMARY.txt
```

**Re-run wizard:**
```bash
docker compose run --rm backend npm run setup:wizard
```

**Happy Backup Management!** 🚀
