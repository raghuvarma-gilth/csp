-- Create table for learning streaks and achievements
CREATE TABLE public.learning_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  total_active_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create table for personal achievements/bests
CREATE TABLE public.learning_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_type TEXT NOT NULL,
  achievement_value INTEGER NOT NULL DEFAULT 0,
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for leaderboard preferences (opt-out)
CREATE TABLE public.leaderboard_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  show_on_leaderboard BOOLEAN NOT NULL DEFAULT true,
  show_streak BOOLEAN NOT NULL DEFAULT true,
  show_improvement BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create table for AIVA chat context
CREATE TABLE public.aiva_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  current_concept TEXT,
  current_chapter TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.learning_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiva_conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for learning_streaks
CREATE POLICY "Users can view their own streaks"
ON public.learning_streaks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streaks"
ON public.learning_streaks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streaks"
ON public.learning_streaks FOR UPDATE
USING (auth.uid() = user_id);

-- Policy to view top streaks for leaderboard (only users who opted in)
CREATE POLICY "Users can view public streaks"
ON public.learning_streaks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leaderboard_preferences lp
    WHERE lp.user_id = learning_streaks.user_id
    AND lp.show_on_leaderboard = true
    AND lp.show_streak = true
  )
);

-- RLS policies for learning_achievements
CREATE POLICY "Users can view their own achievements"
ON public.learning_achievements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements"
ON public.learning_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own achievements"
ON public.learning_achievements FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for leaderboard_preferences
CREATE POLICY "Users can view their own preferences"
ON public.leaderboard_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
ON public.leaderboard_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.leaderboard_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for aiva_conversations
CREATE POLICY "Users can view their own AIVA conversations"
ON public.aiva_conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AIVA conversations"
ON public.aiva_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AIVA conversations"
ON public.aiva_conversations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AIVA conversations"
ON public.aiva_conversations FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_learning_streaks_updated_at
BEFORE UPDATE ON public.learning_streaks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leaderboard_preferences_updated_at
BEFORE UPDATE ON public.leaderboard_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_aiva_conversations_updated_at
BEFORE UPDATE ON public.aiva_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();