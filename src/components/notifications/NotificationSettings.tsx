import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const NotificationSettings = () => {
  const { toast } = useToast();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestPermission = async () => {
    setLoading(true);
    try {
      if (!('Notification' in window)) {
        toast({
          title: 'غير مدعوم',
          description: 'المتصفح لا يدعم الإشعارات',
          variant: 'destructive',
        });
        return;
      }

      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Get FCM token (requires Firebase setup in app)
        // For now, we'll use a placeholder
        const token = `web_${Date.now()}_${Math.random()}`;
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('fcm_tokens').upsert({
          user_id: user.id,
          token,
          platform: 'web',
          is_active: true,
        });

        setPushEnabled(true);
        toast({
          title: '✅ تم التفعيل',
          description: 'سيتم إرسال الإشعارات إلى هذا الجهاز',
        });
      } else {
        toast({
          title: 'تم الرفض',
          description: 'لن تصلك إشعارات على هذا الجهاز',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تفعيل الإشعارات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const disableNotifications = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('fcm_tokens')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('platform', 'web');

      setPushEnabled(false);
      toast({
        title: 'تم التعطيل',
        description: 'لن تصلك إشعارات على هذا الجهاز',
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <Smartphone className="h-6 w-6 text-primary" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold mb-2">إشعارات الجوال</h3>
          <p className="text-sm text-muted-foreground mb-4">
            استلم إشعارات فورية على جهازك عند وصول طلبات جديدة
          </p>
          
          <div className="flex items-center gap-4">
            <Switch
              checked={pushEnabled}
              onCheckedChange={(checked) => {
                if (checked) requestPermission();
                else disableNotifications();
              }}
              disabled={loading}
            />
            
            <span className="text-sm">
              {pushEnabled ? (
                <span className="flex items-center gap-2 text-green-600">
                  <Bell className="h-4 w-4" />
                  مفعّل
                </span>
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <BellOff className="h-4 w-4" />
                  معطّل
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
