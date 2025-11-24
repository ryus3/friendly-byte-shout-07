-- Migration: Fix WhatsApp links in profiles - convert local phone format to international and api.whatsapp.com to wa.me

-- Fix social_media.whatsapp links
UPDATE profiles
SET social_media = jsonb_set(
  COALESCE(social_media, '{}'::jsonb),
  '{whatsapp}',
  to_jsonb(
    CASE
      -- Convert api.whatsapp.com/send?phone=07... to wa.me/9647...
      WHEN social_media->>'whatsapp' LIKE '%api.whatsapp.com/send%phone=07%' THEN
        'https://wa.me/964' || substring(social_media->>'whatsapp' from 'phone=07(\d{9})')
      
      -- Convert api.whatsapp.com/send?phone=7... to wa.me/9647...
      WHEN social_media->>'whatsapp' LIKE '%api.whatsapp.com/send%phone=7%' AND social_media->>'whatsapp' NOT LIKE '%phone=964%' THEN
        'https://wa.me/964' || substring(social_media->>'whatsapp' from 'phone=7(\d{9})')
      
      -- Convert wa.me/07... to wa.me/9647...
      WHEN social_media->>'whatsapp' LIKE '%wa.me/07%' THEN
        replace(social_media->>'whatsapp', 'wa.me/07', 'wa.me/9647')
      
      -- Convert wa.me/7... (but not 964) to wa.me/9647...
      WHEN social_media->>'whatsapp' LIKE '%wa.me/7%' AND social_media->>'whatsapp' NOT LIKE '%wa.me/964%' THEN
        replace(social_media->>'whatsapp', 'wa.me/7', 'wa.me/9647')
      
      ELSE social_media->>'whatsapp'
    END
  )
)
WHERE social_media->>'whatsapp' IS NOT NULL
  AND (
    social_media->>'whatsapp' LIKE '%api.whatsapp.com%'
    OR social_media->>'whatsapp' LIKE '%wa.me/07%'
    OR (social_media->>'whatsapp' LIKE '%wa.me/7%' AND social_media->>'whatsapp' NOT LIKE '%wa.me/964%')
  );

-- Fix business_links WhatsApp URLs
UPDATE profiles
SET business_links = (
  SELECT jsonb_agg(
    CASE
      WHEN link->>'type' = 'whatsapp' OR link->>'url' LIKE '%whatsapp%' OR link->>'url' LIKE '%wa.me%' THEN
        jsonb_set(
          link,
          '{url}',
          to_jsonb(
            CASE
              -- Convert api.whatsapp.com/send?phone=07... to wa.me/9647...
              WHEN link->>'url' LIKE '%api.whatsapp.com/send%phone=07%' THEN
                'https://wa.me/964' || substring(link->>'url' from 'phone=07(\d{9})')
              
              -- Convert api.whatsapp.com/send?phone=7... to wa.me/9647...
              WHEN link->>'url' LIKE '%api.whatsapp.com/send%phone=7%' AND link->>'url' NOT LIKE '%phone=964%' THEN
                'https://wa.me/964' || substring(link->>'url' from 'phone=7(\d{9})')
              
              -- Convert wa.me/07... to wa.me/9647...
              WHEN link->>'url' LIKE '%wa.me/07%' THEN
                replace(link->>'url', 'wa.me/07', 'wa.me/9647')
              
              -- Convert wa.me/7... (but not 964) to wa.me/9647...
              WHEN link->>'url' LIKE '%wa.me/7%' AND link->>'url' NOT LIKE '%wa.me/964%' THEN
                replace(link->>'url', 'wa.me/7', 'wa.me/9647')
              
              ELSE link->>'url'
            END
          )
        )
      ELSE link
    END
  )
  FROM jsonb_array_elements(business_links) AS link
)
WHERE business_links IS NOT NULL
  AND business_links != '[]'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(business_links) AS link
    WHERE (
      link->>'type' = 'whatsapp'
      OR link->>'url' LIKE '%whatsapp%'
      OR link->>'url' LIKE '%wa.me%'
    )
    AND (
      link->>'url' LIKE '%api.whatsapp.com%'
      OR link->>'url' LIKE '%wa.me/07%'
      OR (link->>'url' LIKE '%wa.me/7%' AND link->>'url' NOT LIKE '%wa.me/964%')
    )
  );