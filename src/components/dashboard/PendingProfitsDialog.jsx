import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DollarSign, Eye, CheckCircle } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useProfits } from '@/contexts/ProfitsContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

const PendingProfitsDialog = ({ open, onClose, pendingProfits = [], orders = [] }) => {
  const [selectedProfits, setSelectedProfits] = useState([]);
  const { markInvoiceReceived } = useProfits();
  const { hasPermission } = useAuth();
  
  const canMarkReceived = hasPermission('manage_profit_settlement');

  const handleSelectProfit = (profitId) => {
    setSelectedProfits(prev => 
      prev.includes(profitId) 
        ? prev.filter(id => id !== profitId)
        : [...prev, profitId]
    );
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedProfits(pendingProfits.map(p => p.id));
    } else {
      setSelectedProfits([]);
    }
  };

  const handleMarkSelectedReceived = async () => {
    try {
      for (const profitId of selectedProfits) {
        const profit = pendingProfits.find(p => p.id === profitId);
        if (profit) {
          await markInvoiceReceived(profit.order_id);
        }
      }
      setSelectedProfits([]);
      toast({
        title: "تم الاستلام",
        description: `تم تسجيل استلام ${selectedProfits.length} ربح بنجاح`,
        variant: "success"
      });
      // إعادة تحميل البيانات لتحديث الأرقام
      if (onClose) onClose();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تسجيل الاستلام",
        variant: "destructive"
      });
    }
  };

  const getOrderDetails = (orderId) => {
    return orders.find(o => o.id === orderId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-yellow-500" />
            الأرباح المعلقة ({pendingProfits.length})
          </DialogTitle>
          <DialogDescription>
            عرض تفصيلي للأرباح المعلقة مع إمكانية تسجيل الاستلام
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {canMarkReceived && pendingProfits.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedProfits.length > 0 && selectedProfits.length === pendingProfits.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  تحديد الكل ({selectedProfits.length} محدد)
                </span>
              </div>
              {selectedProfits.length > 0 && (
                <Button 
                  size="sm" 
                  onClick={handleMarkSelectedReceived}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  تسجيل استلام المحدد
                </Button>
              )}
            </div>
          )}

          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {pendingProfits.length > 0 ? (
                pendingProfits.map(profit => {
                  const order = getOrderDetails(profit.order_id);
                  const isSelected = selectedProfits.includes(profit.id);
                  
                  return (
                    <Card 
                      key={profit.id} 
                      className={`transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {canMarkReceived && (
                              <Checkbox
                                className="mt-1"
                                checked={isSelected}
                                onCheckedChange={() => handleSelectProfit(profit.id)}
                              />
                            )}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                  {order?.tracking_number || 'غير محدد'}
                                </span>
                                <Badge variant="outline">
                                  {order?.customer_name || 'زبون غير معروف'}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {profit.created_at && isValid(parseISO(profit.created_at)) ? 
                                  format(parseISO(profit.created_at), 'd MMM yyyy', { locale: ar }) : 
                                  'تاريخ غير محدد'
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">
                                إجمالي المبيعات: {profit.total_revenue?.toLocaleString() || 0} د.ع
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-left">
                            <div className="text-lg font-bold text-yellow-600">
                              {(profit.employee_profit || 0).toLocaleString()} د.ع
                            </div>
                            <div className="text-xs text-muted-foreground">
                              نسبة: {profit.employee_percentage || 0}%
                            </div>
                            <Badge variant="warning" className="mt-1">
                              معلق
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد أرباح معلقة حالياً
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
          <Button onClick={() => {
            onClose();
            // الانتقال إلى صفحة الأرباح
            window.location.href = '/profits-summary?profitStatus=pending';
          }}>
            عرض كل التفاصيل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PendingProfitsDialog;