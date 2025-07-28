import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Print, Download, FileText, Calendar, User, DollarSign, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

const SettlementInvoiceDialog = ({ 
  open, 
  onClose, 
  employee, 
  orders = [], 
  totalProfit = 0,
  settlementDate = new Date()
}) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const handleDownload = () => {
    toast({
      title: "جاري التحضير",
      description: "سيتم تطوير ميزة التحميل قريباً",
      variant: "default"
    });
  };

  const calculateOrderProfit = (order) => {
    if (!order.items || !Array.isArray(order.items)) return 0;
    
    return order.items.reduce((sum, item) => {
      const unitPrice = item.unit_price || item.price || 0;
      const costPrice = item.cost_price || item.costPrice || 0;
      const quantity = item.quantity || 0;
      const profit = (unitPrice - costPrice) * quantity;
      return sum + profit;
    }, 0);
  };

  const invoiceNumber = `INV-${employee?.user_id?.slice(-6)}-${format(settlementDate, 'ddMMyy')}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] max-w-4xl h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 p-4 border-b bg-background/95 backdrop-blur">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            فاتورة تحاسب موظف
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span>رقم الفاتورة: {invoiceNumber}</span>
            <span>التاريخ: {format(settlementDate, 'dd/MM/yyyy', { locale: ar })}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* معلومات الموظف */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                معلومات الموظف
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">اسم الموظف</label>
                <p className="text-base font-semibold">{employee?.full_name || 'غير محدد'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">اسم المستخدم</label>
                <p className="text-base">{employee?.username || 'غير محدد'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">تاريخ التحاسب</label>
                <p className="text-base">{format(settlementDate, 'dd MMMM yyyy', { locale: ar })}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">عدد الطلبات</label>
                <p className="text-base font-semibold">{orders.length} طلب</p>
              </div>
            </CardContent>
          </Card>

          {/* ملخص مالي */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                الملخص المالي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{totalProfit.toLocaleString()} د.ع</p>
                <p className="text-sm text-muted-foreground mt-1">إجمالي المبلغ المستحق</p>
              </div>
            </CardContent>
          </Card>

          {/* تفاصيل الطلبات */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                تفاصيل الطلبات ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {orders.map((order, index) => {
                const orderProfit = calculateOrderProfit(order);
                return (
                  <div key={order.id} className="border rounded-lg p-3 bg-muted/30">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {order.order_number}
                        </Badge>
                        <span className="text-sm font-medium">{order.customer_name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-600">
                          {orderProfit.toLocaleString()} د.ع
                        </p>
                        <p className="text-xs text-muted-foreground">الربح</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(order.created_at), 'dd/MM/yyyy')}
                      </div>
                      <div>
                        المبلغ الإجمالي: {(order.total_amount || 0).toLocaleString()} د.ع
                      </div>
                      <div>
                        عدد المنتجات: {order.items?.length || 0}
                      </div>
                    </div>

                    {/* تفاصيل المنتجات */}
                    {order.items && order.items.length > 0 && (
                      <div className="mt-3 pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">المنتجات:</p>
                        <div className="space-y-1">
                          {order.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex justify-between items-center text-xs bg-background rounded px-2 py-1">
                              <span className="flex-1 truncate">{item.product_name || item.name}</span>
                              <span className="mx-2">x{item.quantity}</span>
                              <span className="font-medium">
                                {((item.unit_price - (item.cost_price || 0)) * item.quantity).toLocaleString()} د.ع
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* شروط وأحكام */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">شروط التحاسب</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• يتم احتساب الربح بناءً على الفرق بين سعر البيع وسعر التكلفة</p>
              <p>• المبلغ المذكور يشمل أرباح الطلبات المُسلّمة فقط</p>
              <p>• يتم خصم أي مرتجعات أو إلغاءات من الحساب النهائي</p>
              <p>• هذه الفاتورة صالحة لمدة 30 يوماً من تاريخ الإصدار</p>
            </CardContent>
          </Card>
        </div>

        {/* أزرار التحكم */}
        <div className="flex-shrink-0 p-4 border-t bg-background/95 backdrop-blur">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                onClick={handlePrint}
                disabled={isPrinting}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Print className="h-4 w-4 ml-1" />
                {isPrinting ? 'جاري الطباعة...' : 'طباعة'}
              </Button>
              <Button 
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Download className="h-4 w-4 ml-1" />
                تحميل PDF
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              onClick={onClose}
              size="sm"
              className="w-full sm:w-auto"
            >
              إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettlementInvoiceDialog;