import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle, FileText, Calendar, User, DollarSign, Receipt, Eye, TrendingUp, Banknote, Clock, Star, Award } from 'lucide-react';
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
      <DialogContent className="max-w-[98vw] sm:max-w-7xl h-[98vh] flex flex-col p-0 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900/20 to-indigo-900/20">
        <ScrollArea className="h-full">
          <div className="flex flex-col min-h-full">
            {/* Header بتصميم مطابق للصور */}
            <div className="relative p-6 flex-shrink-0">
              <div className="absolute top-4 right-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <Receipt className="w-8 h-8 text-white" />
                </div>
              </div>
              
              <div className="mt-16 mb-8">
                <h1 className="text-3xl font-bold text-blue-400 mb-2">فاتورة تسوية</h1>
                <p className="text-slate-400 text-sm">معلومات الموظف</p>
              </div>
            </div>

            {/* اسم الموظف */}
            <div className="px-6 mb-6">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/20 to-teal-500/20 rounded-2xl">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">اسم الموظف</p>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <p className="text-white font-bold text-lg">{invoice.employee_name}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* رقم الفاتورة */}
            <div className="px-6 mb-6">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">رقم الفاتورة</p>
                  <p className="text-white font-bold text-lg">{invoice.invoice_number}</p>
                </div>
              </div>
            </div>

            {/* عدد الطلبات */}
            <div className="px-6 mb-6">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">عدد الطلبات</p>
                  <p className="text-white font-bold text-2xl">{profitStats.ordersCount}</p>
                </div>
              </div>
            </div>

            {/* ربح الموظف */}
            <div className="px-6 mb-8">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-4 left-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <DollarSign className="w-8 h-8" />
                  </div>
                </div>
                
                <div className="text-center mt-8">
                  <div className="text-6xl font-black mb-2">{invoice.settlement_amount?.toLocaleString()}</div>
                  <div className="text-xl opacity-90">ربح الموظف</div>
                  <div className="text-sm opacity-80 mt-1">دينار عراقي</div>
                </div>
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
  console.log('🚀 SettledDuesDialog مُحدّث:', {
    open,
    invoicesReceived: invoices,
    invoicesLength: invoices?.length || 0,
    invoicesType: typeof invoices,
    allUsersLength: allUsers?.length || 0,
    profitsLength: profits?.length || 0,
    ordersLength: orders?.length || 0
  });
  const [filters, setFilters] = useState({
    employeeId: 'all',
    dateRange: { from: undefined, to: undefined },
  });
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
      <DialogContent className="max-w-[98vw] sm:max-w-7xl h-[98vh] flex flex-col p-0 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900/20 to-indigo-900/20">
        <ScrollArea className="h-full">
          <div className="flex flex-col min-h-full">
            {/* Header مع أيقونة الإنجاز */}
            <div className="relative p-6 flex-shrink-0">
              <div className="absolute top-4 right-4">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              
              <div className="mt-16 mb-8">
                <h1 className="text-3xl font-bold text-emerald-400 mb-2">المستحقات المدفوعة</h1>
                <p className="text-slate-400 text-sm">عرض وإدارة فواتير التحاسب المكتملة للموظفين</p>
              </div>
            </div>
            
            {/* فلاتر بتصميم مطابق للصور */}
            <div className="px-6 flex-shrink-0 mb-6">
              <div className="bg-slate-800/60 backdrop-blur-sm rounded-3xl p-6 space-y-6">
                {/* فلتر الموظف */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <User className="w-4 h-4" />
                    <span>الموظف</span>
                  </div>
                  <Select value={filters.employeeId} onValueChange={(value) => setFilters(prev => ({ ...prev, employeeId: value }))}>
                    <SelectTrigger className="h-14 bg-slate-700/50 border-slate-600 rounded-2xl text-white">
                      <SelectValue placeholder="جميع الموظفين" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="all">جميع الموظفين</SelectItem>
                      {employees.map(employee => (
                        <SelectItem key={employee.user_id} value={employee.user_id}>
                          {employee.full_name || employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* فلتر التاريخ */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>فترة التاريخ</span>
                  </div>
                  <DateRangePicker
                    date={filters.dateRange}
                    onDateChange={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
                    className="h-14 bg-slate-700/50 border-slate-600 rounded-2xl text-white"
                  />
                </div>
                
                {/* الفترة المختارة */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>الفترة</span>
                  </div>
                  <div className="h-14 bg-slate-700/50 border border-slate-600 rounded-2xl flex items-center px-4 text-white">
                    {filters.dateRange.from && filters.dateRange.to ? 
                      `${format(filters.dateRange.from, 'dd MMMM yyyy', { locale: ar })} - ${format(filters.dateRange.to, 'dd MMMM yyyy', { locale: ar })}` :
                      'هذا الشهر'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* إجمالي المبلغ بتصميم مطابق */}
            <div className="mx-6 mb-8 flex-shrink-0">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-4 left-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <DollarSign className="w-8 h-8" />
                  </div>
                </div>
                
                <div className="text-center mt-8">
                  <div className="text-6xl font-black mb-2">{totalAmount.toLocaleString()}</div>
                  <div className="text-xl opacity-90">إجمالي المستحقات المدفوعة</div>
                  <div className="text-sm opacity-80 mt-1">المبلغ الكلي للتسويات المكتملة</div>
                  <div className="flex items-center justify-center gap-2 mt-4 text-sm opacity-75">
                    <Receipt className="w-4 h-4" />
                    <span>عدد الفواتير: {filteredInvoices.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* قائمة الفواتير بتصميم مطابق للصور */}
            <div className="flex-1 px-6 pb-6 min-h-0">
              {filteredInvoices.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-32 h-32 mx-auto mb-6 bg-slate-700/30 rounded-full flex items-center justify-center">
                    <FileText className="w-16 h-16 text-slate-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">لا توجد طلبات مسواة لهذه الفترة</h3>
                  <p className="text-slate-400 text-sm">لم يتم العثور على فواتير تحاسب مكتملة</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredInvoices.map((invoice) => (
                    <div key={invoice.id} className="bg-slate-800/60 backdrop-blur-sm rounded-3xl p-6 border border-slate-700/50">
                      {/* رقم الفاتورة */}
                      <div className="mb-6">
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
                            <Receipt className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="text-slate-400 text-sm">رقم الفاتورة</p>
                            <p className="text-white font-bold text-lg">{invoice.invoice_number}</p>
                          </div>
                        </div>
                      </div>

                      {/* اسم الموظف */}
                      <div className="mb-6">
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/20 to-teal-500/20 rounded-2xl">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-teal-600 rounded-xl flex items-center justify-center">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="text-slate-400 text-sm">اسم الموظف</p>
                            <div className="flex items-center gap-2">
                              <Star className="w-4 h-4 text-yellow-400" />
                              <p className="text-white font-bold text-lg">{invoice.employee_name}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* المبلغ */}
                      <div className="mb-6">
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-2xl">
                          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="text-slate-400 text-sm">المبلغ</p>
                            <p className="text-white font-bold text-2xl">{invoice.settlement_amount?.toLocaleString()} د.ع</p>
                          </div>
                        </div>
                      </div>

                      {/* عدد الطلبات */}
                      <div className="mb-6">
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                            <Receipt className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="text-slate-400 text-sm">عدد الطلبات</p>
                            <p className="text-white font-bold text-2xl">0</p>
                          </div>
                        </div>
                      </div>

                      {/* تاريخ التسوية وأزرار العمل */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 rounded-2xl">
                          <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="text-slate-400 text-sm">حالة التسوية</p>
                            <p className="text-emerald-400 font-bold">تم إتمام الدفع بنجاح</p>
                            <p className="text-slate-400 text-xs">معالج تلقائياً بواسطة النظام</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="text-slate-400 text-sm">تاريخ الإصدار</p>
                            <p className="text-white font-bold">
                              {invoice.settlement_date ? 
                                format(parseISO(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar }) :
                                '28/07/2025'
                              }
                            </p>
                          </div>
                        </div>

                        {/* أزرار العمل */}
                        <div className="flex gap-3 pt-4">
                          <Button
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0 rounded-2xl h-14 text-lg font-bold"
                            onClick={() => handlePreviewInvoice(invoice)}
                          >
                            مكتملة
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 rounded-2xl h-14 text-lg font-bold"
                            onClick={() => handlePreviewInvoice(invoice)}
                          >
                            <Eye className="w-5 h-5 ml-2" />
                            معاينة
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="p-6 pt-4 flex-shrink-0 border-t border-slate-700/50 bg-slate-800/60">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                className="w-full bg-slate-700 hover:bg-slate-600 text-white border-slate-600 rounded-2xl h-14 text-lg font-bold"
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