/*
  # Create profile trigger for auto-creation on user registration

  1. Functions
    - `generate_referral_code()` - Generates 8-character referral code
    - `handle_new_user()` - Auto-creates profile when user registers

  2. Trigger
    - `on_auth_user_created` - Executes after INSERT on auth.users
    
  3. Purpose
    - Automatically creates a profile record when a new user signs up
    - Generates unique referral code
    - Copies username from metadata or derives from email
    
  4. Security
    - Uses SECURITY DEFINER to allow profile creation
*/

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();