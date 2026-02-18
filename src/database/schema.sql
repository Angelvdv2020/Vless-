-- Noryx Premium VPN Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL, -- 'monthly', 'yearly', 'trial'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'cancelled'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VPN Configurations table (stores RemnaWave subscription IDs)
CREATE TABLE IF NOT EXISTS vpn_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    remnawave_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    country_code VARCHAR(10) DEFAULT 'auto', -- 'us', 'uk', 'de', 'auto', etc.
    server_location VARCHAR(100),
    config_type VARCHAR(50), -- 'shadowsocks', 'vmess', 'vless', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, subscription_id)
);

-- Connection logs (optional, for analytics)
CREATE TABLE IF NOT EXISTS connection_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50), -- 'ios', 'android', 'windows', 'macos', 'linux'
    connection_type VARCHAR(50), -- 'deep-link', 'file', 'qr-code'
    country_code VARCHAR(10),
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Available countries (cache from RemnaWave)
CREATE TABLE IF NOT EXISTS available_countries (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(10) UNIQUE NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    flag_emoji VARCHAR(10),
    is_available BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority = show first
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default countries
INSERT INTO available_countries (country_code, country_name, flag_emoji, priority) VALUES
    ('auto', 'Auto (Best)', '🌍', 100),
    ('us', 'United States', '🇺🇸', 90),
    ('uk', 'United Kingdom', '🇬🇧', 80),
    ('de', 'Germany', '🇩🇪', 70),
    ('nl', 'Netherlands', '🇳🇱', 60),
    ('sg', 'Singapore', '🇸🇬', 50),
    ('jp', 'Japan', '🇯🇵', 40),
    ('ca', 'Canada', '🇨🇦', 30)
ON CONFLICT (country_code) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_vpn_configs_user_id ON vpn_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_vpn_configs_remnawave_id ON vpn_configs(remnawave_subscription_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_user_id ON connection_logs(user_id);
