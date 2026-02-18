-- ═══════════════════════════════════════════════════════════════
-- SCHEMA ДЛЯ POSTGRESQL НА VPS (СЕРВЕР 1)
-- База данных: noryxvpn
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────────────────────────────────────────────
-- 2. ПОЛЬЗОВАТЕЛИ И АУТЕНТИФИКАЦИЯ
-- ───────────────────────────────────────────────────────────────

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Таблица профилей
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    telegram VARCHAR(100),
    phone VARCHAR(50),
    avatar_url VARCHAR(500),
    country VARCHAR(100),
    language VARCHAR(10) DEFAULT 'ru',
    timezone VARCHAR(100) DEFAULT 'Europe/Moscow',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Индексы для profiles
CREATE INDEX idx_profiles_user_id ON profiles(user_id);

-- ───────────────────────────────────────────────────────────────
-- 3. ТАРИФЫ И ПОДПИСКИ
-- ───────────────────────────────────────────────────────────────

-- Таблица тарифов
CREATE TABLE IF NOT EXISTS tariffs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'RUB',
    duration_days INTEGER NOT NULL,
    traffic_gb INTEGER DEFAULT 0, -- 0 = unlimited
    speed_mbps INTEGER DEFAULT 0, -- 0 = unlimited
    devices_count INTEGER DEFAULT 5,
    features JSONB DEFAULT '[]',
    is_popular BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для tariffs
CREATE INDEX idx_tariffs_is_active ON tariffs(is_active);
CREATE INDEX idx_tariffs_sort_order ON tariffs(sort_order);

-- Вставка дефолтных тарифов
INSERT INTO tariffs (name, description, price, duration_days, traffic_gb, is_popular) VALUES
('Базовый', 'Для начинающих пользователей', 199, 30, 50, FALSE),
('Стандарт', 'Оптимальный выбор', 399, 30, 200, TRUE),
('Премиум', 'Безлимитный трафик', 699, 30, 0, FALSE),
('Годовой', 'Экономия 30%', 4999, 365, 0, TRUE);

-- Таблица подписок
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tariff_id INTEGER REFERENCES tariffs(id),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
    started_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    auto_renew BOOLEAN DEFAULT FALSE,
    traffic_used_gb DECIMAL(10, 2) DEFAULT 0,
    traffic_limit_gb INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для subscriptions
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);

-- ───────────────────────────────────────────────────────────────
-- 4. ПЛАТЕЖИ
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    tariff_id INTEGER REFERENCES tariffs(id),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'RUB',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded')),
    payment_method VARCHAR(50), -- yukassa, card, crypto
    payment_provider VARCHAR(50), -- yukassa, stripe
    payment_id VARCHAR(255), -- ID платежа у провайдера
    payment_url VARCHAR(500), -- URL для оплаты
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для payments
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payment_id ON payments(payment_id);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- ───────────────────────────────────────────────────────────────
-- 5. VPN СЕРВЕРЫ И КЛЮЧИ
-- ───────────────────────────────────────────────────────────────

-- Таблица VPN серверов
CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    x3ui_id INTEGER, -- ID сервера в 3X-UI
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    country_code VARCHAR(2),
    city VARCHAR(100),
    ip_address VARCHAR(100) NOT NULL,
    domain VARCHAR(255),
    port INTEGER DEFAULT 443,
    protocol VARCHAR(50) DEFAULT 'vless',
    load_percent INTEGER DEFAULT 0,
    users_count INTEGER DEFAULT 0,
    max_users INTEGER DEFAULT 1000,
    status VARCHAR(50) DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance')),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_sync_at TIMESTAMP
);

-- Индексы для servers
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_servers_is_active ON servers(is_active);
CREATE INDEX idx_servers_country ON servers(country);
CREATE INDEX idx_servers_x3ui_id ON servers(x3ui_id);

-- Вставка дефолтных серверов (примеры)
INSERT INTO servers (name, country, country_code, city, ip_address, status) VALUES
('RU-Moscow-01', 'Россия', 'RU', 'Москва', '123.45.67.89', 'online'),
('DE-Berlin-01', 'Германия', 'DE', 'Берлин', '123.45.67.90', 'online'),
('US-NewYork-01', 'США', 'US', 'Нью-Йорк', '123.45.67.91', 'online');

-- Таблица VPN ключей пользователей
CREATE TABLE IF NOT EXISTS vpn_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    server_id INTEGER REFERENCES servers(id),
    x3ui_user_id INTEGER, -- ID пользователя в 3X-UI
    key_uuid VARCHAR(255) NOT NULL, -- UUID ключа
    subscription_url TEXT NOT NULL, -- URL для подписки
    qr_code TEXT, -- Base64 QR код
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
    traffic_used_gb DECIMAL(10, 2) DEFAULT 0,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, server_id)
);

-- Индексы для vpn_keys
CREATE INDEX idx_vpn_keys_user_id ON vpn_keys(user_id);
CREATE INDEX idx_vpn_keys_subscription_id ON vpn_keys(subscription_id);
CREATE INDEX idx_vpn_keys_server_id ON vpn_keys(server_id);
CREATE INDEX idx_vpn_keys_status ON vpn_keys(status);
CREATE INDEX idx_vpn_keys_x3ui_user_id ON vpn_keys(x3ui_user_id);

-- ───────────────────────────────────────────────────────────────
-- 6. РЕФЕРАЛЬНАЯ СИСТЕМА
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    invited_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    bonus_amount DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для referrals
CREATE INDEX idx_referrals_user_id ON referrals(user_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_invited_user_id ON referrals(invited_user_id);

-- Таблица балансов рефералов
CREATE TABLE IF NOT EXISTS referral_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    balance DECIMAL(10, 2) DEFAULT 0,
    total_earned DECIMAL(10, 2) DEFAULT 0,
    total_withdrawn DECIMAL(10, 2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для referral_balances
CREATE INDEX idx_referral_balances_user_id ON referral_balances(user_id);

-- ───────────────────────────────────────────────────────────────
-- 7. НОВОСТИ
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    image_url VARCHAR(500),
    author_id UUID REFERENCES users(id),
    category VARCHAR(100),
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для news
CREATE INDEX idx_news_published_at ON news(published_at);
CREATE INDEX idx_news_is_published ON news(is_published);
CREATE INDEX idx_news_category ON news(category);

-- ───────────────────────────────────────────────────────────────
-- 8. УВЕДОМЛЕНИЯ
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- subscription_expiring, payment_success, etc
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ───────────────────────────────────────────────────────────────
-- 9. РАССЫЛКИ
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mailings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    html_content TEXT,
    recipients_filter JSONB, -- фильтр получателей
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для mailings
CREATE INDEX idx_mailings_status ON mailings(status);
CREATE INDEX idx_mailings_scheduled_at ON mailings(scheduled_at);

-- ───────────────────────────────────────────────────────────────
-- 10. ЛОГИ И АУДИТ
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    ip_address VARCHAR(100),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для audit_logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ───────────────────────────────────────────────────────────────
-- 11. ФУНКЦИИ И ТРИГГЕРЫ
-- ───────────────────────────────────────────────────────────────

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Применить триггер ко всем таблицам с updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tariffs_updated_at BEFORE UPDATE ON tariffs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vpn_keys_updated_at BEFORE UPDATE ON vpn_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON news FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция для создания профиля после регистрации
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_profile_trigger AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_profile_for_new_user();

-- Функция для создания реферального кода
CREATE OR REPLACE FUNCTION create_referral_code_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO referrals (user_id, referral_code)
    VALUES (NEW.id, UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)));
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_referral_trigger AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_referral_code_for_user();

-- ═══════════════════════════════════════════════════════════════
-- КОНЕЦ СХЕМЫ
-- ═══════════════════════════════════════════════════════════════
