/*
  # Add missing columns for VPN platform

  1. Modified Tables
    - `profiles` - add `trial_used` boolean for trial period tracking
    - `tariffs` - add `is_trial` boolean for trial tariff identification
    - `subscriptions` - add `x3ui_username` for 3X-UI API lookups
    - `news` - add `published_at` for publish date ordering

  2. New Tables
    - `app_settings` - Key-value configuration store for referral settings, trial config, etc.

  3. Security
    - RLS enabled on app_settings
    - Public read access for settings
    - Service role full access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'trial_used'
  ) THEN
    ALTER TABLE profiles ADD COLUMN trial_used boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tariffs' AND column_name = 'is_trial'
  ) THEN
    ALTER TABLE tariffs ADD COLUMN is_trial boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'x3ui_username'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN x3ui_username text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE news ADD COLUMN published_at timestamptz;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Service role full access to app_settings"
  ON app_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO app_settings (key, value)
VALUES
  ('referral', '{"enabled": true, "bonus_type": "fixed", "bonus_amount": 50}'::jsonb),
  ('trial', '{"enabled": true, "duration_days": 3, "traffic_limit_gb": 5}'::jsonb)
ON CONFLICT (key) DO NOTHING;
