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
        // استبعاد الفئات النظامية وإظهار المصاريف التشغيلية الفعلية فقط
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
          <DialogContent className="max-w-4xl w-[95vw] sm:w-full z-[9999] bg-background border shadow-2xl max-h-[95vh] overflow-hidden flex flex-col"
            style={{ 
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999
            }}
          >
            <DialogHeader className="flex-shrink-0 pb-4 border-b">
              <DialogTitle className="text-right">إدارة المصاريف العامة</DialogTitle>
              <DialogDescription className="text-right">عرض وإضافة المصاريف التشغيلية للمتجر.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 flex-1 overflow-hidden">
              <div className="md:col-span-1 space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold flex items-center gap-2"><PlusCircle className="w-5 h-5 text-primary" /> إضافة مصروف جديد</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="exp-date">التاريخ والوقت</Label>
                    <Input id="exp-date" type="datetime-local" name="date" value={newExpense.date} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor="exp-category">الفئة</Label>
                    <Select value={newExpense.category} onValueChange={handleSelectChange}>
                      <SelectTrigger id="exp-category">
                        <SelectValue placeholder="اختر فئة" />
                      </SelectTrigger>
                       <SelectContent className="z-[10000] bg-popover border shadow-lg pointer-events-auto">
                        {expenseCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="exp-desc">الوصف</Label>
                    <Input id="exp-desc" name="description" value={newExpense.description} onChange={handleInputChange} placeholder="مثال: إعلان فيسبوك" />
                  </div>
                  <div>
                    <Label htmlFor="exp-amount">المبلغ (د.ع)</Label>
                    <Input id="exp-amount" type="number" name="amount" value={newExpense.amount} onChange={handleInputChange} placeholder="50,000" />
                  </div>
                  <Button onClick={handleAddExpense} className="w-full">إضافة المصروف</Button>
                  
                  {/* إضافة فئة جديدة */}
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">إضافة فئة جديدة</h4>
                    <div className="flex gap-2">
                      <Input
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="اسم الفئة الجديدة"
                        className="flex-1"
                      />
                      <Button onClick={handleAddCategory} size="sm">إضافة</Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 space-y-4 overflow-hidden flex flex-col">
                <h3 className="font-semibold">قائمة المصاريف</h3>
                <div className="flex flex-col sm:flex-row gap-2 p-2 border rounded-md">
                    <Select value={filters.category} onValueChange={(v) => setFilters(f => ({...f, category: v}))}>
                        <SelectTrigger className="flex-1">
                            <SelectValue placeholder="فلترة حسب الفئة" />
                        </SelectTrigger>
                        <SelectContent className="z-[10000] bg-popover border shadow-lg pointer-events-auto">
                            <SelectItem value="all">كل الفئات</SelectItem>
                            {expenseCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <DateRangePicker
                        className="flex-1"
                        date={filters.dateRange}
                        onDateChange={(range) => setFilters(f => ({...f, dateRange: range || {from: undefined, to: undefined}}))}
                    />
                </div>
                <ScrollArea className="flex-1 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الوصف</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map(expense => (
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
                                <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };
    
    export default ExpensesDialog;