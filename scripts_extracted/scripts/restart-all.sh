#!/bin/bash

# Скрипт перезапуска всех сервисов VPN Platform
# Использование: bash scripts/restart-all.sh

echo "=========================================="
echo "🔄 ПЕРЕЗАПУСК ВСЕХ СЕРВИСОВ"
echo "=========================================="
echo ""

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Перезапуск RemnaWave (Docker)
echo -e "${YELLOW}→${NC} Перезапуск RemnaWave Panel..."
if [ -d "$HOME/projects/remnawave" ]; then
    cd $HOME/projects/remnawave
    docker-compose restart
    echo -e "${GREEN}✓${NC} RemnaWave перезапущен"
else
    echo "⚠ Директория RemnaWave не найдена"
fi
echo ""

# 2. Перезапуск Next.js Website
echo -e "${YELLOW}→${NC} Перезапуск Next.js Website..."
sudo systemctl restart vpn-website
echo -e "${GREEN}✓${NC} Next.js перезапущен"
echo ""

# 3. Перезапуск Nginx
echo -e "${YELLOW}→${NC} Перезапуск Nginx..."
sudo systemctl restart nginx
echo -e "${GREEN}✓${NC} Nginx перезапущен"
echo ""

# Ожидание запуска
echo "⏳ Ожидание запуска сервисов (5 секунд)..."
sleep 5
echo ""

# Проверка статуса
echo "📊 СТАТУС СЕРВИСОВ:"
echo "---"

if systemctl is-active --quiet vpn-website; then
    echo -e "${GREEN}✓${NC} Next.js Website - работает"
else
    echo -e "❌ Next.js Website - НЕ работает"
fi

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC} Nginx - работает"
else
    echo -e "❌ Nginx - НЕ работает"
fi

if docker ps --filter "name=remnawave-panel" --format "{{.Status}}" | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} RemnaWave Panel - работает"
else
    echo -e "❌ RemnaWave Panel - НЕ работает"
fi

echo ""
echo "=========================================="
echo "✅ Перезапуск завершен!"
echo "=========================================="
echo ""
echo "Для проверки полного статуса используйте:"
echo "  bash scripts/check-status.sh"
echo ""
echo "Для просмотра логов:"
echo "  Next.js:    sudo journalctl -u vpn-website -f"
echo "  RemnaWave:  cd ~/projects/remnawave && docker-compose logs -f"
echo "  Nginx:      sudo tail -f /var/log/nginx/error.log"
