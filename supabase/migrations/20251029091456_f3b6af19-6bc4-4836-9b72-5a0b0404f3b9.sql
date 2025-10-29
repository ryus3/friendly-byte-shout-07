-- Add secondary_phone column to ai_orders table
ALTER TABLE ai_orders 
ADD COLUMN IF NOT EXISTS secondary_phone text;