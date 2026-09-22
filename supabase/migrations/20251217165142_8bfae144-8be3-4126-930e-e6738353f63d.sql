-- Create table for adaptive learning profiles
CREATE TABLE public.adaptive_learning_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  diagnostic_score INTEGER NOT NULL DEFAULT 0,
  learning_style TEXT NOT NULL DEFAULT 'step-by-step',
  answered_questions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create table for concept progress
CREATE TABLE public.adaptive_concept_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  concept_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not-started',
  time_spent INTEGER NOT NULL DEFAULT 0,
  quiz_score INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, concept_id)
);

-- Enable RLS
ALTER TABLE public.adaptive_learning_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_concept_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for adaptive_learning_profiles
CREATE POLICY "Users can view their own learning profile"
ON public.adaptive_learning_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning profile"
ON public.adaptive_learning_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning profile"
ON public.adaptive_learning_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for adaptive_concept_progress
CREATE POLICY "Users can view their own concept progress"
ON public.adaptive_concept_progress
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own concept progress"
ON public.adaptive_concept_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own concept progress"
ON public.adaptive_concept_progress
FOR UPDATE
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_adaptive_learning_profiles_updated_at
BEFORE UPDATE ON public.adaptive_learning_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_adaptive_concept_progress_updated_at
BEFORE UPDATE ON public.adaptive_concept_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();