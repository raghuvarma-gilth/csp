-- Add UPDATE policy so users can change their role
CREATE POLICY "Users can update their own role"
ON public.user_roles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy so users can remove their role when switching
CREATE POLICY "Users can delete their own role"
ON public.user_roles
FOR DELETE
USING (auth.uid() = user_id);