/*
  # Notifications and Mailing System

  1. New Tables
    - `notifications` - уведомления для пользователей
    - `notification_templates` - шаблоны уведомлений
    - `mailing_templates` - шаблоны рассылок с медиа
    - `mailings` - рассылки по сегментам
    - `notification_history` - история отправленных уведомлений
    - `mailing_history` - история рассылок

  2. Columns
    - notifications: id, user_id, type, title, message, data, status, sent_at, scheduled_at
    - notification_templates: type, subject, message, telegram_template
    - mailing_templates: name, segment, subject, html_content, image_url, gif_url
    - mailings: template_id, segment, status, scheduled_at, sent_count
    - notification_history: user_id, notification_id, type, sent_at
    - mailing_history: mailing_id, user_id, sent_at

  3. Security
    - RLS enabled on all tables
    - Admins can manage notifications and mailings
    - Users can view their own notifications

  4. Features
    - 3-level notification system (24h, 10h, 0h before expiry)
    - Segmented mailings with media support
    - HTML and Telegram support
    - Auto-sending via scheduler
*/

CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text UNIQUE NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  telegram_template text DEFAULT '',
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view notification templates"
  ON notification_templates FOR SELECT
  USING (is_active = true OR is_admin());

CREATE POLICY "Admins can manage notification templates"
  ON notification_templates FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update notification templates"
  ON notification_templates FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS mailing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  segment text DEFAULT 'all' CHECK (segment IN ('all', 'with_subscription', 'without_subscription', 'trial', 'no_trial', 'inactive', 'custom')),
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

ALTER TABLE mailing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active mailing templates"
  ON mailing_templates FOR SELECT TO authenticated
  USING (is_active = true OR is_admin());

CREATE POLICY "Admins can insert mailing templates"
  ON mailing_templates FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update mailing templates"
  ON mailing_templates FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('trial_expiry_24h', 'trial_expiry_10h', 'trial_expiry_0h', 'subscription_expiry_24h', 'subscription_expiry_10h', 'subscription_expiry_0h', 'discount_offer', 'custom')),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR auth.uid() = user_id);

CREATE POLICY "Admins can update notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS mailings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES mailing_templates(id) ON DELETE CASCADE,
  segment text NOT NULL CHECK (segment IN ('all', 'with_subscription', 'without_subscription', 'trial', 'no_trial', 'inactive', 'custom')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')),
  filter_conditions jsonb DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mailings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage mailings"
  ON mailings FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert mailings"
  ON mailings FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update mailings"
  ON mailings FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  delivery_status text DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'failed', 'bounced'))
);

ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification history"
  ON notification_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "System can insert notification history"
  ON notification_history FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS mailing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailing_id uuid NOT NULL REFERENCES mailings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sent_at timestamptz DEFAULT now(),
  delivery_status text DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'failed', 'bounced', 'opened'))
);

ALTER TABLE mailing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view mailing history"
  ON mailing_history FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "System can insert mailing history"
  ON mailing_history FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_mailings_status ON mailings(status);
CREATE INDEX IF NOT EXISTS idx_mailings_scheduled_at ON mailings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_mailing_history_mailing_id ON mailing_history(mailing_id);
CREATE INDEX IF NOT EXISTS idx_mailing_history_user_id ON mailing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);

INSERT INTO notification_templates (type, subject, message, telegram_template, variables, is_active)
VALUES
  (
    'subscription_expiry_24h',
    'Ваша подписка заканчивается завтра',
    'Уважаемый {{username}}, ваша подписка {{tariff_name}} истекает завтра в {{expiry_time}}. Продлите подписку, чтобы продолжить пользование сервисом.',
    '⏰ Ваша подписка заканчивается завтра!

Тариф: {{tariff_name}}
Дата истечения: {{expiry_date}} {{expiry_time}}

Продлите подписку прямо сейчас через кабинет',
    '["username", "tariff_name", "expiry_time", "expiry_date"]'::jsonb,
    true
  ),
  (
    'subscription_expiry_10h',
    'Осталось 10 часов до истечения подписки!',
    'Срочно! Ваша подписка {{tariff_name}} заканчивается через 10 часов. Это последнее напоминание перед потерей доступа.',
    '🚨 Срочно! 10 часов до конца подписки!

Тариф: {{tariff_name}}
Истекает: {{expiry_time}}

Продлите сейчас же, чтобы не потерять доступ!',
    '["username", "tariff_name", "expiry_time"]'::jsonb,
    true
  ),
  (
    'subscription_expiry_0h',
    'Ваша подписка истекла',
    'Ваша подписка {{tariff_name}} истекла. К сожалению, доступ к VPN закрыт. Продлите подписку, чтобы восстановить доступ.',
    '❌ Ваша подписка истекла!

Тариф: {{tariff_name}}

Восстановите доступ прямо сейчас - продлите подписку!',
    '["username", "tariff_name"]'::jsonb,
    true
  ),
  (
    'trial_expiry_24h',
    'Ваш пробный период заканчивается завтра',
    'Привет {{username}}! Твой пробный период истекает завтра. Пока ты еще имеешь доступ, опробуй все возможности сервиса!',
    '⏰ Пробный период заканчивается завтра!

Поспеши, у тебя осталось 24 часа!
Оформи подписку и получи доступ ко всем серверам.',
    '["username"]'::jsonb,
    true
  ),
  (
    'discount_offer',
    'Специальное предложение: скидка {{discount}}% на подписку',
    'Привет {{username}}! Мы подготовили для тебя скидку {{discount}}% на тариф {{tariff_name}}. Предложение действует до {{expire_date}}.',
    '🎁 Спецпредложение только для тебя!

Скидка {{discount}}% на {{tariff_name}}
Действит до {{expire_date}}

Спешите, предложение ограничено!',
    '["username", "discount", "tariff_name", "expire_date"]'::jsonb,
    true
  ),
  (
    'custom',
    'Сообщение от {{sender}}',
    '{{message_body}}',
    '{{message_body}}',
    '["sender", "message_body"]'::jsonb,
    true
  )
ON CONFLICT (type) DO NOTHING;
