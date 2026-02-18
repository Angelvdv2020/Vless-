# Noryx VPN - Полное руководство по развертке в Production

> **Важно:** Это полное руководство для запуска приложения Noryx Premium VPN на production сервере. Перед началом изучите [README.md](README.md) для понимания архитектуры системы.

---

## Часть 1: Подготовка сервера

### 1.1 Требования к серверу для Noryx Application

```
ОС:        Ubuntu 22.04 LTS / Debian 12 (рекомендуется)
RAM:       2 GB минимум (4 GB рекомендуется)
CPU:       2 ядра минимум
Диск:      50 GB SSD минимум
Домен:     example.com (главный домен)
Сертификат: Let's Encrypt (автоматический)
```

### 1.2 Подключение и базовая настройка

```bash
# Подключитесь к серверу по SSH
ssh root@your_server_ip

# Обновите систему
sudo apt-get update
sudo apt-get upgrade -y

# Установите необходимые утилиты
sudo apt-get install -y curl wget git nano htop net-tools ufw
```

### 1.3 Настройка файрвола

```bash
# Разрешите SSH (22), HTTP (80), HTTPS (443)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Проверьте статус
sudo ufw status
```

---

## Часть 2: Установка зависимостей

### 2.1 Установка Node.js 20.x

```bash
# Добавьте репозиторий NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Установите Node.js и npm
sudo apt-get install -y nodejs

# Проверьте версии
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 2.2 Установка PostgreSQL 15

```bash
# Добавьте репозиторий PostgreSQL
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Установите PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql-15 postgresql-contrib-15

# Запустите сервис
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Проверьте статус
sudo systemctl status postgresql

# Проверьте версию
psql --version  # psql (PostgreSQL) 15.x
```

### 2.3 Установка PM2 (процесс менеджер)

```bash
# Установите PM2 глобально
sudo npm install -g pm2

# Дайте PM2 права на автозапуск
pm2 startup systemd -u $USER --hp /home/$USER
pm2 save

# Проверьте
pm2 --version
```

### 2.4 Установка Nginx (reverse proxy)

```bash
# Установите Nginx
sudo apt-get install -y nginx

# Запустите сервис
sudo systemctl start nginx
sudo systemctl enable nginx

# Проверьте статус
sudo systemctl status nginx
```

### 2.5 Установка Certbot (Let's Encrypt)

```bash
# Установите Certbot для Nginx
sudo apt-get install -y certbot python3-certbot-nginx

# Проверьте
certbot --version
```

---

## Часть 3: Настройка базы данных

### 3.1 Создание БД и пользователя

```bash
# Подключитесь к PostgreSQL
sudo -u postgres psql

# Выполните SQL команды:
CREATE DATABASE noryx_vpn ENCODING 'UTF8';
CREATE USER noryx_admin WITH ENCRYPTED PASSWORD 'VERY_STRONG_PASSWORD_HERE';
ALTER ROLE noryx_admin SET client_encoding TO 'utf8';
ALTER ROLE noryx_admin SET default_transaction_isolation TO 'read committed';
ALTER ROLE noryx_admin SET default_transaction_deferrable TO on;
ALTER ROLE noryx_admin SET default_transaction_read_committed TO off;
ALTER ROLE noryx_admin SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE noryx_vpn TO noryx_admin;
GRANT USAGE ON SCHEMA public TO noryx_admin;
GRANT CREATE ON SCHEMA public TO noryx_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO noryx_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO noryx_admin;

# Выйдите
\q
```

### 3.2 Проверка подключения

```bash
# Проверьте подключение к БД
psql -h localhost -U noryx_admin -d noryx_vpn -c "SELECT VERSION();"

# При запросе пароля введите VERY_STRONG_PASSWORD_HERE
```

---

## Часть 4: Развертывание приложения Noryx

### 4.1 Скачивание кода

```bash
# Создайте директорию приложения
sudo mkdir -p /opt/noryx-vpn
sudo chown $USER:$USER /opt/noryx-vpn

# Перейдите в директорию
cd /opt/noryx-vpn

# Клонируйте репозиторий (или распакуйте архив)
git clone <your_repository_url> .

# Или если есть архив:
# unzip noryx-vpn.zip
# cd noryx-vpn
```

### 4.2 Установка зависимостей npm

```bash
# Перейдите в папку проекта
cd /opt/noryx-vpn

# Установите зависимости
npm install

# Проверьте что всё установилось
npm list --depth=0
```

### 4.3 Настройка переменных окружения

```bash
# Скопируйте шаблон .env
cp .env.example .env

# Отредактируйте .env
nano .env
```

Необходимые значения в `.env` для production:

```env
# ═══════════════════════════════════════════════════════════════
# PRODUCTION КОНФИГУРАЦИЯ
# ═══════════════════════════════════════════════════════════════

# Основные настройки
PORT=3000
NODE_ENV=production
HOST=127.0.0.1
BASE_URL=https://example.com

# ───────────────────────────────────────────────────────────────
# DATABASE POSTGRESQL
# ───────────────────────────────────────────────────────────────

DB_HOST=localhost
DB_PORT=5432
DB_NAME=noryx_vpn
DB_USER=noryx_admin
DB_PASSWORD=VERY_STRONG_PASSWORD_HERE

# ───────────────────────────────────────────────────────────────
# SECURITY & TOKENS
# ───────────────────────────────────────────────────────────────

# Генерируйте: openssl rand -base64 32
JWT_SECRET=<GENERATE_RANDOM_STRING_1>
HMAC_SECRET=<GENERATE_RANDOM_STRING_2>
TOKEN_EXPIRY_SECONDS=300
JWT_EXPIRES_IN=7d

# ───────────────────────────────────────────────────────────────
# 3X-UI INTEGRATION
# ───────────────────────────────────────────────────────────────

# URL админ-панели 3X-UI на другом сервере
X3UI_API_URL=https://panel.example.com:2053
X3UI_USERNAME=admin_username
X3UI_PASSWORD=admin_password
X3UI_TIMEOUT=30000

# ───────────────────────────────────────────────────────────────
# CORS
# ───────────────────────────────────────────────────────────────

ALLOWED_ORIGINS=https://example.com,https://app.example.com

# ───────────────────────────────────────────────────────────────
# REMNAWAVE (DEPRECATED, LEGACY)
# ───────────────────────────────────────────────────────────────

REMNAWAVE_API_URL=https://panel.example.com
REMNAWAVE_API_KEY=your_key
REMNAWAVE_API_SECRET=your_secret
```

### 4.4 Генерация секретных ключей

```bash
# Генерируйте JWT_SECRET
echo "JWT_SECRET: $(openssl rand -base64 32)"

# Генерируйте HMAC_SECRET
echo "HMAC_SECRET: $(openssl rand -base64 32)"
```

### 4.5 Инициализация базы данных

```bash
# Перейдите в папку проекта
cd /opt/noryx-vpn

# Инициализируйте схему БД
npm run init-db

# Проверьте таблицы в БД
psql -U noryx_admin -d noryx_vpn -c "\dt"
```

---

## Часть 5: Настройка Nginx как Reverse Proxy

### 5.1 Создание конфига Nginx

```bash
# Создайте конфиг для вашего домена
sudo nano /etc/nginx/sites-available/noryx.example.com
```

Содержимое конфига:

```nginx
# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    # Certbot ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com www.example.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Proxy settings
    client_max_body_size 20M;

    # Logs
    access_log /var/log/nginx/noryx_access.log;
    error_log /var/log/nginx/noryx_error.log;

    # Root location
    location / {
        # Proxy to Node.js app
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files (cache)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 30d;
        expires 30d;
    }
}
```

### 5.2 Включение конфига

```bash
# Создайте symlink
sudo ln -s /etc/nginx/sites-available/noryx.example.com /etc/nginx/sites-enabled/

# Удалите default конфиг если нужно
sudo rm /etc/nginx/sites-enabled/default

# Проверьте синтаксис
sudo nginx -t

# Перезагрузите Nginx
sudo systemctl reload nginx
```

### 5.3 Получение SSL сертификата

```bash
# Получите Let's Encrypt сертификат
sudo certbot certonly --nginx -d example.com -d www.example.com

# При запросе:
# - Введите email
# - Согласитесь с условиями
# - Выберите вариант с www и без www

# Проверьте что сертификаты установлены
sudo ls -la /etc/letsencrypt/live/example.com/

# Настройте автообновление сертификатов
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## Часть 6: Запуск приложения

### 6.1 Тестовый запуск

```bash
# Перейдите в папку проекта
cd /opt/noryx-vpn

# Запустите npm build (проверка синтаксиса)
npm run build

# Убедитесь что нет ошибок
echo $?  # Должно быть 0
```

### 6.2 Запуск с PM2

```bash
# Запустите приложение через PM2
cd /opt/noryx-vpn
pm2 start src/server.js --name noryx --watch

# Сохраните конфигурацию PM2
pm2 save

# Проверьте статус
pm2 status
pm2 logs noryx --lines 50
```

### 6.3 Автозапуск при перезагрузке

```bash
# Настройте автозапуск
pm2 startup systemd -u $USER --hp /home/$USER
pm2 save

# Перезагрузитесь и проверьте
sudo reboot

# После перезагрузки проверьте
pm2 status
```

---

## Часть 7: Проверка работы

### 7.1 Проверка API

```bash
# Проверьте health endpoint
curl https://example.com/health

# Ответ должен быть:
# {"status":"ok","service":"Noryx Premium VPN"}
```

### 7.2 Проверка в браузере

```
Главная:        https://example.com/
Логин:          https://example.com/login.html
Регистрация:    https://example.com/register.html
Кабинет:        https://example.com/cabinet.html
Админ-панель:   https://example.com/admin.html
Тарифы:         https://example.com/tariffs.html
Серверы:        https://example.com/servers.html
```

### 7.3 Проверка логов

```bash
# Логи приложения
pm2 logs noryx

# Логи Nginx
sudo tail -f /var/log/nginx/noryx_access.log
sudo tail -f /var/log/nginx/noryx_error.log

# Логи PostgreSQL
sudo journalctl -u postgresql -f --no-pager
```

---

## Часть 8: Мониторинг и обслуживание

### 8.1 Мониторинг процессов

```bash
# Просмотр всех процессов PM2
pm2 monit

# Просмотр информации о приложении
pm2 info noryx

# Просмотр очень подробных логов
pm2 logs noryx --lines 200 --err
```

### 8.2 Мониторинг системы

```bash
# Использование CPU и RAM
top

# Занятые порты
sudo ss -tlnp

# Использование диска
df -h

# Статистика Nginx
curl -s http://127.0.0.1:3000/health | jq
```

### 8.3 Резервное копирование БД

```bash
# Создайте папку для backup
sudo mkdir -p /opt/backups
sudo chown $USER:$USER /opt/backups

# Резервная копия БД (полная)
pg_dump -U noryx_admin noryx_vpn > /opt/backups/noryx_$(date +%Y%m%d_%H%M%S).sql

# Архивируйте backup
gzip /opt/backups/noryx_*.sql

# Расписание автоматического backup (cron)
crontab -e

# Добавьте строку (ежедневно в 2:00 AM):
0 2 * * * pg_dump -U noryx_admin noryx_vpn | gzip > /opt/backups/noryx_$(date +\%Y\%m\%d).sql.gz
```

### 8.4 Восстановление из backup

```bash
# Восстановите БД из backup
gunzip < /opt/backups/noryx_20240101.sql.gz | psql -U noryx_admin noryx_vpn

# Проверьте что восстановилось
psql -U noryx_admin noryx_vpn -c "SELECT COUNT(*) FROM users;"
```

### 8.5 Обновление приложения

```bash
# Остановите приложение
pm2 stop noryx

# Обновите код
cd /opt/noryx-vpn
git pull origin main
# или распакуйте новый архив

# Установите зависимости
npm install

# Обновите БД (если нужны миграции)
npm run init-db

# Запустите приложение
pm2 start noryx

# Проверьте логи
pm2 logs noryx --lines 50
```

---

## Часть 9: Безопасность

### 9.1 Файрвол

```bash
# Проверьте статус ufw
sudo ufw status verbose

# Разрешите только необходимые порты
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS

# Запретите всё остальное (по умолчанию deny incoming)
sudo ufw default deny incoming

# Включите файрвол
sudo ufw enable
```

### 9.2 SSH Security

```bash
# Отредактируйте SSH конфиг
sudo nano /etc/ssh/sshd_config

# Необходимые параметры:
Port 22                          # (или измените на другой порт)
PermitRootLogin no              # Запретить root логин
PasswordAuthentication no        # Только ключи
PubkeyAuthentication yes         # Публичные ключи
X11Forwarding no                # Отключить X11
MaxAuthTries 3                  # Максимум попыток
ClientAliveInterval 300         # Timeout 5 минут
Protocol 2                      # SSH v2

# Перезагрузите SSH
sudo systemctl restart sshd
```

### 9.3 Защита от DDoS

```bash
# Установите fail2ban для защиты от brute-force
sudo apt-get install -y fail2ban

# Включите сервис
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Проверьте статус
sudo fail2ban-client status
```

### 9.4 Регулярные обновления

```bash
# Обновляйте систему еженедельно
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get autoremove -y

# Проверяйте версии компонентов
node --version
npm --version
npm outdated

# Обновляйте npm пакеты
cd /opt/noryx-vpn
npm update
```

---

## Часть 10: Решение типичных проблем

### Проблема: Приложение не запускается

```bash
# Проверьте логи
pm2 logs noryx --lines 100

# Проверьте что БД доступна
psql -U noryx_admin -d noryx_vpn -c "SELECT 1;"

# Проверьте что .env правильно установлен
cat /opt/noryx-vpn/.env | grep -E "^[A-Z_]="

# Проверьте что порт 3000 свободен
sudo ss -tlnp | grep 3000
```

### Проблема: Nginx ошибка 502 Bad Gateway

```bash
# Проверьте что приложение запущено
pm2 status

# Проверьте что приложение слушает на 127.0.0.1:3000
sudo ss -tlnp | grep 3000

# Проверьте логи Nginx
sudo tail -f /var/log/nginx/noryx_error.log

# Проверьте синтаксис Nginx
sudo nginx -t

# Перезагрузите Nginx
sudo systemctl reload nginx
```

### Проблема: SSL сертификат не работает

```bash
# Проверьте сертификаты
sudo ls -la /etc/letsencrypt/live/example.com/

# Проверьте дату истечения
sudo certbot certificates

# Обновите сертификат вручную
sudo certbot renew --force-renewal

# Проверьте что auto-renewal работает
sudo systemctl status certbot.timer
```

### Проблема: БД полная или медленная

```bash
# Проверьте размер БД
sudo -u postgres psql -d noryx_vpn -c "SELECT pg_size_pretty(pg_database_size('noryx_vpn'));"

# Проверьте индексы
sudo -u postgres psql -d noryx_vpn -c "\di"

# Очистите старые данные (если нужно)
sudo -u postgres psql -d noryx_vpn -c "DELETE FROM connection_logs WHERE created_at < NOW() - INTERVAL '30 days';"

# Вакуумируйте БД
sudo -u postgres psql -d noryx_vpn -c "VACUUM ANALYZE;"
```

---

## Часть 11: Performance Tuning

### 11.1 Оптимизация Node.js

```bash
# Увеличьте размер буфера для Node.js
# В .env добавьте:
NODE_OPTIONS=--max-old-space-size=1024

# Перезапустите приложение
pm2 restart noryx
```

### 11.2 Оптимизация Nginx

```bash
# Отредактируйте главный конфиг Nginx
sudo nano /etc/nginx/nginx.conf

# Оптимальные параметры:
worker_processes auto;              # Количество рабочих процессов
worker_connections 1024;            # Соединений на процесс
keepalive_timeout 65;              # Timeout соединения
client_max_body_size 20M;          # Максимальный размер upload

# Перезагрузите Nginx
sudo systemctl reload nginx
```

### 11.3 Оптимизация PostgreSQL

```bash
# Для 2GB RAM сервера, отредактируйте /etc/postgresql/15/main/postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf

# Оптимальные параметры:
shared_buffers = 512MB            # 25% RAM
effective_cache_size = 1536MB     # 75% RAM
work_mem = 4MB                    # 2-4MB
maintenance_work_mem = 128MB      # 10-15% RAM

# Перезагрузите PostgreSQL
sudo systemctl restart postgresql
```

---

## Итоговая чеклист для Production

```
ПОДГОТОВКА:
☐ Сервер запущен и обновлен
☐ Файрвол настроен
☐ Домен настроен и указывает на сервер
☐ SSH ключи вместо пароля

ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ:
☐ Node.js 20+ установлен
☐ PostgreSQL 15+ установлен
☐ Nginx установлен
☐ PM2 установлен

БАЗА ДАННЫХ:
☐ БД noryx_vpn создана
☐ Пользователь noryx_admin создан
☐ Таблицы инициализированы

ПРИЛОЖЕНИЕ:
☐ Код развернут в /opt/noryx-vpn
☐ npm install выполнен
☐ .env правильно настроен
☐ npm run build успешно выполнен
☐ npm run init-db успешно выполнен
☐ Приложение запущено через PM2

NGINX И SSL:
☐ Nginx конфиг создан
☐ SSL сертификат получен от Let's Encrypt
☐ Certbot настроен на автообновление
☐ HTTPS работает корректно

МОНИТОРИНГ И БЕЗОПАСНОСТЬ:
☐ PM2 настроен на автозапуск
☐ Резервная копия БД настроена
☐ Логи проверяются регулярно
☐ Fail2ban установлен и включен

ТЕСТИРОВАНИЕ:
☐ API /health отвечает
☐ Главная страница открывается
☐ HTTPS работает без предупреждений
☐ Админ-панель доступна
☐ БД работает и содержит данные
```

---

## Полезные команды для production

```bash
# Быстрый статус
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql

# Просмотр логов в реальном времени
pm2 logs noryx --err --lines 50

# Перезагрузка приложения
pm2 restart noryx

# Полная перезагрузка
pm2 delete noryx
pm2 start /opt/noryx-vpn/src/server.js --name noryx

# Проверка портов
sudo ss -tlnp | grep -E ':(80|443|3000|5432)'

# Проверка дискового пространства
df -h /
du -sh /opt/noryx-vpn /var/log

# Перезагрузка без простоя
pm2 reload noryx

# Граситель логов после 1GB
logrotate -fv /etc/logrotate.d/nginx
pm2 flush
```

---

**Автор:** Noryx Premium VPN Team
**Версия документа:** 1.0
**Последнее обновление:** 2024
