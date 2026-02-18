# Noryx Premium VPN - Инструкция по установке (3X-UI)

Полная инструкция от чистого сервера до работающей VPN-системы. Написано простым языком для начинающих.

---

## Что мы будем устанавливать

Система состоит из двух частей:

```
1. 3X-UI Panel (порт 2053)
   Панель управления VPN на базе Xray-core.
   Управление клиентами, трафиком, статистикой.

2. Noryx сайт + API (порт 3000)
   Ваш сайт: регистрация, оплата, личный кабинет.
   API: связывает сайт с 3X-UI.
   БД: Supabase (облачная PostgreSQL).
```

Схема работы:

```
Пользователь
    |
    v
[Сайт Noryx] --- регистрация, оплата --->  [3X-UI API]
    |                                            |
    v                                            v
[Личный кабинет] <--- VPN конфиг -------  [3X-UI Panel]
    |                                            |
    v                                            v
[VPN-приложение] <--- подключение --------- [Xray Server]
    |
    v
  Интернет (зашифровано)
```

---

## Требования к серверам

Для 3X-UI + Noryx (один VPS):

```
ОС:     Ubuntu 22.04 / Debian 12 (рекомендуется)
RAM:    2 GB минимум, 4 GB рекомендуется
CPU:    2 ядра минимум
Диск:   20 GB
Домен:  нужен (например vpn.noryx.com для 3X-UI)
```

---

# ЭТАП 1: Установка 3X-UI Panel

---

## 1.1 Установка Docker

Подключитесь к серверу по SSH и выполните:

```bash
sudo curl -fsSL https://get.docker.com | sh
```

Проверьте:

```bash
docker --version
docker compose version
```

Обе команды должны вывести версию.

---

## 1.2 Установка 3X-UI

Выполните одну команду:

```bash
bash <(curl -L https://raw.githubusercontent.com/mhsanaei/3x-ui/main/install.sh)
```

Следуйте инструкциям установщика. По умолчанию:
- Порт: `2053`
- Веб-интерфейс доступен по `https://ваш-ip:2053`
- Логин: `admin`
- Пароль: `admin` (обязательно измените после первого входа)

---

## 1.3 Первый вход в 3X-UI

Откройте в браузере `https://ваш-ip:2053` (игнорируйте предупреждение о SSL).

Введите:
- Логин: `admin`
- Пароль: `admin`

После входа измените пароль: нажмите на иконку профиля -> Settings -> измените пароль.

---

## 1.4 Настройка Reverse Proxy (Caddy для HTTPS)

Если вы хотите получить нормальный HTTPS через свой домен:

```bash
sudo apt-get update
sudo apt-get install -y caddy
```

Отредактируйте конфиг Caddy:

```bash
sudo nano /etc/caddy/Caddyfile
```

Содержимое:

```
vpn.noryx.com {
    reverse_proxy * 127.0.0.1:2053
}
```

Замените `vpn.noryx.com` на ваш домен.

Запустите Caddy:

```bash
sudo systemctl restart caddy
```

Теперь 3X-UI доступна по `https://vpn.noryx.com` с автоматическим HTTPS.

---

## 1.5 Настройка 3X-UI

### Создайте первый Inbound (точку входа)

1. Откройте 3X-UI: `https://vpn.noryx.com` (или `https://ip:2053`)
2. Перейдите в **Inbound list**
3. Нажмите **Add inbound**
4. Выберите протокол: `VLESS` или `VMESS` (рекомендуется `VLESS`)
5. Заполните:
   - Port: `443` (или любой другой открытый порт)
   - Address: введите IP вашего сервера или домен
   - SNI: укажите SNI (например `vless.noryx.com`)
6. Сохраните

### Получите информацию об Inbound

Нужны параметры для API:
- Inbound ID (видно в списке)
- Tag (название inbound, например `vless`)

Эти данные будут использоваться в приложении Noryx для создания конфигов.

---

# ЭТАП 2: Сайт Noryx и API

Сайт работает на Node.js с Supabase (облачная БД).

---

## 2.1 Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Проверка:

```bash
node --version
npm --version
```

---

## 2.2 Скачайте проект Noryx

```bash
cd /opt
git clone <url-вашего-репозитория> noryx-vpn
cd noryx-vpn
```

Или если проект в архиве -- распакуйте и перейдите в папку.

---

## 2.3 Установите зависимости

```bash
npm install
```

---

## 2.4 Настройте .env файл

```bash
cp .env.example .env
nano .env
```

Заполните Supabase данные:

```env
# Supabase
VITE_SUPABASE_URL=https://ваш-проект.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_key

# 3X-UI API
X3UI_API_URL=https://vpn.noryx.com:2053
X3UI_USERNAME=admin
X3UI_PASSWORD=ваш_пароль_от_3xui

# Server
PORT=3000
NODE_ENV=production

# Другие настройки
HMAC_SECRET=сгенерируйте_openssl_rand_-hex_32
TOKEN_EXPIRY_SECONDS=300
JWT_SECRET=сгенерируйте_openssl_rand_-hex_32
```

Как получить Supabase данные:

1. Создайте проект на [supabase.com](https://supabase.com)
2. Перейдите в **Settings** -> **API**
3. Скопируйте `Project URL` и `anon key`

Генерируйте секреты:

```bash
openssl rand -hex 32
```

---

## 2.5 Инициализируйте БД

```bash
npm run init-db
```

Это создаст нужные таблицы в Supabase автоматически.

---

## 2.6 Запустите сервер

Разово:

```bash
npm start
```

В продакшене через pm2:

```bash
npm install -g pm2
pm2 start src/server.js --name noryx
pm2 save
pm2 startup
```

---

## 2.7 Проверьте работу

```bash
curl http://localhost:3000/health
```

Должна вернуть: `{"status":"ok","service":"Noryx Premium VPN"}`

---

## 2.8 Веб-страницы сайта

Все страницы находятся в `/public`:

```
index.html       - Главная
login.html       - Вход
register.html    - Регистрация
cabinet.html     - Личный кабинет
tariffs.html     - Тарифы
servers.html     - Серверы
apps.html        - Приложения
news.html        - Новости
support.html     - Поддержка
referral.html    - Реферальная программа
```

Файлы можно редактировать прямо в `/public`. При перезагрузке браузера изменения появятся.

---

## 2.9 Админ-панель

Адрес: `http://localhost:3000/admin.html`

Возможности:
- Статистика (пользователи, подписки, платформы)
- Управление пользователями
- Управление подписками
- Управление странами (активные/неактивные)
- Логи подключений
- 3X-UI интеграция (создание/удаление VPN, статистика)

---

## 2.10 API-эндпоинты

### VPN эндпоинты

```
POST /api/vpn/connect         - подключение (авто-определение платформы)
GET  /api/vpn/countries        - список доступных стран
POST /api/vpn/change-country   - сменить страну подключения
GET  /api/vpn/stats            - статистика трафика пользователя
```

### Админ эндпоинты (3X-UI интеграция)

```
POST /api/admin/x3ui/create-vpn           - создать VPN для пользователя
POST /api/admin/x3ui/revoke-vpn           - отозвать VPN доступ
GET  /api/admin/x3ui/user-stats/:userId   - статистика пользователя
GET  /api/admin/x3ui/all-users-status     - статус всех пользователей
POST /api/admin/x3ui/reset-traffic        - сбросить лимит трафика
GET  /api/admin/x3ui/inbounds-info        - информация об Inbound
POST /api/admin/x3ui/sync-database        - синхронизация БД с 3X-UI
POST /api/admin/x3ui/cleanup-expired      - удаление истекших клиентов
```

---

## 2.11 Структура проекта

```
noryx-vpn/
  src/
    server.js                 - Главный файл сервера (Express)
    database/
      db.js                   - Подключение к Supabase
      schema.sql              - Схема таблиц
    routes/
      vpn.js                  - VPN маршруты (3X-UI интеграция)
      admin.js                - Админ маршруты
      admin-x3ui.js           - 3X-UI управление
    middleware/
      auth.js                 - Авторизация пользователей
      adminAuth.js            - Авторизация админов
      x3ui-session.js         - 3X-UI сеанс
    services/
      x3ui.js                 - API сервис для 3X-UI
      x3ui-config.js          - Генерация VPN конфигов
      admin-x3ui.js           - Админ сервис для 3X-UI
      platformDetector.js     - Определение платформы (iOS/Android/Desktop)
      tokenService.js         - HMAC токены
      qrService.js            - QR коды
  public/
    index.html                - Главная страница
    admin.html                - Админ-панель
    pages/                    - Остальные страницы
    assets/                   - CSS, JS, картинки
  .env.example                - Шаблон настроек
  package.json                - Зависимости
```

---

# ЭТАП 3: Важные настройки и обслуживание

---

## 3.1 Безопасность

1. **Измените пароль 3X-UI после установки**

   В 3X-UI: Settings -> замените пароль

2. **Файрвол:**

   ```bash
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw allow 2053
   sudo ufw enable
   ```

3. **Порты приложения (3000) НЕ открывайте наружу** -- используйте reverse proxy (Caddy/Nginx)

4. **Обновляйте систему:**

   ```bash
   sudo apt-get update
   sudo apt-get upgrade
   sudo apt-get install --only-upgrade docker
   ```

---

## 3.2 Резервное копирование

Supabase автоматически делает резервные копии.

Если нужна ручная копия:

```bash
# Экспорт таблиц из Supabase (через веб-интерфейс или CLI)
# или используйте pgdump если у вас локальная БД

# Копия .env файлов
cp /opt/noryx-vpn/.env /opt/backups/noryx_env_$(date +%Y%m%d)
```

---

## 3.3 Мониторинг и логи

```bash
# Статус сервера Noryx
pm2 status

# Логи Noryx
pm2 logs noryx

# Логи 3X-UI
sudo systemctl status x-ui
journalctl -u x-ui -f -n 100

# Занятые порты
ss -tlnp

# Статус Caddy (reverse proxy)
sudo systemctl status caddy
```

---

## 3.4 Обновление

```bash
# 3X-UI (проверяет обновления автоматически)
# Обновляется через веб-интерфейс 3X-UI

# Noryx приложение
cd /opt/noryx-vpn
git pull
npm install
pm2 restart noryx
```

---

## 3.5 Частые ошибки и решения

| Ошибка | Причина | Решение |
|--------|---------|---------|
| Cannot connect to Supabase | Неверные данные БД | Проверьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в .env |
| 3X-UI API не отвечает | 3X-UI не запущена или неверный адрес | Проверьте `X3UI_API_URL` и включена ли 3X-UI (`systemctl status x-ui`) |
| Port 3000 already in use | Порт занят | `lsof -i :3000` и либо killить процесс, либо изменить PORT в .env |
| Reverse proxy не работает | Caddy не запущен | `sudo systemctl status caddy` и `sudo systemctl restart caddy` |
| Пользователь не может подключиться к VPN | 3X-UI клиент не создан или истёк трафик | Проверьте в админ-панели: `/api/admin/x3ui/all-users-status` |
| Сертификат SSL не работает | Caddy не получил сертификат | Проверьте домен и DNS: `sudo systemctl status caddy` |

---

## 3.6 Сводная таблица портов

```
Порт    Что                        Где открыт
------  -------------------------  -------------------------
80      HTTP (Caddy redirect)      Открыт (перенаправляет на 443)
443     HTTPS (Caddy, 3X-UI, API)  Открыт
2053    3X-UI Web (внутри)         Только 127.0.0.1 (через Caddy)
3000    Noryx API (внутри)         Только 127.0.0.1 (через reverse proxy)
```

---

## 3.7 Масштабирование на 3 VPS

Если нужна отказоустойчивая архитектура на 3 серверах:

- **VPS 1**: 3X-UI Panel (порт 2053) + Noryx API (порт 3000)
- **VPS 2, 3, N**: Дополнительные Xray серверы (управляются из 3X-UI на VPS 1)

В 3X-UI добавьте дополнительные Inbound на разных портах/IP для каждого сервера.

Документация: см. `README_3_SERVERS.md`

---

## Финальная проверка

```
[ ] Docker и Node.js установлены
[ ] 3X-UI запущена и доступна
[ ] Пароль 3X-UI изменён
[ ] Supabase проект создан
[ ] .env файл заполнен корректно
[ ] Noryx приложение запущено
[ ] /health эндпоинт отвечает
[ ] Админ-панель доступна
[ ] Caddy настроен и HTTPS работает
[ ] Файрвол настроен
```

Все пункты отмечены -- система готова!

---

## Полезные ссылки

- 3X-UI документация: https://github.com/mhsanaei/3x-ui
- Supabase документация: https://supabase.com/docs
- Xray-core (основа 3X-UI): https://xtls.github.io/

---

## Поддержка

Если возникли проблемы:

1. Проверьте логи: `pm2 logs noryx`, `journalctl -u x-ui -f`
2. Проверьте порты: `ss -tlnp`
3. Проверьте .env: все ли переменные заполнены
4. Перезагрузите сервис: `pm2 restart noryx`
