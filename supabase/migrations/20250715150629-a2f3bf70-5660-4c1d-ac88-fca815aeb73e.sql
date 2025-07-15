-- إزالة RLS policies القديمة للإشعارات
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

-- إنشاء RLS policies جديدة محسنة للإشعارات
CREATE POLICY "Users can view notifications" ON public.notifications
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR 
            user_id IS NULL
        )
    );

CREATE POLICY "Users can update notifications" ON public.notifications
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR 
            user_id IS NULL
        )
    );

CREATE POLICY "Users can delete notifications" ON public.notifications
    FOR DELETE USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR 
            user_id IS NULL
        )
    );

CREATE POLICY "Authenticated users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);