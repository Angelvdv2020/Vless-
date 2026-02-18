/*
  # NoryxVPN Platform -- Актуальная схема базы данных
  #
  # Эта схема уже применена к Supabase через миграции.
  # Файл служит справочной документацией.
  # Если вы разворачиваете проект с нуля, выполните этот SQL
  # в SQL Editor вашего Supabase-проекта: https://supabase.com/dashboard
  #
  # Таблицы:
  #   profiles            -- Профили пользователей (связаны с auth.users)
  #   tariffs             -- Тарифные планы VPN
  #   subscriptions       -- Подписки пользователей
  #   payments            -- Записи о платежах
  #   vpn_keys            -- VPN-ключи пользователей
  #   referrals           -- Реферальные бонусы
  #   support_tickets     -- Тикеты поддержки
  #   ticket_messages     -- Сообщения в тикетах
  #   news                -- Новости
  #   promotions          -- Промокоды
  #   gift_subscriptions  -- Подарочные подписки
  #   app_settings        -- Настройки приложения (key-value)
  #
  # Функции:
  #   generate_referral_code()  -- Генерация 8-символьного реферального кода
  #   is_admin()                -- Проверка роли администратора
  #   handle_new_user()         -- Автосоздание профиля при регистрации
  #
  # Триггер:
  #   on_auth_user_created      -- Создает профиль при INSERT в auth.users
  #
  # Безопасность:
  #   RLS включен на всех таблицах
  #   Пользователи видят только свои данные
  #   Администраторы имеют полный доступ через is_admin()
*/

-- ============================================
-- ФУНКЦИИ
-- ============================================

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    public.generate_referral_code()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ТАБЛИЦЫ
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  username text UNIQUE,
  full_name text DEFAULT '',
  telegram_id text DEFAULT '',
  referral_code text UNIQUE DEFAULT generate_referral_code(),
  referred_by uuid REFERENCES profiles(id),
  balance numeric DEFAULT 0,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  trial_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "System can insert profiles"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE TO authenticated
  USING (is_admin());

CREATE TABLE IF NOT EXISTS tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  price_monthly numeric DEFAULT 0,
  price_quarterly numeric DEFAULT 0,
  price_yearly numeric DEFAULT 0,
  max_devices integer DEFAULT 1,
  traffic_limit_gb integer,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  is_trial boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active tariffs"
  ON tariffs FOR SELECT TO authenticated
  USING (is_active = true OR is_admin());

CREATE POLICY "Anon can view active tariffs"
  ON tariffs FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Admins can insert tariffs"
  ON tariffs FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update tariffs"
  ON tariffs FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete tariffs"
  ON tariffs FOR DELETE TO authenticated
  USING (is_admin());

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tariff_id uuid REFERENCES tariffs(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'trial')),
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  auto_renew boolean DEFAULT false,
  remnawave_user_uuid text DEFAULT '',
  remnawave_username text DEFAULT '',
  subscription_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can delete subscriptions"
  ON subscriptions FOR DELETE TO authenticated
  USING (is_admin());

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id),
  amount numeric DEFAULT 0,
  currency text DEFAULT 'RUB',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method text DEFAULT '',
  promo_code text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can insert own payments"
  ON payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update payments"
  ON payments FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete payments"
  ON payments FOR DELETE TO authenticated
  USING (is_admin());

CREATE TABLE IF NOT EXISTS vpn_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id),
  key_name text DEFAULT 'Default',
  access_url text DEFAULT '',
  remnawave_key_id text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vpn_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vpn keys"
  ON vpn_keys FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can insert own vpn keys"
  ON vpn_keys FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vpn keys"
  ON vpn_keys FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vpn keys"
  ON vpn_keys FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bonus_days integer DEFAULT 0,
  bonus_amount numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR is_admin());

CREATE POLICY "System can insert referrals"
  ON referrals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Admins can update referrals"
  ON referrals FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete referrals"
  ON referrals FOR DELETE TO authenticated
  USING (is_admin());

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users and admins can update tickets"
  ON support_tickets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can delete tickets"
  ON support_tickets FOR DELETE TO authenticated
  USING (is_admin());

CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for own tickets"
  ON ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = ticket_messages.ticket_id
    AND (support_tickets.user_id = auth.uid() OR is_admin())
  ));

CREATE POLICY "Users can insert messages for own tickets"
  ON ticket_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = ticket_messages.ticket_id
    AND (support_tickets.user_id = auth.uid() OR is_admin())
  ));

CREATE POLICY "Admins can update ticket messages"
  ON ticket_messages FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete ticket messages"
  ON ticket_messages FOR DELETE TO authenticated
  USING (is_admin());

CREATE TABLE IF NOT EXISTS news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  excerpt text DEFAULT '',
  image_url text DEFAULT '',
  is_published boolean DEFAULT false,
  author_id uuid REFERENCES profiles(id),
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published news"
  ON news FOR SELECT TO authenticated
  USING (is_published = true OR is_admin());

CREATE POLICY "Anon can view published news"
  ON news FOR SELECT TO anon
  USING (is_published = true);

CREATE POLICY "Admins can insert news"
  ON news FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update news"
  ON news FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete news"
  ON news FOR DELETE TO authenticated
  USING (is_admin());

CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text DEFAULT '',
  discount_percent integer DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount numeric DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  max_uses integer DEFAULT 0,
  current_uses integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active promotions"
  ON promotions FOR SELECT TO authenticated
  USING (is_active = true OR is_admin());

CREATE POLICY "Anon can view active promotions"
  ON promotions FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Admins can insert promotions"
  ON promotions FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update promotions"
  ON promotions FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete promotions"
  ON promotions FOR DELETE TO authenticated
  USING (is_admin());

CREATE TABLE IF NOT EXISTS gift_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  tariff_id uuid NOT NULL REFERENCES tariffs(id),
  duration_months integer DEFAULT 1,
  gift_code text UNIQUE DEFAULT generate_referral_code(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'expired')),
  message text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gift_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gift subscriptions"
  ON gift_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR is_admin());

CREATE POLICY "Users can create gift subscriptions"
  ON gift_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Admins can update gift subscriptions"
  ON gift_subscriptions FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete gift subscriptions"
  ON gift_subscriptions FOR DELETE TO authenticated
  USING (is_admin());

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Service role full access to app_settings"
  ON app_settings FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- ТРИГГЕР
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ИНДЕКСЫ
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tariffs_active ON tariffs(is_active, sort_order);

-- ============================================
-- НАЧАЛЬНЫЕ ДАННЫЕ
-- ============================================

INSERT INTO tariffs (name, description, price_monthly, price_quarterly, price_yearly, max_devices, features, is_active, sort_order)
VALUES
  ('Старт', 'Идеально для знакомства с сервисом', 149, 399, 1290, 1,
   '["1 устройство", "Все серверы", "Безлимитный трафик", "Поддержка 24/7"]'::jsonb, true, 1),
  ('Премиум', 'Самый популярный тариф', 299, 749, 2490, 3,
   '["3 устройства", "Все серверы", "Безлимитный трафик", "Приоритетная поддержка", "Выделенный IP"]'::jsonb, true, 2),
  ('Семейный', 'Для всей семьи', 499, 1249, 3990, 6,
   '["6 устройств", "Все серверы", "Безлимитный трафик", "VIP поддержка", "Выделенный IP", "Семейное управление"]'::jsonb, true, 3)
ON CONFLICT DO NOTHING;

INSERT INTO news (title, content, excerpt, is_published, published_at)
VALUES
  ('Запуск NoryxVPN', 'Мы рады представить наш новый VPN-сервис! Быстрое и безопасное подключение к серверам. Используем протокол VLESS для максимальной скорости и стабильности.', 'Новый VPN-сервис с протоколом VLESS', true, now() - interval '3 days'),
  ('Новые серверы в Европе', 'Добавлены серверы в Германии, Нидерландах и Финляндии для ещё более быстрого подключения из России и СНГ.', 'Серверы в Германии, Нидерландах и Финляндии', true, now() - interval '1 day'),
  ('Реферальная программа', 'Приглашайте друзей и получайте бонусы на баланс! Каждый новый пользователь, зарегистрированный по вашей ссылке, приносит вам 50 рублей на баланс.', 'Получайте бонусы за друзей', true, now())
ON CONFLICT DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES
  ('referral', '{"enabled": true, "bonus_type": "fixed", "bonus_amount": 50}'::jsonb),
  ('trial', '{"enabled": true, "duration_days": 3, "traffic_limit_gb": 5}'::jsonb)
ON CONFLICT (key) DO NOTHING;
