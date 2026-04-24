import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell, CheckCircle2, XCircle, Smartphone } from 'lucide-react';
import devLog from '@/lib/devLogger';

// Dynamic import for Capacitor
let PushNotifications = null;
try {
  const capacitorModule = await import('@capacitor/push-notifications');
  PushNotifications = capacitorModule.PushNotifications;
} catch (e) {
  devLog.log('📱 Capacitor not available - running in web mode');
}

const PushNotificationControl = () => {
  const { toast } = useToast();
  const [fcmToken, setFcmToken] = useState(null);
  const [isRegistering, setIsRegistering] = useState(true);
  const [preferences, setPreferences] = useState({
    ai_orders: true,
    regular_orders: false,
    delivery_updates: true,
    new_registrations: true
  });

  useEffect(() => {
    registerNotifications();
  }, []);

  const registerNotifications = async () => {
    try {
      setIsRegistering(true);

      // Check if Capacitor is available
      if (!PushNotifications) {
        devLog.log('📱 Running in web mode - Capacitor Push Notifications not available');
        setIsRegistering(false);
        toast({
          title: "📱 وضع الويب",
          description: "الإشعارات متاحة فقط على التطبيق الأصلي (Android/iOS)",
          variant: "default"
        });
        
        // Load preferences anyway
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (data) {
            setPreferences({
              ai_orders: data.ai_orders ?? true,
              regular_orders: data.regular_orders ?? false,
              delivery_updates: data.delivery_updates ?? true,
              new_registrations: data.new_registrations ?? true
            });
          }
        }
        return;
      }
      
      // طلب الإذن
      const result = await PushNotifications.requestPermissions();
      
      if (result.receive === 'granted') {
        await PushNotifications.register();
        
        // استلام Token
        PushNotifications.addListener('registration', async (token) => {
          devLog.log('✅ FCM Token registered:', token.value);
          
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error } = await supabase.from('fcm_tokens').upsert({
              user_id: user.id,
              token: token.value,
              platform: 'android',
              is_active: true
            });
            
            if (!error) {
              setFcmToken(token.value);
              toast({
                title: "✅ تم تفعيل الإشعارات",
                description: "سيصلك إشعار عند كل حدث جديد",
              });
            }
          }
          setIsRegistering(false);
        });

        // معالجة استلام الإشعارات
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          devLog.log('📨 Notification received:', notification);
        });

        // معالجة النقر على الإشعار
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          devLog.log('👆 Notification clicked:', notification);
          const data = notification.notification.data;
          if (data.route) {
            window.location.href = data.route;
          }
        });
      } else {
        setIsRegistering(false);
        toast({
          title: "⚠️ لم يتم منح الإذن",
          description: "يرجى السماح بالإشعارات من إعدادات التطبيق",
          variant: "destructive"
        });
      }

      // تحميل التفضيلات الحالية
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (data) {
          setPreferences({
            ai_orders: data.ai_orders ?? true,
            regular_orders: data.regular_orders ?? false,
            delivery_updates: data.delivery_updates ?? true,
            new_registrations: data.new_registrations ?? true
          });
        }
      }
    } catch (error) {
      console.error('❌ Error registering notifications:', error);
      setIsRegistering(false);
    }
  };

  const updatePreference = async (key, value) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updated = { ...preferences, [key]: value };
      setPreferences(updated);
      
      const { error } = await supabase.from('notification_preferences').upsert({
        user_id: user.id,
        ai_orders: updated.ai_orders,
        regular_orders: updated.regular_orders,
        delivery_updates: updated.delivery_updates,
        new_registrations: updated.new_registrations
      });

      if (!error) {
        toast({
          title: value ? "✅ تم التفعيل" : "❌ تم التعطيل",
          description: getPreferenceLabel(key),
        });
      }
    } catch (error) {
      console.error('Error updating preference:', error);
    }
  };

  const getPreferenceLabel = (key) => {
    const labels = {
      ai_orders: '🤖 طلبات تليجرام',
      regular_orders: '📦 الطلبات العادية',
      delivery_updates: '🚚 تحديثات التوصيل',
      new_registrations: '👥 الموظفين الجدد'
    };
    return labels[key];
  };

  const testNotification = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          title: '🎉 اختبار ناجح!',
          body: 'نظام الإشعارات يعمل بشكل مثالي ✨',
          data: { test: true, route: '/notifications' }
        }
      });

      if (!error) {
        toast({
          title: "📤 تم إرسال الاختبار",
          description: "يجب أن يصلك الإشعار خلال ثوانٍ",
        });
      } else {
        toast({
          title: "❌ فشل الإرسال",
          description: error.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: "❌ خطأ",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-6 h-6" />
            التحكم الكامل بالإشعارات
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* حالة التسجيل */}
          <div className={`p-4 rounded-lg ${fcmToken ? 'bg-green-50 dark:bg-green-950' : 'bg-yellow-50 dark:bg-yellow-950'}`}>
            <div className="flex items-center gap-2">
              {fcmToken ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-300">✅ الإشعارات مفعّلة</span>
                </>
              ) : isRegistering ? (
                <>
                  <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                  <span className="font-medium text-yellow-700 dark:text-yellow-300">⏳ جاري التسجيل...</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-700 dark:text-red-300">❌ غير مفعّل</span>
                </>
              )}
            </div>
            {fcmToken && (
              <p className="text-xs text-muted-foreground mt-2 font-mono break-all">
                Token: {fcmToken.substring(0, 30)}...
              </p>
            )}
          </div>

          {/* خيارات الإشعارات */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">اختر أنواع الإشعارات:</h3>
            
            <div className="space-y-4">
              {[
                { key: 'ai_orders', icon: '🤖', label: 'طلبات تليجرام (AI Orders)' },
                { key: 'regular_orders', icon: '📦', label: 'الطلبات العادية الجديدة' },
                { key: 'delivery_updates', icon: '🚚', label: 'تحديثات حالة التوصيل' },
                { key: 'new_registrations', icon: '👥', label: 'تسجيل موظفين جدد' }
              ].map(({ key, icon, label }) => (
                <div key={key} className="flex justify-between items-center p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <span className="font-medium">{label}</span>
                  </div>
                  <Switch 
                    checked={preferences[key]}
                    onCheckedChange={(value) => updatePreference(key, value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* زر الاختبار */}
          <Button 
            onClick={testNotification} 
            className="w-full"
            size="lg"
            disabled={!fcmToken}
          >
            <Bell className="w-5 h-5 mr-2" />
            اختبار إشعار فوري 🔔
          </Button>

          {!fcmToken && (
            <p className="text-sm text-muted-foreground text-center">
              يجب تفعيل الإشعارات أولاً لإرسال اختبار
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PushNotificationControl;
