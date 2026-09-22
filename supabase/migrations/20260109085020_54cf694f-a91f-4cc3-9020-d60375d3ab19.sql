-- Add unique constraint for user_id and chapter_id to support upsert
ALTER TABLE public.chapter_content 
ADD CONSTRAINT chapter_content_user_chapter_unique UNIQUE (user_id, chapter_id);