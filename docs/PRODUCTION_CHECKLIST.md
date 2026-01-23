# 🚀 Production Deployment Checklist

## Pre-Deployment

### Environment Variables
- [ ] All required env vars configured in Vercel
- [ ] `NEXTAUTH_SECRET` is a strong random string (32+ chars)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (NOT the anon key)
- [ ] R2 storage credentials configured
- [ ] SMTP credentials configured
- [ ] Bank details configured for payments

### Database
- [ ] Supabase project in production region
- [ ] Row Level Security (RLS) enabled on all tables
- [ ] Database backups enabled (daily)
- [ ] Connection pooling configured

### Security
- [ ] HTTPS enforced (automatic on Vercel)
- [ ] Security headers configured in `vercel.json`
- [ ] Admin emails configured in env
- [ ] Rate limiting active on auth endpoints

---

## Deployment Steps

### 1. Connect Repository
```bash
vercel link
```

### 2. Configure Environment
```bash
vercel env add NEXTAUTH_SECRET production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... add all env vars
```

### 3. Deploy
```bash
vercel --prod
```

### 4. Verify
- [ ] Homepage loads correctly
- [ ] API endpoints respond
- [ ] Authentication works
- [ ] File uploads work
- [ ] Email sending works

---

## Post-Deployment

### Monitoring
- [ ] Set up Vercel Analytics
- [ ] Configure Sentry for error tracking (optional)
- [ ] Enable Vercel Speed Insights

### Performance
- [ ] Run Lighthouse audit (target: 90+ all categories)
- [ ] Check Core Web Vitals in Vercel dashboard
- [ ] Enable image optimization

### Backup Strategy
- [ ] Supabase automatic backups enabled
- [ ] Export critical data weekly
- [ ] Test restore procedure quarterly

---

## Emergency Procedures

### Rollback
```bash
vercel rollback
```

### Database Issues
1. Check Supabase dashboard for errors
2. Review recent migrations
3. Restore from backup if needed

### Security Incident
1. Rotate all secrets immediately
2. Review access logs
3. Disable compromised accounts
4. Notify affected users

---

## Maintenance Schedule

| Task | Frequency |
|------|-----------|
| Database backup verification | Weekly |
| Dependency updates | Monthly |
| Security audit | Quarterly |
| Performance review | Monthly |
| Log cleanup | Weekly |

---

## Contacts

| Role | Contact |
|------|---------|
| DevOps | [Your Contact] |
| Security | [Your Contact] |
| Database | [Your Contact] |
