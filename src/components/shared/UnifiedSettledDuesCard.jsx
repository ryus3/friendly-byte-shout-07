import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Receipt, User, DollarSign, Calendar, CheckCircle, Eye, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * مكون موحد لعرض المستحقات المدفوعة - متوافق مع الهاتف
 * يُستخدم في:
 * 1. متابعة الموظفين
 * 2. ملخص الأرباح 
 * 3. المركز المالي
 */
const UnifiedSettledDuesCard = ({ 
  open, 
  onOpenChange, 
  allUsers = [], 
  dateRange = null 
}) => {
  const [settlementInvoices, setSettlementInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  // جلب فواتير التسوية
  useEffect(() => {
    const fetchSettlementInvoices = async () => {
      if (!open) return;
      
      setLoading(true);
      try {
        console.log('🔄 جلب فواتير التسوية...');
        const { data, error } = await supabase
          .from('settlement_invoices')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ خطأ في جلب فواتير التسوية:', error);
        } else {
          console.log('✅ تم جلب فواتير التسوية:', data?.length || 0);
          setSettlementInvoices(data || []);
        }
      } catch (error) {
        console.error('❌ خطأ غير متوقع:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettlementInvoices();
  }, [open]);

  // فلترة الفواتير حسب التاريخ
  const filteredInvoices = useMemo(() => {
    if (!dateRange) return settlementInvoices;
    
    const { from, to } = dateRange;
    if (!from || !to) return settlementInvoices;

    return settlementInvoices.filter(invoice => {
      const invoiceDate = parseISO(invoice.settlement_date || invoice.created_at);
      return isValid(invoiceDate) && invoiceDate >= from && invoiceDate <= to;
    });
  }, [settlementInvoices, dateRange]);

  // حساب الإجماليات
  const totals = useMemo(() => {
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const invoicesCount = filteredInvoices.length;
    const uniqueEmployees = new Set(filteredInvoices.map(inv => inv.employee_id)).size;

    return { totalAmount, invoicesCount, uniqueEmployees };
  }, [filteredInvoices]);

  const handlePreviewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowPreview(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-6xl max-h-[95vh] overflow-hidden p-0 sm:p-6">
          <DialogHeader className="px-4 pt-4 sm:px-0 sm:pt-0">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-center gradient-text mb-4">
              المستحقات المدفوعة
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-full max-h-[80vh] px-4 sm:px-0">
            <div className="space-y-4">
              {/* إحصائيات سريعة */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5" />
                      <span className="text-sm font-medium">إجمالي المبلغ</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold">
                      {totals.totalAmount.toLocaleString()} د.ع
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Receipt className="w-5 h-5" />
                      <span className="text-sm font-medium">عدد الفواتير</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold">{totals.invoicesCount}</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <User className="w-5 h-5" />
                      <span className="text-sm font-medium">عدد الموظفين</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold">{totals.uniqueEmployees}</p>
                  </CardContent>
                </Card>
              </div>

              {/* قائمة الفواتير */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-pulse">جاري التحميل...</div>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium text-muted-foreground">لا توجد مستحقات مدفوعة</p>
                    <p className="text-sm text-muted-foreground mt-2">لم يتم العثور على فواتير تسوية في هذه الفترة</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredInvoices.map((invoice) => (
                    <Card key={invoice.id} className="transition-all duration-300 hover:shadow-lg border-l-4 border-l-emerald-500">
                      <CardContent className="p-4">
                        {/* تخطيط متجاوب للهاتف */}
                        <div className="block">
                          {/* الصف الأول - معلومات أساسية */}
                          <div className="flex items-center justify-between gap-4 mb-3">
                            {/* رقم الفاتورة */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white flex-shrink-0">
                                <Receipt className="w-3 h-3" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-blue-600 font-mono text-xs truncate">
                                  {invoice.invoice_number}
                                </p>
                                <p className="text-xs text-muted-foreground">الفاتورة</p>
                              </div>
                            </div>
                            
                            {/* اسم الموظف */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="p-1 bg-green-100 rounded dark:bg-green-900/30 flex-shrink-0">
                                <User className="w-3 h-3 text-green-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-green-700 dark:text-green-400 text-xs truncate">
                                  {invoice.employee_name}
                                </p>
                                <p className="text-xs text-muted-foreground">الموظف</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* الصف الثاني - المبلغ والتاريخ */}
                          <div className="flex items-center justify-between gap-4 mb-3">
                            {/* المبلغ */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="p-1 bg-emerald-100 rounded dark:bg-emerald-900/30 flex-shrink-0">
                                <DollarSign className="w-3 h-3 text-emerald-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-emerald-600 text-sm">
                                  {invoice.total_amount?.toLocaleString()} د.ع
                                </p>
                                <p className="text-xs text-muted-foreground">المبلغ</p>
                              </div>
                            </div>
                            
                            {/* التاريخ */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="p-1 bg-purple-100 rounded dark:bg-purple-900/30 flex-shrink-0">
                                <Calendar className="w-3 h-3 text-purple-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-purple-600 text-xs">
                                  {invoice.settlement_date ? 
                                    format(parseISO(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar }) :
                                    (invoice.created_at ? 
                                      format(parseISO(invoice.created_at), 'dd/MM/yyyy', { locale: ar }) :
                                      'غير محدد'
                                    )
                                  }
                                </p>
                                <p className="text-xs text-muted-foreground">التاريخ</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* الصف الثالث - الحالة والإجراءات */}
                          <div className="flex items-center justify-between gap-3">
                            <Badge 
                              variant="secondary" 
                              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-0 text-xs font-bold transition-all duration-300 hover:scale-105 px-2 py-1 rounded-md gap-1"
                            >
                              <CheckCircle className="w-3 h-3" />
                              مكتملة
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreviewInvoice(invoice)}
                              className="gap-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none hover:from-indigo-600 hover:to-purple-700 hover:shadow-lg transition-all duration-300 flex-shrink-0 text-xs px-3 py-1"
                            >
                              <Eye className="w-3 h-3" />
                              معاينة
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* نافذة معاينة الفاتورة */}
      {selectedInvoice && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden">
            <ScrollArea className="h-full max-h-[85vh]">
              <div className="p-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold">فاتورة تسوية</h2>
                  <p className="text-muted-foreground">تفاصيل المستحقات المدفوعة</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-bold mb-3">معلومات الفاتورة</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>رقم الفاتورة:</span>
                          <span className="font-mono">{selectedInvoice.invoice_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>اسم الموظف:</span>
                          <span>{selectedInvoice.employee_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>المبلغ:</span>
                          <span className="font-bold text-emerald-600">
                            {selectedInvoice.total_amount?.toLocaleString()} د.ع
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>طريقة الدفع:</span>
                          <span>{selectedInvoice.payment_method === 'cash' ? 'نقدي' : selectedInvoice.payment_method}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-bold mb-3">التفاصيل الإضافية</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>تاريخ التسوية:</span>
                          <span>
                            {selectedInvoice.settlement_date ? 
                              format(parseISO(selectedInvoice.settlement_date), 'dd/MM/yyyy - HH:mm', { locale: ar }) :
                              'غير محدد'
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>الحالة:</span>
                          <Badge className="bg-emerald-500 text-white">مكتملة</Badge>
                        </div>
                        {selectedInvoice.notes && (
                          <div>
                            <span>الملاحظات:</span>
                            <p className="text-sm text-muted-foreground mt-1">{selectedInvoice.notes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default UnifiedSettledDuesCard;