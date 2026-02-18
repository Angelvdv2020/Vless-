# E2E Smoke Report

## Environment
- Repository: `/workspace/Vless-`
- Date: automated in CI/container environment
- Note: container does not provide configured PostgreSQL/3X-UI/GigaChat credentials.

## Scenario Checklist

1. Registration user
2. Login user
3. Redirect to cabinet
4. Smart connect
5. Logout
6. Login admin
7. Admin create user
8. Admin create subscription
9. Admin sync 3X-UI
10. Builder create section draft/publish
11. Landing shows published section

## Executed commands and logs

### 1) Syntax/build checks
```bash
npm run build
node -c src/server.js
node -c src/routes/site-builder.js
node -c src/routes/admin.js
node -c src/routes/auth.js
node -c src/routes/site-content.js
node -c src/services/health.js
node -c src/services/password.js
```
Result: passed.

### 2) Health dependency check under mocked env
```bash
PORT=3110 DB_HOST=127.0.0.1 DB_PORT=5432 DB_NAME=noryx_vpn DB_USER=noryx_admin DB_PASSWORD=bad JWT_SECRET=testsecret X3UI_API_URL=https://127.0.0.1:2053 X3UI_USERNAME=admin X3UI_PASSWORD=bad ALLOWED_ORIGINS=http://localhost:3110 npm start
curl -s -o /tmp/health.json -w "%{http_code}" http://127.0.0.1:3110/health
```
HTTP status: `503`

Response body:
```json
{"status":"degraded","service":"Noryx Premium VPN","ok":false,"dependencies":{"database":{"ok":false,"error":"connect ECONNREFUSED 127.0.0.1:5432"},"x3ui":{"ok":false,"error":"connect ECONNREFUSED 127.0.0.1:2053"},"aiProvider":{"ok":true,"skipped":true,"reason":"AI_TEXT_ENABLED=false"}}}
```

Interpretation: health gate works and blocks `200` when required dependencies are unavailable.

## Browser artifact attempt

Attempted to capture screenshot via Playwright on `http://127.0.0.1:3111/`.

Outcome: failed in this environment with network reset (`NS_ERROR_NET_RESET`), no artifact produced.

## Repro on clean target environment

To complete full E2E, deploy with:
- working PostgreSQL,
- reachable 3X-UI,
- optionally GigaChat credentials and `AI_TEXT_ENABLED=true`.

Then run the exact scenario from `README.md` section "E2E smoke сценарий".
