import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle, FileText, Calendar, User, DollarSign, Receipt, ShoppingCart } from 'lucide-react';

// مكون معاينة الفاتورة الاحترافي
const InvoicePreviewDialog = ({ invoice, open, onOpenChange }) => {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <ScrollArea className="h-full max-h-[80vh]">
          <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            {/* Header */}
            <div className="text-center mb-6 pb-4 border-b-2 border-green-200">
              <h1 className="text-3xl font-bold text-green-700 mb-2">فاتورة تسوية</h1>
              <p className="text-lg text-green-600">مستحقات الموظف</p>
            </div>

            {/* Invoice Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Right Column */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg">
                  <Receipt className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">رقم الفاتورة</p>
                    <p className="font-bold text-lg">{invoice.invoice_number}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">اسم الموظف</p>
                    <p className="font-bold text-lg">{invoice.employee_name}</p>
                  </div>
                </div>
              </div>

              {/* Left Column */}
              <div className="space-y-4">
                 <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg">
                   <Calendar className="w-5 h-5 text-purple-600" />
                   <div>
                     <p className="text-sm text-gray-600">تاريخ التسوية</p>
                     <p className="font-bold text-lg">
                       {invoice.settlement_date ? 
                         format(parseISO(invoice.settlement_date), 'dd MMMM yyyy', { locale: ar }) :
                         format(new Date(), 'dd MMMM yyyy', { locale: ar })
                       }
                     </p>
                     <p className="text-sm text-gray-500">
                       {invoice.settlement_date ? 
                         format(parseISO(invoice.settlement_date), 'HH:mm', { locale: ar }) :
                         format(new Date(), 'HH:mm', { locale: ar })
                       }
                     </p>
                   </div>
                 </div>

                <div className="flex items-center gap-3 p-3 bg-green-100 rounded-lg border-2 border-green-200">
                  <DollarSign className="w-6 h-6 text-green-700" />
                  <div>
                    <p className="text-sm text-green-700">إجمالي المبلغ</p>
                    <p className="font-bold text-2xl text-green-800">
                      {invoice.settlement_amount?.toLocaleString()} د.ع
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                وصف التسوية
              </h3>
              <div className="p-4 bg-white/70 rounded-lg border">
                <p className="text-gray-700">{invoice.description}</p>
              </div>
            </div>

            {/* Orders Details */}
            {invoice.metadata?.orders_details && invoice.metadata.orders_details.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  تفاصيل الطلبات المدفوعة ({invoice.metadata.orders_details.length} طلب)
                </h3>
                <div className="grid gap-3">
                  {invoice.metadata.orders_details.map((order, index) => (
                    <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold text-blue-800">#{order.order_number}</p>
                        <Badge className="bg-blue-500 text-white">{order.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">المبلغ الإجمالي: </span>
                          <span className="font-semibold">{order.total_amount?.toLocaleString()} د.ع</span>
                        </div>
                        <div>
                          <span className="text-gray-600">ربح الموظف: </span>
                          <span className="font-semibold text-green-600">{order.employee_profit?.toLocaleString()} د.ع</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-600">العميل: </span>
                          <span className="font-semibold">{order.customer_name}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-600">تاريخ الطلب: </span>
                          <span className="font-semibold">
                            {format(parseISO(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            {invoice.metadata && Object.keys(invoice.metadata).length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3">تفاصيل إضافية</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {invoice.metadata.employee_name && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">اسم الموظف المدرج</p>
                      <p className="font-semibold">{invoice.metadata.employee_name}</p>
                    </div>
                  )}
                  {invoice.metadata.orders_count && (
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-orange-600">عدد الطلبات المسواة</p>
                      <p className="font-semibold">{invoice.metadata.orders_count}</p>
                    </div>
                  )}
                  {invoice.metadata.settlement_type && (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">نوع التسوية</p>
                      <p className="font-semibold">
                        {invoice.metadata.settlement_type === 'employee_profit' ? 'أرباح موظف' : invoice.metadata.settlement_type}
                      </p>
                    </div>
                  )}
                  {invoice.receipt_number && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">رقم الإيصال</p>
                      <p className="font-semibold">{invoice.receipt_number}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="text-center pt-4 border-t border-green-200">
              <Badge className="bg-green-500 text-white px-6 py-2 text-lg">
                ✅ تسوية مكتملة
              </Badge>
              <p className="text-sm text-gray-600 mt-2">تم إتمام التسوية بنجاح</p>
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SettledDuesDialog = ({ open, onOpenChange, invoices, allUsers }) => {
  console.log('🚀 SettledDuesDialog مُحدّث:', {
    open,
    invoicesReceived: invoices,
    invoicesLength: invoices?.length || 0,
    invoicesType: typeof invoices,
    allUsersLength: allUsers?.length || 0
  });
  const [filters, setFilters] = useState({
    employeeId: 'all',
    dateRange: { from: undefined, to: undefined },
  });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const employees = useMemo(() => {
    if (!Array.isArray(allUsers)) return [];
    return allUsers.filter(u => u.status === 'active' && u.role !== 'admin');
  }, [allUsers]);

  // استخراج اسم الموظف من وصف المصروف - مبسط ومحسن
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

  // جلب فواتير التحاسب من جدول expenses مع نوع system
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
    
    // البحث عن مصاريف نوع "مستحقات الموظفين" - إزالة التكرار الشديد
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
        receipt_number: expense.receipt_number,
        vendor_name: expense.vendor_name,
        isSettlement
      });
      
      return isSettlement;
    });

    // تجميع المصاريف المكررة بأقوى آلية للتخلص من التكرار
    const uniqueSettlements = settlements.reduce((unique, expense) => {
      // استخدام مفاتيح متعددة للتأكد من عدم التكرار
      const employeeName = expense.vendor_name || extractEmployeeNameFromDescription(expense.description);
      const amount = Number(expense.amount);
      const dateKey = new Date(expense.created_at).toDateString();
      
      // مفتاح فريد يجمع الموظف والمبلغ واليوم
      const uniqueKey = `${employeeName}-${amount}-${dateKey}`;
      
      console.log(`🔍 معالجة المصروف - المفتاح الفريد: ${uniqueKey}`, {
        employee: employeeName,
        amount: amount,
        date: dateKey,
        receipt_number: expense.receipt_number,
        existing: !!unique[uniqueKey]
      });
      
      // إذا كان هذا المفتاح موجود، اختر الأحدث أو الذي له receipt_number
      if (unique[uniqueKey]) {
        console.log(`⚠️ تم العثور على تكرار للمفتاح: ${uniqueKey}`);
        
        // اختر الأحدث أو الذي له receipt_number
        if (expense.receipt_number && !unique[uniqueKey].receipt_number) {
          unique[uniqueKey] = expense;
          console.log(`✅ تم استبدال المصروف بالأحدث الذي له receipt_number`);
        } else if (new Date(expense.created_at) > new Date(unique[uniqueKey].created_at)) {
          unique[uniqueKey] = expense;
          console.log(`✅ تم استبدال المصروف بالأحدث زمنياً`);
        }
      } else {
        unique[uniqueKey] = expense;
        console.log(`✅ تم إضافة مصروف جديد للمفتاح: ${uniqueKey}`);
      }
      
      return unique;
    }, {});

    const processedSettlements = Object.values(uniqueSettlements).map(expense => {
      // استخراج اسم الموظف من وصف المصروف أو vendor_name
      const employeeName = expense.vendor_name || extractEmployeeNameFromDescription(expense.description);
      
      console.log(`🔍 معالجة المصروف النهائي - الموظف: "${employeeName}", المبلغ: ${expense.amount}`);
      
      return {
        id: expense.id,
        invoice_number: expense.receipt_number || `RY-${expense.id.slice(-6).toUpperCase()}`,
        employee_name: employeeName,
        settlement_amount: Number(expense.amount) || 0,
        settlement_date: expense.created_at, // التاريخ الحقيقي من قاعدة البيانات
        status: 'completed',
        description: expense.description,
        metadata: expense.metadata || {},
        receipt_number: expense.receipt_number
      };
    });
    
    console.log('📋 فواتير التحاسب المعالجة (بدون تكرار نهائياً):', {
      originalCount: settlements.length,
      uniqueCount: processedSettlements.length,
      removedDuplicates: settlements.length - processedSettlements.length,
      settlements: processedSettlements
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
      <DialogContent className="max-w-[95vw] sm:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col min-h-full">
            <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <CheckCircle className="w-5 h-5 text-green-500" />
                المستحقات المدفوعة
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                عرض وإدارة فواتير التحاسب المكتملة للموظفين
              </DialogDescription>
            </DialogHeader>
            
            {/* فلاتر */}
            <div className="px-4 sm:px-6 flex-shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الموظف</label>
                  <Select value={filters.employeeId} onValueChange={(value) => setFilters(prev => ({ ...prev, employeeId: value }))}>
                    <SelectTrigger className="h-9 sm:h-10">
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
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">فترة التاريخ</label>
                  <DateRangePicker
                    date={filters.dateRange}
                    onDateChange={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
                    className="h-9 sm:h-10"
                  />
                </div>
              </div>
            </div>

            {/* إجمالي المبلغ */}
            <div className="mx-4 sm:mx-6 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center mb-4 flex-shrink-0">
              <p className="text-xs sm:text-sm text-muted-foreground">إجمالي المستحقات المدفوعة</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{totalAmount.toLocaleString()} د.ع</p>
              <p className="text-xs text-muted-foreground mt-1">عدد الفواتير: {filteredInvoices.length}</p>
            </div>

            {/* الجدول - responsive */}
            <div className="flex-1 px-4 sm:px-6 pb-4 sm:pb-6 min-h-0">
              <div className="h-full border rounded-lg overflow-hidden">
                <ScrollArea className="h-full">
                  {/* عرض mobile */}
                  <div className="block sm:hidden">
                    {filteredInvoices.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">لا توجد مستحقات مدفوعة</p>
                        <p className="text-sm">لم يتم العثور على فواتير تحاسب مكتملة</p>
                      </div>
                    ) : (
                      <div className="space-y-3 p-3">
                        {filteredInvoices.map((invoice) => (
                          <Card key={invoice.id} className="p-4 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-sm">{invoice.employee_name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{invoice.invoice_number}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-green-600">{invoice.settlement_amount?.toLocaleString()} د.ع</p>
                                <p className="text-xs text-muted-foreground">
                                  {invoice.settlement_date ? 
                                    format(parseISO(invoice.settlement_date), 'dd/MM/yyyy HH:mm', { locale: ar }) :
                                    'غير محدد'
                                  }
                                </p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                مكتملة
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-8"
                                onClick={() => handlePreviewInvoice(invoice)}
                              >
                                معاينة
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* عرض desktop */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>رقم الفاتورة</TableHead>
                          <TableHead>اسم الموظف</TableHead>
                          <TableHead>المبلغ</TableHead>
                          <TableHead>تاريخ التسوية</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead>الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                              <p className="text-lg font-medium">لا توجد مستحقات مدفوعة لعرضها</p>
                              <p className="text-sm">لم يتم العثور على فواتير تحاسب مكتملة</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredInvoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                              <TableCell className="font-medium">{invoice.employee_name}</TableCell>
                              <TableCell className="text-green-600 font-bold">
                                {invoice.settlement_amount?.toLocaleString()} د.ع
                              </TableCell>
                              <TableCell>
                                {invoice.settlement_date ? 
                                  format(parseISO(invoice.settlement_date), 'dd/MM/yyyy HH:mm', { locale: ar }) :
                                  'غير محدد'
                                }
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-green-100 text-green-800 border-green-200">
                                  مكتملة
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePreviewInvoice(invoice)}
                                  >
                                    معاينة الفاتورة
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter className="p-4 sm:p-6 pt-2 flex-shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
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
      />
    </Dialog>
  );
};

export default SettledDuesDialog;