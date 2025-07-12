-- إضافة عمود type إلى جدول categories
ALTER TABLE public.categories 
ADD COLUMN type TEXT DEFAULT 'main';