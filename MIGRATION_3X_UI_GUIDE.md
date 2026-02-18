# Миграция с RemnaWave на 3X-UI

## Обзор

Проект был переведен с использования RemnaWave API на 3X-UI (Xray Web UI). 3X-UI предоставляет более гибкую архитектуру для управления VPN клиентами и поддерживает несколько протоколов: VLESS, VMESS, Shadowsocks, Trojan.

## Созданные файлы для 3X-UI

### 1. `/src/services/x3ui.js` - Основной сервис
- Управление сеансами 3X-UI API
- Создание/удаление VPN клиентов
- Получение конфигураций клиентов
- Управление трафиком клиентов
- Получение статистики инбаундов

**Основные методы:**
```javascript
await x3ui.login()                           // Вход в 3X-UI
await x3ui.createClient(email, country)    // Создать VPN клиента
await x3ui.getClientConfig(inboundId, email) // Получить конфиг клиента
await x3ui.updateClientTraffic(email, gb)  // Обновить лимит трафика
await x3ui.deleteClient(inboundId, email)  // Удалить клиента
await x3ui.getStats(inboundId)             // Статистика
```

### 2. `/src/services/x3ui-config.js` - Сервис конфигураций
- Кодирование/декодирование конфигурационных ссылок
- Генерация ссылок для различных протоколов
- Управление использованием трафика клиентом
- Удаление истекших клиентов

### 3. `/src/middleware/x3ui-session.js` - Управление сеансом
- Инициализация сеанса 3X-UI при запуске
- Автоматическое обновление сеанса каждый час
- Обработка ошибок подключения

### 4. Обновленные маршруты `/src/routes/vpn.js`
Все маршруты переработаны для использования 3X-UI:
- `POST /api/vpn/connect` - Умное подключение с автоопределением платформы
- `GET /api/vpn/countries` - Список доступных стран
- `POST /api/vpn/change-country` - Смена страны подключения
- `GET /api/vpn/download/:token` - Загрузка конфигурации
- `GET /api/vpn/stats` - Статистика использования

## Требования к окружению

Обновите `.env` файл:

```env
# 3X-UI API (обязательно)
X3UI_API_URL=http://localhost:2053
X3UI_USERNAME=admin
X3UI_PASSWORD=admin

# Прочие переменные
PORT=3000
NODE_ENV=development
HMAC_SECRET=your_random_secret_key_here
TOKEN_EXPIRY_SECONDS=300
JWT_SECRET=your_jwt_secret_key_here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Supabase (если используется)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Структура базы данных

### Таблица `subscriptions` - добавлены колонки:
- `x3ui_client_uuid` - UUID клиента в 3X-UI
- `x3ui_client_email` - Email клиента в 3X-UI
- `x3ui_inbound_id` - ID входящего прокси

### Таблица `vpn_keys` - добавлены колонки:
- `x3ui_client_id` - ID клиента
- `x3ui_inbound_id` - ID входящего прокси
- `x3ui_inbound_tag` - Тип протокола (vless/vmess/ss/trojan)

## Развертывание 3X-UI сервера

### На Ubuntu/Debian:

```bash
# 1. Скачать и установить 3X-UI
bash <(curl -L https://raw.githubusercontent.com/mhsanaei/3x-ui/main/install.sh)

# 2. Запустить 3X-UI
systemctl start x-ui

# 3. Проверить статус
systemctl status x-ui

# 4. Веб-интерфейс доступен по адресу:
# https://localhost:2053
```

### Docker вариант:

```bash
docker run -d --name x-ui \
  -p 2053:2053 \
  -p 443:443 \
  -p 80:80 \
  -p 8080:8080 \
  -e XRAY_LOGGER_LEVEL=info \
  ghcr.io/mhsanaei/x-ui:latest
```

## Миграция существующих пользователей

### 1. Экспортировать данные из RemnaWave:

```bash
# Получить все подписки RemnaWave
SELECT user_id, remnawave_subscription_id, country_code
FROM vpn_configs
WHERE remnawave_subscription_id IS NOT NULL;
```

### 2. Создать клиентов в 3X-UI:

```javascript
const x3ui = require('./src/services/x3ui');

async function migrateUsers(userIds) {
  for (const userId of userIds) {
    const clientEmail = `user_${userId}@noryx.vpn`;
    await x3ui.createClient(clientEmail, 'auto');

    // Обновить в БД
    await updateSubscription(userId, clientEmail);
  }
}
```

## Использование в приложении

### Пример подключения с фронтенда:

```javascript
async function connectVPN(userId, countryCode = 'auto') {
  const response = await fetch('/api/vpn/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      userId,
      countryCode
    })
  });

  const data = await response.json();

  if (data.deliveryFormat === 'deep-link') {
    window.location.href = data.deepLink;
  } else if (data.deliveryFormat === 'qr-code') {
    displayQRCode(data.qrCode);
  }
}
```

## Мониторинг и обслуживание

### 1. Проверить подключение к 3X-UI:

```bash
curl -X POST http://localhost:2053/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

### 2. Просмотр логов:

```bash
# Docker
docker logs x-ui

# Systemd
journalctl -u x-ui -f
```

### 3. Управление через API:

```javascript
// Получить все инбаунды
GET http://localhost:2053/api/inbounds/list

// Получить статистику
GET http://localhost:2053/api/inbounds/getStats/{inboundId}

// Создать клиента
POST http://localhost:2053/api/inbounds/addClient
```

## Различия от RemnaWave

| Параметр | RemnaWave | 3X-UI |
|----------|-----------|-------|
| Тип API | REST JSON | REST JSON |
| Поддерживаемые протоколы | Auto | VLESS, VMESS, SS, Trojan, HTTP/2 |
| Управление клиентами | Через подписки | Прямое управление |
| Аутентификация | API Key/Secret | Сеанс с логином/паролем |
| Конфигурация | URL-ссылка | JSON/Link |
| Масштабируемость | Облако | Self-hosted |
| Стоимость | Платный | Бесплатный (Open Source) |

## Решение проблем

### Ошибка: "3X-UI login failed"
- Проверьте `X3UI_API_URL`, `X3UI_USERNAME`, `X3UI_PASSWORD`
- Убедитесь, что 3X-UI сервер запущен
- Проверьте сетевое подключение

### Ошибка: "No inbounds configured"
- Создайте входящий прокси (inbound) в веб-интерфейсе 3X-UI
- Поддерживаемые протоколы: VLESS, VMESS, Shadowsocks, Trojan

### Клиент не может подключиться
- Проверьте порты 3X-UI в firewall
- Убедитесь, что протокол правильно сконфигурирован
- Проверьте UUID клиента в конфиге

## Безопасность

- Никогда не коммитьте настоящие учетные данные 3X-UI в Git
- Используйте переменные окружения для всех секретов
- Регулярно меняйте пароль admin в 3X-UI
- Используйте HTTPS для всех соединений с 3X-UI API
- Ограничьте доступ к API портам firewall'ом

## Поддержка и документация

- Официальная документация 3X-UI: https://github.com/mhsanaei/3x-ui
- X-Ray документация: https://xtls.github.io/
