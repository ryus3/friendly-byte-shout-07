-- إضافة عمود telegram_code لجدول profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_code TEXT;

COMMENT ON COLUMN public.profiles.telegram_code IS 'رمز التليغرام للموظف للربط مع البوت الذكي (مثال: RYU559)';

-- إنشاء index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_code 
ON public.profiles(telegram_code) 
WHERE telegram_code IS NOT NULL;