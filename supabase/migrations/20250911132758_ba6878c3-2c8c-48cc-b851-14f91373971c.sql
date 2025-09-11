-- Add AI order preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS default_ai_order_destination text DEFAULT 'local',
ADD COLUMN IF NOT EXISTS auto_approve_ai_orders boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS selected_delivery_account text DEFAULT NULL;

-- Add delivery account tracking to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_account_used text DEFAULT NULL;