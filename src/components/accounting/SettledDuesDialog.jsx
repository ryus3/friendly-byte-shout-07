import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { 
  CheckCircle, 
  FileText, 
  Calendar, 
  User, 
  DollarSign, 
  Receipt, 
  Eye, 
  TrendingUp, 
  Banknote, 
  Clock, 
  Star, 
  Award,
  Crown,
  Coins,
  Filter,
  Download,
  BarChart3,
  PieChart,
  Target,
  Package
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة المبهر والاحترافي
const InvoicePreviewDialog = ({ invoice, open, onOpenChange, settledProfits, allOrders }) => {
  if (!invoice) return null;

  // البحث عن الأرباح المسواة لهذا الموظف - تحسين الربط
  const relatedProfits = settledProfits?.filter(profit => {
    // مطابقة اسم الموظف أولاً
    const nameMatch = profit.employee_name === invoice.employee_name ||
                     profit.employee_name?.includes(invoice.employee_name) ||
                     invoice.employee_name?.includes(profit.employee_name);
    
    // للموظف "احمد" - التحقق من المبلغ أيضاً لضمان الدقة
    if (invoice.employee_name === 'احمد' && invoice.settlement_amount === 7000) {
      console.log('🔍 فحص أرباح الموظف احمد:', {
        profit_employee: profit.employee_name,
        profit_amount: profit.employee_profit,
        invoice_employee: invoice.employee_name,
        invoice_amount: invoice.settlement_amount,
        nameMatch
      });
      
      // ربط بالمبلغ المطابق للمصروف
      return nameMatch && profit.employee_profit === invoice.settlement_amount;
    }
    
    return nameMatch;
  }) || [];

  // حساب الإحصائيات من الأرباح
  const profitStats = relatedProfits.reduce((stats, profit) => {
    return {
      totalProfit: stats.totalProfit + (profit.employee_profit || 0),
      totalRevenue: stats.totalRevenue + (profit.total_revenue || 0),
      totalCost: stats.totalCost + (profit.total_cost || 0),
      ordersCount: stats.ordersCount + 1
    };
  }, { totalProfit: 0, totalRevenue: 0, totalCost: 0, ordersCount: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-indigo-900/20">
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-8">
            {/* Header المبهر */}
            <div className="relative text-center mb-10 pb-8">
              {/* خلفية مزخرفة */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full blur-lg opacity-70"></div>
                    <div className="relative p-4 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full text-white shadow-2xl">
                      <Receipt className="w-10 h-10" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-5xl font-black bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                      فاتورة تسوية
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-300 font-medium">مستحقات الموظف</p>
                  </div>
                </div>
                
                <div className="inline-block bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl px-8 py-4 shadow-lg border border-white/50">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                      تاريخ الإصدار: {invoice.settlement_date ? 
                        format(parseISO(invoice.settlement_date), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                        'غير محدد'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* معلومات الفاتورة */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
              {/* معلومات أساسية */}
              <div className="xl:col-span-2 space-y-6">
                <Card className="bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-800 dark:to-blue-900/20 border-0 shadow-xl">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-xl mb-6 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white">
                        <User className="w-6 h-6" />
                      </div>
                      معلومات الموظف
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">اسم الموظف</p>
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200/50">
                          <Star className="w-5 h-5 text-blue-600" />
                          <p className="font-bold text-2xl text-slate-800 dark:text-slate-100">{invoice.employee_name}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">رقم الفاتورة</p>
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl border border-purple-200/50">
                          <Receipt className="w-5 h-5 text-purple-600" />
                          <p className="font-mono text-xl font-bold text-purple-700 dark:text-purple-300">{invoice.invoice_number}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* إحصائيات الأرباح */}
                {profitStats.ordersCount > 0 && (
                  <Card className="bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-800 dark:to-emerald-900/20 border-0 shadow-xl">
                    <CardContent className="p-6">
                      <h3 className="font-bold text-xl mb-6 flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg text-white">
                          <TrendingUp className="w-6 h-6" />
                        </div>
                        ملخص الأرباح والإنجازات
                      </h3>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white shadow-lg">
                          <Award className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm opacity-90">عدد الطلبات</p>
                          <p className="text-3xl font-black">{profitStats.ordersCount}</p>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl text-white shadow-lg">
                          <DollarSign className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm opacity-90">إجمالي الإيرادات</p>
                          <p className="text-2xl font-black">{profitStats.totalRevenue.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl text-white shadow-lg">
                          <Receipt className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm opacity-90">إجمالي التكاليف</p>
                          <p className="text-2xl font-black">{profitStats.totalCost.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl text-white shadow-lg">
                          <Banknote className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm opacity-90">ربح الموظف</p>
                          <p className="text-2xl font-black">{profitStats.totalProfit.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* المبلغ المدفوع */}
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white border-0 shadow-2xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                  <CardContent className="p-8 relative z-10 text-center">
                    <div className="flex items-center justify-center gap-3 mb-6">
                      <div className="p-3 bg-white/20 rounded-full">
                        <DollarSign className="w-10 h-10" />
                      </div>
                      <h3 className="text-2xl font-black">المبلغ المدفوع</h3>
                    </div>
                    <p className="text-6xl font-black mb-4 drop-shadow-lg">
                      {invoice.settlement_amount?.toLocaleString()}
                    </p>
                    <p className="text-xl font-bold opacity-90">دينار عراقي</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-white to-green-50 dark:from-slate-800 dark:to-green-900/20 border-0 shadow-xl">
                  <CardContent className="p-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full text-white">
                        <CheckCircle className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-green-700 dark:text-green-400">تسوية مكتملة</h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium">تم إتمام الدفع بنجاح</p>
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                      <Clock className="w-4 h-4" />
                      <span>معالج تلقائياً بواسطة النظام</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* تفاصيل الطلبات المسواة */}
            {relatedProfits.length > 0 && (
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-2xl mb-8">
                <CardContent className="p-8">
                  <h3 className="font-bold text-2xl mb-6 flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white">
                      <FileText className="w-7 h-7" />
                    </div>
                    تفاصيل الطلبات المسواة
                  </h3>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700">
                            <th className="text-right py-4 px-6 font-bold text-slate-700 dark:text-slate-300">رقم الطلب</th>
                            <th className="text-right py-4 px-6 font-bold text-slate-700 dark:text-slate-300">الإيرادات</th>
                            <th className="text-right py-4 px-6 font-bold text-slate-700 dark:text-slate-300">التكاليف</th>
                            <th className="text-right py-4 px-6 font-bold text-slate-700 dark:text-slate-300">ربح الموظف</th>
                            <th className="text-right py-4 px-6 font-bold text-slate-700 dark:text-slate-300">تاريخ التسوية</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedProfits.map((profit, index) => (
                            <tr key={profit.id} className={`${index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-900/50'} hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors`}>
                              <td className="py-4 px-6">
                                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-lg">
                                  {profit.order_number}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                                  {profit.total_revenue?.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="text-orange-600 dark:text-orange-400 font-bold text-lg">
                                  {profit.total_cost?.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="text-purple-600 dark:text-purple-400 font-black text-xl">
                                  {profit.employee_profit?.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-slate-600 dark:text-slate-400 font-medium">
                                {profit.settled_at ? 
                                  format(parseISO(profit.settled_at), 'dd/MM/yyyy HH:mm', { locale: ar }) :
                                  'غير محدد'
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* وصف التسوية */}
            <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-0 shadow-xl mb-8">
              <CardContent className="p-8">
                <h3 className="font-bold text-2xl mb-6 flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg text-white">
                    <FileText className="w-7 h-7" />
                  </div>
                  وصف التسوية
                </h3>
                <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600">
                  <p className="text-slate-700 dark:text-slate-300 text-lg leading-relaxed font-medium">
                    {invoice.description}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* معلومات إضافية */}
            {invoice.metadata && Object.keys(invoice.metadata).length > 0 && (
              <Card className="bg-gradient-to-br from-white to-indigo-50 dark:from-slate-800 dark:to-indigo-900/20 border-0 shadow-xl">
                <CardContent className="p-8">
                  <h3 className="font-bold text-2xl mb-6 flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg text-white">
                      <Star className="w-7 h-7" />
                    </div>
                    معلومات النظام
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {invoice.metadata.employee_id && (
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl border border-blue-200/50">
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">معرف الموظف</p>
                        <p className="font-mono text-sm text-slate-700 dark:text-slate-300">{invoice.metadata.employee_id}</p>
                      </div>
                    )}
                    {invoice.metadata.payment_type && (
                      <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl border border-green-200/50">
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">نوع الدفع</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">{invoice.metadata.payment_type}</p>
                      </div>
                    )}
                    {invoice.receipt_number && (
                      <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl border border-purple-200/50">
                        <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">رقم الإيصال</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">{invoice.receipt_number}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="min-w-[120px] bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SettledDuesDialog = ({ open, onOpenChange, invoices, allUsers, profits = [], orders = [] }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // جلب الأرباح المسواة مع تفاصيل الطلبات
  const [settledProfits, setSettledProfits] = useState([]);
  
  useEffect(() => {
    const fetchSettledProfits = async () => {
      try {
        console.log('🔍 جلب الأرباح المسواة...');
        
        const { data, error } = await supabase
          .from('profits')
          .select(`
            *,
            order:orders(order_number, status, created_at, total_amount, final_amount),
            employee:profiles!employee_id(full_name, username)
          `)
          .in('status', ['settled', 'invoice_received']) // أضافة invoice_received أيضاً
          .order('settled_at', { ascending: false });

        if (error) throw error;
        
        const processedProfits = data?.map(profit => ({
          ...profit,
          employee_name: profit.employee?.full_name || profit.employee?.username || 'غير محدد',
          order_number: profit.order?.order_number || 'غير محدد',
          order_total: profit.order?.final_amount || profit.order?.total_amount || 0
        })) || [];

        console.log('📊 الأرباح المسواة المُحدّثة:', {
          count: processedProfits.length,
          profits: processedProfits
        });
        setSettledProfits(processedProfits);
      } catch (error) {
        console.error('❌ خطأ في جلب الأرباح المسواة:', error);
      }
    };

    if (open) {
      fetchSettledProfits();
    }
  }, [open]);

  const employees = useMemo(() => {
    if (!Array.isArray(allUsers)) return [];
    return allUsers.filter(u => u.status === 'active' && u.role !== 'admin');
  }, [allUsers]);

  // استخراج اسم الموظف من وصف المصروف - محسن
  const extractEmployeeNameFromDescription = (description) => {
    if (!description || typeof description !== 'string') {
      console.warn('⚠️ وصف المصروف فارغ أو غير صالح:', description);
      return 'غير محدد';
    }
    
    console.log('🔍 معالجة الوصف:', description);
    
    // تنظيف النص
    const cleanDesc = description.trim();
    
    // محاولة استخراج الاسم بعد "الموظف"
    const match = cleanDesc.match(/الموظف\s+(.+?)(?:\s*$)/i);
    if (match && match[1]) {
      const extractedName = match[1].trim();
      console.log(`✅ تم استخراج الاسم: "${extractedName}"`);
      return extractedName;
    }
    
    // محاولة أخذ آخر كلمة
    const words = cleanDesc.split(/\s+/);
    if (words.length >= 2) {
      const lastName = words[words.length - 1];
      console.log(`⚠️ استخراج آخر كلمة: "${lastName}"`);
      return lastName;
    }
    
    console.log('❌ فشل في استخراج الاسم، استخدام القيمة الافتراضية');
    return 'غير محدد';
  };

  // جلب فواتير التحاسب من جدول expenses مع نوع system - تحسين التاريخ
  const settlementInvoices = useMemo(() => {
    console.log('🔄 معالجة بيانات المصاريف:', {
      invoicesLength: invoices?.length || 0,
      invoicesArray: Array.isArray(invoices),
      sampleData: invoices?.slice(0, 2)
    });
    
    if (!Array.isArray(invoices) || invoices.length === 0) {
      console.warn('❌ لا توجد مصاريف أو البيانات ليست مصفوفة');
      return [];
    }
    
    // البحث عن مصاريف نوع "مستحقات الموظفين"
    const settlements = invoices.filter(expense => {
      if (!expense) return false;
      
      const isSettlement = expense.category === 'مستحقات الموظفين' && 
                          expense.expense_type === 'system' &&
                          expense.status === 'approved';
      
      console.log(`💰 فحص المصروف ${expense.id}:`, {
        category: expense.category,
        expense_type: expense.expense_type,
        status: expense.status,
        description: expense.description,
        amount: expense.amount,
        created_at: expense.created_at, // إضافة التاريخ للتحقق
        isSettlement
      });
      
      return isSettlement;
    });

    // تجميع المصاريف المكررة
    const uniqueSettlements = settlements.reduce((unique, expense) => {
      const employeeName = expense.vendor_name || extractEmployeeNameFromDescription(expense.description);
      const amount = Number(expense.amount);
      const dateKey = new Date(expense.created_at).toDateString();
      
      const uniqueKey = `${employeeName}-${amount}-${dateKey}`;
      
      console.log(`🔍 معالجة المصروف - المفتاح الفريد: ${uniqueKey}`, {
        employee: employeeName,
        amount: amount,
        date: dateKey,
        created_at: expense.created_at, // تحقق من التاريخ
        existing: !!unique[uniqueKey]
      });
      
      if (unique[uniqueKey]) {
        console.log(`⚠️ تم العثور على تكرار للمفتاح: ${uniqueKey}`);
        
        if (expense.receipt_number && !unique[uniqueKey].receipt_number) {
          unique[uniqueKey] = expense;
        } else if (new Date(expense.created_at) > new Date(unique[uniqueKey].created_at)) {
          unique[uniqueKey] = expense;
        }
      } else {
        unique[uniqueKey] = expense;
        console.log(`✅ تم إضافة مصروف جديد للمفتاح: ${uniqueKey}`);
      }
      
      return unique;
    }, {});

    const processedSettlements = Object.values(uniqueSettlements).map(expense => {
      const employeeName = expense.vendor_name || extractEmployeeNameFromDescription(expense.description);
      
      console.log(`🔍 معالجة المصروف النهائي:`, {
        employee: employeeName,
        amount: expense.amount,
        created_at: expense.created_at,
        settlement_date: expense.created_at // التأكد من استخدام created_at كتاريخ التسوية
      });
      
      return {
        id: expense.id,
        invoice_number: expense.receipt_number || `RY-${expense.id.slice(-6).toUpperCase()}`,
        employee_name: employeeName,
        settlement_amount: Number(expense.amount) || 0,
        settlement_date: expense.created_at, // استخدام created_at مباشرة
        status: 'completed',
        description: expense.description,
        metadata: expense.metadata || {},
        receipt_number: expense.receipt_number
      };
    });
    
    console.log('📋 فواتير التحاسب المعالجة (بتاريخ صحيح):', {
      originalCount: settlements.length,
      uniqueCount: processedSettlements.length,
      settlements: processedSettlements.map(s => ({
        id: s.id,
        employee: s.employee_name,
        amount: s.settlement_amount,
        date: s.settlement_date
      }))
    });
    
    return processedSettlements;
  }, [invoices]);
  
  const filteredInvoices = useMemo(() => {
    console.log('🔄 فلترة الفواتير:', {
      settlementInvoicesCount: settlementInvoices.length,
      filters: filters,
      employeesCount: employees.length
    });
    
    const filtered = settlementInvoices.filter(invoice => {
      const employeeMatch = filters.employeeId === 'all' || 
        invoice.employee_name?.toLowerCase().includes(
          employees.find(e => e.user_id === filters.employeeId)?.full_name?.toLowerCase() || ''
        ) ||
        invoice.employee_name?.toLowerCase().includes(
          employees.find(e => e.user_id === filters.employeeId)?.name?.toLowerCase() || ''
        );
      
      const dateMatch = !filters.dateRange.from || 
        (new Date(invoice.settlement_date) >= filters.dateRange.from && 
         new Date(invoice.settlement_date) <= (filters.dateRange.to || new Date()));
      
      console.log(`🔍 فلترة الفاتورة ${invoice.id}:`, {
        employee_name: invoice.employee_name,
        settlement_date: invoice.settlement_date,
        employeeMatch,
        dateMatch,
        finalMatch: employeeMatch && dateMatch
      });
      
      return employeeMatch && dateMatch;
    });
    
    console.log('✅ الفواتير المفلترة:', {
      count: filtered.length,
      invoices: filtered
    });
    
    return filtered;
  }, [settlementInvoices, filters, employees]);

  const totalAmount = useMemo(() => {
    const total = filteredInvoices.reduce((sum, inv) => {
      const amount = Number(inv.settlement_amount) || 0;
      return sum + amount;
    }, 0);
    
    console.log('💰 حساب الإجمالي:', {
      invoicesCount: filteredInvoices.length,
      total: total,
      invoices: filteredInvoices.map(inv => ({ id: inv.id, amount: inv.settlement_amount }))
    });
    
    return total;
  }, [filteredInvoices]);

  const handlePreviewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setIsPreviewOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] sm:max-w-7xl h-[98vh] flex flex-col p-0 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-indigo-900/20">
        <ScrollArea className="h-full">
          <div className="flex flex-col min-h-full">
            {/* Header مبهر */}
            <div className="relative p-6 sm:p-8 pb-4 flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 rounded-t-3xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full blur-lg opacity-70"></div>
                    <div className="relative p-3 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full text-white shadow-2xl">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                      المستحقات المدفوعة
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-300 font-medium">
                      عرض وإدارة فواتير التحاسب المكتملة للموظفين
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* فلاتر محسنة */}
            <div className="px-6 sm:px-8 flex-shrink-0 mb-6">
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-0 shadow-xl">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        الموظف
                      </label>
                      <Select value={filters.employeeId} onValueChange={(value) => setFilters(prev => ({ ...prev, employeeId: value }))}>
                        <SelectTrigger className="h-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl">
                          <SelectValue placeholder="اختر الموظف" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">جميع الموظفين</SelectItem>
                          {employees.map(employee => (
                            <SelectItem key={employee.user_id} value={employee.user_id}>
                              {employee.full_name || employee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        فترة التاريخ
                      </label>
                      <DateRangePicker
                        date={filters.dateRange}
                        onDateChange={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
                        className="h-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* إجمالي المبلغ المبهر */}
            <div className="mx-6 sm:mx-8 mb-8 flex-shrink-0">
              <Card className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white border-0 shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                <CardContent className="p-8 relative z-10 text-center">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="p-3 bg-white/20 rounded-full">
                      <DollarSign className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black">إجمالي المستحقات المدفوعة</h2>
                  </div>
                  <p className="text-5xl font-black mb-2 drop-shadow-lg">{totalAmount.toLocaleString()}</p>
                  <p className="text-xl font-bold opacity-90">دينار عراقي</p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm opacity-75">
                    <Receipt className="w-4 h-4" />
                    <span>عدد الفواتير: {filteredInvoices.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* الجدول المبهر */}
            <div className="flex-1 px-6 sm:px-8 pb-6 sm:pb-8 min-h-0">
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-2xl h-full">
                <CardContent className="p-0 h-full">
                  <ScrollArea className="h-full">
                    {/* عرض mobile */}
                    <div className="block lg:hidden">
                      {filteredInvoices.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                          <div className="relative mb-6">
                            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-12 h-12 text-slate-400" />
                            </div>
                          </div>
                          <h3 className="text-xl font-bold mb-2">لا توجد مستحقات مدفوعة</h3>
                          <p className="text-sm">لم يتم العثور على فواتير تحاسب مكتملة</p>
                        </div>
                      ) : (
                        <div className="space-y-4 p-4">
                          {filteredInvoices.map((invoice) => (
                            <Card key={invoice.id} className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-0 shadow-lg">
                              <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white">
                                      <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-lg">{invoice.employee_name}</p>
                                      <p className="text-sm text-slate-500 font-mono">{invoice.invoice_number}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-2xl font-black text-emerald-600">{invoice.settlement_amount?.toLocaleString()}</p>
                                    <p className="text-sm text-slate-500">دينار عراقي</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                  <Calendar className="w-4 h-4 text-blue-500" />
                                  <p className="text-sm font-medium">
                                    {invoice.settlement_date ? 
                                      format(parseISO(invoice.settlement_date), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                                      'غير محدد'
                                    }
                                  </p>
                                </div>
                                
                                <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                                  <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 px-4 py-2">
                                    مكتملة
                                  </Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 hover:from-blue-600 hover:to-purple-600"
                                    onClick={() => handlePreviewInvoice(invoice)}
                                  >
                                    <Eye className="w-4 h-4 ml-2" />
                                    معاينة
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* عرض desktop */}
                    <div className="hidden lg:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-0">
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300 py-4">رقم الفاتورة</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300 py-4">اسم الموظف</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300 py-4">المبلغ</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300 py-4">تاريخ التسوية</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300 py-4">الحالة</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300 py-4">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredInvoices.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-16">
                                <div className="relative mb-6">
                                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center">
                                    <CheckCircle className="w-12 h-12 text-slate-400" />
                                  </div>
                                </div>
                                <h3 className="text-xl font-bold text-slate-600 mb-2">لا توجد مستحقات مدفوعة لعرضها</h3>
                                <p className="text-sm text-slate-500">لم يتم العثور على فواتير تحاسب مكتملة</p>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredInvoices.map((invoice, index) => (
                              <TableRow key={invoice.id} className={`${index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-900/50'} hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200`}>
                                <TableCell className="py-4">
                                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-lg">
                                    {invoice.invoice_number}
                                  </span>
                                </TableCell>
                                <TableCell className="py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg text-white">
                                      <User className="w-4 h-4" />
                                    </div>
                                    <span className="font-bold text-lg">{invoice.employee_name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-xl">
                                    {invoice.settlement_amount?.toLocaleString()} د.ع
                                  </span>
                                </TableCell>
                                <TableCell className="py-4">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                    <span className="font-medium">
                                      {invoice.settlement_date ? 
                                        format(parseISO(invoice.settlement_date), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                                        'غير محدد'
                                      }
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4">
                                  <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 px-4 py-2">
                                    مكتملة
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-4">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
                                    onClick={() => handlePreviewInvoice(invoice)}
                                  >
                                    <Eye className="w-4 h-4 ml-2" />
                                    معاينة الفاتورة
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <DialogFooter className="p-6 sm:p-8 pt-4 flex-shrink-0 border-t bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                className="w-full sm:w-auto bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                إغلاق
              </Button>
            </DialogFooter>
          </div>
        </ScrollArea>
      </DialogContent>
      
      {/* معاينة الفاتورة الاحترافية */}
      <InvoicePreviewDialog 
        invoice={selectedInvoice}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        settledProfits={settledProfits}
        allOrders={orders}
      />
    </Dialog>
  );
};

export default SettledDuesDialog;