-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('student', 'faculty', 'research_expert');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own initial role"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create chapter_content table for faculty uploads
CREATE TABLE public.chapter_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    chapter_id TEXT NOT NULL DEFAULT 'arrays-stacks-queues',
    title TEXT NOT NULL,
    content TEXT,
    lecture_notes TEXT,
    slides_url TEXT,
    pdf_url TEXT,
    learning_objectives JSONB DEFAULT '[]'::jsonb,
    key_concepts JSONB DEFAULT '[]'::jsonb,
    common_misconceptions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for chapter_content
ALTER TABLE public.chapter_content ENABLE ROW LEVEL SECURITY;

-- Faculty can manage their own content
CREATE POLICY "Faculty can manage their own chapter content"
ON public.chapter_content
FOR ALL
USING (auth.uid() = user_id);

-- Students can view chapter content
CREATE POLICY "Students can view chapter content"
ON public.chapter_content
FOR SELECT
USING (true);

-- Create research_insights table for research experts
CREATE TABLE public.research_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    concept_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL DEFAULT 'arrays-stacks-queues',
    title TEXT NOT NULL,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('code_snippet', 'case_study', 'research_note', 'real_world_application')),
    content TEXT NOT NULL,
    code_language TEXT,
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for research_insights
ALTER TABLE public.research_insights ENABLE ROW LEVEL SECURITY;

-- Research experts can manage their own insights
CREATE POLICY "Research experts can manage their own insights"
ON public.research_insights
FOR ALL
USING (auth.uid() = user_id);

-- Everyone can view approved insights
CREATE POLICY "Everyone can view approved insights"
ON public.research_insights
FOR SELECT
USING (is_approved = true);

-- Add triggers for updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chapter_content_updated_at
BEFORE UPDATE ON public.chapter_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_research_insights_updated_at
BEFORE UPDATE ON public.research_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();