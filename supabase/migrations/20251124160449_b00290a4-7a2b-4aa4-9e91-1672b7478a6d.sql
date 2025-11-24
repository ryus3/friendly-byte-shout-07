-- Migration: تصحيح جميع روابط WhatsApp الخاطئة في قاعدة البيانات
-- تحويل جميع روابط api.whatsapp.com إلى wa.me مع رسالة افتراضية

-- تحديث روابط WhatsApp في social_media
UPDATE profiles
SET social_media = jsonb_set(
  social_media,
  '{whatsapp}',
  to_jsonb(
    CASE 
      WHEN social_media->>'whatsapp' LIKE '%api.whatsapp.com/send%' THEN
        'https://wa.me/' || 
        substring(social_media->>'whatsapp' from 'phone=(\d+)') ||
        '?text=' || encode(convert_to('مرحباً، أريد الاستفسار عن طلبي', 'UTF8'), 'escape')
      WHEN social_media->>'whatsapp' LIKE '%wa.me%' AND social_media->>'whatsapp' NOT LIKE '%text=%' THEN
        social_media->>'whatsapp' || '?text=' || encode(convert_to('مرحباً، أريد الاستفسار', 'UTF8'), 'escape')
      ELSE
        social_media->>'whatsapp'
    END
  )
)
WHERE social_media IS NOT NULL 
  AND social_media->>'whatsapp' IS NOT NULL
  AND (
    social_media->>'whatsapp' LIKE '%api.whatsapp.com%'
    OR (social_media->>'whatsapp' LIKE '%wa.me%' AND social_media->>'whatsapp' NOT LIKE '%text=%')
  );

-- تحديث روابط WhatsApp في business_links
UPDATE profiles
SET business_links = (
  SELECT jsonb_agg(
    CASE 
      WHEN link->>'type' = 'whatsapp' AND link->>'url' LIKE '%api.whatsapp.com/send%' THEN
        jsonb_set(
          link,
          '{url}',
          to_jsonb(
            'https://wa.me/' || 
            substring(link->>'url' from 'phone=(\d+)') ||
            '?text=' || encode(convert_to('مرحباً، أريد الاستفسار عن طلبي', 'UTF8'), 'escape')
          )
        )
      WHEN link->>'type' = 'whatsapp' AND link->>'url' LIKE '%wa.me%' AND link->>'url' NOT LIKE '%text=%' THEN
        jsonb_set(
          link,
          '{url}',
          to_jsonb(
            link->>'url' || '?text=' || encode(convert_to('مرحباً، أريد الاستفسار', 'UTF8'), 'escape')
          )
        )
      ELSE
        link
    END
  )
  FROM jsonb_array_elements(business_links) AS link
)
WHERE business_links IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(business_links) AS link
    WHERE link->>'type' = 'whatsapp'
      AND (
        link->>'url' LIKE '%api.whatsapp.com%'
        OR (link->>'url' LIKE '%wa.me%' AND link->>'url' NOT LIKE '%text=%')
      )
  );