import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useVariants } from '@/contexts/VariantsContext';
import { useAuth } from '@/contexts/AuthContext';
import { X, Copy, Check, ChevronsUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

const MultiProductSelector = ({ selectedProducts, setSelectedProducts }) => {
    const { products } = useInventory();
    const [open, setOpen] = useState(false);

    console.log('Products in MultiProductSelector:', products?.length || 0);

    const handleSelect = (productId) => {
        setSelectedProducts(prev => 
            prev.includes(productId) 
            ? prev.filter(id => id !== productId)
            : [...prev, productId]
        );
    };

    const selectedProductNames = products
        ?.filter(p => selectedProducts.includes(p.id))
        ?.map(p => p.name)
        ?.join(', ') || '';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between min-h-[40px] h-auto"
                >
                    <span className="truncate text-right flex-1">
                        {selectedProducts.length > 0 
                            ? `${selectedProducts.length} منتج محدد${selectedProducts.length <= 3 ? ': ' + selectedProductNames : ''}` 
                            : products?.length > 0 ? "اختر المنتجات..." : "جاري تحميل المنتجات..."
                        }
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0 max-h-[300px] bg-background border shadow-lg" style={{ zIndex: 10000 }}>
                <Command>
                    <CommandInput placeholder="ابحث عن منتج..." />
                    <CommandList>
                        <CommandEmpty>
                            {products?.length === 0 ? "جاري تحميل المنتجات..." : "لم يتم العثور على منتج."}
                        </CommandEmpty>
                        <CommandGroup>
                            {(products || []).map((product) => (
                                <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={() => handleSelect(product.id)}
                                    className="flex items-center gap-2 cursor-pointer hover:bg-accent"
                                >
                                    <Checkbox
                                        checked={selectedProducts.includes(product.id)}
                                        readOnly
                                    />
                                    <span className="flex-1">{product.name}</span>
                                    {selectedProducts.includes(product.id) && (
                                        <Check className="h-4 w-4 text-primary" />
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

const ManageProfitsDialog = ({ employee, open, onOpenChange }) => {
  const { products, categories, departments, setEmployeeProfitRule, getEmployeeProfitRules } = useInventory();
  const { categories: variantCategories, departments: variantDepartments, productTypes, seasonsOccasions } = useVariants();
  const { allUsers } = useAuth();
  const [rules, setRules] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [multiProductProfit, setMultiProductProfit] = useState('');
  
  const employees = useMemo(() => {
    if (!Array.isArray(allUsers)) return [];
    return allUsers.filter(u => u.role === 'employee' || u.role === 'deputy' || u.role === 'manager');
  }, [allUsers]);

  // استخدام البيانات من VariantsContext للحصول على البيانات الحقيقية
  const realCategories = variantCategories || [];
  const realDepartments = variantDepartments || [];
  const realProductTypes = productTypes || [];
  const realSeasonsOccasions = seasonsOccasions || [];

  useEffect(() => {
    if (employee) {
      const employeeId = employee.user_id || employee.id;
      setRules(getEmployeeProfitRules(employeeId));
    }
  }, [employee, getEmployeeProfitRules, open]);

  if (!employee) return null;

  const handleRuleChange = (ruleType, targetId, profitAmount) => {
    const existingRuleIndex = rules.findIndex(r => r.rule_type === ruleType && r.target_id === targetId);
    let newRules = [...rules];
    const newRule = { 
      rule_type: ruleType, 
      target_id: targetId, 
      profit_amount: parseFloat(profitAmount) || 0, 
      employee_id: employee.user_id || employee.id 
    };

    if (existingRuleIndex > -1) {
      newRules[existingRuleIndex] = newRule;
    } else {
      newRules.push(newRule);
    }
    setRules(newRules);
  };
  
  const handleRemoveRule = (ruleType, targetId) => {
    setRules(rules.filter(r => !(r.rule_type === ruleType && r.target_id === targetId)));
  };

  const handleSave = () => {
    setEmployeeProfitRule(employee.user_id || employee.id, rules);
    toast({
      title: "تم حفظ قواعد الأرباح",
      description: `تم تحديث قواعد الأرباح للموظف ${employee.full_name || employee.username}.`,
      variant: 'default'
    });
    onOpenChange(false);
  };
  
  const getRuleValue = (ruleType, targetId) => {
    return rules.find(r => r.rule_type === ruleType && r.target_id === targetId)?.profit_amount || '';
  };
  const handleCopyRules = (fromEmployeeId) => {
    if (!fromEmployeeId || !employee) return;
    
    try {
      const rulesToCopy = getEmployeeProfitRules(fromEmployeeId);
      if (rulesToCopy && rulesToCopy.length > 0) {
        const copiedRules = rulesToCopy.map(rule => ({
          ...rule,
          employee_id: employee.user_id || employee.id
        }));
        setRules(copiedRules);
        toast({
          title: "تم نسخ القواعد",
          description: `تم نسخ ${copiedRules.length} قاعدة أرباح من الموظف المحدد.`,
        });
      } else {
        toast({
          title: "لا توجد قواعد",
          description: "الموظف المحدد ليس لديه قواعد أرباح لنسخها.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error copying rules:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء نسخ القواعد.",
        variant: "destructive"
      });
    }
  };

  const applyMultiProductProfit = () => {
    if (selectedProducts.length === 0 || !multiProductProfit) {
        toast({ title: "خطأ", description: "الرجاء تحديد منتجات ومبلغ ربح.", variant: "destructive" });
        return;
    }
    let newRules = [...rules];
    const profit = parseFloat(multiProductProfit);
    selectedProducts.forEach(productId => {
        const existingRuleIndex = newRules.findIndex(r => r.rule_type === 'product' && r.target_id === productId);
        if (existingRuleIndex > -1) {
            newRules[existingRuleIndex].profit_amount = profit;
        } else {
            newRules.push({ 
              rule_type: 'product', 
              target_id: productId, 
              profit_amount: profit, 
              employee_id: employee.user_id || employee.id 
            });
        }
    });
    setRules(newRules);
    setSelectedProducts([]);
    setMultiProductProfit('');
    toast({ title: "تم التطبيق", description: "تم تطبيق الربح على المنتجات المحددة.", variant: 'default' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-3xl lg:max-w-4xl h-[90vh] overflow-hidden flex flex-col bg-background border shadow-lg backdrop-blur-sm"
        style={{ zIndex: 9999 }}>
        <DialogHeader className="flex-shrink-0 pb-2 border-b">
          <DialogTitle className="text-base font-semibold">قواعد الأرباح: {employee?.full_name || employee?.username}</DialogTitle>
          <DialogDescription className="text-xs">
            إدارة قواعد الأرباح - نسب مئوية أو مبالغ ثابتة حسب المنتج أو التصنيف
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          {/* شريط نسخ القواعد */}
          <Card className="flex-shrink-0 mb-3">
            <CardContent className="p-3 flex flex-col sm:flex-row gap-3 items-center">
              <Label className="whitespace-nowrap text-sm">نسخ القواعد من:</Label>
              <Select onValueChange={handleCopyRules}>
                <SelectTrigger className="w-full sm:w-[200px] h-8">
                  <SelectValue placeholder="اختر موظفاً..." />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 10001 }} className="bg-background border shadow-lg">
                  {employees.filter(e => (e.user_id || e.id) !== (employee?.user_id || employee?.id)).map(emp => (
                    <SelectItem key={emp.user_id || emp.id} value={emp.user_id || emp.id}>
                      {emp.full_name || emp.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

            {/* التبويبات */}
            <Tabs defaultValue="product" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-5 mb-3 flex-shrink-0 h-8">
                <TabsTrigger value="product" className="text-xs px-1">المنتجات</TabsTrigger>
                <TabsTrigger value="category" className="text-xs px-1">التصنيفات</TabsTrigger>
                <TabsTrigger value="department" className="text-xs px-1">الأقسام</TabsTrigger>
                <TabsTrigger value="season" className="text-xs px-1">المواسم</TabsTrigger>
                <TabsTrigger value="general" className="text-xs px-1">عامة</TabsTrigger>
              </TabsList>
            
            {/* محتوى التبويبات مع scrolling صحيح */}
            <div className="flex-1 overflow-hidden">
              <TabsContent value="product" className="h-full overflow-y-auto mt-0 pr-2">
                <Card className="h-full">
                  <CardContent className="p-2 space-y-2">
                    {/* أداة تحديد عدة منتجات */}
                    <div className="p-3 border rounded-lg bg-secondary/50 space-y-2 sticky top-0 z-10 bg-background">
                      <h4 className="font-semibold text-sm">تحديد ربح لعدة منتجات</h4>
                      <MultiProductSelector selectedProducts={selectedProducts} setSelectedProducts={setSelectedProducts} />
                      <Input
                        type="number"
                        placeholder="مبلغ الربح (د.ع)"
                        value={multiProductProfit}
                        onChange={(e) => setMultiProductProfit(e.target.value)}
                        className="h-8"
                      />
                      <Button onClick={applyMultiProductProfit} className="w-full h-8 text-sm">تطبيق على المحدد</Button>
                    </div>
                    
                    {/* جدول المنتجات */}
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-5">
                          <TableRow className="text-xs">
                            <TableHead className="text-xs">المنتج</TableHead>
                            <TableHead className="text-xs">الربح (د.ع)</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(products || []).slice(0, 50).map(p => (
                            <TableRow key={p.id} className="text-xs">
                              <TableCell className="text-xs">{p.name}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  placeholder="مبلغ"
                                  value={getRuleValue('product', p.id)}
                                  onChange={(e) => handleRuleChange('product', p.id, e.target.value)}
                                  className="h-7 text-xs"
                                />
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveRule('product', p.id)} className="h-6 w-6 p-0">
                                  <X className="w-3 h-3 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!products || products.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                                جاري تحميل المنتجات...
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="category" className="h-full overflow-y-auto mt-0 pr-2">
                <Card className="h-full">
                  <CardContent className="p-2">
                    <div className="overflow-auto h-full">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-5">
                          <TableRow className="text-xs">
                            <TableHead className="text-xs">التصنيف</TableHead>
                            <TableHead className="text-xs">الربح (د.ع)</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                         {realCategories.map(cat => (
                           <TableRow key={cat.id} className="text-xs">
                             <TableCell className="text-xs">{cat.name}</TableCell>
                             <TableCell>
                               <Input
                                 type="number"
                                 placeholder="مبلغ"
                                 value={getRuleValue('category', cat.id)}
                                 onChange={(e) => handleRuleChange('category', cat.id, e.target.value)}
                                 className="h-7 text-xs"
                               />
                             </TableCell>
                             <TableCell>
                               <Button variant="ghost" size="sm" onClick={() => handleRemoveRule('category', cat.id)} className="h-6 w-6 p-0">
                                 <X className="w-3 h-3 text-destructive" />
                               </Button>
                             </TableCell>
                           </TableRow>
                         ))}
                         {realCategories.length === 0 && (
                           <TableRow>
                             <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                               جاري تحميل التصنيفات...
                             </TableCell>
                           </TableRow>
                         )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="department" className="h-full overflow-y-auto mt-0 pr-2">
                <Card className="h-full">
                  <CardContent className="p-2">
                    <div className="overflow-auto h-full">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-5">
                          <TableRow className="text-xs">
                            <TableHead className="text-xs">القسم</TableHead>
                            <TableHead className="text-xs">الربح (د.ع)</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                         {realDepartments.map(dept => (
                           <TableRow key={dept.id} className="text-xs">
                             <TableCell className="text-xs">{dept.name}</TableCell>
                             <TableCell>
                               <Input
                                 type="number"
                                 placeholder="مبلغ"
                                 value={getRuleValue('department', dept.id)}
                                 onChange={(e) => handleRuleChange('department', dept.id, e.target.value)}
                                 className="h-7 text-xs"
                               />
                             </TableCell>
                             <TableCell>
                               <Button variant="ghost" size="sm" onClick={() => handleRemoveRule('department', dept.id)} className="h-6 w-6 p-0">
                                 <X className="w-3 h-3 text-destructive" />
                               </Button>
                             </TableCell>
                           </TableRow>
                         ))}
                         {realDepartments.length === 0 && (
                           <TableRow>
                             <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                               جاري تحميل الأقسام...
                             </TableCell>
                           </TableRow>
                         )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="season" className="h-full overflow-y-auto mt-0 pr-2">
                <Card className="h-full">
                  <CardContent className="p-2">
                    <div className="overflow-auto h-full">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-5">
                          <TableRow className="text-xs">
                            <TableHead className="text-xs">الموسم/المناسبة</TableHead>
                            <TableHead className="text-xs">الربح (د.ع)</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                         {realSeasonsOccasions.map(season => (
                           <TableRow key={season.id} className="text-xs">
                             <TableCell className="text-xs">
                               <div className="flex items-center gap-2">
                                 <span>{season.name}</span>
                                 <span className="text-xs text-muted-foreground">({season.type})</span>
                               </div>
                             </TableCell>
                             <TableCell>
                               <Input
                                 type="number"
                                 placeholder="مبلغ"
                                 value={getRuleValue('season', season.id)}
                                 onChange={(e) => handleRuleChange('season', season.id, e.target.value)}
                                 className="h-7 text-xs"
                               />
                             </TableCell>
                             <TableCell>
                               <Button variant="ghost" size="sm" onClick={() => handleRemoveRule('season', season.id)} className="h-6 w-6 p-0">
                                 <X className="w-3 h-3 text-destructive" />
                               </Button>
                             </TableCell>
                           </TableRow>
                         ))}
                         {realSeasonsOccasions.length === 0 && (
                           <TableRow>
                             <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                               جاري تحميل المواسم والمناسبات...
                             </TableCell>
                           </TableRow>
                         )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            
            <TabsContent value="general" className="flex-1 overflow-y-auto min-h-0 mt-0">
              <Card>
                <CardContent className="p-2 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-2 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <h4 className="font-semibold text-blue-700 dark:text-blue-300 text-sm">نسبة الربح العامة</h4>
                      <Input
                        type="number"
                        placeholder="نسبة مئوية (%)"
                        value={getRuleValue('general', 'percentage')}
                        onChange={(e) => handleRuleChange('general', 'percentage', e.target.value)}
                        className="h-7 text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        تُطبق على المنتجات بدون قواعد محددة
                      </p>
                    </div>
                    
                    <div className="space-y-2 p-3 border rounded-lg bg-green-50 dark:bg-green-950/30">
                      <h4 className="font-semibold text-green-700 dark:text-green-300 text-sm">مبلغ ثابت عام</h4>
                      <Input
                        type="number"
                        placeholder="مبلغ ثابت (د.ع)"
                        value={getRuleValue('general', 'fixed')}
                        onChange={(e) => handleRuleChange('general', 'fixed', e.target.value)}
                        className="h-7 text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        مبلغ ثابت لكل عملية بيع
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950/30">
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300 text-sm mb-2">إحصائيات القواعد</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                       <div className="text-center">
                         <div className="font-bold text-sm text-purple-600">{rules.filter(r => r.rule_type === 'product').length}</div>
                         <div className="text-muted-foreground">منتجات</div>
                       </div>
                       <div className="text-center">
                         <div className="font-bold text-sm text-blue-600">{rules.filter(r => r.rule_type === 'category').length}</div>
                         <div className="text-muted-foreground">تصنيفات</div>
                       </div>
                       <div className="text-center">
                         <div className="font-bold text-sm text-green-600">{rules.filter(r => r.rule_type === 'general').length}</div>
                         <div className="text-muted-foreground">عامة</div>
                       </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            </div>
          </Tabs>
        </div>
        
        <DialogFooter className="flex-shrink-0 pt-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs h-8 px-3">إلغاء</Button>
          <Button onClick={handleSave} className="text-xs h-8 px-3">حفظ التغييرات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageProfitsDialog;