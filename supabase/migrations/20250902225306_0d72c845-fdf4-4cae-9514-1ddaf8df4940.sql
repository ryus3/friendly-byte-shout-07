-- Delete duplicate notifications for ORD000012 keeping only the most recent one
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY (data->>'order_number')
           ORDER BY created_at DESC
         ) as rn
  FROM notifications 
  WHERE data->>'order_number' = 'ORD000012'
  AND type = 'alwaseet_status_change'
)
DELETE FROM notifications 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);