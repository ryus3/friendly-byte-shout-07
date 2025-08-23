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
  Search,
  Copy,
  Download,
  Eye,
  Package
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
    setSyncInterval,
    fastSyncPendingOrders,
    syncAndApplyOrders,
    comprehensiveOrderCorrection,
    syncOrderByTracking,
    lastSyncAt,
    isSyncing,
    getOrderStatuses
  } = useAlWaseet();
  
  const { toast } = useToast();
  const [isManualSyncing, setIsManualSyncing] = React.useState(false);
  const [singleOrderTracking, setSingleOrderTracking] = React.useState('');
  const [isLoadingStatuses, setIsLoadingStatuses] = React.useState(false);
  const [statusesData, setStatusesData] = React.useState([]);
  const [showStatusesTable, setShowStatusesTable] = React.useState(false);

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

  const handleFetchStatuses = async () => {
    if (isLoadingStatuses) return;
    
    setIsLoadingStatuses(true);
    try {
      const result = await getOrderStatuses();
      if (result.success && result.data) {
        setStatusesData(result.data);
        setShowStatusesTable(true);
        toast({
          title: "تم جلب حالات الوسيط بنجاح",
          description: `تم جلب ${result.data.length} حالة من الوسيط`,
        });
      } else {
        toast({
          title: "خطأ في جلب الحالات",
          description: result.message || "حدث خطأ أثناء جلب حالات الوسيط",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('خطأ في جلب حالات الوسيط:', error);
      toast({
        title: "خطأ في جلب الحالات",
        description: "حدث خطأ أثناء جلب حالات الوسيط",
        variant: "destructive"
      });
    } finally {
      setIsLoadingStatuses(false);
    }
  };

  const handleCopyStatuses = () => {
    const jsonData = JSON.stringify(statusesData, null, 2);
    navigator.clipboard.writeText(jsonData).then(() => {
      toast({
        title: "تم نسخ البيانات",
        description: "تم نسخ جميع حالات الوسيط بتنسيق JSON",
      });
    }).catch(() => {
      toast({
        title: "خطأ في النسخ",
        description: "حدث خطأ أثناء نسخ البيانات",
        variant: "destructive"
      });
    });
  };

  const handleExportCSV = () => {
    const headers = ['state_id', 'status'];
    const csvContent = [
      headers.join(','),
      ...statusesData.map(status => [
        status.id || status.state_id || '',
        `"${(status.status || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `alwaseet_statuses_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "تم تصدير البيانات",
      description: "تم تحميل ملف CSV بحالات الوسيط",
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

          {/* فحص حالات الوسيط */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Search className="w-4 h-4" />
                فحص حالات الوسيط
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">عرض جميع حالات الوسيط</Label>
                  <p className="text-xs text-muted-foreground">
                    جلب وعرض جميع الحالات المتاحة من API الوسيط مع state_id
                  </p>
                </div>
                <Button
                  onClick={handleFetchStatuses}
                  disabled={isLoadingStatuses}
                  variant="outline"
                  size="sm"
                >
                  {isLoadingStatuses && <RefreshCw className="w-4 h-4 ml-1 animate-spin" />}
                  <Eye className="w-4 h-4 ml-1" />
                  عرض الحالات
                </Button>
              </div>

              {/* جدول الحالات */}
              {showStatusesTable && statusesData.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">الحالات المتاحة ({statusesData.length})</span>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCopyStatuses}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="w-4 h-4 ml-1" />
                        نسخ JSON
                      </Button>
                      <Button
                        onClick={handleExportCSV}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="w-4 h-4 ml-1" />
                        تصدير CSV
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-right p-2 border-b">state_id</th>
                          <th className="text-right p-2 border-b">الحالة</th>
                          <th className="text-center p-2 border-b">تحرير المخزون</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statusesData.map((status, index) => {
                          const stateId = status.id || status.state_id;
                          const isStockReleasing = stateId === 17 || stateId === '17';
                          return (
                            <tr 
                              key={index} 
                              className={`border-b hover:bg-muted/50 ${
                                isStockReleasing ? 'bg-green-50 border-green-200' : ''
                              }`}
                            >
                              <td className="p-2 font-mono text-center">
                                <Badge variant={isStockReleasing ? "success" : "secondary"}>
                                  {stateId}
                                </Badge>
                              </td>
                              <td className="p-2">{status.status || 'غير محدد'}</td>
                              <td className="p-2 text-center">
                                {isStockReleasing ? (
                                  <Badge variant="success" className="text-xs">
                                    <Package className="w-3 h-3 ml-1" />
                                    نعم
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    لا
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-xs text-muted-foreground bg-green-50 border border-green-200 p-3 rounded">
                    <Package className="w-4 h-4 inline ml-1 text-green-600" />
                    قاعدة تحرير المخزون: فقط الحالة state_id: 17 ("تم الارجاع الى التاجر") تحرر المخزون المحجوز من الطلبات
                  </div>
                </div>
              )}
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