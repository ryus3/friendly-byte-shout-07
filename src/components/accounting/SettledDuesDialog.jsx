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
    return allUsers.filter(u => u.role === 'employee' || u.role === 'deputy');
  }, [allUsers]);

  // جلب فواتير التحاسب من جدول expenses مع نوع system
  const settlementInvoices = useMemo(() => {
    if (!Array.isArray(invoices)) return [];
    
    // البحث عن مصاريف نوع "مستحقات الموظفين" 
    return invoices.filter(expense => 
      expense.category === 'مستحقات الموظفين' && 
      expense.expense_type === 'system' &&
      expense.status === 'approved'
    ).map(expense => ({
      id: expense.id,
      invoice_number: `SETTLEMENT-${expense.id.slice(-8)}`,
      employee_name: expense.description?.replace('دفع مستحقات الموظف ', '') || 'غير محدد',
      settlement_amount: expense.amount,
      settlement_date: expense.created_at,
      status: 'completed'
    }));
  }, [invoices]);
  
  const filteredInvoices = useMemo(() => {
    return settlementInvoices.filter(invoice => {
      const employeeMatch = filters.employeeId === 'all' || 
        invoice.employee_name?.includes(employees.find(e => e.id === filters.employeeId)?.full_name || '');
      const dateMatch = !filters.dateRange.from || 
        (new Date(invoice.settlement_date) >= filters.dateRange.from && 
         new Date(invoice.settlement_date) <= (filters.dateRange.to || new Date()));
      return employeeMatch && dateMatch;
    });
  }, [settlementInvoices, filters, employees]);

  const totalAmount = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + inv.settlement_amount, 0);
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
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name}
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
                            // فتح نافذة معاينة الفاتورة - سيتم تطويرها لاحقاً
                            alert(`فاتورة التحاسب: ${invoice.invoice_number}\nالموظف: ${invoice.employee_name}\nالمبلغ: ${invoice.settlement_amount.toLocaleString()} د.ع`);
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