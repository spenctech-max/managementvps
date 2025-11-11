# Quick Start - Deploy to Unraid

## 📋 TL;DR - Fast Deployment

### 1. Transfer Files (Windows → Unraid)
```powershell
# On Windows Command Prompt/PowerShell
cd C:\Users\Spenc\MMVPS
scp -r medicine-man root@YOUR_UNRAID_IP:/mnt/user/appdata/
```

### 2. Deploy on Unraid
```bash
# SSH into Unraid
ssh root@YOUR_UNRAID_IP

# Navigate to folder
cd /mnt/user/appdata/medicine-man

# Run deployment
chmod +x deploy-updates.sh
./deploy-updates.sh
```

### 3. Create Users
When prompted, set passwords for these 5 users:
- **Admin** (admin) - Full admin access
- **Kaos** (admin) - Full admin access
- **zeus** (user) - Can review application
- **marlon** (user) - Can review application
- **s3rpant** (user) - Can review application

**Password Requirements:** 8+ chars, uppercase, lowercase, number

### 4. Access Application
- Frontend: `http://YOUR_UNRAID_IP:5173`
- Backend: `http://YOUR_UNRAID_IP:3000`

---

## 🚀 What Changed

✅ **Fixed login issues** - Database schema corrected
✅ **Removed self-enrollment** - Only admins can create users
✅ **Added password reset** - Users can reset passwords with admin help
✅ **5 local accounts** - Admin, Kaos, zeus, marlon, s3rpant

---

## 👥 User Accounts

| User     | Role  | Can Do                                    |
|----------|-------|-------------------------------------------|
| Admin    | admin | Everything + user management              |
| Kaos     | admin | Everything + user management              |
| zeus     | user  | View dashboards, servers, scans, backups  |
| marlon   | user  | View dashboards, servers, scans, backups  |
| s3rpant  | user  | View dashboards, servers, scans, backups  |

---

## 🔧 Common Commands

### View Logs
```bash
docker-compose logs -f
```

### Restart Services
```bash
docker-compose restart
```

### Create More Users Later
```bash
cd /mnt/user/appdata/medicine-man/backend
npm run setup:users
```

### Check Status
```bash
docker-compose ps
```

---

## ⚠️ Troubleshooting

### Can't login?
1. Check backend logs: `docker-compose logs backend`
2. Verify migration ran: Look for "Migrations completed" in deployment output
3. Reset database and re-run: `docker-compose down -v && ./deploy-updates.sh`

### Can't transfer files?
1. Verify Unraid IP: Check Unraid dashboard
2. Verify SSH enabled: Unraid Settings → SSH
3. Use WinSCP as alternative: https://winscp.net/

### Script won't run?
```bash
# Make executable
chmod +x deploy-updates.sh

# Or run manually:
docker-compose down
cd backend && npm run migrate && cd ..
cd backend && npm run setup:users && cd ..
docker-compose up -d --build
```

---

## 📖 Full Documentation

- **DEPLOY-TO-UNRAID.md** - Complete deployment guide
- **AUTHENTICATION-CHANGES.md** - Technical details
- **README.md** - Application overview

---

## 🎯 Success Checklist

After deployment, verify:

- [ ] All containers running: `docker-compose ps`
- [ ] Can login as Admin
- [ ] Can login as regular user (zeus/marlon/s3rpant)
- [ ] Admin can access `/users` page
- [ ] Regular users CANNOT access `/users` page
- [ ] Can view dashboards, servers, scans, backups

✅ **You're all set!**
