import React, { useState, useEffect } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Trash2, PlusCircle } from 'lucide-react';
    import { format, parseISO } from 'date-fns';
    import { ar } from 'date-fns/locale';
    import { toast } from '@/hooks/use-toast';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
    import { DateRangePicker } from '@/components/ui/date-range-picker';
    import { supabase } from '@/lib/customSupabaseClient';
    
    const ExpensesDialog = ({ open, onOpenChange, expenses, addExpense, deleteExpense }) => {
      const [newExpense, setNewExpense] = useState({
        date: new Date().toISOString().slice(0, 16),
        category: 'تسويق',
        description: '',
        amount: '',
      });
      const [filters, setFilters] = useState({
        category: 'all',
        dateRange: { from: undefined, to: undefined }
      });
    
      const [expenseCategories, setExpenseCategories] = useState([
        'مشتريات', 'تسويق', 'رواتب', 'إيجار', 'فواتير', 'صيانة', 'شحن ونقل', 'تكاليف التحويل', 'مصاريف بنكية', 'أخرى'
      ]);
      const [newCategory, setNewCategory] = useState('');

      // تحميل فئات المصاريف من قاعدة البيانات
      useEffect(() => {
        const loadExpenseCategories = async () => {
          try {
            const { data, error } = await supabase
              .from('expenses')
              .select('description')
              .eq('category', 'فئات_المصاريف')
              .eq('expense_type', 'system');
            
            if (error) throw error;
            
            if (data && data.length > 0) {
              const categories = data.map(item => item.description).filter(Boolean);
              setExpenseCategories(categories);
            }
          } catch (error) {
            console.warn('تعذر تحميل فئات المصاريف من قاعدة البيانات:', error);
          }
        };

        if (open) {
          loadExpenseCategories();
        }
      }, [open]);
    
      // فلترة المصاريف لإظهار المصاريف الفعلية فقط (ليس الفئات النظامية)
      const filteredExpenses = expenses.filter(expense => {
        // استبعاد الفئات النظامية فقط وإظهار جميع المصاريف التشغيلية
        if (expense.expense_type === 'system' || expense.category === 'فئات_المصاريف') {
          return false;
        }
        
        const categoryMatch = filters.category === 'all' || expense.category === filters.category || expense.related_data?.category === filters.category;
        const dateMatch = !filters.dateRange.from || (new Date(expense.transaction_date) >= filters.dateRange.from && new Date(expense.transaction_date) <= (filters.dateRange.to || new Date()));
        
        return categoryMatch && dateMatch;
      });
    
      const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewExpense(prev => ({ ...prev, [name]: value }));
      };
    
      const handleSelectChange = (value) => {
        setNewExpense(prev => ({ ...prev, category: value }));
      };
    
      const handleAddExpense = async () => {
        if (!newExpense.description || !newExpense.amount || !newExpense.category) {
          toast({ title: 'خطأ', description: 'الرجاء ملء جميع الحقول.', variant: 'destructive' });
          return;
        }
        
        try {
          // التأكد من أن التاريخ صحيح
          const expenseDate = newExpense.date ? new Date(newExpense.date) : new Date();
          
          await addExpense({
            ...newExpense,
            amount: parseFloat(newExpense.amount),
            transaction_date: expenseDate.toISOString(), // تأكيد إضافة التاريخ والوقت الصحيح
            expense_type: 'operational' // تأكيد أنه مصروف تشغيلي وليس نظامي
          });
          
          // إعادة تعيين النموذج
          setNewExpense({
            date: new Date().toISOString().slice(0, 16),
            category: expenseCategories[0] || 'تسويق',
            description: '',
            amount: '',
          });
          
          toast({ title: 'نجح', description: 'تم إضافة المصروف بنجاح', variant: 'success' });
        } catch (error) {
          console.error('خطأ في إضافة المصروف:', error);
          toast({ title: 'خطأ', description: 'فشل في إضافة المصروف', variant: 'destructive' });
        }
      };

      const handleAddCategory = () => {
        if (newCategory.trim() && !expenseCategories.includes(newCategory.trim())) {
          setExpenseCategories(prev => [...prev, newCategory.trim()]);
          setNewCategory('');
          toast({ title: 'تم إضافة الفئة بنجاح', variant: 'success' });
        }
      };
    
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-4xl w-[95vw] sm:w-full z-[9999] bg-background border shadow-2xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col"
            style={{ 
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999
            }}
          >
            <DialogHeader className="flex-shrink-0 pb-4 border-b">
              <DialogTitle className="text-right text-lg sm:text-xl">إدارة المصاريف العامة</DialogTitle>
              <DialogDescription className="text-right text-sm">عرض وإضافة المصاريف التشغيلية للمتجر.</DialogDescription>
            </DialogHeader>
            
            {/* تخطيط موائم للهاتف */}
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 py-4 flex-1 overflow-hidden">
              {/* قسم إضافة مصروف جديد */}
              <div className="lg:col-span-1 space-y-4 p-3 sm:p-4 border rounded-lg max-h-[40vh] lg:max-h-full overflow-y-auto">
                <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> 
                  إضافة مصروف جديد
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="exp-date" className="text-xs sm:text-sm">التاريخ والوقت</Label>
                    <Input 
                      id="exp-date" 
                      type="datetime-local" 
                      name="date" 
                      value={newExpense.date} 
                      onChange={handleInputChange}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="exp-category" className="text-xs sm:text-sm">الفئة</Label>
                    <Select value={newExpense.category} onValueChange={handleSelectChange}>
                      <SelectTrigger id="exp-category" className="text-sm">
                        <SelectValue placeholder="اختر فئة" />
                      </SelectTrigger>
                      <SelectContent className="z-[10000] bg-popover border shadow-lg pointer-events-auto">
                        {expenseCategories.map(cat => <SelectItem key={cat} value={cat} className="text-sm">{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="exp-desc" className="text-xs sm:text-sm">الوصف</Label>
                    <Input 
                      id="exp-desc" 
                      name="description" 
                      value={newExpense.description} 
                      onChange={handleInputChange} 
                      placeholder="مثال: إعلان فيسبوك"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="exp-amount" className="text-xs sm:text-sm">المبلغ (د.ع)</Label>
                    <Input 
                      id="exp-amount" 
                      type="number" 
                      name="amount" 
                      value={newExpense.amount} 
                      onChange={handleInputChange} 
                      placeholder="50,000"
                      className="text-sm"
                    />
                  </div>
                  <Button onClick={handleAddExpense} className="w-full text-sm">إضافة المصروف</Button>
                  
                  {/* إضافة فئة جديدة */}
                  <div className="pt-4 border-t">
                    <h4 className="text-xs sm:text-sm font-medium mb-2">إضافة فئة جديدة</h4>
                    <div className="flex gap-2">
                      <Input
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="اسم الفئة الجديدة"
                        className="flex-1 text-sm"
                      />
                      <Button onClick={handleAddCategory} size="sm" className="text-xs">إضافة</Button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* قسم قائمة المصاريف */}
              <div className="lg:col-span-2 space-y-4 overflow-hidden flex flex-col flex-1">
                <h3 className="font-semibold text-sm sm:text-base flex-shrink-0">قائمة المصاريف</h3>
                
                {/* الفلاتر */}
                <div className="flex flex-col sm:flex-row gap-2 p-2 border rounded-md">
                  <Select value={filters.category} onValueChange={(v) => setFilters(f => ({...f, category: v}))}>
                    <SelectTrigger className="flex-1 text-sm">
                      <SelectValue placeholder="فلترة حسب الفئة" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000] bg-popover border shadow-lg pointer-events-auto">
                      <SelectItem value="all" className="text-sm">كل الفئات</SelectItem>
                      {expenseCategories.map(cat => <SelectItem key={cat} value={cat} className="text-sm">{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <DateRangePicker
                    className="flex-1"
                    date={filters.dateRange}
                    onDateChange={(range) => setFilters(f => ({...f, dateRange: range || {from: undefined, to: undefined}}))}
                  />
                </div>
                
                {/* جدول المصاريف */}
                <ScrollArea className="flex-1 border rounded-lg min-h-[200px] sm:min-h-[300px] max-h-[60vh] lg:max-h-[500px] bg-card">
                  <div className="p-2">
                    {/* عرض الهاتف */}
                    <div className="block sm:hidden space-y-2">
                      {filteredExpenses.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          لا توجد مصاريف للعرض
                        </div>
                      ) : (
                        filteredExpenses.map(expense => (
                          <div key={expense.id} className="bg-background border rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{expense.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {expense.category || 'غير محدد'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {expense.transaction_date 
                                    ? format(parseISO(expense.transaction_date), 'd MMM yyyy HH:mm', { locale: ar })
                                    : format(new Date(), 'd MMM yyyy HH:mm', { locale: ar })
                                  }
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-red-500 text-sm">{expense.amount.toLocaleString()} د.ع</p>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive p-1">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="z-[10001] bg-background border shadow-2xl w-[90vw] max-w-md">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-sm">تأكيد الحذف</AlertDialogTitle>
                                      <AlertDialogDescription className="text-xs">
                                        هل أنت متأكد من حذف هذا المصروف؟ ({expense.amount?.toLocaleString() || 0} د.ع)
                                        <br />لا يمكن التراجع عن هذا الإجراء.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="text-xs"
                                        onClick={async () => {
                                          try {
                                            await deleteExpense(expense.id);
                                          } catch (error) {
                                            console.error('خطأ في حذف المصروف:', error);
                                            toast({
                                              title: 'خطأ',
                                              description: 'فشل في حذف المصروف',
                                              variant: 'destructive'
                                            });
                                          }
                                        }}
                                      >
                                        حذف
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* عرض الديسكتوب */}
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">الوصف</TableHead>
                            <TableHead className="text-right">المبلغ</TableHead>
                            <TableHead className="text-right w-20">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredExpenses.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                لا توجد مصاريف للعرض
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredExpenses.map(expense => (
                              <TableRow key={expense.id}>
                                <TableCell>
                                  <p className="font-medium">{expense.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {expense.category || 'غير محدد'} - {
                                      expense.transaction_date 
                                        ? format(parseISO(expense.transaction_date), 'd MMM yyyy HH:mm', { locale: ar })
                                        : format(new Date(), 'd MMM yyyy HH:mm', { locale: ar })
                                    }
                                  </p>
                                </TableCell>
                                <TableCell className="font-semibold text-red-500">{expense.amount.toLocaleString()} د.ع</TableCell>
                                <TableCell>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="z-[10001] bg-background border shadow-2xl">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          هل أنت متأكد من حذف هذا المصروف؟ ({expense.amount?.toLocaleString() || 0} د.ع)
                                          <br />لا يمكن التراجع عن هذا الإجراء.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={async () => {
                                            try {
                                              await deleteExpense(expense.id);
                                            } catch (error) {
                                              console.error('خطأ في حذف المصروف:', error);
                                              toast({
                                                title: 'خطأ',
                                                description: 'فشل في حذف المصروف',
                                                variant: 'destructive'
                                              });
                                            }
                                          }}
                                        >
                                          حذف
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
            
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="text-sm">إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };
    
    export default ExpensesDialog;