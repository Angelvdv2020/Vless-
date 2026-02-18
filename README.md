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

```bash
npm start
```

Проверка:

```bash
curl -s http://127.0.0.1:3000/health
```

Ожидаемый ответ: `{"status":"ok",...}`.

---

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

---

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

---

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

---

## 7) Как пользоваться проектом прямо сейчас

### 7.1 Запуск

```bash
npm install
npm run init-db
npm start
```

### 7.2 Куда заходить

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

---

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
