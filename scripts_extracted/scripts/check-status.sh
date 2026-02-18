#!/bin/bash

# Скрипт проверки статуса всех сервисов VPN Platform
# Использование: bash scripts/check-status.sh

echo "=========================================="
echo "🔍 ПРОВЕРКА СТАТУСА СЕРВИСОВ"
echo "=========================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция проверки сервиса
check_service() {
    if systemctl is-active --quiet $1; then
        echo -e "${GREEN}✓${NC} $2 - работает"
    else
        echo -e "${RED}✗${NC} $2 - НЕ работает"
    fi
}

# Функция проверки порта
check_port() {
    if nc -z localhost $1 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Порт $1 - открыт"
    else
        echo -e "${RED}✗${NC} Порт $1 - закрыт"
    fi
}

# Функция проверки URL
check_url() {
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k $1)
    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 301 ] || [ "$HTTP_CODE" -eq 302 ]; then
        echo -e "${GREEN}✓${NC} $1 - доступен (HTTP $HTTP_CODE)"
    else
        echo -e "${RED}✗${NC} $1 - НЕ доступен (HTTP $HTTP_CODE)"
    fi
}

echo "📦 СИСТЕМНЫЕ СЕРВИСЫ:"
echo "---"
check_service "nginx" "Nginx"
check_service "vpn-website" "Next.js Website"
echo ""

echo "🐳 DOCKER КОНТЕЙНЕРЫ:"
echo "---"
if command -v docker &> /dev/null; then
    X3UI_STATUS=$(docker ps --filter "name=x3ui-panel" --format "{{.Status}}" 2>/dev/null)
    DB_STATUS=$(docker ps --filter "name=x3ui-db" --format "{{.Status}}" 2>/dev/null)

    if [ -n "$X3UI_STATUS" ]; then
        echo -e "${GREEN}✓${NC} 3X-UI Panel - $X3UI_STATUS"
    else
        echo -e "${RED}✗${NC} 3X-UI Panel - НЕ запущен"
    fi

    if [ -n "$DB_STATUS" ]; then
        echo -e "${GREEN}✓${NC} PostgreSQL DB - $DB_STATUS"
    else
        echo -e "${RED}✗${NC} PostgreSQL DB - НЕ запущен"
    fi
else
    echo -e "${YELLOW}⚠${NC} Docker не установлен"
fi
echo ""

echo "🔌 ПРОВЕРКА ПОРТОВ:"
echo "---"
check_port 80    # HTTP
check_port 443   # HTTPS
check_port 3000  # 3X-UI Panel
check_port 3100  # Next.js Website
echo ""

echo "🌐 ПРОВЕРКА ДОМЕНОВ:"
echo "---"
check_url "https://servervpn.store"
check_url "https://panels.servervpn.store"
check_url "https://sab.servervpn.store"
echo ""

echo "🔒 SSL СЕРТИФИКАТЫ:"
echo "---"
if command -v certbot &> /dev/null; then
    CERT_COUNT=$(sudo certbot certificates 2>/dev/null | grep -c "Certificate Name")
    if [ "$CERT_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} Найдено $CERT_COUNT сертификата(ов)"

        # Проверка срока действия основного сертификата
        EXPIRY=$(sudo certbot certificates 2>/dev/null | grep -A 2 "servervpn.store" | grep "Expiry Date" | awk '{print $3}')
        if [ -n "$EXPIRY" ]; then
            echo -e "${GREEN}✓${NC} Срок действия: $EXPIRY"
        fi
    else
        echo -e "${RED}✗${NC} SSL сертификаты не найдены"
    fi
else
    echo -e "${YELLOW}⚠${NC} Certbot не установлен"
fi
echo ""

echo "💾 ИСПОЛЬЗОВАНИЕ РЕСУРСОВ:"
echo "---"
echo "CPU Load: $(uptime | awk -F'load average:' '{print $2}')"
echo "Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " используется)"}')"
echo ""

echo "=========================================="
echo "Проверка завершена!"
echo "=========================================="
echo ""
echo "Для просмотра логов используйте:"
echo "  Next.js:    sudo journalctl -u vpn-website -f"
echo "  3X-UI:  cd ~/projects/x3ui && docker-compose logs -f"
echo "  Nginx:      sudo tail -f /var/log/nginx/error.log"
