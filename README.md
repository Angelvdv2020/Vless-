# Noryx Premium VPN

Production-ready MVP for VPN platform:
- user/admin auth with role-based redirect,
- VPN provisioning via 3X-UI,
- admin panel,
- site-builder with draft/publish/rollback,
- optional AI text generation via GigaChat.

## 1. Обязательные ENV и поведение при отсутствии

### 1.1 Обязательные переменные (без них сервер НЕ запустится)

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=noryx_vpn
DB_USER=noryx_admin
DB_PASSWORD=CHANGE_ME
JWT_SECRET=CHANGE_ME_LONG_RANDOM
X3UI_API_URL=https://YOUR_3XUI_HOST:2053
X3UI_USERNAME=admin
X3UI_PASSWORD=CHANGE_ME
```

Поведение при отсутствии: процесс завершится на старте с ошибкой `Missing required env vars`.

### 1.2 Рекомендуемые переменные

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://your-domain.com
AUTH_RATE_LIMIT_MAX=10
TRUST_PROXY=1
AI_TEXT_ENABLED=false
AI_REQUEST_TIMEOUT_MS=30000
```

Если `NODE_ENV=production` и не задан `ALLOWED_ORIGINS`, сервер завершится на старте.

### 1.3 Переменные GigaChat (только если AI_TEXT_ENABLED=true)

```env
GIGACHAT_AUTH_KEY=BASE64(client_id:client_secret)
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_AUTH_URL=https://ngw.devices.sberbank.ru:9443/api/v2/oauth
GIGACHAT_API_URL=https://gigachat.devices.sberbank.ru/api/v1/chat/completions
GIGACHAT_MODEL=GigaChat:latest
```

Если `AI_TEXT_ENABLED=true` и нет `GIGACHAT_AUTH_KEY`:
- `/health` вернет `503`,
- AI endpoint вернет graceful fallback, а не падение всего проекта.


### 1.4 Если запуск через Nginx/Cloudflare/балансировщик

Чтобы `express-rate-limit` корректно работал с заголовком `X-Forwarded-For`, добавьте в `.env`:

```env
TRUST_PROXY=1
```

Если прокси-цепочка сложная, можно указать:
- `TRUST_PROXY=true` (доверять всем прокси),
- или конкретное число хопов (`1`, `2`, ...).

---

## 2. Пошаговая установка (без "догадайся сам")

Все команды ниже выполняются на Ubuntu/Debian.

### Шаг 1. Пакеты ОС

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y curl git nano ufw nginx postgresql postgresql-contrib
```

### Шаг 2. Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

### Шаг 3. PostgreSQL

```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql --no-pager
```

Войти в БД:

```bash
sudo -u postgres psql
```

Создать БД и пользователя:

```sql
CREATE DATABASE noryx_vpn;
CREATE USER noryx_admin WITH ENCRYPTED PASSWORD 'CHANGE_ME';
GRANT ALL PRIVILEGES ON DATABASE noryx_vpn TO noryx_admin;
```

Как выйти из psql:

```sql
\q
```

(если не вышло — `Ctrl + D`).

### Шаг 4. Репозиторий проекта

```bash
cd /opt
git clone https://github.com/Angelvdv2020/Vless-.git noryx-vpn
cd /opt/noryx-vpn
pwd
```

`pwd` должен показать `/opt/noryx-vpn`.

### Шаг 5. Установка npm зависимостей

```bash
npm install
```

### Шаг 6. Установка 3X-UI

```bash
bash <(curl -L https://raw.githubusercontent.com/mhsanaei/3x-ui/main/install.sh)
```

В 3X-UI создайте inbound и проверьте доступ API.

### Шаг 7. Создание `.env`

```bash
nano .env
```

Заполните обязательные переменные из раздела 1.

### Шаг 8. Инициализация БД

```bash
npm run init-db
```

### Шаг 9. Проверка синтаксиса

```bash
npm run build
```

### Шаг 10. Старт

```bash
npm start
```

---

## 3. Health-check зависимостей

### Endpoint

`GET /health`

### Логика

Возвращает `200` только если:
- доступна БД,
- доступен 3X-UI,
- AI provider доступен (или AI выключен флагом `AI_TEXT_ENABLED=false`).

Иначе возвращает `503` с деталями по зависимостям.

---

## 4. Security hardening (реализовано)

- CORS whitelist через `ALLOWED_ORIGINS`.
- В production нельзя запускать без `ALLOWED_ORIGINS`.
- Rate-limit на:
  - `/api/auth/login`
  - `/api/auth/register`
- `userId` берется из JWT (`req.user.id`), не из body.
- Удален дублирующий admin-login flow: единый `/api/auth/login`.

Подробный чек-лист: `SECURITY_CHECKLIST.md`.

---

## 5. Site-builder scope (product completeness)

Поддерживаемые сущности:
- `hero`
- `features`
- `pricing`
- `faq`
- `footer`

Реализовано:
- draft сохранение,
- publish,
- rollback на выбранную версию,
- публичный endpoint опубликованного контента.

Endpoints:
- `GET /api/admin/site-builder/content`
- `PUT /api/admin/site-builder/content/:key`
- `POST /api/admin/site-builder/content/:key/publish`
- `POST /api/admin/site-builder/content/:key/rollback`
- `GET /api/admin/site-builder/content/:key/versions`
- `GET /api/site-content/published`

---

## 6. AI часть (production behavior)

- Feature-flag: `AI_TEXT_ENABLED=true|false`
- Graceful fallback: при сбое AI API проект не падает
- Таймаут: `AI_REQUEST_TIMEOUT_MS`
- Audit log генераций: таблица `ai_generation_logs`

Endpoint:
- `POST /api/admin/site-builder/ai/text`

---

## 7. E2E smoke сценарий (обязательный)

См. `E2E_SMOKE_REPORT.md`.

Там зафиксирована цепочка:
1. Регистрация пользователя
2. Login user
3. Smart connect
4. Logout
5. Login admin
6. Admin create user
7. Admin create subscription
8. Admin sync 3X-UI
9. Builder create/publish section
10. Проверка отображения секции на landing

---

## 8. Definition of Done

Финальный DoD и статусы: `DEFINITION_OF_DONE.md`.

---

## 9. Полезные команды

```bash
# Запуск
cd /opt/noryx-vpn && npm start

# Dev
cd /opt/noryx-vpn && npm run dev

# Проверка синтаксиса
cd /opt/noryx-vpn && npm run build

# Инициализация БД
cd /opt/noryx-vpn && npm run init-db

# Проверка health
curl -s http://127.0.0.1:3000/health
```

---

## 10. ЧАСТЬ 5: КОНФИГУРАЦИЯ NGINX (исправленная, пошагово)

Ниже рабочая последовательность **без догадок**.

### 10.1 Установите certbot (если ещё не установлен)

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

### 10.2 Создайте временный HTTP-конфиг (для первичного выпуска SSL)

```bash
sudo nano /etc/nginx/sites-available/noryx
```

Вставьте (замените `example.com` на ваш домен):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 10.3 Включите конфиг и проверьте синтаксис

```bash
sudo ln -sf /etc/nginx/sites-available/noryx /etc/nginx/sites-enabled/noryx
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 10.4 Получите SSL сертификат

```bash
sudo certbot certonly --nginx -d example.com -d www.example.com
```

Проверьте, что сертификаты есть:

```bash
sudo ls -la /etc/letsencrypt/live/example.com/
```

Должны быть минимум:
- `fullchain.pem`
- `privkey.pem`

### 10.5 Переключите конфиг на HTTPS + редирект с HTTP

```bash
sudo nano /etc/nginx/sites-available/noryx
```

Вставьте:

```nginx
# HTTP -> HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 20M;
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;

    access_log /var/log/nginx/noryx_access.log;
    error_log /var/log/nginx/noryx_error.log;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Статика: кэш через заголовки (без proxy_cache_path)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

### 10.6 Примените изменения

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Ожидаемо:
- `nginx: ... syntax is ok`
- `nginx: ... test is successful`

### 10.7 Автообновление сертификата

Проверка dry-run:

```bash
sudo certbot renew --dry-run
```

---

## 11. Частые ошибки в Nginx/SSL и как исправить

### Ошибка: `cannot load certificate`
Причина: неверный путь или сертификат не выпущен.

Проверьте:

```bash
sudo ls -la /etc/letsencrypt/live/example.com/
```

### Ошибка: `nginx: [emerg] unknown directive "proxy_cache_valid"`
Причина: использована директива кэша без глобального `proxy_cache_path`.

Решение: используйте вариант как в этом README (через `expires` + `Cache-Control`) либо отдельно настраивайте `proxy_cache_path` в `nginx.conf`.


### Ошибка certbot: `ModuleNotFoundError: No module named _cffi_backend` / `pyo3_runtime.PanicException`
Причина: сломан Python-стек системного certbot (обычно конфликт `python3-cryptography`/`pyOpenSSL`/`cffi`).

Это **не ошибка Nginx**. Ваш `nginx -t` уже успешно проходит.

Рекомендуемое исправление (самый надежный путь) — перейти на certbot через snap:

```bash
# 1) Удалить apt-версии certbot
sudo apt-get remove -y certbot python3-certbot-nginx
sudo apt-get autoremove -y

# 2) Переустановить python-библиотеки (если остались поломанные зависимости)
sudo apt-get install -y --reinstall python3-cryptography python3-openssl python3-cffi-backend

# 3) Установить certbot через snap
sudo apt-get install -y snapd
sudo systemctl enable --now snapd
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot

# 4) Проверить, что запускается
certbot --version
```

После этого снова выпустите сертификат:

```bash
sudo certbot certonly --nginx -d servervpn.store -d www.servervpn.store
```

Если всё ещё ошибка, проверьте базовые условия выпуска сертификата:

```bash
# DNS должен указывать на ваш сервер
getent hosts servervpn.store
getent hosts www.servervpn.store

# Порт 80 должен быть доступен снаружи
sudo ufw status
sudo ss -tulpn | rg ':80|:443'
```

### Ошибка: certbot не проходит challenge
Причины:
- DNS домена не указывает на сервер,
- порт 80 закрыт,
- конфликтующий Nginx-конфиг.

Проверьте:

```bash
dig +short example.com
sudo ufw status
sudo nginx -t
```
