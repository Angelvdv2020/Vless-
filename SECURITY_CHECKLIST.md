# SECURITY CHECKLIST

## Status
- [x] CORS whitelist is configurable via `ALLOWED_ORIGINS`.
- [x] Production startup is blocked if `ALLOWED_ORIGINS` is missing.
- [x] Rate limit enabled for `/api/auth/login`.
- [x] Rate limit enabled for `/api/auth/register`.
- [x] Duplicate admin auth flow removed.
- [x] JWT required for admin endpoints.
- [x] `userId` is taken from JWT (`req.user.id`) in VPN flow.
- [x] AI endpoint has feature flag and graceful fallback.

## Manual review commands
```bash
rg -n "ALLOWED_ORIGINS|AUTH_RATE_LIMIT_MAX|/api/auth/login|/api/auth/register" src/server.js
rg -n "req\.user\.id|userId" src/routes/vpn.js
rg -n "router.post\('/auth/login'|router.use\(adminAuth\)" src/routes/auth.js src/routes/admin.js
```
