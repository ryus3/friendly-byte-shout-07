import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Truck,
  Package,
  MapPin
} from 'lucide-react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';

const DeliveryIntegrationStatus = () => {
  const { 
    isLoggedIn, 
    activePartner, 
    token, 
    waseetUser,
    loading,
    syncAndApplyOrders,
    fastSyncPendingOrders,
    getMerchantOrders
  } = useAlWaseet();
  
  const [syncStats, setSyncStats] = useState({
    totalOrders: 0,
    pendingSync: 0,
    lastSync: null,
    isOnline: false
  });
  const [syncing, setSyncing] = useState(false);

  // فحص حالة الاتصال مع شركة التوصيل
  const checkConnectionStatus = async () => {
    if (!isLoggedIn || !token) {
      setSyncStats(prev => ({ ...prev, isOnline: false }));
      return;
    }

    try {
      const result = await getMerchantOrders();
      if (result.success) {
        setSyncStats(prev => ({
          ...prev,
          isOnline: true,
          totalOrders: result.data?.length || 0,
          lastSync: new Date()
        }));
      } else {
        setSyncStats(prev => ({ ...prev, isOnline: false }));
      }
    } catch (error) {
      setSyncStats(prev => ({ ...prev, isOnline: false }));
    }
  };

  // مزامنة سريعة
  const handleFastSync = async () => {
    setSyncing(true);
    try {
      const result = await fastSyncPendingOrders();
      toast({
        title: 'مزامنة سريعة مكتملة',
        description: `تم فحص ${result.checked} طلب وتحديث ${result.updated} طلب`,
        variant: 'success'
      });
      await checkConnectionStatus();
    } catch (error) {
      toast({
        title: 'خطأ في المزامنة السريعة',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  // مزامنة شاملة
  const handleFullSync = async () => {
    setSyncing(true);
    try {
      await syncAndApplyOrders();
      await checkConnectionStatus();
    } catch (error) {
      toast({
        title: 'خطأ في المزامنة الشاملة',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && token) {
      checkConnectionStatus();
      // فحص دوري كل 30 ثانية
      const interval = setInterval(checkConnectionStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, token]);

  if (activePartner === 'local') {
    return (
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">وضع التوصيل المحلي</p>
              <p className="text-sm text-blue-600">لا تحتاج لمزامنة مع شركة خارجية</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isLoggedIn) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">غير متصل بشركة التوصيل</p>
              <p className="text-sm text-red-600">يجب تسجيل الدخول لشركة الوسيط أولاً</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            حالة ربط شركة التوصيل
          </div>
          <Badge variant={syncStats.isOnline ? "success" : "destructive"}>
            {syncStats.isOnline ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                متصل
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                غير متصل
              </>
            )}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* معلومات الحساب */}
        {waseetUser && (
          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="font-medium mb-2">معلومات الحساب</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">اسم التاجر:</span>
                <p className="font-medium">{waseetUser.name || 'غير محدد'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">رصيد الحساب:</span>
                <p className="font-medium">{waseetUser.balance || 0} د.ع</p>
              </div>
            </div>
          </div>
        )}

        {/* إحصائيات المزامنة */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <div className="text-2xl font-bold text-primary">{syncStats.totalOrders}</div>
            <div className="text-sm text-muted-foreground">إجمالي الطلبات</div>
          </div>
          <div className="text-center p-3 bg-green-100 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              <CheckCircle className="h-6 w-6 mx-auto" />
            </div>
            <div className="text-sm text-muted-foreground">
              {syncStats.lastSync ? 'آخر مزامنة' : 'لم تتم المزامنة'}
            </div>
          </div>
        </div>

        {/* أزرار المزامنة */}
        <div className="space-y-2">
          <Button 
            onClick={handleFastSync}
            disabled={syncing || loading || !syncStats.isOnline}
            className="w-full"
            variant="outline"
          >
            {syncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                جاري المزامنة السريعة...
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-2" />
                مزامنة سريعة (الطلبات المعلقة فقط)
              </>
            )}
          </Button>

          <Button 
            onClick={handleFullSync}
            disabled={syncing || loading || !syncStats.isOnline}
            className="w-full"
          >
            {syncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                جاري المزامنة الشاملة...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                مزامنة شاملة (جميع الطلبات)
              </>
            )}
          </Button>
        </div>

        {/* معلومات إضافية */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• المزامنة السريعة: تفحص الطلبات المعلقة فقط</p>
          <p>• المزامنة الشاملة: تفحص جميع الطلبات وتحدث الحالات</p>
          {syncStats.lastSync && (
            <p>• آخر مزامنة: {syncStats.lastSync.toLocaleTimeString('ar-EG')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DeliveryIntegrationStatus;