#!/bin/bash

# Скрипт для настройки существующих SSL сертификатов

set -e

echo "====================================="
echo "Настройка существующих SSL сертификатов"
echo "====================================="
echo ""

# Проверка что скрипт запущен с правами root
if [ "$EUID" -ne 0 ]; then
    echo "Пожалуйста, запустите скрипт с правами root (sudo)"
    exit 1
fi

# Создание директории для nginx
echo "Создание директории /opt/x3ui/nginx..."
mkdir -p /opt/x3ui/nginx
cd /opt/x3ui/nginx

# Запрос путей к сертификатам для основного сайта
echo ""
echo "=== SSL для основного сайта (servervpn.store / www.servervpn.store) ==="
echo ""
read -p "Введите путь к fullchain.pem (например, /etc/letsencrypt/live/servervpn.store/fullchain.pem): " WEBSITE_FULLCHAIN
read -p "Введите путь к privkey.pem (например, /etc/letsencrypt/live/servervpn.store/privkey.pem): " WEBSITE_PRIVKEY

# Проверка существования файлов
if [ ! -f "$WEBSITE_FULLCHAIN" ]; then
    echo "Ошибка: Файл $WEBSITE_FULLCHAIN не найден"
    exit 1
fi

if [ ! -f "$WEBSITE_PRIVKEY" ]; then
    echo "Ошибка: Файл $WEBSITE_PRIVKEY не найден"
    exit 1
fi

# Копирование сертификатов для основного сайта
echo "Копирование сертификатов основного сайта..."
cp "$WEBSITE_FULLCHAIN" /opt/x3ui/nginx/website_fullchain.pem
cp "$WEBSITE_PRIVKEY" /opt/x3ui/nginx/website_privkey.key

# Запрос путей к сертификатам для панели
echo ""
echo "=== SSL для панели 3X-UI (panel.yourdomain.com) ==="
echo ""
read -p "Введите путь к fullchain.pem (например, /etc/letsencrypt/live/panel.yourdomain.com/fullchain.pem): " PANEL_FULLCHAIN
read -p "Введите путь к privkey.pem (например, /etc/letsencrypt/live/panel.yourdomain.com/privkey.pem): " PANEL_PRIVKEY

# Проверка существования файлов
if [ ! -f "$PANEL_FULLCHAIN" ]; then
    echo "Ошибка: Файл $PANEL_FULLCHAIN не найден"
    exit 1
fi

if [ ! -f "$PANEL_PRIVKEY" ]; then
    echo "Ошибка: Файл $PANEL_PRIVKEY не найден"
    exit 1
fi

# Копирование сертификатов для панели
echo "Копирование сертификатов панели..."
cp "$PANEL_FULLCHAIN" /opt/x3ui/nginx/panel_fullchain.pem
cp "$PANEL_PRIVKEY" /opt/x3ui/nginx/panel_privkey.key

# Запрос о Subscription Page
echo ""
read -p "Используете ли вы Subscription Page? (y/n): " USE_SUB

if [ "$USE_SUB" = "y" ] || [ "$USE_SUB" = "Y" ]; then
    echo ""
    echo "=== SSL для Subscription Page (sub.yourdomain.com) ==="
    echo ""
    read -p "Введите путь к fullchain.pem для sub: " SUB_FULLCHAIN
    read -p "Введите путь к privkey.pem для sub: " SUB_PRIVKEY

    if [ ! -f "$SUB_FULLCHAIN" ]; then
        echo "Ошибка: Файл $SUB_FULLCHAIN не найден"
        exit 1
    fi

    if [ ! -f "$SUB_PRIVKEY" ]; then
        echo "Ошибка: Файл $SUB_PRIVKEY не найден"
        exit 1
    fi

    echo "Копирование сертификатов Subscription Page..."
    cp "$SUB_FULLCHAIN" /opt/x3ui/nginx/sub_fullchain.pem
    cp "$SUB_PRIVKEY" /opt/x3ui/nginx/sub_privkey.key
fi

# Установка прав
echo ""
echo "Установка прав доступа..."
chmod 644 /opt/x3ui/nginx/website_fullchain.pem
chmod 600 /opt/x3ui/nginx/website_privkey.key
chmod 644 /opt/x3ui/nginx/panel_fullchain.pem
chmod 600 /opt/x3ui/nginx/panel_privkey.key

if [ "$USE_SUB" = "y" ] || [ "$USE_SUB" = "Y" ]; then
    chmod 644 /opt/x3ui/nginx/sub_fullchain.pem
    chmod 600 /opt/x3ui/nginx/sub_privkey.key
fi

chown root:root /opt/x3ui/nginx/*.pem 2>/dev/null || true
chown root:root /opt/x3ui/nginx/*.key 2>/dev/null || true

# Проверка сертификатов
echo ""
echo "Проверка сертификатов..."
echo ""
echo "=== Сертификат основного сайта ==="
openssl x509 -in /opt/x3ui/nginx/website_fullchain.pem -noout -subject -dates

echo ""
echo "=== Сертификат панели ==="
openssl x509 -in /opt/x3ui/nginx/panel_fullchain.pem -noout -subject -dates

if [ "$USE_SUB" = "y" ] || [ "$USE_SUB" = "Y" ]; then
    echo ""
    echo "=== Сертификат Subscription Page ==="
    openssl x509 -in /opt/x3ui/nginx/sub_fullchain.pem -noout -subject -dates
fi

# Создание скрипта обновления
echo ""
echo "Создание скрипта автоматического обновления сертификатов..."

cat > /opt/x3ui/nginx/update-certs.sh << EOF
#!/bin/bash

# Автоматическое обновление сертификатов

# Копирование сертификатов для основного сайта
cp "$WEBSITE_FULLCHAIN" /opt/x3ui/nginx/website_fullchain.pem
cp "$WEBSITE_PRIVKEY" /opt/x3ui/nginx/website_privkey.key

# Копирование сертификатов для панели
cp "$PANEL_FULLCHAIN" /opt/x3ui/nginx/panel_fullchain.pem
cp "$PANEL_PRIVKEY" /opt/x3ui/nginx/panel_privkey.key
EOF

if [ "$USE_SUB" = "y" ] || [ "$USE_SUB" = "Y" ]; then
    cat >> /opt/x3ui/nginx/update-certs.sh << EOF

# Копирование сертификатов для Subscription Page
cp "$SUB_FULLCHAIN" /opt/x3ui/nginx/sub_fullchain.pem
cp "$SUB_PRIVKEY" /opt/x3ui/nginx/sub_privkey.key
EOF
fi

cat >> /opt/x3ui/nginx/update-certs.sh << 'EOF'

# Установка прав
chmod 644 /opt/x3ui/nginx/*.pem
chmod 600 /opt/x3ui/nginx/*.key

# Перезапуск Nginx
cd /opt/x3ui/nginx && docker compose restart

echo "Сертификаты обновлены и Nginx перезапущен"
EOF

chmod +x /opt/x3ui/nginx/update-certs.sh

echo ""
echo "====================================="
echo "Готово!"
echo "====================================="
echo ""
echo "Сертификаты скопированы в:"
echo "  - /opt/x3ui/nginx/website_fullchain.pem (основной сайт)"
echo "  - /opt/x3ui/nginx/website_privkey.key"
echo "  - /opt/x3ui/nginx/panel_fullchain.pem (панель)"
echo "  - /opt/x3ui/nginx/panel_privkey.key"

if [ "$USE_SUB" = "y" ] || [ "$USE_SUB" = "Y" ]; then
    echo "  - /opt/x3ui/nginx/sub_fullchain.pem (subscription page)"
    echo "  - /opt/x3ui/nginx/sub_privkey.key"
fi

echo ""
echo "Скрипт обновления создан:"
echo "  - /opt/x3ui/nginx/update-certs.sh"
echo ""
echo "Следующие шаги:"
echo "1. Создайте nginx.conf согласно инструкции SSL_EXISTING_CERTS.md"
echo "2. Создайте docker-compose.yml для Nginx"
echo "3. Запустите Nginx: cd /opt/x3ui/nginx && docker compose up -d"
echo ""
echo "Для автоматического обновления сертификатов добавьте в cron:"
echo "  0 2 * * 0 /opt/x3ui/nginx/update-certs.sh >> /var/log/cert-update.log 2>&1"
echo ""
