-- Date Planner schema
-- Run this in your Supabase SQL editor after creating the project.

-- Profiles (auto-created on signup)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invites
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Date plans
CREATE TABLE IF NOT EXISTS date_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID UNIQUE REFERENCES invites(id) ON DELETE SET NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_id UUID REFERENCES auth.users(id),
  selected_date TEXT,
  selected_date_label TEXT,
  selected_time TEXT,
  selected_time_label TEXT,
  selected_entree TEXT,
  selected_activities JSONB NOT NULL DEFAULT '[]',
  itinerary JSONB,
  itinerary_generated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ratings (one per person per plan)
CREATE TABLE IF NOT EXISTS date_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES date_plans(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id),
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, rater_id)
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_ratings ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- Invites: sender owns their invites; anyone with the token can read
CREATE POLICY "Sender owns invites" ON invites FOR ALL USING (auth.uid() = sender_id);
CREATE POLICY "Token read" ON invites FOR SELECT USING (true);

-- Plans: sender and recipient can read/update
CREATE POLICY "Plan participants" ON date_plans FOR ALL
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Ratings: participants can rate and read
CREATE POLICY "Ratings" ON date_ratings FOR ALL
  USING (
    auth.uid() = rater_id OR
    EXISTS (
      SELECT 1 FROM date_plans
      WHERE id = plan_id
      AND (sender_id = auth.uid() OR recipient_id = auth.uid())
    )
  );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
