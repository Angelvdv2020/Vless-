# 3 Servers Architecture (3X-UI)

Актуальная схема:
- App server: Noryx API (`src/server.js`)
- 3X-UI server: управление inbound/clients
- DB server: PostgreSQL

Связи:
- App -> PostgreSQL
- App -> 3X-UI API
- User -> App (через Nginx)

Подробная инструкция и troubleshooting: `README.md`.
