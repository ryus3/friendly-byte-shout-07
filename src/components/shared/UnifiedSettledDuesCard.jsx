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

      {/* نافذة معاينة الفاتورة - بالتصميم الأصلي الجميل */}
      {selectedInvoice && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden">
            <ScrollArea className="h-full max-h-[85vh]">
              <div className="p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="p-3 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full text-white shadow-lg">
                      <Receipt className="w-10 h-10" />
                    </div>
                    <div>
                      <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100">فاتورة تسوية</h1>
                      <p className="text-lg text-slate-600 dark:text-slate-400">مستحقات الموظف</p>
                    </div>
                  </div>
                </div>

                {/* معلومات الفاتورة */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                  {/* معلومات الموظف */}
                  <Card className="lg:col-span-2 relative overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl bg-background border-border">
                    <CardContent className="relative p-5">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 group-hover:scale-110 transition-all duration-300">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="font-bold text-lg text-foreground">معلومات الموظف والفاتورة</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-3">
                          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-3 backdrop-blur-sm hover:from-blue-600 hover:to-blue-700 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                            <p className="text-xs opacity-90 font-medium mb-1.5">اسم الموظف</p>
                            <p className="font-bold text-base">{selectedInvoice.employee_name}</p>
                          </div>
                          <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg p-3 backdrop-blur-sm hover:from-emerald-600 hover:to-green-700 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                            <p className="text-xs opacity-90 font-medium mb-1.5">معرف الموظف</p>
                            <p className="font-mono font-bold text-sm">{selectedInvoice.employee_code || 'غير محدد'}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg p-3 backdrop-blur-sm hover:from-purple-600 hover:to-violet-700 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                            <p className="text-xs opacity-90 font-medium mb-1.5">رقم الفاتورة</p>
                            <p className="font-mono font-bold text-sm">{selectedInvoice.invoice_number}</p>
                          </div>
                          <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg p-3 backdrop-blur-sm hover:from-orange-600 hover:to-amber-700 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                            <p className="text-xs opacity-90 font-medium mb-1.5">طريقة الدفع</p>
                            <p className="font-bold text-sm">{selectedInvoice.payment_method === 'cash' ? 'نقدي' : selectedInvoice.payment_method}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* المبلغ المدفوع */}
                  <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 opacity-90"></div>
                    <div className="absolute inset-0 bg-black/10"></div>
                    <CardContent className="relative p-5 text-white text-center">
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30 group-hover:scale-110 transition-all duration-300">
                          <DollarSign className="w-8 h-8 drop-shadow-lg" />
                        </div>
                        <h3 className="text-lg font-bold drop-shadow-lg">المبلغ المدفوع</h3>
                      </div>
                      <p className="text-4xl font-black mb-3 drop-shadow-2xl">
                        {selectedInvoice.total_amount?.toLocaleString()}
                      </p>
                      <p className="text-base font-bold opacity-90 mb-4 drop-shadow-lg">دينار عراقي</p>
                      <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/20">
                        <div className="flex items-center justify-center gap-2 text-sm font-bold">
                          <CheckCircle className="w-5 h-5" />
                          <span>تم الدفع بنجاح</span>
                        </div>
                      </div>
                      <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
                      <div className="absolute -top-3 -left-3 w-12 h-12 bg-white/5 rounded-full"></div>
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