-- 1) إعادة تفعيل حسابات شركة التوصيل التي عُطّلت بالخطأ ولكن توكنها لا يزال صالحاً
UPDATE public.delivery_partner_tokens
SET is_active = true,
    auto_renew_enabled = true,
    updated_at = now()
WHERE partner_name IN ('alwaseet','modon')
  AND is_active = false
  AND token IS NOT NULL
  AND length(token) > 10
  AND expires_at IS NOT NULL
  AND expires_at > now();

-- 2) ضمان تفعيل التجديد التلقائي لكل الحسابات النشطة الحالية
UPDATE public.delivery_partner_tokens
SET auto_renew_enabled = true,
    updated_at = now()
WHERE partner_name IN ('alwaseet','modon')
  AND is_active = true
  AND auto_renew_enabled IS DISTINCT FROM true;