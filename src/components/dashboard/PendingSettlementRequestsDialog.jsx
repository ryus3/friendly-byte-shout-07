import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PackageCheck, DollarSign, Calendar, User, Users, Bell } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const PendingSettlementRequestsDialog = ({ 
  open, 
  onClose, 
  onNavigateToSettlement
}) => {
  const [settlementRequests, setSettlementRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // جلب طلبات التحاسب من الإشعارات
  const fetchSettlementRequests = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('type', 'profit_settlement_request')
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('خطأ في جلب طلبات التحاسب:', error);
        return;
      }

      setSettlementRequests(data || []);
    } catch (error) {
      console.error('خطأ في fetchSettlementRequests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSettlementRequests();
    }
  }, [open]);

  // معالج تحديد طلب التحاسب كمقروء والانتقال له
  const handleSelectRequest = async (request) => {
    try {
      // تحديد الإشعار كمقروء
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', request.id);

      // استخراج بيانات الطلب
      const employeeId = request.data?.employeeId || request.data?.employee_id;
      const orderIds = request.data?.orderIds || request.data?.order_ids || [];
      
      if (employeeId && orderIds.length > 0) {
        // إغلاق النافذة والانتقال لصفحة متابعة الموظفين مع تحديد الطلبات
        onClose();
        onNavigateToSettlement(employeeId, orderIds);
      } else {
        toast({
          title: "خطأ في البيانات",
          description: "لا يمكن العثور على بيانات الطلب",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('خطأ في معالجة طلب التحاسب:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء معالجة الطلب",
        variant: "destructive"
      });
    }
  };

  // تحديد جميع الطلبات كمقروءة
  const handleMarkAllAsRead = async () => {
    try {
      const requestIds = settlementRequests.map(r => r.id);
      
      if (requestIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', requestIds);

      if (error) {
        console.error('خطأ في تحديد الطلبات كمقروءة:', error);
        return;
      }

      toast({
        title: "تم التحديث",
        description: "تم تحديد جميع الطلبات كمقروءة"
      });

      setSettlementRequests([]);
    } catch (error) {
      console.error('خطأ في handleMarkAllAsRead:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 p-3 sm:p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            طلبات التحاسب الجديدة
          </DialogTitle>
          <div className="text-xs sm:text-sm text-muted-foreground mt-1">
            الطلبات الواردة من الموظفين للتحاسب على الأرباح
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 p-2 sm:p-4 gap-3">
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-shrink-0">
            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">طلبات جديدة</p>
                    <p className="text-sm sm:text-base font-semibold">{settlementRequests.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">إجمالي المبلغ</p>
                    <p className="text-sm sm:text-base font-semibold">
                      {settlementRequests.reduce((sum, req) => {
                        const amount = req.data?.amount || req.data?.total_profit || 0;
                        return sum + amount;
                      }, 0).toLocaleString()} د.ع
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">عدد الموظفين</p>
                    <p className="text-sm sm:text-base font-semibold">
                      {new Set(settlementRequests.map(req => req.data?.employeeId || req.data?.employee_id)).size}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* أزرار التحكم */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <Button 
              onClick={handleMarkAllAsRead}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto text-xs sm:text-sm"
              disabled={settlementRequests.length === 0}
            >
              تحديد الكل كمقروء
            </Button>
          </div>

          {/* قائمة الطلبات */}
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full w-full">
              <div className="space-y-2 pr-1">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-sm">جاري تحميل الطلبات...</p>
                  </div>
                ) : settlementRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <PackageCheck className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">لا توجد طلبات تحاسب جديدة</p>
                  </div>
                ) : (
                  settlementRequests.map((request) => {
                    const employeeName = request.data?.employeeName || request.data?.employee_name || 'غير معروف';
                    const amount = request.data?.amount || request.data?.total_profit || 0;
                    const orderIds = request.data?.orderIds || request.data?.order_ids || [];
                    const ordersCount = request.data?.orders_count || orderIds.length;

                    return (
                      <Card 
                        key={request.id} 
                        className="cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-primary/20"
                        onClick={() => handleSelectRequest(request)}
                      >
                        <CardContent className="p-3">
                          <div className="space-y-3">
                            {/* الصف الأول: معلومات الموظف والحالة */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="default" className="text-xs bg-blue-500">
                                طلب جديد
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {employeeName}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {ordersCount} طلب
                              </Badge>
                            </div>

                            {/* الصف الثاني: المبلغ والتاريخ */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm font-medium">{employeeName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-xs">
                                    {format(parseISO(request.created_at), 'dd MMM yyyy HH:mm', { locale: ar })}
                                  </span>
                                </div>
                              </div>

                              {/* المبلغ */}
                              <div className="space-y-2">
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                                  <div className="text-center">
                                    <p className="text-sm sm:text-base font-bold text-green-600">
                                      {amount.toLocaleString()} د.ع
                                    </p>
                                    <p className="text-xs text-muted-foreground">مبلغ التحاسب</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* الرسالة */}
                            <div className="border-t pt-2">
                              <p className="text-xs text-muted-foreground mb-1">الرسالة:</p>
                              <p className="text-sm bg-muted/30 rounded px-2 py-1">
                                {request.message}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* تذييل النافذة */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <Button variant="outline" onClick={onClose} size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
              إغلاق
            </Button>
            <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-right">
              {settlementRequests.length} طلب تحاسب جديد
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PendingSettlementRequestsDialog;