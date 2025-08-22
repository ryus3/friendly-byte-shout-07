import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  RefreshCcw
} from 'lucide-react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useToast } from '@/hooks/use-toast';

const DeliveryManagementDialog = ({ open, onOpenChange }) => {
  const { 
    isLoggedIn, 
    activePartner, 
    token,
    autoSyncEnabled,
    setAutoSyncEnabled,
    syncInterval,
    fastSyncPendingOrders,
    syncAndApplyOrders,
    comprehensiveOrderCorrection,
    lastSyncAt,
    isSyncing
  } = useAlWaseet();
  
  const { toast } = useToast();
  const [isManualSyncing, setIsManualSyncing] = React.useState(false);

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
        ? "ستتم مزامنة الطلبات تلقائياً كل 10 دقائق" 
        : "ستحتاج لتشغيل المزامنة يدوياً",
    });
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
                    تشغيل المزامنة التلقائية كل 10 دقائق
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