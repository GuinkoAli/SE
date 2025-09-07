-- Database Schema for ALX Polly Polling Application
-- This schema supports creating polls, multiple options per poll, and recording votes

-- Enable Row Level Security (RLS)
-- ALTER DATABASE postgres SET "app.jwt_secret" TO '''your-jwt-secret-here''';

-- Create custom types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '''poll_status''') THEN
        CREATE TYPE poll_status AS ENUM ('''active''', '''closed''', '''draft''');
    END IF;
END $$;

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Polls table
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  description TEXT,
  status poll_status DEFAULT '''active''',
  is_public BOOLEAN DEFAULT true,
  allow_multiple_votes BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poll options table
CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes table
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
  voter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, voter_id, option_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_polls_creator_id ON public.polls(creator_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON public.polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON public.polls(created_at);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_display_order ON public.poll_options(display_order);
CREATE INDEX IF NOT EXISTS idx_votes_poll_id ON public.votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_option_id ON public.votes(option_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON public.votes(voter_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for polls
CREATE POLICY "Anyone can view public active polls" ON public.polls
  FOR SELECT USING (is_public = true AND status = '''active''');

CREATE POLICY "Users can view their own polls" ON public.polls
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Authenticated users can create polls" ON public.polls
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update their own polls" ON public.polls
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete their own polls" ON public.polls
  FOR DELETE USING (auth.uid() = creator_id);

-- RLS Policies for poll options
CREATE POLICY "Anyone can view poll options for public polls" ON public.poll_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.polls 
      WHERE id = poll_id 
      AND is_public = true 
      AND status = '''active'''
    )
  );

CREATE POLICY "Users can view options for their own polls" ON public.poll_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.polls 
      WHERE id = poll_id 
      AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage options for their own polls" ON public.poll_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.polls 
      WHERE id = poll_id 
      AND creator_id = auth.uid()
    )
  );

-- RLS Policies for votes
CREATE POLICY "Anyone can view votes for public polls" ON public.votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.polls 
      WHERE id = poll_id 
      AND is_public = true
    )
  );

CREATE POLICY "Users can view their own votes" ON public.votes
  FOR SELECT USING (auth.uid() = voter_id);

CREATE POLICY "Authenticated users can vote on public active polls" ON public.votes
  FOR INSERT WITH CHECK (
    auth.uid() = voter_id AND
    EXISTS (
      SELECT 1 FROM public.polls 
      WHERE id = poll_id 
      AND is_public = true 
      AND status = '''active'''
    )
  );

CREATE POLICY "Users can update their own votes" ON public.votes
  FOR UPDATE USING (auth.uid() = voter_id);

CREATE POLICY "Users can delete their own votes" ON public.votes
  FOR DELETE USING (auth.uid() = voter_id);

-- Create functions for common operations
CREATE OR REPLACE FUNCTION get_poll_with_options(poll_uuid UUID)
RETURNS TABLE (
  poll_id UUID,
  question TEXT,
  description TEXT,
  status poll_status,
  is_public BOOLEAN,
  allow_multiple_votes BOOLEAN,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  creator_id UUID,
  options JSON,
  total_votes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as poll_id,
    p.question,
    p.description,
    p.status,
    p.is_public,
    p.allow_multiple_votes,
    p.expires_at,
    p.created_at,
    p.creator_id,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          '''id''', po.id,
          '''option_text''', po.option_text,
          '''display_order''', po.display_order,
          '''vote_count''', COALESCE(vote_counts.vote_count, 0)
        ) ORDER BY po.display_order
      ) FROM public.poll_options po
      LEFT JOIN (
        SELECT option_id, COUNT(*) as vote_count
        FROM public.votes
        WHERE poll_id = p.id
        GROUP BY option_id
      ) vote_counts ON po.id = vote_counts.option_id
      WHERE po.poll_id = p.id), 
      '''[]'''::json
    ) as options,
    COALESCE((SELECT COUNT(*) FROM public.votes WHERE poll_id = p.id), 0) as total_votes
  FROM public.polls p
  WHERE p.id = poll_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user'''s polls
CREATE OR REPLACE FUNCTION get_user_polls(user_uuid UUID)
RETURNS TABLE (
  poll_id UUID,
  question TEXT,
  description TEXT,
  status poll_status,
  is_public BOOLEAN,
  allow_multiple_votes BOOLEAN,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  total_votes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as poll_id,
    p.question,
    p.description,
    p.status,
    p.is_public,
    p.allow_multiple_votes,
    p.expires_at,
    p.created_at,
    COALESCE((SELECT COUNT(*) FROM public.votes WHERE poll_id = p.id), 0) as total_votes
  FROM public.polls p
  WHERE p.creator_id = user_uuid
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to record a vote
CREATE OR REPLACE FUNCTION record_vote(
  poll_uuid UUID,
  option_uuid UUID,
  voter_uuid UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  poll_record RECORD;
BEGIN
  -- Check if poll exists and is active
  SELECT * INTO poll_record FROM public.polls WHERE id = poll_uuid;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '''Poll not found''';
  END IF;
  
  IF poll_record.status != '''active''' THEN
    RAISE EXCEPTION '''Poll is not active''';
  END IF;
  
  -- Check if option belongs to the poll
  IF NOT EXISTS (SELECT 1 FROM public.poll_options WHERE id = option_uuid AND poll_id = poll_uuid) THEN
    RAISE EXCEPTION '''Invalid option for this poll''';
  END IF;
  
  -- Handle voting logic
  IF poll_record.allow_multiple_votes THEN
    -- For polls allowing multiple votes, insert the new vote.
    -- A user can vote for the same option only once due to the UNIQUE constraint.
    INSERT INTO public.votes (poll_id, option_id, voter_id) VALUES (poll_uuid, option_uuid, voter_uuid)
    ON CONFLICT (poll_id, voter_id, option_id) DO NOTHING;
  ELSE
    -- For single-choice polls, this will overwrite the previous vote.
    -- This allows a user to change their vote.
    DELETE FROM public.votes WHERE poll_id = poll_uuid AND voter_id = voter_uuid;
    INSERT INTO public.votes (poll_id, option_id, voter_id) VALUES (poll_uuid, option_uuid, voter_uuid);
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_polls_updated_at
  BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_poll_options_updated_at
  BEFORE UPDATE ON public.poll_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- INSERT INTO public.profiles (id, email, full_name) VALUES 
--   ('''00000000-0000-0000-0000-000000000001''', '''test@example.com''', '''Test User''');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
