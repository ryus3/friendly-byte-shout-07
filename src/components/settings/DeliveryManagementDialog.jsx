import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  Truck, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Bell,
  BellOff,
  RefreshCcw,
  List,
  ArrowRight
} from 'lucide-react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useToast } from '@/hooks/use-toast';
import { getOrderStatuses } from '@/lib/alwaseet-api';

const DeliveryManagementDialog = ({ open, onOpenChange }) => {
  const { 
    isLoggedIn, 
    activePartner, 
    token,
    autoSyncEnabled,
    setAutoSyncEnabled,
    syncInterval,
    setSyncInterval,
    fastSyncPendingOrders,
    syncAndApplyOrders,
    comprehensiveOrderCorrection,
    syncOrderByTracking,
    lastSyncAt,
    isSyncing
  } = useAlWaseet();
  
  const { toast } = useToast();
  const [isManualSyncing, setIsManualSyncing] = React.useState(false);
  const [singleOrderTracking, setSingleOrderTracking] = React.useState('');
  const [showStatusList, setShowStatusList] = React.useState(false);
  const [statusList, setStatusList] = React.useState([]);
  const [loadingStatuses, setLoadingStatuses] = React.useState(false);

  const handleManualSync = async (type = 'fast') => {
    if (isManualSyncing || isSyncing) return;
    
    setIsManualSyncing(true);
    try {
      let result;
      if (type === 'fast') {
        result = await fastSyncPendingOrders(true);
        toast({
          title: "مزامنة سريعة مكتملة",
          description: `تم تحديث ${result.updated} طلب من أصل ${result.checked}`,
        });
      } else if (type === 'full') {
        result = await syncAndApplyOrders();
        toast({
          title: "مزامنة شاملة مكتملة",
          description: "تم مزامنة جميع الطلبات بنجاح",
        });
      } else if (type === 'correction') {
        result = await comprehensiveOrderCorrection();
        toast({
          title: "تصحيح شامل مكتمل",
          description: "تم تصحيح وربط الطلبات بنجاح",
        });
      }
    } catch (error) {
      console.error('خطأ في المزامنة اليدوية:', error);
      toast({
        title: "خطأ في المزامنة",
        description: "حدث خطأ أثناء المزامنة، يرجى المحاولة مرة أخرى",
        variant: "destructive"
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleAutoSyncToggle = (enabled) => {
    setAutoSyncEnabled(enabled);
    toast({
      title: enabled ? "تم تفعيل المزامنة التلقائية" : "تم إيقاف المزامنة التلقائية",
      description: enabled 
        ? `ستتم مزامنة الطلبات تلقائياً كل ${getSyncIntervalText()}` 
        : "ستحتاج لتشغيل المزامنة يدوياً",
    });
  };

  const getSyncIntervalText = () => {
    const minutes = syncInterval / 60000;
    if (minutes < 60) return `${minutes} دقيقة`;
    const hours = minutes / 60;
    return `${hours} ساعة`;
  };

  const handleSyncIntervalChange = (newInterval) => {
    setSyncInterval(newInterval);
    toast({
      title: "تم تحديث فترة المزامنة",
      description: `سيتم المزامنة كل ${getSyncIntervalText()}`,
    });
  };

  const handleSingleOrderSync = async () => {
    if (!singleOrderTracking.trim() || isManualSyncing || isSyncing) return;
    
    setIsManualSyncing(true);
    try {
      const result = await syncOrderByTracking(singleOrderTracking.trim());
      if (result && result.success) {
        toast({
          title: "تم تحديث الطلب بنجاح",
          description: `الطلب ${singleOrderTracking}: ${result.deliveryStatus || 'تم التحديث'}`,
          variant: "success"
        });
        setSingleOrderTracking('');
      } else {
        toast({
          title: "خطأ في تحديث الطلب",
          description: result?.error || "الطلب غير موجود أو حدث خطأ",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "خطأ في المزامنة",
        description: "حدث خطأ أثناء تحديث الطلب",
        variant: "destructive"
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleShowStatuses = async () => {
    if (!token) return;
    
    setLoadingStatuses(true);
    try {
      const statuses = await getOrderStatuses(token);
      setStatusList(statuses || []);
      setShowStatusList(true);
      toast({
        title: "تم جلب الحالات",
        description: `تم جلب ${statuses?.length || 0} حالة من الوسيط`,
      });
    } catch (error) {
      console.error('خطأ في جلب الحالات:', error);
      toast({
        title: "خطأ في جلب الحالات",
        description: "حدث خطأ أثناء جلب حالات الطلبات من الوسيط",
        variant: "destructive"
      });
    } finally {
      setLoadingStatuses(false);
    }
  };

  const getInternalMapping = (statusText) => {
    const statusLower = statusText?.toLowerCase() || '';
    
    // حالات الإرجاع للمخزن
    if (statusLower.includes('تم الارجاع') && statusLower.includes('التاجر')) {
      return { internal: 'returned_in_stock', label: 'راجع للمخزن', color: 'purple' };
    }
    // حالات الإرجاع العادية
    else if (statusLower.includes('مرجع') || (statusLower.includes('راجع') && !statusLower.includes('التاجر'))) {
      return { internal: 'returned', label: 'مُرجع', color: 'purple' };
    }
    // حالات التأجيل والغياب - في الطريق وليس قيد التجهيز
    else if (statusLower.includes('مؤجل') || statusLower.includes('تأجيل') || 
             statusLower.includes('لا يمكن الوصول') || statusLower.includes('عدم وجود')) {
      return { internal: 'delivery', label: 'قيد التوصيل', color: 'orange' };
    }
    // حالات التسليم
    else if (statusLower.includes('تسليم') || statusLower.includes('مسلم')) {
      return { internal: 'delivered', label: 'تم التسليم', color: 'green' };
    }
    // حالات الإلغاء
    else if (statusLower.includes('ملغي') || statusLower.includes('رفض')) {
      return { internal: 'cancelled', label: 'ملغي', color: 'red' };
    }
    // حالات الشحن
    else if (statusLower.includes('استلام') && statusLower.includes('مندوب')) {
      return { internal: 'shipped', label: 'تم الشحن', color: 'blue' };
    }
    // حالات قيد التوصيل
    else if (statusLower.includes('جاري') || statusLower.includes('في الطريق')) {
      return { internal: 'delivery', label: 'قيد التوصيل', color: 'orange' };
    }
    // حالة افتراضية
    else if (statusLower.includes('فعال')) {
      return { internal: 'pending', label: 'قيد التجهيز', color: 'yellow' };
    }
    
    return { internal: 'unknown', label: 'غير محدد', color: 'gray' };
  };

  if (activePartner === 'local' || !isLoggedIn) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              إدارة التوصيل
            </DialogTitle>
          </DialogHeader>
          
          <Card className="bg-muted">
            <CardContent className="p-6 text-center">
              <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                غير متصل بشركة توصيل خارجية
              </p>
              <Badge variant="secondary" className="mt-2">
                وضع محلي
              </Badge>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            إدارة التوصيل - الوسيط
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* حالة الاتصال */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600" />
                حالة الاتصال
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">شركة التوصيل</span>
                <Badge variant="default">الوسيط</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">حالة الاتصال</span>
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 ml-1" />
                  متصل
                </Badge>
              </div>
              {lastSyncAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">آخر مزامنة</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(lastSyncAt).toLocaleString('ar-EG')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* إعدادات المزامنة */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Settings className="w-4 h-4" />
                إعدادات المزامنة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">المزامنة التلقائية</Label>
                  <p className="text-xs text-muted-foreground">
                    تشغيل المزامنة التلقائية كل {getSyncIntervalText()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {autoSyncEnabled ? (
                    <RefreshCw className="w-4 h-4 text-green-600" />
                  ) : (
                    <RefreshCcw className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Switch
                    checked={autoSyncEnabled}
                    onCheckedChange={handleAutoSyncToggle}
                  />
                </div>
              </div>

              <Separator />

              {/* إعدادات فترة المزامنة */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">فترة المزامنة التلقائية</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 600000, label: '10 د' },
                    { value: 900000, label: '15 د' },
                    { value: 1800000, label: '30 د' },
                    { value: 2700000, label: '45 د' },
                    { value: 3600000, label: '1 س' },
                    { value: 7200000, label: '2 س' },
                    { value: 10800000, label: '3 س' },
                    { value: 0, label: 'يدوي' }
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant={syncInterval === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSyncIntervalChange(option.value)}
                      className="text-xs h-8"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
                <Bell className="w-4 h-4 inline ml-1" />
                ملاحظة: إيقاف المزامنة التلقائية يقلل من الإشعارات المتكررة ويحسن الأداء
              </div>
            </CardContent>
          </Card>

          {/* المزامنة اليدوية */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4" />
                المزامنة اليدوية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={() => handleManualSync('fast')}
                  disabled={isManualSyncing || isSyncing}
                  variant="outline"
                  className="justify-start"
                >
                  {(isManualSyncing || isSyncing) && <RefreshCw className="w-4 h-4 ml-2 animate-spin" />}
                  مزامنة سريعة
                  <span className="text-xs text-muted-foreground mr-auto">
                    (الطلبات المعلقة فقط)
                  </span>
                </Button>
                
                <Button
                  onClick={() => handleManualSync('full')}
                  disabled={isManualSyncing || isSyncing}
                  variant="outline"
                  className="justify-start"
                >
                  {(isManualSyncing || isSyncing) && <RefreshCw className="w-4 h-4 ml-2 animate-spin" />}
                  مزامنة شاملة
                  <span className="text-xs text-muted-foreground mr-auto">
                    (جميع الطلبات)
                  </span>
                </Button>
                
                <Button
                  onClick={() => handleManualSync('correction')}
                  disabled={isManualSyncing || isSyncing}
                  variant="outline"
                  className="justify-start"
                >
                  {(isManualSyncing || isSyncing) && <RefreshCw className="w-4 h-4 ml-2 animate-spin" />}
                  تصحيح وربط
                  <span className="text-xs text-muted-foreground mr-auto">
                     (ربط الطلبات الحالية)
                   </span>
                 </Button>
               </div>
               
               <Separator />
               
               {/* مزامنة طلب واحد */}
               <div className="space-y-2">
                 <Label className="text-sm font-medium">مزامنة طلب محدد</Label>
                 <div className="flex gap-2">
                   <Input
                     placeholder="رقم التتبع (مثال: 98716812)"
                     value={singleOrderTracking}
                     onChange={(e) => setSingleOrderTracking(e.target.value)}
                     className="flex-1"
                   />
                   <Button
                     onClick={handleSingleOrderSync}
                     disabled={!singleOrderTracking.trim() || isManualSyncing || isSyncing}
                     size="sm"
                   >
                     {(isManualSyncing || isSyncing) && <RefreshCw className="w-4 h-4 ml-1 animate-spin" />}
                     تحديث
                   </Button>
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* عرض حالات الوسيط */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <List className="w-4 h-4" />
                حالات الوسيط
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleShowStatuses}
                disabled={loadingStatuses || !token}
                variant="outline"
                className="w-full justify-start"
              >
                {loadingStatuses && <RefreshCw className="w-4 h-4 ml-2 animate-spin" />}
                <List className="w-4 h-4 ml-2" />
                عرض جميع حالات الوسيط
                <span className="text-xs text-muted-foreground mr-auto">
                  (State ID + النص العربي)
                </span>
              </Button>

              {showStatusList && (
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto border rounded p-3">
                  <div className="text-sm font-medium mb-2">
                    جميع الحالات المتاحة ({statusList.length})
                  </div>
                  {statusList.map((status, index) => {
                    const mapping = getInternalMapping(status.text);
                    const isReturnToStock = status.text?.includes('تم الارجاع') && status.text?.includes('التاجر');
                    
                    return (
                      <div 
                        key={status.id || index}
                        className={`flex items-center justify-between p-2 border rounded-lg ${
                          isReturnToStock ? 'bg-purple-50 border-purple-200' : 'hover:bg-muted/50'
                        } transition-colors`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            ID: {status.id}
                          </Badge>
                          <span className="font-medium text-sm">
                            {status.text}
                            {isReturnToStock && (
                              <Badge className="ml-2 bg-purple-100 text-purple-800 text-xs">
                                راجع للمخزن
                              </Badge>
                            )}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge 
                            className={`text-xs ${
                              mapping.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                              mapping.color === 'green' ? 'bg-green-100 text-green-800' :
                              mapping.color === 'red' ? 'bg-red-100 text-red-800' :
                              mapping.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                              mapping.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                              mapping.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {mapping.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* معلومات إضافية */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-900">
                    نصائح لتحسين الأداء
                  </p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• استخدم المزامنة السريعة للتحديثات العادية</li>
                    <li>• استخدم المزامنة الشاملة عند وجود مشاكل في البيانات</li>
                    <li>• استخدم التصحيح والربط عند إضافة طلبات جديدة خارجية</li>
                    <li>• إيقاف المزامنة التلقائية يقلل الإشعارات غير الضرورية</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryManagementDialog;