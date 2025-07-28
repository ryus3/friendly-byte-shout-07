import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar, User, DollarSign, FileCheck, Eye, Receipt } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import SettlementInvoiceDialog from '@/components/profits/SettlementInvoiceDialog';

const PendingSettlementRequestsDialog = ({ 
  open, 
  onClose, 
  onSettlementSelect 
}) => {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSettlementRequests();
    }
  }, [open]);

  const fetchSettlementRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('type', 'profit_settlement_request')
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSettlements(data || []);
    } catch (error) {
      console.error('خطأ في جلب طلبات التحاسب:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب طلبات التحاسب",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewSettlement = async (settlement) => {
    try {
      // وضع علامة قراءة على الإشعار
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', settlement.id);

      // إغلاق النافذة والانتقال لصفحة متابعة الموظفين
      onClose();
      if (onSettlementSelect) {
        onSettlementSelect(settlement);
      }
    } catch (error) {
      console.error('خطأ في معالجة طلب التحاسب:', error);
    }
  };

  const getSettlementStatusColor = (settlement) => {
    const data = settlement.data || {};
    if (data.settlement_completed) return 'bg-green-500';
    return 'bg-amber-500';
  };

  const getSettlementStatusText = (settlement) => {
    const data = settlement.data || {};
    if (data.settlement_completed) return 'تم التحاسب';
    return 'معلق';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex-shrink-0 p-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <FileCheck className="h-5 w-5" />
              </div>
              طلبات المحاسبة المعلقة
            </DialogTitle>
            <div className="text-sm opacity-90 mt-1">
              إدارة طلبات التحاسب من الموظفين
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 p-4">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">جاري تحميل طلبات التحاسب...</p>
                </div>
              ) : settlements.length === 0 ? (
                <div className="text-center py-12">
                  <FileCheck className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد طلبات تحاسب معلقة</h3>
                  <p className="text-muted-foreground">جميع طلبات التحاسب تم معالجتها</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {settlements.map((settlement) => {
                    const data = settlement.data || {};
                    const isCompleted = data.settlement_completed;
                    
                    return (
                      <Card 
                        key={settlement.id} 
                        className={`cursor-pointer transition-all hover:shadow-lg border-l-4 ${
                          isCompleted ? 'border-l-green-500 bg-green-50/50' : 'border-l-amber-500 bg-amber-50/50'
                        }`}
                        onClick={() => handleViewSettlement(settlement)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              {/* معلومات الطلب */}
                              <div className="flex items-center gap-3">
                                <Badge 
                                  className={`${getSettlementStatusColor(settlement)} text-white`}
                                >
                                  {getSettlementStatusText(settlement)}
                                </Badge>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="w-4 h-4" />
                                  {format(parseISO(settlement.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                                </div>
                              </div>

                              {/* تفاصيل الموظف */}
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <User className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <h4 className="font-semibold">{data.employee_name || 'موظف'}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    طلب تحاسب على {data.orders_count || 0} طلب
                                  </p>
                                </div>
                              </div>

                              {/* الملخص المالي */}
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-green-600" />
                                    <span className="text-sm font-medium">المبلغ المطلوب:</span>
                                  </div>
                                  <span className="text-lg font-bold text-green-600">
                                    {(data.total_profit || 0).toLocaleString()} د.ع
                                  </span>
                                </div>
                              </div>

                              {/* الرسالة */}
                              <div className="bg-muted/30 rounded-lg p-3">
                                <p className="text-sm">{settlement.message}</p>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewSettlement(settlement);
                                }}
                              >
                                <Eye className="w-4 h-4 ml-1" />
                                عرض
                              </Button>
                              
                              {isCompleted && data.invoice_available && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSettlement(settlement);
                                    setShowInvoice(true);
                                  }}
                                >
                                  <Receipt className="w-4 h-4 ml-1" />
                                  الفاتورة
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex-shrink-0 p-4 border-t bg-background/50">
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={onClose}>
                إغلاق
              </Button>
              <div className="text-sm text-muted-foreground">
                {settlements.length} طلب تحاسب معلق
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* نافذة الفاتورة */}
      {showInvoice && selectedSettlement && (
        <SettlementInvoiceDialog
          open={showInvoice}
          onClose={() => setShowInvoice(false)}
          employee={{
            full_name: selectedSettlement.data?.employee_name,
            user_id: selectedSettlement.data?.employee_id
          }}
          orders={[]} // سيتم تحميلها لاحقاً
          totalProfit={selectedSettlement.data?.total_profit || 0}
          settlementDate={parseISO(selectedSettlement.created_at)}
        />
      )}
    </>
  );
};

export default PendingSettlementRequestsDialog;