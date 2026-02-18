-- Noryx Premium VPN Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    x3ui_client_uuid VARCHAR(255),
    x3ui_client_email VARCHAR(255),
    x3ui_inbound_id INTEGER,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VPN keys table used by runtime routes
CREATE TABLE IF NOT EXISTS vpn_keys (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    x3ui_client_id VARCHAR(255),
    x3ui_inbound_id INTEGER,
    x3ui_inbound_tag VARCHAR(100),
    country_code VARCHAR(10) DEFAULT 'auto',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subscription_id)
);

-- Optional compatibility table
CREATE TABLE IF NOT EXISTS vpn_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    x3ui_client_ref VARCHAR(255) UNIQUE NOT NULL,
    country_code VARCHAR(10) DEFAULT 'auto',
    server_location VARCHAR(100),
    config_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, subscription_id)
);

CREATE TABLE IF NOT EXISTS connection_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50),
    connection_type VARCHAR(50),
    country_code VARCHAR(10),
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS available_countries (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(10) UNIQUE NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    flag_emoji VARCHAR(10),
    is_available BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_content (
    id SERIAL PRIMARY KEY,
    section_key VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) DEFAULT '',
    body TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE site_content
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS published_version INTEGER;

CREATE TABLE IF NOT EXISTS site_content_versions (
    id SERIAL PRIMARY KEY,
    section_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    title VARCHAR(255) DEFAULT '',
    body TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section_key, version_no)
);

CREATE TABLE IF NOT EXISTS ai_generation_logs (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    section_key VARCHAR(100),
    prompt TEXT,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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


INSERT INTO site_content (section_key, title, body, image_url, status, current_version, published_version)
VALUES
  ('hero', 'Secure VPN for everyone', 'Fast, private and reliable connection.', '', 'published', 1, 1),
  ('features', 'Features', 'AES-256, no logs, global servers.', '', 'published', 1, 1),
  ('pricing', 'Pricing', 'Simple plans for teams and individuals.', '', 'published', 1, 1),
  ('faq', 'FAQ', 'Answers to common VPN questions.', '', 'published', 1, 1),
  ('footer', 'Contacts', 'support@noryx.example', '', 'published', 1, 1)
ON CONFLICT (section_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_x3ui_email ON subscriptions(x3ui_client_email);
CREATE INDEX IF NOT EXISTS idx_vpn_keys_subscription_id ON vpn_keys(subscription_id);
CREATE INDEX IF NOT EXISTS idx_vpn_configs_user_id ON vpn_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_vpn_configs_x3ui_client_ref ON vpn_configs(x3ui_client_ref);
CREATE INDEX IF NOT EXISTS idx_connection_logs_user_id ON connection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_site_content_section_key ON site_content(section_key);

CREATE INDEX IF NOT EXISTS idx_site_content_versions_section_key ON site_content_versions(section_key);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_created_at ON ai_generation_logs(created_at);
