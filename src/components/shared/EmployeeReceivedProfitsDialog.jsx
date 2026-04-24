import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Calendar, User, DollarSign, FileText, CheckCircle, TrendingUp, Award, Banknote, Eye } from 'lucide-react';
import { parseISO, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfYear, subDays, subWeeks, subMonths, subYears, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz/formatInTimeZone';
import devLog from '@/lib/devLogger';

// تعيين التوقيت المحلي العراقي
const IRAQ_TIMEZONE = 'Asia/Baghdad';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import SettlementInvoiceDialog from '@/components/profits/SettlementInvoiceDialog';
import { useEmployeeReceivedPeriod } from '@/hooks/useEmployeeReceivedPeriod';

/**
 * نافذة تفاصيل الأرباح المستلمة للموظف
 * نفس تصميم نافذة المدير بالضبط مع الكروت الملونة والتدرجات الجميلة
 * مع إضافة فلتر الفترة الزمنية
 */
const EmployeeReceivedProfitsDialog = ({
  isOpen,
  onClose,
  allUsers = []
}) => {
  const { user } = useAuth();
  const [realTimeInvoices, setRealTimeInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  
  // استخدام فلتر الفترة الموحد بين الكارت والنافذة
  const { period, setPeriod, dateRange } = useEmployeeReceivedPeriod();

  // جلب فواتير التسوية باستخدام المعرف الصغير employee_code بدلاً من UUID - نفس منطق الكارت الخارجي
  useEffect(() => {
    const fetchEmployeeInvoices = async () => {
      if (!user?.employee_code) {
        devLog.log('🔍 EmployeeReceivedProfitsDialog: لا يوجد معرف موظف صغير');
        return;
      }

      try {
        devLog.log('🔍 EmployeeReceivedProfitsDialog: جلب فواتير بالمعرف الصغير:', {
          employeeCode: user.employee_code,
          userName: user.full_name
        });
        
        // البحث بالمعرف الصغير employee_code بدلاً من UUID - نفس منطق الكارت الخارجي
        const { data: invoices, error } = await supabase
          .from('settlement_invoices')
          .select('*')
          .eq('employee_code', user.employee_code)  // استخدام المعرف الصغير EMP002
          .eq('status', 'completed')
          .order('settlement_date', { ascending: false });

        if (error) {
          console.error('❌ خطأ في جلب فواتير التسوية:', error);
          return;
        }

        devLog.log('✅ EmployeeReceivedProfitsDialog: فواتير محملة بنجاح بالمعرف الصغير:', {
          employeeCode: user.employee_code,
          invoicesCount: invoices?.length || 0,
          invoices: invoices || [],
          invoiceDetails: invoices?.map(inv => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            total_amount: inv.total_amount,
            settlement_date: inv.settlement_date,
            employee_name: inv.employee_name,
            employee_code: inv.employee_code,
            status: inv.status
          })) || []
        });

        setRealTimeInvoices(invoices || []);
      } catch (error) {
        console.error('❌ خطأ في جلب فواتير التسوية:', error);
      }
    };

    fetchEmployeeInvoices();
  }, [user?.employee_code, user?.full_name]);

  const getPayerName = (createdBy) => {
    // إذا كان المدير العام
    if (createdBy === '91484496-b887-44f7-9e5d-be9db5567604') {
      return 'المدير العام';
    }
    
    const payer = allUsers.find(u => u.id === createdBy);
    return payer ? payer.full_name : 'النظام';
  };

  // فلترة الفواتير حسب الفترة الزمنية المحددة
  const filteredInvoices = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return realTimeInvoices;
    
    return realTimeInvoices.filter(invoice => {
      const invoiceDate = parseISO(invoice.settlement_date);
      return isValid(invoiceDate) && 
             invoiceDate >= dateRange.from && 
             invoiceDate <= dateRange.to;
    });
  }, [realTimeInvoices, dateRange]);

  // حساب الإحصائيات المفلترة
  const stats = useMemo(() => {
    const totalFiltered = filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    return {
      totalReceived: totalFiltered,
      invoicesCount: filteredInvoices.length,
      averageAmount: filteredInvoices.length > 0 ? totalFiltered / filteredInvoices.length : 0,
      lastPaymentDate: filteredInvoices.length > 0 ? 
        filteredInvoices.sort((a, b) => new Date(b.settlement_date) - new Date(a.settlement_date))[0]?.settlement_date : null
    };
  }, [filteredInvoices]);

  // معالج معاينة الفاتورة
  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDialog(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[98vw] h-[95vh] overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-3 sm:p-6">
            {/* Header - متوافق مع الهاتف */}
            <div className="text-center mb-6">
              <div className="flex flex-col items-center justify-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-green-600 rounded-full text-white shadow-lg">
                  <Receipt className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">أرباحي المستلمة</h1>
                  <p className="text-base text-slate-600 dark:text-slate-400">تفاصيل الأرباح المدفوعة</p>
                </div>
              </div>
            </div>

            {/* فلتر الفترة الزمنية - قائمة منسدلة */}
            <div className="mb-6">
              <Card className="border-border bg-background/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-foreground">فترة العرض:</span>
                    </div>
                    <Select value={period} onValueChange={setPeriod}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="اختر الفترة الزمنية" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">اليوم</SelectItem>
                        <SelectItem value="week">هذا الأسبوع</SelectItem>
                        <SelectItem value="month">هذا الشهر</SelectItem>
                        <SelectItem value="year">هذه السنة</SelectItem>
                        <SelectItem value="all">كل الفترات</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* معلومات الموظف والمبلغ الإجمالي */}
            <div className="space-y-4 mb-6">
              {/* معلومات الموظف */}
              <Card className="relative overflow-hidden bg-background border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">معلومات الموظف</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-3 relative overflow-hidden">
                      <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-white/10 rounded-full"></div>
                      <p className="text-xs opacity-90 font-medium mb-1">اسم الموظف</p>
                      <p className="font-bold text-sm">{user?.full_name || 'غير محدد'}</p>
                    </div>
                    <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg p-3 relative overflow-hidden">
                      <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-white/10 rounded-full"></div>
                      <p className="text-xs opacity-90 font-medium mb-1">معرف الموظف</p>
                      <p className="font-mono font-bold text-sm">{user?.employee_code || 'غير محدد'}</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg p-3 relative overflow-hidden">
                      <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-white/10 rounded-full"></div>
                      <p className="text-xs opacity-90 font-medium mb-1">عدد الفواتير</p>
                      <p className="font-mono font-bold text-sm">{stats.invoicesCount}</p>
                    </div>
                    <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg p-3 relative overflow-hidden">
                      <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-white/10 rounded-full"></div>
                      <p className="text-xs opacity-90 font-medium mb-1">متوسط الفاتورة</p>
                      <p className="font-bold text-sm">{stats.averageAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* المبلغ الإجمالي المستلم */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-green-600 to-teal-700 opacity-90"></div>
                <div className="absolute inset-0 bg-black/10"></div>
                <CardContent className="relative p-4 text-white text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30">
                      <DollarSign className="w-8 h-8 drop-shadow-lg" />
                    </div>
                    <h3 className="text-lg font-bold drop-shadow-lg">إجمالي المستلم</h3>
                  </div>
                  <p className="text-3xl font-black mb-3 drop-shadow-2xl">
                    {stats.totalReceived?.toLocaleString()}
                  </p>
                  <p className="text-base font-bold opacity-90 mb-4 drop-shadow-lg">دينار عراقي</p>
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/20">
                    <div className="flex items-center justify-center gap-2 text-sm font-bold">
                      <CheckCircle className="w-5 h-5" />
                      <span>تم الاستلام بنجاح</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-white/5 rounded-full"></div>
                  <div className="absolute -top-3 -left-3 w-8 h-8 bg-white/5 rounded-full"></div>
                </CardContent>
              </Card>
            </div>

            {/* إحصائيات سريعة - نفس تصميم المدير */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 md:mb-6">
              <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                <CardContent className="p-2 md:p-3 text-center">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                    <div className="flex justify-center mb-1 md:mb-2">
                      <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <Award className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                    </div>
                    <p className="text-[10px] md:text-xs opacity-90 mb-1">عدد الفواتير</p>
                    <p className="text-lg md:text-xl font-black">{stats.invoicesCount}</p>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                <CardContent className="p-2 md:p-3 text-center">
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                    <div className="flex justify-center mb-1 md:mb-2">
                      <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                    </div>
                    <p className="text-[10px] md:text-xs opacity-90 mb-1">إجمالي المبلغ</p>
                    <p className="text-sm md:text-base font-black">{stats.totalReceived.toLocaleString()}</p>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                <CardContent className="p-2 md:p-3 text-center">
                  <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                    <div className="flex justify-center mb-1 md:mb-2">
                      <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <Banknote className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                    </div>
                    <p className="text-[10px] md:text-xs opacity-90 mb-1">متوسط الفاتورة</p>
                    <p className="text-sm md:text-base font-black">{stats.averageAmount.toLocaleString()}</p>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                <CardContent className="p-2 md:p-3 text-center">
                  <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                    <div className="flex justify-center mb-1 md:mb-2">
                      <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                    </div>
                    <p className="text-[10px] md:text-xs opacity-90 mb-1">آخر دفعة</p>
                    <p className="text-[10px] md:text-xs font-black">
                      {stats.lastPaymentDate ? formatInTimeZone(parseISO(stats.lastPaymentDate), IRAQ_TIMEZONE, 'dd/MM', { locale: ar }) : 'لا يوجد'}
                    </p>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* قائمة الفواتير - نفس تصميم المدير */}
            <Card className="mb-4 md:mb-8 relative overflow-hidden shadow-2xl">
              <CardContent className="p-4 md:p-8">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-xl md:rounded-2xl p-4 md:p-8 relative overflow-hidden">
                  <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-8">
                    <div className="p-2 md:p-4 bg-white/10 rounded-xl md:rounded-2xl backdrop-blur-sm">
                      <FileText className="w-6 h-6 md:w-10 md:h-10" />
                    </div>
                    <h3 className="font-black text-xl md:text-3xl">
                      {filteredInvoices.length === 0 
                        ? 'فواتير الأرباح المستلمة' 
                        : `تفاصيل الفواتير المستلمة (${filteredInvoices.length})`
                      }
                    </h3>
                  </div>

                  {filteredInvoices.length === 0 ? (
                    <div className="text-center py-12">
                      <Receipt className="w-20 h-20 text-white/30 mx-auto mb-6" />
                      <h4 className="text-2xl font-bold mb-4 text-white/90">لا توجد فواتير في هذه الفترة</h4>
                      <p className="text-white/70 text-lg mb-6">جرب تغيير الفترة الزمنية لرؤية الفواتير</p>
                      <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/20 max-w-md mx-auto">
                        <p className="text-white/80 text-sm">💡 نصيحة: استخدم فلتر الفترة أعلاه لاختيار فترة مختلفة</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* عرض الهاتف - بدون جدول */}
                      <div className="md:hidden space-y-3">
                        {filteredInvoices
                          .sort((a, b) => new Date(b.settlement_date) - new Date(a.settlement_date))
                          .map((invoice, index) => (
                          <div key={invoice.id} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-blue-300 font-bold text-sm">#{invoice.invoice_number}</span>
                              <span className="text-cyan-300 text-xs">
                                {formatInTimeZone(parseISO(invoice.settlement_date), IRAQ_TIMEZONE, 'dd/MM/yyyy - HH:mm', { locale: ar })}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="text-green-300">
                                <span className="opacity-70">المبلغ: </span>
                                <span className="font-bold">{invoice.total_amount?.toLocaleString() || '0'}</span>
                              </div>
                              <div className="text-orange-300">
                                <span className="opacity-70">دفع بواسطة: </span>
                                <span className="font-bold">{getPayerName(invoice.created_by)}</span>
                              </div>
                            </div>
                            {invoice.description && (
                              <div className="text-purple-300 text-xs">
                                <span className="opacity-70">الوصف: </span>
                                <span>{invoice.description}</span>
                              </div>
                            )}
                            <div className="flex justify-center pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewInvoice(invoice)}
                                className="text-xs gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                معاينة
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* عرض الديسكتوب - جدول */}
                      <div className="hidden md:block bg-white/10 rounded-2xl p-1 backdrop-blur-sm">
                        <div className="bg-slate-900/80 rounded-xl overflow-hidden">
                          {/* Header */}
                           <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 md:px-8 py-4 md:py-6">
                             <div className="grid grid-cols-6 gap-3 md:gap-6 text-center font-bold text-sm md:text-lg">
                               <div className="text-blue-300 flex items-center justify-center gap-1 md:gap-2">
                                 <FileText className="w-3 h-3 md:w-4 md:h-4" />
                                 رقم الفاتورة
                               </div>
                               <div className="text-green-300 flex items-center justify-center gap-1 md:gap-2">
                                 <DollarSign className="w-3 h-3 md:w-4 md:h-4" />
                                 المبلغ
                               </div>
                               <div className="text-purple-300 flex items-center justify-center gap-1 md:gap-2">
                                 <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                                 تاريخ الدفع
                               </div>
                               <div className="text-orange-300 flex items-center justify-center gap-1 md:gap-2">
                                 <User className="w-3 h-3 md:w-4 md:h-4" />
                                 دفع بواسطة
                               </div>
                               <div className="text-cyan-300 flex items-center justify-center gap-1 md:gap-2">
                                 الوصف
                               </div>
                               <div className="text-white flex items-center justify-center gap-1 md:gap-2">
                                 <Eye className="w-3 h-3 md:w-4 md:h-4" />
                                 الإجراءات
                               </div>
                             </div>
                           </div>
                          
                          {/* الفواتير */}
                          <div className="divide-y divide-slate-700/50">
                            {filteredInvoices
                              .sort((a, b) => new Date(b.settlement_date) - new Date(a.settlement_date))
                              .map((invoice, index) => (
                              <div key={invoice.id} className="px-4 md:px-8 py-3 md:py-4 hover:bg-white/5 transition-all duration-200">
                                <div className="grid grid-cols-6 gap-3 md:gap-6 text-center text-xs md:text-sm">
                                  <div className="text-blue-300 font-mono font-bold">
                                    {invoice.invoice_number}
                                  </div>
                                  <div className="text-green-300 font-bold">
                                    {invoice.total_amount?.toLocaleString() || '0'}
                                  </div>
                                   <div className="text-purple-300">
                                     {formatInTimeZone(parseISO(invoice.settlement_date), IRAQ_TIMEZONE, 'dd/MM/yyyy - HH:mm', { locale: ar })}
                                   </div>
                                  <div className="text-orange-300">
                                    {getPayerName(invoice.created_by)}
                                  </div>
                                  <div className="text-cyan-300 truncate" title={invoice.description}>
                                    {invoice.description || 'لا يوجد وصف'}
                                  </div>
                                  <div className="flex items-center justify-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewInvoice(invoice)}
                                      className="p-2"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
      
      {/* نافذة معاينة الفاتورة */}
      {selectedInvoice && (
        <SettlementInvoiceDialog
          invoice={selectedInvoice}
          open={showInvoiceDialog}
          onOpenChange={setShowInvoiceDialog}
          allUsers={allUsers}
        />
      )}
    </Dialog>
  );
};

export default EmployeeReceivedProfitsDialog;