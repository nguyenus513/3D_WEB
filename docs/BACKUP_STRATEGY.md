# 💾 Backup Strategy Documentation

## Overview

This document outlines the backup and disaster recovery strategy for the 3D Printing E-commerce platform.

---

## Backup Components

### 1. Database (Supabase PostgreSQL)

| Aspect | Configuration |
|--------|---------------|
| **Provider** | Supabase |
| **Automatic Backups** | Daily (Pro plan) |
| **Point-in-Time Recovery** | Yes (7 days) |
| **Manual Export** | Weekly recommended |

#### Manual Backup Command
```bash
# Export database via Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d).sql
```

#### Critical Tables
- `profiles` - User accounts
- `orders` - Customer orders
- `products` - Product catalog
- `addresses` - Shipping addresses
- `verification_tokens` - Auth tokens
- `security_logs` - Audit trail

---

### 2. File Storage (Cloudflare R2)

| Aspect | Configuration |
|--------|---------------|
| **Provider** | Cloudflare R2 |
| **Versioning** | Enable recommended |
| **Replication** | Automatic (multi-region) |

#### Backup Files
- User uploaded STL/OBJ files
- Product images
- Order attachments

#### Sync to Secondary Storage
```bash
# Using rclone
rclone sync r2:bucket-name backup-location:bucket-backup
```

---

### 3. Codebase (GitHub)

| Aspect | Configuration |
|--------|---------------|
| **Repository** | Private GitHub repo |
| **Branch Protection** | main branch protected |
| **Backup** | Automatic (GitHub) |

---

## Backup Schedule

| Component | Frequency | Retention |
|-----------|-----------|-----------|
| Database (auto) | Daily | 7 days |
| Database (manual) | Weekly | 30 days |
| R2 Files | Real-time versioning | 30 days |
| Code | Every push | Indefinite |

---

## Recovery Procedures

### Database Recovery

#### From Supabase Dashboard
1. Go to **Database → Backups**
2. Select backup point
3. Click **Restore**

#### From Manual Backup
```bash
# Restore from SQL dump
supabase db restore -f backup_20260123.sql
```

### File Storage Recovery

#### Single File
```bash
# Restore specific version
aws s3api get-object \
  --bucket your-bucket \
  --key path/to/file \
  --version-id VERSION_ID \
  output-file
```

#### Full Bucket
```bash
rclone sync backup-location:bucket-backup r2:bucket-name
```

---

## Testing Schedule

| Test | Frequency | Responsible |
|------|-----------|-------------|
| Database restore | Quarterly | DevOps |
| File restore | Quarterly | DevOps |
| Full DR drill | Annually | Team |

---

## Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Database failure | 1 hour | 24 hours |
| File storage failure | 30 min | Real-time |
| Complete system failure | 4 hours | 24 hours |

---

## Monitoring & Alerts

- Supabase dashboard for database health
- Cloudflare dashboard for R2 storage
- Vercel dashboard for application status

### Alert Channels
- Email notifications
- Slack integration (optional)
