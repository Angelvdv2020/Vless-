# ТЕХНИЧЕСКАЯ СПЕЦИФИКАЦИЯ ПРОЕКТА NORYX PREMIUM VPN

## 1. ОБЗОР ПРОЕКТА

**Название:** Noryx Premium VPN
**Тип:** Полнофункциональная платформа управления VPN-подписками
**Архитектура:** Монолитное Node.js приложение с интеграцией внешнего VPN-провайдера RemnaWave

### 1.1 Назначение системы

Веб-платформа для продажи и управления VPN-подписками с автоматическим созданием VPN-конфигураций через RemnaWave API, системой уведомлений, реферальной программой и административной панелью.

### 1.2 Основные функциональные модули

1. **Пользовательский портал** - регистрация, авторизация, личный кабинет
2. **Система подписок** - покупка, продление, управление тарифами
3. **VPN-провиженинг** - автоматическое создание VPN-пользователей через RemnaWave API
4. **Smart Connect** - автоматическое определение платформы и выдача конфигурации
5. **Реферальная система** - реферальные коды и начисление бонусов
6. **Система уведомлений** - автоматические уведомления об истечении подписок
7. **Система рассылок** - сегментированные email/telegram рассылки
8. **Административная панель** - управление пользователями, подписками, тарифами
9. **Новостная система** - публикация новостей для пользователей

---

## 2. ТЕХНОЛОГИЧЕСКИЙ СТЕК

### 2.1 Backend

| Компонент | Технология | Версия | Назначение |
|-----------|-----------|--------|------------|
| **Runtime** | Node.js | 18+ | Серверная среда выполнения |
| **Framework** | Express.js | ^4.18.2 | Веб-фреймворк для REST API |
| **Language** | JavaScript (ES6+) | - | Основной язык разработки |
| **Database Driver** | pg (node-postgres) | ^8.11.3 | PostgreSQL драйвер для локальной БД |
| **Database ORM** | @supabase/supabase-js | latest | Supabase клиент для облачной БД |

### 2.2 База данных

| Система | Назначение | Детали |
|---------|-----------|--------|
| **PostgreSQL** | Локальная БД | Версия 14+, используется для таблиц: users, subscriptions, vpn_configs, connection_logs, available_countries |
| **Supabase PostgreSQL** | Облачная БД | Расширенная схема с RLS, используется для: profiles, tariffs, news, referrals, notifications, mailings, payments |

### 2.3 Внешние сервисы

| Сервис | Назначение | Протокол |
|--------|-----------|----------|
| **RemnaWave Panel** | VPN-провайдер | REST API (порт 3000) |
| **RemnaWave Subscription Page** | Страница подписок VPN | HTTP (порт 3010) |
| **Supabase** | Database + Auth + Storage | HTTPS REST + PostgreSQL |

### 2.4 Библиотеки и зависимости

```json
{
  "dependencies": {
    "axios": "^1.6.2",              // HTTP клиент для RemnaWave API
    "cors": "^2.8.5",                // CORS middleware
    "dotenv": "^16.3.1",             // Переменные окружения
    "express": "^4.18.2",            // Web framework
    "express-rate-limit": "^7.1.5",  // Rate limiting
    "helmet": "^7.1.0",              // Security headers
    "jsonwebtoken": "^9.0.3",        // JWT токены
    "pg": "^8.11.3",                 // PostgreSQL клиент
    "qrcode": "^1.5.3"               // QR code генерация
  },
  "devDependencies": {
    "nodemon": "^3.0.2"              // Hot reload для разработки
  }
}
```

### 2.5 Frontend

| Технология | Назначение |
|-----------|-----------|
| **HTML5** | Разметка страниц |
| **CSS3** | Стилизация, градиенты, анимации |
| **JavaScript (Vanilla)** | Клиентская логика, AJAX запросы |
| **Bootstrap 5.3** | UI framework для админ-панели |
| **jQuery** | DOM манипуляции в админ-панели |

---

## 3. АРХИТЕКТУРА СИСТЕМЫ

### 3.1 Компоненты инфраструктуры

```
┌─────────────────────────────────────────────────────────────┐
│                         INTERNET                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     REVERSE PROXY (Caddy)                   │
│                  SSL Termination + Load Balancing           │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌──────────────────┐   ┌────────────────┐
│  Noryx App    │   │ RemnaWave Panel  │   │ RemnaWave Sub  │
│  (Port 3000)  │   │   (Port 3000)    │   │  (Port 3010)   │
│  Node.js +    │   │   Docker +       │   │     Docker     │
│  Express      │   │   PostgreSQL     │   │                │
└───────────────┘   └──────────────────┘   └────────────────┘
        │                     │
        │                     │
        ▼                     ▼
┌───────────────┐   ┌──────────────────┐
│  PostgreSQL   │   │ RemnaWave Nodes  │
│  (Port 5432)  │   │  (VPS servers)   │
│  Local DB     │   │  Xray-core VPN   │
└───────────────┘   └──────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│         Supabase Cloud                  │
│  PostgreSQL + Auth + RLS + Storage      │
└─────────────────────────────────────────┘
```

### 3.2 Потоки данных

#### 3.2.1 Регистрация и аутентификация

```
User → POST /api/auth/register → Supabase Auth (email/password) →
→ Create profile in DB → Generate referral_code → Return JWT token
```

#### 3.2.2 Покупка подписки

```
User → POST /api/subscriptions/purchase (tariff_id, period) →
→ Validate tariff → Check trial status →
→ Create RemnaWave user (API call) →
→ Save subscription to Supabase DB →
→ Deduct balance / Create payment record →
→ Process referral bonus (if referred) →
→ Return subscription URL
```

#### 3.2.3 Smart Connect (главная функция)

```
User → POST /api/vpn/connect (userId, countryCode) →
→ Detect platform from User-Agent →
→ Check active subscription →
→ Get/Create RemnaWave subscription →
→ Return format based on platform:
  • iOS/Android: deep-link (shadowrocket://add/...)
  • Desktop: secure download token (/api/vpn/download/:token)
  • Unknown: QR code (base64 data URL)
```

---

## 4. БАЗА ДАННЫХ

### 4.1 Локальная PostgreSQL БД (schema.sql)

#### Таблица: `users`
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Таблица: `subscriptions`
```sql
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL, -- 'monthly', 'yearly', 'trial'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'cancelled'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Таблица: `vpn_configs`
```sql
CREATE TABLE vpn_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    remnawave_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    country_code VARCHAR(10) DEFAULT 'auto',
    server_location VARCHAR(100),
    config_type VARCHAR(50), -- 'shadowsocks', 'vmess', 'vless'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, subscription_id)
);
```

#### Таблица: `connection_logs`
```sql
CREATE TABLE connection_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50), -- 'ios', 'android', 'windows', 'macos', 'linux'
    connection_type VARCHAR(50), -- 'deep-link', 'file', 'qr-code'
    country_code VARCHAR(10),
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Таблица: `available_countries`
```sql
CREATE TABLE available_countries (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(10) UNIQUE NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    flag_emoji VARCHAR(10),
    is_available BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Default countries: auto, us, uk, de, nl, sg, jp, ca
```

### 4.2 Supabase PostgreSQL БД

#### Таблица: `profiles`
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text DEFAULT '',
  telegram_id text DEFAULT '',
  balance decimal(10,2) DEFAULT 0,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  referral_code text UNIQUE, -- 8 символов A-Z0-9
  referred_by uuid REFERENCES profiles(id),
  trial_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### Таблица: `tariffs`
```sql
CREATE TABLE tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  price_monthly decimal(10,2) DEFAULT 0,
  price_quarterly decimal(10,2) DEFAULT 0,
  price_yearly decimal(10,2) DEFAULT 0,
  traffic_limit_gb integer DEFAULT 0, -- 0 = безлимит
  max_devices integer DEFAULT 1,
  is_trial boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  features jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### Таблица: `subscriptions`
```sql
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tariff_id uuid NOT NULL REFERENCES tariffs(id),
  remnawave_username text DEFAULT '',
  remnawave_user_uuid text DEFAULT '',
  subscription_url text DEFAULT '',
  status text DEFAULT 'active' CHECK (status IN ('active', 'trial', 'expired', 'cancelled')),
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### Таблица: `referrals`
```sql
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bonus_amount decimal(10,2) DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);
```

#### Таблица: `notifications`
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'trial_expiry_24h', 'trial_expiry_10h', 'trial_expiry_0h',
    'subscription_expiry_24h', 'subscription_expiry_10h', 'subscription_expiry_0h',
    'discount_offer', 'custom'
  )),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  scheduled_at timestamptz,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

#### Таблица: `notification_templates`
```sql
CREATE TABLE notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text UNIQUE NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  telegram_template text DEFAULT '',
  variables jsonb DEFAULT '[]'::jsonb, -- ['username', 'tariff_name', ...]
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### Таблица: `mailing_templates`
```sql
CREATE TABLE mailing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  segment text DEFAULT 'all' CHECK (segment IN (
    'all', 'with_subscription', 'without_subscription',
    'trial', 'no_trial', 'inactive', 'custom'
  )),
  subject text NOT NULL,
  html_content text NOT NULL,
  image_url text DEFAULT '',
  gif_url text DEFAULT '',
  variables jsonb DEFAULT '[]'::jsonb,
  preview_data jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### Таблица: `mailings`
```sql
CREATE TABLE mailings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES mailing_templates(id) ON DELETE CASCADE,
  segment text NOT NULL,
  filter_conditions jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'sending', 'sent', 'paused', 'failed'
  )),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
```

#### Таблица: `news`
```sql
CREATE TABLE news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  image_url text DEFAULT '',
  category text DEFAULT 'general',
  is_published boolean DEFAULT false,
  published_at timestamptz,
  views integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### Таблица: `payments`
```sql
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id),
  amount decimal(10,2) NOT NULL,
  payment_method text DEFAULT 'balance',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_id text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
```

#### Таблица: `app_settings`
```sql
CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Примеры настроек:
INSERT INTO app_settings (key, value) VALUES
  ('referral', '{"enabled": true, "bonus_type": "fixed", "bonus_amount": 50}'),
  ('trial', '{"enabled": true, "duration_days": 3, "traffic_limit_gb": 5}');
```

### 4.3 Row Level Security (RLS) Policies

Все таблицы в Supabase имеют включенный RLS. Примеры политик:

```sql
-- Пользователи видят только свои подписки
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Только админы могут управлять тарифами
CREATE POLICY "Admins can manage tariffs"
  ON tariffs FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Функция проверки админа
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

---

## 5. BACKEND API

### 5.1 Структура проекта

```
src/
├── server.js                 # Точка входа, Express app
├── config.js                 # Конфигурация из переменных окружения
├── logger.js                 # Winston logger
├── security.js               # Валидация, санитизация, XSS защита
├── scheduler.js              # Cron задачи (уведомления, рассылки)
├── database/
│   ├── db.js                 # PostgreSQL pool подключение
│   ├── init.js               # Инициализация БД
│   └── schema.sql            # SQL схема локальной БД
├── middleware/
│   ├── auth.js               # JWT аутентификация middleware
│   └── adminAuth.js          # Простая Bearer token админ аутентификация
├── routes/
│   ├── vpn.js                # VPN endpoints (connect, countries, download)
│   ├── admin.js              # Админ панель endpoints (users, stats, logs)
│   ├── auth.js               # Регистрация, логин, профиль (Supabase)
│   ├── subscriptions.js      # Покупка, продление, отмена подписок
│   ├── tariffs.js            # Список тарифов
│   ├── referrals.js          # Реферальная система
│   ├── news.js               # Новости
│   ├── notifications.js      # Уведомления пользователя
│   ├── mailings.js           # Рассылки (админ)
│   └── servers.js            # Список серверов RemnaWave
├── services/
│   ├── remnawave.js          # RemnaWave API клиент
│   ├── platformDetector.js   # Определение платформы (iOS/Android/Desktop)
│   ├── tokenService.js       # HMAC токены для скачивания
│   └── qrService.js          # QR code генерация
└── supabase.js               # Supabase клиент + auth helpers
```

### 5.2 Основные endpoints

#### 5.2.1 VPN Routes (`/api/vpn/`)

**POST /api/vpn/connect**
Smart Connect - главная функция платформы

Request:
```json
{
  "userId": 1,
  "countryCode": "us"
}
```

Response (iOS/Android):
```json
{
  "platform": "ios",
  "deliveryFormat": "deep-link",
  "serverLocation": "United States (New York)",
  "countryCode": "us",
  "deepLink": "shadowrocket://add/vmess://eyJhZGQiOi...",
  "configUrl": "https://api.remnawave.com/sub/abc123xyz"
}
```

Response (Desktop):
```json
{
  "platform": "windows",
  "deliveryFormat": "file",
  "serverLocation": "United States (New York)",
  "countryCode": "us",
  "downloadUrl": "/api/vpn/download/eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 300
}
```

Response (Unknown):
```json
{
  "platform": "unknown",
  "deliveryFormat": "qr-code",
  "serverLocation": "United States (New York)",
  "countryCode": "us",
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "configUrl": "https://api.remnawave.com/sub/abc123xyz"
}
```

**GET /api/vpn/countries**
Список доступных стран

Response:
```json
{
  "countries": [
    {
      "country_code": "auto",
      "country_name": "Auto (Best)",
      "flag_emoji": "🌍",
      "is_available": true
    },
    {
      "country_code": "us",
      "country_name": "United States",
      "flag_emoji": "🇺🇸",
      "is_available": true
    }
  ]
}
```

**POST /api/vpn/change-country**
Смена страны VPN

Request:
```json
{
  "userId": 1,
  "countryCode": "uk"
}
```

**GET /api/vpn/download/:token**
Скачать конфиг файл по токену (для Desktop)

- Валидирует HMAC token (5 минут жизни)
- Возвращает файл конфигурации с headers:
  - `Content-Type: application/octet-stream`
  - `Content-Disposition: attachment; filename="noryx-vpn-config.conf"`

#### 5.2.2 Auth Routes (`/api/auth/`)

**POST /api/auth/register**
Регистрация через Supabase Auth

Request:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "john_doe",
  "referralCode": "ABC12345"
}
```

Response:
```json
{
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "...",
    "expires_in": 3600
  }
}
```

**POST /api/auth/login**
Вход через Supabase Auth

**POST /api/auth/logout**
Выход

**GET /api/auth/profile**
Получить профиль текущего пользователя (требует JWT)

**PUT /api/auth/profile**
Обновить профиль

#### 5.2.3 Subscriptions Routes (`/api/subscriptions/`)

**GET /api/subscriptions/**
Список подписок текущего пользователя (с данными из RemnaWave API)

Response:
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "tariff_id": "uuid",
    "tariff": {
      "name": "Premium",
      "traffic_limit_gb": 100
    },
    "remnawave_username": "web_1234567890abc_xyz",
    "subscription_url": "https://panel.example.com/api/sub/shortUuid",
    "status": "active",
    "starts_at": "2026-02-01T00:00:00Z",
    "expires_at": "2026-03-01T00:00:00Z",
    "traffic_used_gb": 15.3,
    "traffic_limit_gb": 100,
    "online_at": "2026-02-15T10:30:00Z",
    "remna_status": "ACTIVE"
  }
]
```

**POST /api/subscriptions/purchase**
Покупка подписки

Request:
```json
{
  "tariff_id": "uuid",
  "period": "monthly"
}
```

Логика:
1. Проверка тарифа (активен ли, триал ли)
2. Проверка использования триала
3. Расчет срока и цены
4. Создание пользователя в RemnaWave API
5. Сохранение подписки в БД
6. Списание баланса / создание платежа
7. Обработка реферального бонуса

**POST /api/subscriptions/:id/renew**
Продление подписки

**DELETE /api/subscriptions/:id**
Отмена подписки (disable в RemnaWave + статус cancelled)

#### 5.2.4 Admin Routes (`/api/admin/`)

Требуют `Authorization: Bearer {ADMIN_PASSWORD}` header.

**GET /api/admin/users**
Список пользователей с количеством подписок

**GET /api/admin/subscriptions**
Все подписки

**PATCH /api/admin/subscriptions/:id/renew**
Продлить подписку на N дней

**PATCH /api/admin/subscriptions/:id/cancel**
Отменить подписку

**POST /api/admin/subscriptions/grant-trial**
Выдать триал пользователю

**GET /api/admin/countries**
Все страны (включая неактивные)

**PATCH /api/admin/countries/:code/toggle**
Включить/выключить страну

**GET /api/admin/stats**
Статистика (пользователи, подписки, подключения, топ стран, платформы)

**GET /api/admin/connection-logs**
Логи подключений

#### 5.2.5 Другие Routes

**GET /api/tariffs/**
Список активных тарифов

**GET /api/referrals/**
Реферальная статистика (требует auth)

**GET /api/news/**
Новости (опубликованные)

**GET /api/notifications/**
Уведомления пользователя (требует auth)

**GET /api/servers/**
Список серверов RemnaWave (nodes)

**POST /api/mailings/** (admin)
Создать рассылку

**GET /api/settings/:key**
Получить настройку из app_settings

### 5.3 Middleware

#### auth.js (JWT аутентификация)
```javascript
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}
```

#### adminAuth.js (Простая admin аутентификация)
```javascript
const adminAuth = (req, res, next) => {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const token = authHeader.substring(7);

  if (token !== adminPassword) {
    return res.status(403).json({ error: 'Invalid admin credentials' });
  }

  next();
};
```

#### requireAuth (Supabase Auth)
```javascript
export async function requireAuth(req, res, next) {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  req.user = user;
  next();
}
```

---

## 6. ИНТЕГРАЦИЯ REMNAWAVE API

### 6.1 RemnaWave Service (src/services/remnawave.js)

RemnaWave - это VPN-панель управления на базе Xray-core. Интеграция использует REST API.

#### Методы аутентификации

1. **Token mode** - Bearer token в Authorization header
2. **Basic mode** - Логин/пароль с сессионными cookies

#### API Endpoints используемые в проекте

| Метод | Endpoint | Назначение |
|-------|----------|------------|
| POST | `/api/auth/login` | Авторизация (basic mode) |
| GET | `/api/nodes` | Список VPN-нод |
| GET | `/api/users` | Список пользователей |
| GET | `/api/users/:username` | Информация о пользователе |
| POST | `/api/users` | Создать VPN-пользователя |
| PUT | `/api/users/:uuid` | Обновить пользователя |
| DELETE | `/api/users/:uuid` | Удалить пользователя |
| POST | `/api/users/disable/:uuid` | Деактивировать |
| POST | `/api/users/enable/:uuid` | Активировать |
| GET | `/api/inbounds` | Список inbound-подключений |
| GET | `/api/system` | Системная статистика |

#### Создание VPN-пользователя

```javascript
async createUser({ username, trafficLimitBytes = 0, expireAt, deviceLimit = 1 }) {
  return apiRequest('POST', '/api/users', {
    username,
    trafficLimitStrategy: trafficLimitBytes > 0 ? 'CUSTOM' : 'NO_LIMIT',
    trafficLimitBytes,
    expireAt,
    activateAllInbounds: true,
    hwidDeviceLimit: deviceLimit,
    status: 'ACTIVE',
  });
}
```

**Response пример:**
```json
{
  "response": {
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "username": "web_abc123_xyz",
    "subscriptionUrl": "https://panel.example.com/api/sub/shortUuid",
    "status": "ACTIVE",
    "trafficLimitBytes": 107374182400,
    "usedTrafficBytes": 0,
    "expireAt": "2026-03-01T00:00:00Z",
    "hwidDeviceLimit": 3,
    "onlineAt": null
  }
}
```

#### Получение данных пользователя (трафик, статус)

```javascript
async getUser(username) {
  return apiRequest('GET', `/api/users/${username}`);
}
```

**Response:**
```json
{
  "response": {
    "uuid": "...",
    "username": "web_abc123_xyz",
    "usedTrafficBytes": 16106127360,
    "trafficLimitBytes": 107374182400,
    "status": "ACTIVE",
    "onlineAt": "2026-02-15T10:30:00Z",
    "subscriptionUrl": "..."
  }
}
```

### 6.2 Архитектура RemnaWave

```
Config Profile → Node → Host → Internal Squad → User → Subscription
```

1. **Config Profile** - шаблон конфигурации протокола (VLESS, VMess, etc)
2. **Node** - VPS сервер с Xray-core
3. **Host** - хост внутри ноды
4. **Internal Squad** - группа inbound-подключений
5. **User** - VPN-пользователь (наш клиент)
6. **Subscription** - URL подписки для импорта в VPN-клиент

---

## 7. ПЛАТФОРМЫ И SMART CONNECT

### 7.1 Определение платформы (src/services/platformDetector.js)

```javascript
const platformPatterns = {
  ios: /iPhone|iPad|iPod/i,
  android: /Android/i,
  windows: /Windows/i,
  macos: /Macintosh|Mac OS X/i,
  linux: /Linux/i,
};

function detectPlatform(userAgent) {
  if (!userAgent) return 'unknown';

  if (platformPatterns.ios.test(userAgent)) return 'ios';
  if (platformPatterns.android.test(userAgent)) return 'android';
  if (platformPatterns.windows.test(userAgent)) return 'windows';
  if (platformPatterns.macos.test(userAgent)) return 'macos';
  if (platformPatterns.linux.test(userAgent)) return 'linux';

  return 'unknown';
}
```

### 7.2 Форматы доставки конфигурации

| Платформа | Формат | Реализация |
|-----------|--------|------------|
| iOS | deep-link | `shadowrocket://add/{configUrl}` |
| Android | deep-link | `v2rayng://install-config?url={configUrl}` |
| Windows/macOS/Linux | file | Secure download token → `/api/vpn/download/:token` |
| Unknown | qr-code | QR code data URL (PNG base64) |

### 7.3 Deep-link схемы

```javascript
const schemes = {
  ios: {
    shadowsocks: 'shadowrocket://add/',
    vmess: 'shadowrocket://add/',
    vless: 'shadowrocket://add/',
  },
  android: {
    shadowsocks: 'v2rayng://install-config?url=',
    vmess: 'v2rayng://install-config?url=',
    vless: 'v2rayng://install-config?url=',
  },
};
```

### 7.4 HMAC Token Service (tokenService.js)

Для безопасного скачивания конфигураций на Desktop используются HMAC токены с ограниченным сроком жизни (5 минут).

```javascript
function generateDownloadToken(userId, subscriptionId) {
  const expiresAt = Date.now() + TOKEN_EXPIRY * 1000; // 300 сек
  const payload = `${userId}:${subscriptionId}:${expiresAt}`;

  const hmac = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex');

  const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');
  return token;
}

function validateDownloadToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [userId, subscriptionId, expiresAt, providedHmac] = decoded.split(':');

    // Check expiration
    if (Date.now() > parseInt(expiresAt)) return null;

    // Verify HMAC
    const payload = `${userId}:${subscriptionId}:${expiresAt}`;
    const expectedHmac = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(payload)
      .digest('hex');

    if (expectedHmac !== providedHmac) return null;

    return { userId: parseInt(userId), subscriptionId, expiresAt: parseInt(expiresAt) };
  } catch {
    return null;
  }
}
```

### 7.5 QR Code Service (qrService.js)

```javascript
const QRCode = require('qrcode');

async function generateQRCode(text) {
  const qrDataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 300,
    margin: 2,
  });
  return qrDataUrl; // data:image/png;base64,...
}
```

---

## 8. СИСТЕМА УВЕДОМЛЕНИЙ

### 8.1 Типы уведомлений

1. **trial_expiry_24h** - Триал истекает через 24 часа
2. **trial_expiry_10h** - Триал истекает через 10 часов
3. **trial_expiry_0h** - Триал истек
4. **subscription_expiry_24h** - Подписка истекает через 24 часа
5. **subscription_expiry_10h** - Подписка истекает через 10 часов
6. **subscription_expiry_0h** - Подписка истекла
7. **discount_offer** - Специальное предложение
8. **custom** - Кастомное уведомление

### 8.2 Планировщик уведомлений (src/scheduler.js)

Cron задача запускается каждый час:

```javascript
setInterval(checkSubscriptionsExpiry, 60 * 60 * 1000);
```

Алгоритм:
1. Выбрать все активные подписки (status: active/trial)
2. Для каждой подписки вычислить часы до истечения
3. Проверить, нужно ли отправить уведомление (окно ±30 минут):
   - 24 часа (23.5-24.5)
   - 10 часов (9.5-10.5)
   - 0 часов (истекла)
4. Загрузить шаблон уведомления
5. Интерполировать переменные: `{{username}}`, `{{tariff_name}}`, `{{expiry_date}}`
6. Сохранить уведомление в таблицу `notifications`
7. Записать в `notification_history` (для дедупликации)
8. При истечении (0h) - установить статус подписки: `expired`

### 8.3 Шаблоны уведомлений (notification_templates)

Пример шаблона:
```json
{
  "type": "subscription_expiry_24h",
  "subject": "Ваша подписка скоро истечет",
  "message": "Здравствуйте, {{username}}! Ваш тариф \"{{tariff_name}}\" истекает {{time_text}}. Продлите подписку, чтобы не потерять доступ.",
  "telegram_template": "🔔 Напоминание: тариф {{tariff_name}} истекает через 24 часа",
  "variables": ["username", "tariff_name", "expiry_date", "expiry_time", "time_text"],
  "is_active": true
}
```

---

## 9. СИСТЕМА РАССЫЛОК

### 9.1 Сегменты пользователей

- **all** - Все пользователи
- **with_subscription** - С активной подпиской
- **without_subscription** - Без активной подписки
- **trial** - Использовали триал
- **no_trial** - Не использовали триал
- **inactive** - Не заходили 30+ дней
- **custom** - Кастомный SQL фильтр

### 9.2 Планировщик рассылок

Cron задача каждые 5 минут:

```javascript
setInterval(processPendingMailings, 5 * 60 * 1000);
```

Алгоритм:
1. Выбрать рассылки со статусом `scheduled` и `scheduled_at <= NOW()`
2. Для каждой рассылки:
   - Установить статус `sending`
   - Загрузить шаблон рассылки
   - Получить список получателей по сегменту
   - Для каждого пользователя:
     - Отрендерить HTML (интерполяция: `{{username}}`, `{{email}}`)
     - Отправить email/telegram (в текущей реализации только logging)
     - Записать в `mailing_history`
   - Обновить статус рассылки: `sent`
   - Записать `sent_count` и `failed_count`

### 9.3 Шаблоны рассылок (mailing_templates)

Пример:
```json
{
  "name": "Скидка 50% на Premium",
  "segment": "without_subscription",
  "subject": "Специальное предложение: скидка 50%",
  "html_content": "<h1>Привет, {{username}}!</h1><p>Только сегодня скидка 50% на тариф Premium.</p><img src='{{image_url}}' />",
  "image_url": "https://example.com/promo.png",
  "gif_url": "",
  "variables": ["username", "email"],
  "is_active": true
}
```

---

## 10. РЕФЕРАЛЬНАЯ СИСТЕМА

### 10.1 Механика

1. При регистрации каждому пользователю генерируется уникальный `referral_code` (8 символов A-Z0-9)
2. Пользователь приглашает друга по ссылке: `https://noryx.com/register?ref=ABC12345`
3. Друг регистрируется с `referralCode` в запросе
4. В профиле друга сохраняется `referred_by: referrer_id`
5. Когда друг покупает подписку, вызывается `processReferralBonus()`
6. Считается бонус:
   - **fixed** - фиксированная сумма (например, 50 руб)
   - **percent** - процент от суммы покупки (например, 10%)
7. Бонус начисляется на баланс реферера
8. Создается запись в таблице `referrals` со статусом `completed`

### 10.2 Настройки реферальной программы

```json
{
  "key": "referral",
  "value": {
    "enabled": true,
    "bonus_type": "fixed",
    "bonus_amount": 50
  }
}
```

### 10.3 API для реферальной статистики

**GET /api/referrals/**

Response:
```json
{
  "referral_code": "ABC12345",
  "referral_link": "https://noryx.com/register?ref=ABC12345",
  "total_referrals": 12,
  "total_earnings": 600,
  "referrals": [
    {
      "referred_id": "uuid",
      "referred_email": "friend@example.com",
      "bonus_amount": 50,
      "status": "completed",
      "created_at": "2026-02-10T12:00:00Z"
    }
  ]
}
```

---

## 11. FRONTEND

### 11.1 Структура веб-страниц

```
web_extracted/web/
├── pages/
│   ├── index.html          # Главная страница
│   ├── login.html          # Вход
│   ├── register.html       # Регистрация
│   ├── cabinet.html        # Личный кабинет
│   ├── tariffs.html        # Тарифы
│   ├── servers.html        # Серверы
│   ├── apps.html           # Приложения для скачивания
│   ├── news.html           # Новости
│   ├── support.html        # Поддержка
│   └── referral.html       # Реферальная программа
├── assets/
│   ├── styles.css          # Общие стили
│   ├── app.js              # Общая JS логика
│   ├── photo_2026-02-06_13-27-18.jpg  # Изображение
│   └── {D15AB384-...}.png  # Логотип
└── public/                 # Копия для legacy
```

### 11.2 Админ панель (public/admin.html)

**Технологии:**
- Bootstrap 5.3
- jQuery
- Chart.js (для графиков)

**Функционал:**
- Dashboard с статистикой (пользователи, подписки, подключения)
- Управление пользователями
- Управление подписками (продление, отмена, выдача триала)
- Управление странами (включение/выключение)
- Логи подключений
- Графики по платформам и странам

**Аутентификация:**
Простой Bearer token в localStorage:
```javascript
const adminPassword = localStorage.getItem('adminPassword') || prompt('Admin Password:');
localStorage.setItem('adminPassword', adminPassword);

fetch('/api/admin/stats', {
  headers: {
    'Authorization': `Bearer ${adminPassword}`
  }
});
```

### 11.3 Демо страница VPN подключения (public/index.html)

**Функционал:**
- Определение платформы клиента
- Выбор страны из списка
- Кнопка "Connect to VPN"
- Отображение результата:
  - iOS/Android: кнопка "Open in VPN App"
  - Desktop: кнопка "Download Config File"
  - Unknown: QR код

**Код:**
```javascript
async function smartConnect() {
  const response = await fetch('/api/vpn/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: USER_ID, // Demo user
      countryCode: countrySelect.value
    })
  });

  const data = await response.json();

  if (data.deepLink) {
    // iOS/Android
    html += `<a href="${data.deepLink}">Open in VPN App</a>`;
  }

  if (data.downloadUrl) {
    // Desktop
    html += `<a href="${data.downloadUrl}" download>Download Config File</a>`;
  }

  if (data.qrCode) {
    // Unknown
    html += `<img src="${data.qrCode}" alt="QR Code">`;
  }
}
```

---

## 12. БЕЗОПАСНОСТЬ

### 12.1 Middleware безопасности

#### Helmet.js
```javascript
app.use(helmet({
  contentSecurityPolicy: false, // Для инлайн скриптов в демо
}));
```

#### CORS
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

#### Rate Limiting
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);
```

### 12.2 Валидация и санитизация (src/security.js)

```javascript
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,32}$/;
  return usernameRegex.test(username);
}

function sanitizeInput(input) {
  return input.trim().replace(/[<>]/g, '');
}
```

### 12.3 Защита от SQL Injection

Использование параметризованных запросов:

```javascript
// ✅ Безопасно
pool.query('SELECT * FROM users WHERE email = $1', [email]);

// ❌ Небезопасно
pool.query(`SELECT * FROM users WHERE email = '${email}'`);
```

### 12.4 Секреты и переменные окружения

**Критически важные секреты:**
- `HMAC_SECRET` - для генерации download токенов
- `JWT_SECRET` - для JWT токенов
- `ADMIN_PASSWORD` - для доступа к админ панели
- `DB_PASSWORD` - пароль БД
- `REMNAWAVE_API_KEY` / `REMNAWAVE_API_SECRET` - RemnaWave API credentials
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

**Все секреты хранятся в .env файле и НИКОГДА не коммитятся в Git.**

### 12.5 Row Level Security (RLS) в Supabase

Все таблицы защищены RLS политиками:
- Пользователи видят только свои данные
- Админы имеют полный доступ через функцию `is_admin()`
- Публичные данные (tariffs, news) доступны без аутентификации

---

## 13. КОНФИГУРАЦИЯ

### 13.1 Переменные окружения (.env)

```bash
# Server
PORT=3000
NODE_ENV=production

# Local PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=noryx_vpn
DB_USER=postgres
DB_PASSWORD=your_password_here

# Supabase (Cloud Database + Auth)
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# RemnaWave API (VPN Provider)
REMNA_BASE_URL=https://panel.example.com
REMNA_API_AUTH_MODE=basic
REMNA_ADMIN_LOGIN=admin
REMNA_ADMIN_PASSWORD=admin_password
REMNA_API_TOKEN=your_api_token_if_token_mode

# Security
HMAC_SECRET=your_random_secret_key_here_min_32_chars
TOKEN_EXPIRY_SECONDS=300
JWT_SECRET=your_jwt_secret_key_here_min_32_chars
ADMIN_PASSWORD=admin123

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://noryx.com
```

### 13.2 package.json scripts

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "init-db": "node src/database/init.js",
    "seed-demo": "node scripts/seed-demo-data.js",
    "test-api": "./scripts/test-endpoints.sh"
  }
}
```

---

## 14. ЗАПУСК И ДЕПЛОЙ

### 14.1 Требования системы

**Минимальные требования:**
- OS: Ubuntu 22.04 / Debian 11+
- CPU: 2 cores
- RAM: 2 GB
- Disk: 20 GB SSD
- Node.js: 18+
- PostgreSQL: 14+
- Docker + Docker Compose (для RemnaWave)

### 14.2 Порты

| Сервис | Порт | Протокол | Назначение |
|--------|------|----------|------------|
| Noryx App | 3000 | HTTP/HTTPS | Основное приложение |
| RemnaWave Panel | 3000 | HTTP/HTTPS | VPN панель управления |
| RemnaWave Sub Page | 3010 | HTTP | Страница подписок |
| PostgreSQL | 5432 | TCP | База данных |
| Caddy (Reverse Proxy) | 80, 443 | HTTP/HTTPS | Веб-сервер |

### 14.3 Установка и запуск

#### Этап 1: Установка зависимостей

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt install postgresql postgresql-contrib

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

#### Этап 2: RemnaWave Panel

```bash
# Download docker-compose
wget -O docker-compose.yml https://docs.rw/api/download/docker-compose-remnawave-panel.yml

# Generate secrets
NEW_SECRET=$(openssl rand -base64 32)
NEW_DB_PASSWORD=$(openssl rand -base64 16)

# Replace in docker-compose.yml
sed -i "s|SECRET_KEY_HERE|$NEW_SECRET|g" docker-compose.yml
sed -i "s|DB_PASSWORD_HERE|$NEW_DB_PASSWORD|g" docker-compose.yml

# Create .env
cat > .env <<EOF
SECRET_KEY=$NEW_SECRET
DATABASE_URL=postgresql://remnawave:$NEW_DB_PASSWORD@postgres:5432/remnawave
EOF

# Start
docker-compose up -d
```

#### Этап 3: RemnaWave Subscription Page

```bash
mkdir remnawave-sub && cd remnawave-sub

cat > docker-compose.yml <<EOF
services:
  remnawave-subscription-page:
    image: remnawave/subscription-page:latest
    container_name: remnawave-subscription-page
    hostname: remnawave-subscription-page
    restart: always
    env_file:
      - .env
    ports:
      - '127.0.0.1:3010:3010'
    networks:
      - remnawave-network

networks:
  remnawave-network:
    driver: bridge
    external: true
EOF

cat > .env <<EOF
REMNAWAVE_BACKEND_URL=http://remnawave-panel:3000
REMNAWAVE_API_TOKEN=your_api_token_from_panel
EOF

docker-compose up -d
```

#### Этап 4: Noryx App

```bash
git clone <repo> && cd noryx-vpn
npm install
cp .env.example .env
nano .env  # Configure all variables

# Initialize database
npm run init-db

# Start
npm start

# Or with PM2
npm install -g pm2
pm2 start src/server.js --name noryx-vpn
pm2 save
pm2 startup
```

#### Этап 5: Reverse Proxy (Caddy)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Caddyfile
sudo nano /etc/caddy/Caddyfile
```

```caddy
noryx.com {
    reverse_proxy localhost:3000
}

panel.noryx.com {
    reverse_proxy localhost:3000
}

sub.noryx.com {
    reverse_proxy localhost:3010
}
```

```bash
sudo systemctl restart caddy
```

---

## 15. МОНИТОРИНГ И ЛОГИРОВАНИЕ

### 15.1 Winston Logger (src/logger.js)

```javascript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

### 15.2 Health Check

**GET /health**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-16T10:00:00Z",
  "uptime": 86400,
  "env": "production",
  "services": {
    "supabase": true,
    "remnawave": true
  }
}
```

---

## 16. ФАЙЛОВАЯ СТРУКТУРА ПРОЕКТА

```
noryx-premium-vpn/
├── .env                        # Переменные окружения (не в git)
├── .env.example                # Пример конфигурации
├── package.json                # NPM зависимости
├── package-lock.json
├── README.md                   # Инструкции по установке (для новичков)
├── TECHNICAL_SPECIFICATION.md  # Этот документ
│
├── public/                     # Статические файлы (legacy)
│   ├── index.html              # Демо страница Smart Connect
│   └── admin.html              # Админ панель (Bootstrap 5)
│
├── admin-panel/                # Копия админ панели
│   ├── index.html
│   └── README.txt
│
├── web_extracted/              # Новые веб-страницы
│   └── web/
│       ├── pages/              # HTML страницы (10 шт)
│       │   ├── index.html
│       │   ├── login.html
│       │   ├── register.html
│       │   ├── cabinet.html
│       │   ├── tariffs.html
│       │   ├── servers.html
│       │   ├── apps.html
│       │   ├── news.html
│       │   ├── support.html
│       │   └── referral.html
│       └── assets/             # CSS, JS, изображения
│           ├── styles.css
│           ├── app.js
│           └── *.jpg, *.png
│
├── src/                        # Backend код
│   ├── server.js               # Точка входа
│   ├── config.js               # Конфигурация
│   ├── logger.js               # Winston logger
│   ├── security.js             # Валидация, санитизация
│   ├── scheduler.js            # Cron задачи (уведомления, рассылки)
│   ├── supabase.js             # Supabase клиент
│   │
│   ├── database/
│   │   ├── db.js               # PostgreSQL pool
│   │   ├── init.js             # Инициализация БД
│   │   └── schema.sql          # SQL схема
│   │
│   ├── middleware/
│   │   ├── auth.js             # JWT аутентификация
│   │   └── adminAuth.js        # Admin Bearer token auth
│   │
│   ├── routes/
│   │   ├── vpn.js              # /api/vpn/* (connect, countries, download)
│   │   ├── admin.js            # /api/admin/* (users, subscriptions, stats)
│   │   ├── auth.js             # /api/auth/* (register, login, profile)
│   │   ├── subscriptions.js    # /api/subscriptions/* (purchase, renew)
│   │   ├── tariffs.js          # /api/tariffs/*
│   │   ├── referrals.js        # /api/referrals/*
│   │   ├── news.js             # /api/news/*
│   │   ├── notifications.js    # /api/notifications/*
│   │   ├── mailings.js         # /api/mailings/*
│   │   └── servers.js          # /api/servers/*
│   │
│   └── services/
│       ├── remnawave.js        # RemnaWave API клиент
│       ├── platformDetector.js # Platform detection (iOS/Android/...)
│       ├── tokenService.js     # HMAC token генерация
│       └── qrService.js        # QR code генерация
│
├── src_extracted/              # Альтернативная версия src (более новая)
│   └── src/
│       ├── server.js           # Express app с scheduler
│       ├── supabase.js         # Supabase + auth helpers
│       ├── remnawave.js        # RemnaWave API с retry logic
│       ├── scheduler.js        # Notifications + mailings scheduler
│       ├── security.js         # Validation + sanitization
│       ├── logger.js           # Winston
│       ├── config.js           # Centralized config
│       └── routes/             # Все routes (auth, subscriptions, etc)
│
├── lib_extracted/              # TypeScript библиотеки
│   └── lib/
│       ├── supabase-client.ts  # Supabase client
│       ├── auth.ts             # Auth helpers
│       └── remnawave.ts        # RemnaWave API (TypeScript)
│
├── supabase/                   # Supabase миграции
│   └── migrations/
│       ├── 20260216140033_20260216_notifications_mailing_system.sql
│       └── 20260216140200_20260216_mailing_templates_content.sql
│
├── supabase_extracted/         # Дополнительные миграции
│   └── supabase/
│       └── migrations/
│           ├── 20260215065332_add_missing_columns_for_vpn_platform.sql
│           ├── 20260215134732_create_profile_trigger.sql
│           └── 20260216010123_20260216_fix_rls_performance_auth_functions.sql
│
├── scripts/                    # Вспомогательные скрипты
│   ├── seed-demo-data.js       # Генерация демо-данных
│   ├── test-endpoints.sh       # Тестирование API
│   ├── check-ports.sh          # Проверка портов
│   ├── check-status.sh         # Проверка статуса сервисов
│   ├── dev-start.sh            # Запуск dev окружения
│   ├── restart-all.sh          # Перезапуск всех сервисов
│   ├── setup-existing-ssl.sh   # Настройка SSL
│   └── update-server.sh        # Обновление сервера
│
├── tests/                      # Тесты
│   └── smoke.test.js           # Smoke tests
│
└── logs/                       # Логи (создается автоматически)
    ├── error.log
    └── combined.log
```

---

## 17. СТАТИСТИКА ПРОЕКТА

### 17.1 Количество кода

| Компонент | Количество файлов | Строки кода (примерно) |
|-----------|-------------------|------------------------|
| Backend (src/) | 20+ | ~3000 |
| Frontend (web/pages/) | 10 | ~2000 |
| Admin Panel (admin.html) | 1 | 640 |
| Migrations (supabase/) | 5 | ~800 |
| Scripts | 8 | ~500 |
| **Итого** | **44+** | **~6940** |

### 17.2 Endpoints API

- **VPN**: 4 endpoints
- **Auth**: 4 endpoints
- **Subscriptions**: 3 endpoints
- **Admin**: 9 endpoints
- **Tariffs**: 1 endpoint
- **Referrals**: 1 endpoint
- **News**: 2 endpoints
- **Notifications**: 2 endpoints
- **Mailings**: 3 endpoints
- **Servers**: 1 endpoint
- **Settings**: 1 endpoint

**Итого: 31 endpoint**

### 17.3 Таблицы базы данных

**Локальная PostgreSQL:**
- users
- subscriptions
- vpn_configs
- connection_logs
- available_countries

**Суммарно: 5 таблиц**

**Supabase PostgreSQL:**
- profiles
- tariffs
- subscriptions
- referrals
- notifications
- notification_templates
- notification_history
- mailing_templates
- mailings
- mailing_history
- news
- payments
- app_settings

**Суммарно: 13 таблиц**

**Всего таблиц: 18**

---

## 18. ТЕХНИЧЕСКИЕ ОСОБЕННОСТИ И ПРЕИМУЩЕСТВА

### 18.1 Smart Connect

Уникальная функция автоматического определения платформы и выдачи оптимального формата VPN-конфигурации:
- **iOS**: Deep-link для Shadowrocket (один клик)
- **Android**: Deep-link для V2RayNG (один клик)
- **Desktop**: Безопасная загрузка файла с HMAC токеном (5 мин)
- **Unknown**: QR код для сканирования

### 18.2 Двухуровневая база данных

- **Локальная PostgreSQL**: быстрые операции, connection logs
- **Supabase PostgreSQL**: облачная БД с RLS, Auth, Storage

### 18.3 Автоматизация

- **Cron планировщик**: автоматические уведомления за 24h, 10h, 0h до истечения
- **Сегментированные рассылки**: отправка по сегментам (триал, активные, неактивные)
- **Auto-provisioning**: автоматическое создание VPN-пользователей через RemnaWave API

### 18.4 Реферальная программа

Встроенная реферальная система с гибкими настройками (фиксированный бонус или процент).

### 18.5 Безопасность

- HMAC токены для скачивания конфигов
- JWT для API аутентификации
- Row Level Security в Supabase
- Rate limiting (100 req/15min)
- CORS, Helmet, Input validation

---

## 19. ИЗВЕСТНЫЕ ОГРАНИЧЕНИЯ

1. **Email/Telegram отправка**: В текущей реализации рассылки только логируются, реальная отправка не настроена
2. **Платежная интеграция**: Отсутствует интеграция с платежными системами (Stripe, PayPal)
3. **Многоязычность**: Интерфейс только на русском языке
4. **Mobile приложения**: Нет нативных iOS/Android приложений, только web
5. **WebSocket**: Нет real-time уведомлений, только polling

---

## 20. ROADMAP (БУДУЩИЕ УЛУЧШЕНИЯ)

1. **Stripe/PayPal интеграция** для автоматических платежей
2. **Email провайдер** (SendGrid, Mailgun) для реальных рассылок
3. **Telegram бот** для уведомлений и управления подписками
4. **WebSocket** для real-time уведомлений
5. **CDN** для статических файлов (Cloudflare, AWS CloudFront)
6. **Grafana + Prometheus** для мониторинга
7. **CI/CD** (GitHub Actions) для автоматического деплоя
8. **Docker Compose** для всего стека (Noryx + RemnaWave + PostgreSQL)
9. **Multi-language** поддержка (English, Spanish, Chinese)
10. **Mobile приложения** (React Native / Flutter)

---

## 21. КОНТАКТЫ И ПОДДЕРЖКА

**Документация:**
- RemnaWave: https://docs.rw/
- Supabase: https://supabase.com/docs

**Техническая поддержка:**
- Email: support@noryx.com
- Telegram: @noryx_support

---

**Версия документа:** 1.0
**Дата создания:** 2026-02-16
**Автор:** Technical Team Noryx Premium VPN
