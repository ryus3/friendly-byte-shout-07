import React, { useState, useMemo } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { format, parseISO } from 'date-fns';
    import { ar } from 'date-fns/locale';
    import { DateRangePicker } from '@/components/ui/date-range-picker';
    
    const SettledDuesDialog = ({ open, onOpenChange, invoices, allUsers }) => {
      const [filters, setFilters] = useState({
        employeeId: 'all',
        dateRange: { from: undefined, to: undefined },
      });
    
      const employees = useMemo(() => {
        return allUsers.filter(u => u.role === 'employee' || u.role === 'deputy');
      }, [allUsers]);
    
      const filteredInvoices = useMemo(() => {
        return invoices.filter(invoice => {
          const employeeMatch = filters.employeeId === 'all' || invoice.employee_id === filters.employeeId;
          const dateMatch = !filters.dateRange.from || (new Date(invoice.settlement_date) >= filters.dateRange.from && new Date(invoice.settlement_date) <= (filters.dateRange.to || new Date()));
          return employeeMatch && dateMatch;
        });
      }, [invoices, filters]);

      const totalAmount = useMemo(() => {
        return filteredInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      }, [filteredInvoices]);
    
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>تفاصيل المستحقات المدفوعة للموظفين</DialogTitle>
              <DialogDescription>عرض وتحليل جميع فواتير التسوية التي تم دفعها للموظفين.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex flex-col sm:flex-row gap-2 p-2 border rounded-md">
                <Select value={filters.employeeId} onValueChange={(v) => setFilters(f => ({ ...f, employeeId: v }))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="فلترة حسب الموظف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الموظفين</SelectItem>
                    {employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <DateRangePicker
                  className="flex-1"
                  date={filters.dateRange}
                  onDateChange={(range) => setFilters(f => ({ ...f, dateRange: range || { from: undefined, to: undefined } }))}
                />
              </div>

               <div className="p-4 bg-secondary rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">الإجمالي للمحدد</p>
                    <p className="text-2xl font-bold text-primary">{totalAmount.toLocaleString()} د.ع</p>
                </div>
    
              <ScrollArea className="h-96 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الفاتورة</TableHead>
                      <TableHead>الموظف</TableHead>
                      <TableHead>تاريخ التسوية</TableHead>
                      <TableHead>المبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map(invoice => {
                      const employee = allUsers.find(u => u.id === invoice.employee_id);
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono">{invoice.invoice_number}</TableCell>
                          <TableCell>{employee?.full_name || 'غير معروف'}</TableCell>
                          <TableCell>{format(parseISO(invoice.settlement_date), 'd MMM yyyy', { locale: ar })}</TableCell>
                          <TableCell className="font-semibold text-green-500">{invoice.total_amount.toLocaleString()} د.ع</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };
    
    export default SettledDuesDialog;