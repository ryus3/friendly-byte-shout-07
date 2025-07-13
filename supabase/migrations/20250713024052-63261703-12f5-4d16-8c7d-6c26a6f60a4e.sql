-- إضافة العمود المفقود للحذف التلقائي في جدول الإشعارات
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS auto_delete boolean DEFAULT false;

-- إضافة العمود المفقود للآولوية في جدول الإشعارات  
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';