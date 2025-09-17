// مكون طلب الإذن للإشعارات
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, CheckCircle } from 'lucide-react';
import { notificationService } from '@/utils/NotificationService';

const NotificationPermissionRequest = () => {
  const [permission, setPermission] = useState('default');
  const [showRequest, setShowRequest] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // فحص حالة الإذن الحالية
    if ('Notification' in window) {
      setPermission(Notification.permission);
      
      // إظهار طلب الإذن إذا لم يتم منحه أو رفضه
      if (Notification.permission === 'default') {
        setShowRequest(true);
      }
    }
  }, []);

  const requestPermission = async () => {
    setIsRequesting(true);
    
    try {
      const granted = await notificationService.requestPermission();
      
      if (granted) {
        setPermission('granted');
        setShowRequest(false);
        
        // إرسال إشعار تجريبي للتأكيد
        setTimeout(() => {
          notificationService.notify(
            'تم تفعيل الإشعارات',
            'ستتلقى إشعارات فورية للطلبات الجديدة',
            'success'
          );
        }, 1000);
      } else {
        setPermission('denied');
        setShowRequest(false);
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const dismissRequest = () => {
    setShowRequest(false);
  };

  if (!showRequest || permission !== 'default') {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          تفعيل الإشعارات الفورية
        </CardTitle>
        <CardDescription>
          احصل على إشعارات فورية للطلبات الجديدة حتى عندما يكون الموقع مغلق
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-3">
          <Button 
            onClick={requestPermission}
            disabled={isRequesting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isRequesting ? (
              'جاري التفعيل...'
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                تفعيل الإشعارات
              </>
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={dismissRequest}
            className="text-gray-600 hover:text-gray-800"
          >
            <BellOff className="w-4 h-4 mr-2" />
            ليس الآن
          </Button>
        </div>
        
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          <p>💡 الإشعارات الفورية تساعدك على:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>استلام تنبيهات فورية للطلبات الذكية الجديدة</li>
            <li>متابعة تحديثات الطلبات في الوقت الفعلي</li>
            <li>عدم تفويت أي طلب مهم</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationPermissionRequest;