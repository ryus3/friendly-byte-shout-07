import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle } from 'lucide-react';

const SettledDuesDialog = ({ open, onOpenChange, invoices, allUsers }) => {
  const [filters, setFilters] = useState({
    employeeId: 'all',
    dateRange: { from: undefined, to: undefined },
  });

  const employees = useMemo(() => {
    if (!Array.isArray(allUsers)) return [];
    return allUsers.filter(u => u.status === 'active' && u.role !== 'admin');
  }, [allUsers]);

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
        isSettlement
      });
      
      return isSettlement;
    }).map(expense => {
      // استخراج اسم الموظف من وصف المصروف
      const employeeName = extractEmployeeNameFromDescription(expense.description);
      
      console.log(`🔍 استخراج اسم الموظف من "${expense.description}": "${employeeName}"`);
      
      return {
        id: expense.id,
        invoice_number: `INV-${expense.id.slice(-8).toUpperCase()}`,
        employee_name: employeeName,
        settlement_amount: Number(expense.amount) || 0,
        settlement_date: expense.created_at,
        status: 'completed',
        description: expense.description,
        metadata: expense.metadata || {}
      };
    });
    
    console.log('📋 فواتير التحاسب المعالجة:', {
      count: settlements.length,
      settlements: settlements
    });
    
    return settlements;
  }, [invoices]);
  
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            المستحقات المدفوعة
          </DialogTitle>
          <DialogDescription>
            عرض وإدارة فواتير التحاسب المكتملة للموظفين
          </DialogDescription>
        </DialogHeader>
        
        {/* فلاتر */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">الموظف</label>
            <Select value={filters.employeeId} onValueChange={(value) => setFilters(prev => ({ ...prev, employeeId: value }))}>
              <SelectTrigger>
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
            />
          </div>
        </div>

        {/* إجمالي المبلغ */}
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center mb-4">
          <p className="text-sm text-muted-foreground">إجمالي المستحقات المدفوعة</p>
          <p className="text-2xl font-bold text-green-600">{totalAmount.toLocaleString()} د.ع</p>
        </div>

        {/* الجدول */}
        <ScrollArea className="h-[400px] w-full border rounded-lg">
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
                    لا توجد مستحقات مدفوعة لعرضها
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">{invoice.invoice_number}</TableCell>
                    <TableCell className="font-medium">{invoice.employee_name}</TableCell>
                    <TableCell className="text-green-600 font-bold">
                      {invoice.settlement_amount?.toLocaleString()} د.ع
                    </TableCell>
                    <TableCell>
                      {format(parseISO(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar })}
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
                          onClick={() => {
                            // فتح نافذة معاينة الفاتورة مع التفاصيل الكاملة
                            const details = `=== فاتورة التحاسب ===
رقم الفاتورة: ${invoice.invoice_number}
الموظف: ${invoice.employee_name}
المبلغ: ${invoice.settlement_amount.toLocaleString()} د.ع
تاريخ التسوية: ${format(parseISO(invoice.settlement_date), 'dd/MM/yyyy - HH:mm', { locale: ar })}
الوصف: ${invoice.description}
الحالة: تم التحاسب بنجاح`;
                            
                            alert(details);
                          }}
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
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettledDuesDialog;