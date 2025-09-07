-- إصلاح مشكلة RLS المعطلة
ALTER TABLE public.background_sync_logs ENABLE ROW LEVEL SECURITY;