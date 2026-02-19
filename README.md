Noryx Premium VPN

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

## 2. Пошаговая установка (без "догадайся сам")

Все команды ниже выполняются на Ubuntu/Debian.

### Шаг 1. Пакеты ОС

# Noryx Premium VPN (3X-UI only)

Этот репозиторий теперь использует **только 3X-UI + Node.js API + PostgreSQL**.
Упоминания и сценарии legacy-провайдера удалены из рабочего контура.

## 1) Архитектура и совместимость

| Компонент | Версия | С чем совместим |
|---|---|---|
| Ubuntu / Debian | Ubuntu 22.04+ / Debian 12+ | Node.js 20, PostgreSQL 15, Nginx |
| Node.js | 20.x | Приложение API (`src/server.js`) |
| PostgreSQL | 15+ | Схема из `src/database/schema.sql` |
| 3X-UI | актуальный stable | Интеграция через `src/services/x3ui.js` |
| Nginx | 1.22+ | Reverse proxy для API и статики |

## 2) Пошаговая установка

### Шаг 1. Подготовка сервера

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


sudo apt-get install -y curl git nano ufw nginx
```

Открыть порты:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### Шаг 2. Установка Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

### Шаг 3. Установка PostgreSQL

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Создать БД и пользователя:

```bash
sudo -u postgres psql
CREATE DATABASE noryx_vpn;
CREATE USER noryx_admin WITH ENCRYPTED PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE noryx_vpn TO noryx_admin;
\q
```

### Шаг 4. Установка и настройка 3X-UI

```bash
bash <(curl -L https://raw.githubusercontent.com/mhsanaei/3x-ui/main/install.sh)
```

В панели 3X-UI:
1. Создайте inbound (например VLESS).
2. Запомните ID inbound.
3. Проверьте, что API панели доступен с сервера приложения.

### Шаг 5. Развертывание приложения

```bash
cd /opt
git clone https://github.com/Angelvdv2020/Vless-.git noryx-vpn
cd noryx-vpn
npm install
```

Создайте `.env`:

```env
PORT=3000
NODE_ENV=production

DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=noryx_vpn
DB_USER=noryx_admin
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD

JWT_SECRET=CHANGE_ME_LONG_RANDOM
ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD
HMAC_SECRET=CHANGE_ME_HMAC_SECRET
TOKEN_EXPIRY_SECONDS=300

X3UI_API_URL=https://YOUR_3XUI_HOST:2053
X3UI_USERNAME=admin
X3UI_PASSWORD=CHANGE_ME_3XUI_PASSWORD

ALLOWED_ORIGINS=https://YOUR_DOMAIN

# AI builder (optional)
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TEXT_MODEL=gpt-4o-mini
OPENAI_IMAGE_MODEL=gpt-image-1
```

Инициализируйте БД и проверьте синтаксис:

```bash
npm run init-db
npm run build
```

### Шаг 6. Запуск

## 6. AI часть (production behavior)

- Feature-flag: `AI_TEXT_ENABLED=true|false`
- Graceful fallback: при сбое AI API проект не падает
- Таймаут: `AI_REQUEST_TIMEOUT_MS`
- Audit log генераций: таблица `ai_generation_logs`

Endpoint:
- `POST /api/admin/site-builder/ai/text`

Проверка:

```bash
curl -s http://127.0.0.1:3000/health
``

Ожидаемый ответ: `{"status":"ok",...}`.

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

## 3) Команды управления

### Приложение

```bash
npm start              # запуск
npm run dev            # запуск с nodemon
npm run build          # проверка синтаксиса
npm run init-db        # инициализация схемы
```

### systemd (рекомендуется для production)

Создайте сервис `/etc/systemd/system/noryx-vpn.service`:


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
```ini
[Unit]
Description=Noryx VPN API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/noryx-vpn
ExecStart=/usr/bin/node /opt/noryx-vpn/src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Команды:

```bash
sudo systemctl daemon-reload
sudo systemctl enable noryx-vpn
sudo systemctl start noryx-vpn
sudo systemctl status noryx-vpn
journalctl -u noryx-vpn -f
```

### Nginx reverse proxy

Пример `/etc/nginx/sites-available/noryx-vpn`:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Применить:

```bash
sudo ln -s /etc/nginx/sites-available/noryx-vpn /etc/nginx/sites-enabled/noryx-vpn
sudo nginx -t
sudo systemctl reload nginx
```

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
## 4) Частые ошибки и решения

### Ошибка: `3X-UI login failed`
**Причина:** неверные `X3UI_USERNAME/X3UI_PASSWORD` или недоступен `X3UI_API_URL`.

**Проверка:**
```bash
curl -k -I https://YOUR_3XUI_HOST:2053
```

**Решение:** проверьте логин/пароль в `.env`, сетевую доступность и SSL.

### Ошибка: `No inbounds configured in 3X-UI`
**Причина:** в панели не создан inbound.

**Решение:** создайте inbound в 3X-UI и повторите запрос `/api/vpn/connect`.

### Ошибка БД: `password authentication failed`
**Причина:** неверные DB-параметры.

**Проверка:**
```bash
psql -h 127.0.0.1 -U noryx_admin -d noryx_vpn -c "SELECT 1;"
```

### Ошибка CORS: `Not allowed by CORS`
**Причина:** домен фронта не добавлен в `ALLOWED_ORIGINS`.

**Решение:** добавьте точный origin (без лишних слешей), перезапустите сервис.

---

## 5) Минимальная проверка сочетания компонентов

1. API поднимается: `/health` отвечает `ok`.
2. БД инициализируется: `npm run init-db` без ошибок.
3. 3X-UI доступен, логин успешен.
4. `/api/vpn/countries` возвращает список стран.
5. `/api/vpn/connect` создает/использует клиента в 3X-UI.

Если любой из пунктов падает — смотрите раздел «Частые ошибки и решения».

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
## 6) Что реализовано сейчас (по факту)

Ниже честная сверка с вашим ожидаемым сценарием.

### Ожидание: «полноценный сайт -> вход -> разный ЛК user/admin -> удалённое управление 3X-UI -> умная кнопка -> конструктор сайта»

### Факт в текущем рантайме

1. **Рабочий frontend в рантайме:**
   - сервер раздаёт статику только из папки `public/`;
   - там реально используются `public/index.html` и `public/admin.html`.

2. **User-flow:**
   - на `public/index.html` есть smart connect-кнопка и выбор страны;
   - endpoint для подключения: `POST /api/vpn/connect`.

3. **Admin-flow:**
   - `public/admin.html` — отдельная админ-панель с логином по паролю;
   - backend-логин админа: `POST /api/admin/auth/login`;
   - есть разделы управления пользователями/подписками/странами/логами и отдельные 3X-UI admin endpoints.

4. **3X-UI удалённое управление:**
   - реализовано через `src/services/x3ui.js` и `src/routes/admin-x3ui.js`.

5. **Что НЕ доведено до рабочего состояния в текущем runtime:**
   - полноценный пользовательский кабинет с register/login/cabinet из `web_extracted/web/pages/*` не подключён к текущему Express runtime;
   - «конструктор управления сайтом» как отдельный рабочий модуль/раздел в активном backend/frontend отсутствует.

Итого: **ядро VPN + админка + 3X-UI управление есть**, а **полный продуктовый web-кабинет и конструктор** сейчас лежат в виде заготовок/отдельного extracted-набора, но не в активном контуре запуска.

Ожидаемо:
- `nginx: ... syntax is ok`
- `nginx: ... test is successful`

### 10.7 Автообновление сертификата

Проверка dry-run:

```bash
sudo certbot renew --dry-run
=======
## 7) Как пользоваться проектом прямо сейчас

### 7.1 Запуск

```bash
npm install
npm run init-db
npm start
```

### 7.2 Куда заходить

## 11. Частые ошибки в Nginx/SSL и как исправить

### Ошибка: `cannot load certificate`
Причина: неверный путь или сертификат не выпущен.

Проверьте:

```bash
sudo ls -la /etc/letsencrypt/live/example.com/
```
- Пользовательский экран (smart connect): `http://HOST:3000/`
- Админ-панель: `http://HOST:3000/admin.html`

### 7.3 Как войти в админку

1. В `.env` задать:
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
2. На странице `/admin.html` ввести `ADMIN_PASSWORD`.
3. Панель получит JWT через `POST /api/admin/auth/login` и откроет секции управления.

### 7.4 Что может пользователь сейчас

- Выбрать страну;
- Нажать smart connect;
- Получить deep link / файл / QR в зависимости от платформы.

### 7.5 Что может админ сейчас

- Смотреть пользователей и подписки;
- Продлевать/отменять подписки;
- Управлять странами и смотреть логи;
- Выполнять операции 3X-UI (create/revoke/reset/stats/sync/cleanup).

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
=======
## 8) Где лежит «плановая» (расширенная) веб-часть

Файлы расширенного UI лежат в:
- `web_extracted/web/pages/login.html`
- `web_extracted/web/pages/register.html`
- `web_extracted/web/pages/cabinet.html`
- и другие страницы в `web_extracted/web/pages/`

Эти страницы **не подключены автоматически** к текущему `src/server.js` (он раздаёт `public/`).

Если хотите, следующим шагом я могу сделать отдельный план миграции:
1) подключить полноценный web-кабинет в runtime,
2) сделать role-based routing user/admin,
3) добавить/описать модуль «конструктор сайта» (если укажете, что именно должен конструировать: контент, тарифы, блоки лендинга, новости и т.д.).


## 9) Единый вход и роли (реализовано)

Теперь рабочий контур такой:

1. Пользователь заходит на `/login.html` или `/register.html`.
2. После успешного входа backend отдает JWT-сессию с ролью (`user` или `admin`).
3. Frontend делает redirect по роли:
   - `admin` -> `/admin.html`
   - `user` -> `/cabinet.html`
4. Smart Connect на главной (`/`) работает только с JWT (demo `USER_ID=1` убран).

API авторизации:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/profile`

## 10) Конструктор сайта + AI (реализовано)

Добавлен admin-only модуль конструктора:
- Страница: `/builder.html`
- API:
  - `GET /api/admin/site-builder/content`
  - `PUT /api/admin/site-builder/content/:key`
  - `POST /api/admin/site-builder/ai/text`
  - `POST /api/admin/site-builder/ai/image`

Хранение контента:
- Таблица `site_content` в БД.

Важно:
- Для AI-функций нужен `OPENAI_API_KEY`.
- Без ключа конструктор сохранения контента работает, а AI-генерация вернет понятную ошибку конфигурации.

## 11) Выровнена БД и runtime-код

В `schema.sql` добавлены/выровнены структуры, которые реально использует runtime:
- `users.is_admin`
- `subscriptions.x3ui_client_uuid/x3ui_client_email/x3ui_inbound_id`
- таблица `vpn_keys`
- таблица `site_content`

Это устраняет расхождения между SQL-схемой и маршрутами `vpn/admin`.
