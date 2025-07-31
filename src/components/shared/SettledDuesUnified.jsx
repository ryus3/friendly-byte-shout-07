import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { User, Calendar, Receipt, DollarSign } from 'lucide-react';
import useSettledDues from '@/hooks/useSettledDues';

/**
 * مكون موحد لعرض المستحقات المدفوعة
 * يستخدم في جميع أنحاء التطبيق
 */
const SettledDuesUnified = ({ 
  open, 
  onOpenChange, 
  dateRange = null,
  title = 'المستحقات المدفوعة'
}) => {
  const { settledDuesData, loading } = useSettledDues(dateRange);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedExpense, setSelectedExpense] = useState(null);

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center py-8">
            <div className="text-muted-foreground">جاري التحميل...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // فلترة البيانات حسب الموظف المحدد
  const filteredExpenses = selectedFilter === 'all' 
    ? settledDuesData.expenses
    : settledDuesData.byEmployee[selectedFilter]?.expenses || [];

  const employeeOptions = Object.entries(settledDuesData.byEmployee).map(([id, data]) => ({
    id,
    name: data.employeeName,
    total: data.total
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center flex items-center justify-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* ملخص سريع */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(settledDuesData.total)}
              </div>
              <div className="text-sm text-muted-foreground">إجمالي المدفوع</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {settledDuesData.count}
              </div>
              <div className="text-sm text-muted-foreground">عدد المدفوعات</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Object.keys(settledDuesData.byEmployee).length}
              </div>
              <div className="text-sm text-muted-foreground">عدد الموظفين</div>
            </CardContent>
          </Card>
        </div>

        {/* فلترة حسب الموظف */}
        <div className="mb-4">
          <Select value={selectedFilter} onValueChange={setSelectedFilter}>
            <SelectTrigger>
              <SelectValue placeholder="اختر موظف للفلترة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الموظفين</SelectItem>
              {employeeOptions.map(employee => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name} - {formatCurrency(employee.total)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* قائمة المدفوعات */}
        <div className="space-y-3">
          {filteredExpenses.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              لا توجد مستحقات مدفوعة للفترة المحددة
            </div>
          ) : (
            filteredExpenses.map((expense) => {
              const metadata = expense.metadata || {};
              const employeeName = metadata.employee_name || 'غير محدد';
              const employeeCode = metadata.employee_code || '';
              const invoiceNumber = expense.receipt_number || '';
              
              return (
                <Card key={expense.id} className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedExpense(expense)}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">{employeeName}</span>
                          {employeeCode && (
                            <Badge variant="outline" className="text-xs">
                              {employeeCode}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {expense.created_at && !isNaN(new Date(expense.created_at).getTime()) ? 
                            format(new Date(expense.created_at), 'dd MMMM yyyy - HH:mm', { locale: ar }) : 
                            'غير محدد'
                          }
                        </div>
                        
                        {invoiceNumber && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Receipt className="h-4 w-4" />
                            فاتورة: {invoiceNumber}
                          </div>
                        )}
                        
                        <div className="text-sm text-muted-foreground">
                          {expense.description}
                        </div>
                      </div>
                      
                      <div className="text-left">
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(expense.amount)}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          مدفوع
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* تفاصيل المدفوعة المحددة */}
        {selectedExpense && (
          <Dialog open={!!selectedExpense} onOpenChange={() => setSelectedExpense(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>تفاصيل المدفوعة</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">المبلغ</label>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(selectedExpense.amount)}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">الموظف</label>
                  <div>{selectedExpense.metadata?.employee_name || 'غير محدد'}</div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">التاريخ</label>
                  <div>{selectedExpense.created_at && !isNaN(new Date(selectedExpense.created_at).getTime()) ? 
                    format(new Date(selectedExpense.created_at), 'dd MMMM yyyy - HH:mm', { locale: ar }) : 
                    'غير محدد'
                  }</div>
                </div>
                
                {selectedExpense.receipt_number && (
                  <div>
                    <label className="text-sm font-medium">رقم الفاتورة</label>
                    <div>{selectedExpense.receipt_number}</div>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium">الوصف</label>
                  <div className="text-sm text-muted-foreground">
                    {selectedExpense.description}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SettledDuesUnified;