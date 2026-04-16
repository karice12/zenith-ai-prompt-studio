-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  subscription_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('active', 'inactive', 'past_due', 'cancelled')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  stripe_plan TEXT,
  subscription_start_at TIMESTAMPTZ,
  subscription_end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-insert profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- prompts_history table
CREATE TABLE IF NOT EXISTS prompts_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompts_history_user_id ON prompts_history(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_history_created_at ON prompts_history(created_at);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view own prompts"
  ON prompts_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompts"
  ON prompts_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Expiration: delete prompts older than 20 days
-- Run this query via a scheduled job (pg_cron or Supabase Edge Function cron):
-- DELETE FROM prompts_history WHERE created_at < NOW() - INTERVAL '20 days';

-- Or create a function + cron job (requires pg_cron extension):
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-old-prompts',
  '0 3 * * *',
  $$DELETE FROM prompts_history WHERE created_at < NOW() - INTERVAL '20 days'$$
);
