import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trash2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAiOrdersCleanup } from '@/hooks/useAiOrdersCleanup';
import { useToast } from '@/hooks/use-toast';

const AiOrdersCleanupManager = () => {
  const [cleanupProgress, setCleanupProgress] = useState({ current: 0, total: 0, message: '' });
  const [orphanedOrders, setOrphanedOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { 
    cleanupOrphanedAiOrders, 
    checkOrphanedAiOrders,
    deleteAiOrderSafely 
  } = useAiOrdersCleanup();
  const { toast } = useToast();

  // التحقق من الطلبات المتبقية عند تحميل المكون
  useEffect(() => {
    checkOrphanedOrders();
  }, []);

  const checkOrphanedOrders = async () => {
    setIsLoading(true);
    try {
      const result = await checkOrphanedAiOrders();
      if (result.success) {
        setOrphanedOrders(result.orders || []);
      }
    } catch (error) {
      console.error('خطأ في فحص الطلبات المتبقية:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanupAll = async () => {
    if (orphanedOrders.length === 0) {
      toast({
        title: "لا توجد طلبات للحذف",
        description: "جميع الطلبات الذكية تم معالجتها أو حذفها",
        variant: "default",
      });
      return;
    }

    setCleanupProgress({ 
      current: 0, 
      total: orphanedOrders.length, 
      message: 'بدء حذف الطلبات الذكية المتبقية...' 
    });

    try {
      let deletedCount = 0;
      
      for (let i = 0; i < orphanedOrders.length; i++) {
        const order = orphanedOrders[i];
        setCleanupProgress({ 
          current: i + 1, 
          total: orphanedOrders.length, 
          message: `حذف الطلب ${order.customer_name || 'غير محدد'}...` 
        });

        const result = await deleteAiOrderSafely(order.id);
        if (result.success) {
          deletedCount++;
        }
      }

      setCleanupProgress({ 
        current: orphanedOrders.length, 
        total: orphanedOrders.length, 
        message: `تم حذف ${deletedCount} طلب بنجاح` 
      });

      // تحديث قائمة الطلبات المتبقية
      await checkOrphanedOrders();
      
      toast({
        title: "تم التنظيف بنجاح",
        description: `تم حذف ${deletedCount} طلب ذكي متبقي`,
        variant: "default",
      });

      // إخفاء شريط التقدم بعد ثانيتين
      setTimeout(() => {
        setCleanupProgress({ current: 0, total: 0, message: '' });
      }, 2000);

    } catch (error) {
      console.error('خطأ في تنظيف الطلبات:', error);
      setCleanupProgress({ current: 0, total: 0, message: '' });
      toast({
        title: "خطأ في التنظيف",
        description: "حدث خطأ أثناء حذف الطلبات الذكية",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          تنظيف الطلبات الذكية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* معلومات الطلبات المتبقية */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">طلبات متبقية:</span>
            <Badge variant={orphanedOrders.length > 0 ? "destructive" : "default"}>
              {orphanedOrders.length}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">الحالة:</span>
            <Badge variant={orphanedOrders.length === 0 ? "default" : "secondary"}>
              {orphanedOrders.length === 0 ? "نظيف" : "يحتاج تنظيف"}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">آخر فحص:</span>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleTimeString('ar-IQ')}
            </span>
          </div>
        </div>

        {/* عرض الطلبات المتبقية */}
        {orphanedOrders.length > 0 && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              الطلبات الذكية المتبقية ({orphanedOrders.length}):
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {orphanedOrders.slice(0, 10).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-2 bg-background rounded border text-xs">
                  <div className="flex-1 truncate">
                    <span className="font-medium">{order.customer_name || 'غير محدد'}</span>
                    <span className="text-muted-foreground ml-2">
                      ({order.source || 'telegram'})
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('ar-IQ')}
                  </span>
                </div>
              ))}
              {orphanedOrders.length > 10 && (
                <div className="text-muted-foreground p-2 text-center">
                  و {orphanedOrders.length - 10} طلب آخر...
                </div>
              )}
            </div>
          </div>
        )}

        {/* رسالة النظافة */}
        {orphanedOrders.length === 0 && !isLoading && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">جميع الطلبات الذكية نظيفة</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              لا توجد طلبات ذكية متبقية تحتاج للحذف. النظام نظيف وجاهز للعمل.
            </p>
          </div>
        )}

        {/* أزرار التحكم مع شريط التقدم */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={checkOrphanedOrders}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  جاري الفحص...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  فحص الطلبات المتبقية
                </>
              )}
            </Button>

            <Button 
              onClick={handleCleanupAll}
              disabled={isLoading || orphanedOrders.length === 0 || cleanupProgress.total > 0}
              variant="destructive"
              className="flex-1"
            >
              {cleanupProgress.total > 0 ? (
                <>
                  <Trash2 className="h-4 w-4 animate-pulse mr-2" />
                  جاري الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  حذف جميع الطلبات المتبقية
                </>
              )}
            </Button>
          </div>

          {/* شريط التقدم */}
          {cleanupProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{cleanupProgress.message}</span>
                <span>{Math.round((cleanupProgress.current / cleanupProgress.total) * 100)}%</span>
              </div>
              <Progress 
                value={(cleanupProgress.current / cleanupProgress.total) * 100} 
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* معلومات إضافية */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• الطلبات الذكية المتبقية هي طلبات لم يتم ربطها بطلبات حقيقية</p>
          <p>• يُنصح بتنظيف هذه الطلبات دورياً لتوفير مساحة التخزين</p>
          <p>• التنظيف آمن ولا يؤثر على الطلبات الحقيقية المرتبطة</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AiOrdersCleanupManager;