# Pre-Deployment Checklist for Unraid

## BEFORE You Zip and Transfer

### 1. Update Root .env File
Edit `.env` and change:
```env
# Change these passwords to strong values:
DB_PASSWORD=YOUR_STRONG_DB_PASSWORD_HERE
REDIS_PASSWORD=YOUR_STRONG_REDIS_PASSWORD_HERE
```

### 2. Update Backend .env File  
Edit `backend/.env` and change:

**Line 5-6:** Set to production
```env
NODE_ENV=production
PORT=3000
```

**Line 10-11:** Change to Docker service names
```env
DB_HOST=postgres
DB_PORT=5432
```

**Line 13-14:** Match root .env passwords
```env
DB_PASSWORD=YOUR_STRONG_DB_PASSWORD_HERE  # Same as root .env
```

**Line 17:** Update DATABASE_URL
```env
DATABASE_URL=postgresql://medicine_user:YOUR_STRONG_DB_PASSWORD_HERE@postgres:5432/medicine_man
```

**Line 20-22:** Change to Docker service names
```env
REDIS_HOST=redis
REDIS_PORT=6379  
REDIS_PASSWORD=YOUR_STRONG_REDIS_PASSWORD_HERE  # Same as root .env
```

**Line 24-26:** Keep these (already generated)
```env
JWT_SECRET=3f1d7666523b0735ede5fe8deb6eaf23f739437170f83b48160a96c62215bf7a
SESSION_SECRET=812d4985952ab0e9684b3a5db097d48abb504885552236c00a606cc3b4dc41eb
ENCRYPTION_KEY=cd60245652691647a9748dc82dbcf6fd1d60a77622079f2fe8667810033b07c2
```

**Line 29:** Change to your Unraid IP
```env
CORS_ORIGIN=http://YOUR-UNRAID-IP:8091
```
Example: `CORS_ORIGIN=http://192.168.1.100:8091`

### 3. Verify Files Ready
- [ ] Root `.env` has strong passwords
- [ ] `backend/.env` has production settings
- [ ] `backend/.env` has Docker hostnames (postgres, redis)
- [ ] `backend/.env` has your Unraid IP in CORS_ORIGIN
- [ ] All passwords match between root and backend .env

### 4. Optional: Configure Email/Slack
If you want notifications, add to `backend/.env`:
```env
# Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=Medicine Man <noreply@yourdomain.com>

# Slack Notifications  
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

---

## Quick Update Script

Want me to help update these files automatically? Just run:
```bash
# I can help create a script to update these values
```

---

## After These Changes

Run the zip command to create deployment package:
```bash
# Coming next...
```

---

**Once .env files are updated, you're ready to create the deployment zip!**
