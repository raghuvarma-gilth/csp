-- Create storage bucket for PDF uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('learning-materials', 'learning-materials', true, 10485760, ARRAY['application/pdf']);

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload learning materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'learning-materials');

-- Create policy for anyone to view learning materials
CREATE POLICY "Anyone can view learning materials"
ON storage.objects
FOR SELECT
USING (bucket_id = 'learning-materials');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own learning materials"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'learning-materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own uploads
CREATE POLICY "Users can update their own learning materials"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'learning-materials' AND auth.uid()::text = (storage.foldername(name))[1]);