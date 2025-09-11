-- Add auto_approval_enabled column to profiles table for AI orders
ALTER TABLE public.profiles 
ADD COLUMN auto_approval_enabled boolean DEFAULT false;