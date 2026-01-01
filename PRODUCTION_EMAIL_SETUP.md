# Production Email Setup - Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Get Resend API Key
```
1. Visit: https://resend.com/signup
2. Create account
3. Go to: API Keys → Create API Key
4. Copy key (starts with re_)
```

### 2. Configure Domain (Optional but Recommended)
```
1. Resend Dashboard → Domains → Add Domain
2. Add DNS records provided by Resend
3. Wait 5-10 minutes for verification
```

### 3. Set Environment Variables on Render
```bash
# Go to: Render Dashboard → Your Service → Environment

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPPORT_SENDER_EMAIL=support@yourdomain.com
SUPPORT_RECEIVER_EMAIL=support@yourdomain.com
```

### 4. Deploy
```bash
git push origin main
# Render auto-deploys
```

---

## ✅ Verification Checklist

- [ ] Resend account created
- [ ] API key generated
- [ ] Domain verified (if using custom domain)
- [ ] Environment variables set on Render
- [ ] Backend deployed successfully
- [ ] Test email sent and received
- [ ] No errors in production logs

---

## 🧪 Test Command

```bash
curl -X POST https://your-backend.onrender.com/api/v1/support/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Production Test",
    "category": "Testing",
    "description": "Verifying email system works in production"
  }'
```

**Expected:**
- ✅ HTTP 201 response
- ✅ Reference ID in response
- ✅ Email received within 5 seconds

---

## 📊 Monitor These Logs

**Success:**
```
[INFO] Support ticket email sent successfully
```

**Warning (OK in dev):**
```
[WARN] RESEND_API_KEY not configured
```

**Error (needs attention):**
```
[ERROR] Failed to send support ticket email
```

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| No email received | Check spam, verify API key is set |
| "Not configured" warning | Add RESEND_API_KEY to environment |
| Domain not verified | Wait 10 mins, check DNS records |
| API slow | This shouldn't happen - email is async |

---

## 📞 Support

- **Resend Dashboard:** https://resend.com/dashboard
- **Resend Docs:** https://resend.com/docs
- **Check Logs:** Render Dashboard → Logs

---

## 🎯 Key Points

1. **No SMTP** - Uses HTTPS API
2. **Non-blocking** - API responds instantly
3. **Fail-safe** - Email errors don't break API
4. **Production-ready** - Works on all platforms

**You're all set! 🚀**
