# 🚀 Production Security Checklist

Sử dụng checklist này trước khi deploy production và trong quá trình audit định kỳ.

---

## ☑️ PRE-DEPLOYMENT CHECKLIST

### 1. Environment Variables
- [ ] Tất cả secrets đã được set trong production env (không hardcode)
- [ ] `NODE_ENV=production`
- [ ] Supabase keys đúng cho production DB
- [ ] Bank account env vars đã set:
  - `BANK_TCB_ACCOUNT_NO`
  - `BANK_TCB_ACCOUNT_NAME`
  - `BANK_STB_ACCOUNT_NO`
  - `BANK_STB_ACCOUNT_NAME`
- [ ] `NEXT_PUBLIC_APP_URL` trỏ đến production domain

### 2. Database Security
- [ ] Chạy migration `security-tables.sql` trên production
- [ ] Kiểm tra tất cả RLS policies đang enabled
- [ ] Service role key KHÔNG expose trên client
- [ ] Database connection pooling enabled
- [ ] Regular backup scheduled

### 3. HTTPS & Domain
- [ ] SSL certificate valid và auto-renew
- [ ] TLS 1.3 preferred
- [ ] HSTS enabled (trong next.config.ts) ✅
- [ ] Domain verified trong Vercel/hosting
- [ ] WWW → non-WWW redirect (hoặc ngược lại)

### 4. CDN & DDoS Protection
- [ ] Cloudflare hoặc tương đương đã setup
- [ ] Rate limiting tại edge
- [ ] Bot protection enabled
- [ ] Under Attack Mode sẵn sàng khi cần

### 5. Monitoring & Alerts
- [ ] Error tracking (Sentry hoặc tương đương)
- [ ] Health check endpoint
- [ ] Uptime monitoring
- [ ] Alert channels (email, Telegram, Slack)

---

## ☑️ CODE SECURITY CHECKLIST

### Authentication
- [x] Passwords hashed với bcrypt (cost 12+)
- [x] Rate limiting cho login endpoint (10/15min)
- [x] Brute force protection (5 attempts → block 30min)
- [x] Generic error messages (không leak user exists)
- [x] Email verification required
- [ ] Refresh token rotation enabled (cần integrate)

### Authorization
- [x] Admin routes protected
- [x] Phoenix Protocol cho admin path
- [x] RLS policies trên sensitive tables
- [x] RBAC implementation

### Input Validation
- [x] Input sanitization utilities ✅
- [x] Magic bytes file validation ✅
- [x] File size limits (100MB)
- [x] Filename sanitization

### Security Headers
- [x] Content-Security-Policy ✅
- [x] X-Frame-Options ✅
- [x] X-Content-Type-Options ✅
- [x] Strict-Transport-Security ✅
- [x] Referrer-Policy ✅
- [x] Permissions-Policy ✅

### API Security
- [x] CORS configured ✅
- [x] Rate limiting per-route ✅
- [x] No sensitive data in logs ✅
- [x] Proper error handling

---

## ☑️ POST-DEPLOYMENT VERIFICATION

### Functional Tests
- [ ] Login/register flow works
- [ ] Password reset works
- [ ] Payment flow works
- [ ] File upload works
- [ ] Admin panel accessible

### Security Tests
- [ ] Check CSP headers (browser DevTools)
- [ ] Verify HTTPS redirect
- [ ] Test rate limiting (script)
- [ ] Check for exposed .env files
- [ ] Verify no source maps

### Performance Tests
- [ ] Page load < 3s
- [ ] API response < 500ms
- [ ] No memory leaks
- [ ] Database queries optimized

---

## ☑️ PERIODIC AUDIT (Hàng tháng)

### Access Review
- [ ] Review admin account list
- [ ] Remove unused accounts
- [ ] Check for suspicious sessions
- [ ] Review security logs

### Dependency Updates
- [ ] `npm audit` - kiểm tra vulnerabilities
- [ ] Update critical dependencies
- [ ] Test after updates

### Backup Verification
- [ ] Test backup restoration
- [ ] Verify backup encryption
- [ ] Check backup schedule

### Incident Readiness
- [ ] Incident response plan updated
- [ ] Contact list current
- [ ] Rollback procedure tested

---

## 🚨 INCIDENT RESPONSE QUICK REFERENCE

### Bị hack / Data breach:
1. **Cô lập**: Disable affected features
2. **Revoke**: Revoke all tokens & sessions
3. **Block**: Block suspicious IPs
4. **Analyze**: Export security logs
5. **Notify**: Notify affected users (if needed)
6. **Patch**: Fix vulnerability
7. **Document**: Post-mortem report

### DDoS Attack:
1. Enable Cloudflare Under Attack Mode
2. Increase rate limits tại edge
3. Block attacking countries/regions
4. Scale up if needed
5. Contact hosting support

### Account Takeover:
1. Lock affected account
2. Revoke all sessions
3. Force password reset
4. Review account activity
5. Notify user

---

## 📋 Environment Variables Template

```env
# === REQUIRED FOR PRODUCTION ===

# App
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# NextAuth
NEXTAUTH_SECRET=generate-strong-secret-here
NEXTAUTH_URL=https://your-domain.com

# Bank Accounts
BANK_TCB_ACCOUNT_NO=xxx
BANK_TCB_ACCOUNT_NAME=xxx
BANK_STB_ACCOUNT_NO=xxx
BANK_STB_ACCOUNT_NAME=xxx

# Email (optional)
RESEND_API_KEY=xxx
EMAIL_FROM=noreply@your-domain.com

# Google Drive (optional)
GOOGLE_DRIVE_CLIENT_ID=xxx
GOOGLE_DRIVE_CLIENT_SECRET=xxx
GOOGLE_DRIVE_REDIRECT_URI=https://your-domain.com/api/drive/callback
```
