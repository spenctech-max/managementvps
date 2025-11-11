# Medicine Man - Unraid Quick Reference

## 🚀 Quick Start

```bash
cd /mnt/user/appdata
git clone <repo> medicine-man
cd medicine-man
chmod +x deploy-unraid.sh
./deploy-unraid.sh
```

Access: `http://YOUR_UNRAID_IP:8091`  
Login: `admin` / `Admin123!` (change immediately!)

---

## 📊 Resource Usage

| Component | RAM | CPU | Storage |
|-----------|-----|-----|---------|
| PostgreSQL | 1.5GB | 1.5 | 2GB |
| Backend | 2GB | 1.5 | 500MB |
| Redis | 512MB | 0.5 | 100MB |
| Frontend | 256MB | 0.5 | 100MB |
| **Total** | **~4GB** | **~4 cores** | **~10GB** |

---

## 🔧 Key Optimizations

### Storage
- ✅ `/mnt/user/appdata/medicine-man` structure
- ✅ Array-optimized PostgreSQL (HDD-friendly)
- ✅ Longer checkpoint intervals (less writes)

### Permissions
- ✅ PUID=99 (nobody), PGID=100 (users)
- ✅ All files owned correctly

### Performance
- ✅ Reduced memory footprint (-33%)
- ✅ Conservative worker processes
- ✅ Log rotation (30MB max per container)

---

## 🎯 Optimal Configuration

### If Appdata on Cache (SSD)
Edit `postgres-custom.conf`:
```ini
random_page_cost = 1.1
effective_io_concurrency = 200
```

### If Appdata on Array (HDD)
Keep defaults (already optimized)

---

## 📝 Essential Commands

```bash
# View logs
docker-compose logs -f

# Restart all
docker-compose restart

# Stop all
docker-compose stop

# Start all
docker-compose start

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Database backup
docker exec medicine_man_postgres pg_dump -U medicine_user medicine_man > backup.sql

# Check health
docker ps
curl http://localhost:3000/health
```

---

## 🔐 Security Checklist

- [ ] Changed admin password
- [ ] Generated unique secrets in `.env`
- [ ] Set strong DB_PASSWORD
- [ ] Set strong REDIS_PASSWORD
- [ ] Configured firewall rules
- [ ] Enabled HTTPS (via reverse proxy)

---

## 🩺 Health Check

```bash
# All should show "healthy"
docker ps | grep medicine_man

# Should return 200 OK
curl -I http://localhost:3000/health
curl -I http://localhost:8091/
```

---

## 🐛 Common Issues

### Permission Denied
```bash
chown -R 99:100 /mnt/user/appdata/medicine-man
chmod -R 755 /mnt/user/appdata/medicine-man
```

### Port Conflicts
Edit `.env`:
```env
BACKEND_PORT=3001
FRONTEND_PORT=8092
```

### Slow Performance
Move appdata to cache:
- Unraid UI → Shares → appdata
- Primary storage = Cache
- Run mover

### Out of Memory
Reduce limits in `docker-compose.yml`:
```yaml
mem_limit: 1G  # Reduce as needed
```

---

## 📚 Documentation

- **Full Guide**: `UNRAID-DEPLOYMENT-GUIDE-OPTIMIZED.md`
- **Optimizations**: `UNRAID-OPTIMIZATIONS-SUMMARY.md`
- **Main README**: `README.md`

---

## 🔄 Update Process

```bash
cd /mnt/user/appdata/medicine-man
git pull
docker-compose build --no-cache
docker-compose down
docker-compose up -d
```

---

## 💾 Backup Strategy

### Daily (Automated)
- Logs rotated automatically

### Weekly
```bash
# Database backup
docker exec medicine_man_postgres pg_dump -U medicine_user medicine_man > \
  /mnt/user/backups/medicine-man-$(date +%Y%m%d).sql
```

### Monthly
```bash
# Full backup
docker-compose stop
tar -czf /mnt/user/backups/medicine-man-full-$(date +%Y%m%d).tar.gz \
  /mnt/user/appdata/medicine-man
docker-compose start
```

---

## 📞 Support

- GitHub Issues: [Create issue with logs]
- Unraid Forums: [Search or post]
- Logs: `docker-compose logs > medicine-man-logs.txt`

---

## ⚡ Performance Tips

1. **Use SSD cache** for appdata (critical!)
2. **Allocate 6GB RAM** minimum to Unraid
3. **Run on dedicated network** (custom bridge)
4. **Monitor disk I/O** with `iostat -x 2`
5. **Schedule scans** during off-peak hours

---

## 🎉 Features

- ✅ Server management (SSH)
- ✅ Automated scanning
- ✅ Backup scheduling
- ✅ Real-time terminal
- ✅ User management
- ✅ Role-based access
- ✅ API access
- ✅ Queue system (BullMQ)

---

**Version**: Optimized for Unraid (Nov 2025)  
**Status**: Production Ready ✅
