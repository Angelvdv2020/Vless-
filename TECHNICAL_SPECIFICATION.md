# Technical Specification (current)

## Core stack
- Node.js/Express backend
- PostgreSQL database
- 3X-UI integration service
- Static frontend from `public/`

## API groups
- `/api/vpn/*` user VPN actions
- `/api/admin/*` admin actions
- `/api/admin/x3ui/*` 3X-UI operations

## Database entities
- `users`
- `subscriptions`
- `vpn_configs`
- `vpn_keys`
- `connection_logs`
- `available_countries`

Полная operational-спецификация: `README.md`.
