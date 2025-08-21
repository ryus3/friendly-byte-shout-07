-- Add missing customer_phone2 column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_phone2 TEXT;