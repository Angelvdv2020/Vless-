#!/bin/bash

# Скрипт обновления файлов на сервере

set -e

echo "====================================="
echo "Обновление VPN Website на сервере"
echo "====================================="
echo ""

# Проверка что скрипт запущен с правами root
if [ "$EUID" -ne 0 ]; then
    echo "Пожалуйста, запустите скрипт с правами root (sudo)"
    exit 1
fi

PROJECT_DIR="/root/vpn-web-platform"

# Проверка что директория проекта существует
if [ ! -d "$PROJECT_DIR" ]; then
    echo "Ошибка: Директория $PROJECT_DIR не найдена"
    echo "Установите проект сначала"
    exit 1
fi

cd $PROJECT_DIR

echo "1. Получение обновлений..."
git pull

echo ""
echo "2. Установка зависимостей..."
npm install

echo ""
echo "3. Обновление systemd сервиса..."
cp vpn-website.service /etc/systemd/system/
systemctl daemon-reload

echo ""
echo "4. Перезапуск сервиса..."
systemctl restart vpn-website

echo ""
echo "5. Ожидание запуска (3 сек)..."
sleep 3

echo ""
echo "6. Проверка статуса..."
systemctl status vpn-website --no-pager || true

echo ""
echo "7. Проверка работоспособности..."
if curl -f http://localhost:3100/health > /dev/null 2>&1; then
    echo "✓ Сайт работает"
else
    echo "✗ Ошибка: Сайт не отвечает"
    echo ""
    echo "Логи:"
    journalctl -u vpn-website -n 20 --no-pager
    exit 1
fi

echo ""
echo "====================================="
echo "Готово!"
echo "====================================="
echo ""
echo "Сайт обновлен и перезапущен"
echo ""
echo "Полезные команды:"
echo "  sudo systemctl status vpn-website      # Статус"
echo "  sudo journalctl -u vpn-website -f      # Логи"
echo "  curl http://localhost:3100/health      # Проверка"
echo ""
