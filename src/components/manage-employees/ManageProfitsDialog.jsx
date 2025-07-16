import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { X, Copy, Check, ChevronsUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const MultiProductSelector = ({ selectedProducts, setSelectedProducts }) => {
    const { products } = useInventory();
    const [open, setOpen] = useState(false);

    const handleSelect = (productId) => {
        setSelectedProducts(prev => 
            prev.includes(productId) 
            ? prev.filter(id => id !== productId)
            : [...prev, productId]
        );
    }

    const selectedProductNames = products
        .filter(p => selectedProducts.includes(p.id))
        .map(p => p.name)
        .join(', ');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    <span className="truncate">{selectedProducts.length > 0 ? `${selectedProducts.length} منتج محدد` : "اختر المنتجات..."}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="ابحث عن منتج..." />
                    <CommandList>
                    <CommandEmpty>لم يتم العثور على منتج.</CommandEmpty>
                    <CommandGroup>
                        {products.map((product) => (
                            <CommandItem
                                key={product.id}
                                onSelect={() => handleSelect(product.id)}
                            >
                                <Checkbox
                                    className="mr-2"
                                    checked={selectedProducts.includes(product.id)}
                                    onCheckedChange={() => handleSelect(product.id)}
                                />
                                {product.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

const ManageProfitsDialog = ({ employee, open, onOpenChange }) => {
  const { products, setEmployeeProfitRule, getEmployeeProfitRules } = useInventory();
  const { allUsers } = useAuth();
  const [rules, setRules] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [multiProductProfit, setMultiProductProfit] = useState('');
  
  const employees = useMemo(() => {
    if (!Array.isArray(allUsers)) return [];
    return allUsers.filter(u => u.role === 'employee' || u.role === 'deputy');
  }, [allUsers]);

  useEffect(() => {
    if (employee) {
      setRules(getEmployeeProfitRules(employee.id));
    }
  }, [employee, getEmployeeProfitRules, open]);

  if (!employee) return null;

  const handleRuleChange = (ruleType, targetId, profitAmount) => {
    const existingRuleIndex = rules.findIndex(r => r.ruleType === ruleType && r.targetId === targetId);
    let newRules = [...rules];
    const newRule = { ruleType, targetId, profitAmount: parseFloat(profitAmount) || 0, employeeId: employee.id };

    if (existingRuleIndex > -1) {
      newRules[existingRuleIndex] = newRule;
    } else {
      newRules.push(newRule);
    }
    setRules(newRules);
  };
  
  const handleRemoveRule = (ruleType, targetId) => {
    setRules(rules.filter(r => !(r.ruleType === ruleType && r.targetId === targetId)));
  };

  const handleSave = () => {
    setEmployeeProfitRule(employee.id, rules);
    toast({
      title: "تم حفظ قواعد الأرباح",
      description: `تم تحديث قواعد الأرباح للموظف ${employee.fullName}.`,
      variant: 'success'
    });
    onOpenChange(false);
  };
  
  const getRuleValue = (ruleType, targetId) => {
    return rules.find(r => r.ruleType === ruleType && r.targetId === targetId)?.profitAmount || '';
  };
  
  const productCategories = [...new Set(products.map(p => p.categories?.main_category).filter(Boolean))];
  
  const handleCopyRules = (fromEmployeeId) => {
    if (!fromEmployeeId) return;
    const rulesToCopy = getEmployeeProfitRules(fromEmployeeId);
    setRules(rulesToCopy);
    toast({
      title: "تم نسخ القواعد",
      description: `تم نسخ قواعد الأرباح من الموظف المحدد.`,
      variant: 'success'
    });
  };

  const applyMultiProductProfit = () => {
    if (selectedProducts.length === 0 || !multiProductProfit) {
        toast({ title: "خطأ", description: "الرجاء تحديد منتجات ومبلغ ربح.", variant: "destructive" });
        return;
    }
    let newRules = [...rules];
    const profit = parseFloat(multiProductProfit);
    selectedProducts.forEach(productId => {
        const existingRuleIndex = newRules.findIndex(r => r.ruleType === 'product' && r.targetId === productId);
        if (existingRuleIndex > -1) {
            newRules[existingRuleIndex].profitAmount = profit;
        } else {
            newRules.push({ ruleType: 'product', targetId: productId, profitAmount: profit, employeeId: employee.id });
        }
    });
    setRules(newRules);
    setSelectedProducts([]);
    setMultiProductProfit('');
    toast({ title: "تم التطبيق", description: "تم تطبيق الربح على المنتجات المحددة.", variant: 'success' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-3 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl">قواعد الأرباح: {employee.full_name || employee.username}</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            إدارة قواعد الأرباح الخاصة بالموظف - نسب مئوية أو مبالغ ثابتة حسب المنتج أو التصنيف مع حساب دقيق للمستحقات.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-3 sm:space-y-4">
            <Card>
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
                    <Label className="whitespace-nowrap">نسخ القواعد من:</Label>
                    <Select onValueChange={handleCopyRules}>
                        <SelectTrigger className="w-full sm:w-[250px]">
                            <SelectValue placeholder="اختر موظفاً لنسخ قواعده..." />
                        </SelectTrigger>
                        <SelectContent>
                            {employees.filter(e => e.user_id !== employee.user_id).map(emp => (
                                 <SelectItem key={emp.user_id} value={emp.user_id}>{emp.full_name || emp.username}</SelectItem>
                             ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

          <Tabs defaultValue="product" className="w-full flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-3 mb-3 sm:mb-4 flex-shrink-0">
              <TabsTrigger value="product" className="text-xs sm:text-sm px-2 sm:px-4">حسب المنتج</TabsTrigger>
              <TabsTrigger value="category" className="text-xs sm:text-sm px-2 sm:px-4">حسب التصنيف</TabsTrigger>
              <TabsTrigger value="general" className="text-xs sm:text-sm px-2 sm:px-4">القواعد العامة</TabsTrigger>
            </TabsList>
            <TabsContent value="product" className="flex-1 overflow-y-auto min-h-0 mt-0">
              <Card className="h-full">
                <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4 h-full overflow-y-auto">
                  <div className="p-4 border rounded-lg bg-secondary/50 space-y-3">
                      <h4 className="font-semibold">تحديد ربح لعدة منتجات</h4>
                      <MultiProductSelector selectedProducts={selectedProducts} setSelectedProducts={setSelectedProducts} />
                      <Input
                          type="number"
                          placeholder="مبلغ الربح (د.ع)"
                          value={multiProductProfit}
                          onChange={(e) => setMultiProductProfit(e.target.value)}
                      />
                      <Button onClick={applyMultiProductProfit} className="w-full">تطبيق على المحدد</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المنتج</TableHead>
                        <TableHead>الربح المحدد (د.ع)</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map(p => (
                        <TableRow key={p.id}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              placeholder="مبلغ الربح"
                              value={getRuleValue('product', p.id)}
                              onChange={(e) => handleRuleChange('product', p.id, e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRule('product', p.id)}>
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="category">
               <Card>
                <CardContent className="p-4">
                   <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التصنيف</TableHead>
                        <TableHead>الربح المحدد (د.ع)</TableHead>
                         <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productCategories.map(cat => (
                        <TableRow key={cat}>
                          <TableCell>{cat}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              placeholder="مبلغ الربح"
                              value={getRuleValue('category', cat)}
                              onChange={(e) => handleRuleChange('category', cat, e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRule('category', cat)}>
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="general">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <h4 className="font-semibold text-blue-700 dark:text-blue-300">نسبة الربح العامة</h4>
                      <Input
                        type="number"
                        placeholder="نسبة مئوية عامة (%)"
                        value={getRuleValue('general', 'percentage')}
                        onChange={(e) => handleRuleChange('general', 'percentage', e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        تُطبق على جميع المنتجات التي لا تحتوي على قواعد محددة
                      </p>
                    </div>
                    
                    <div className="space-y-3 p-4 border rounded-lg bg-green-50 dark:bg-green-950/30">
                      <h4 className="font-semibold text-green-700 dark:text-green-300">مبلغ ثابت عام</h4>
                      <Input
                        type="number"
                        placeholder="مبلغ ثابت (د.ع)"
                        value={getRuleValue('general', 'fixed')}
                        onChange={(e) => handleRuleChange('general', 'fixed', e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        مبلغ ثابت يُضاف لكل عملية بيع بغض النظر عن المنتج
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/30">
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300">معلومات إضافية</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-lg text-purple-600">{rules.filter(r => r.ruleType === 'product').length}</div>
                        <div className="text-muted-foreground">قواعد المنتجات</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-blue-600">{rules.filter(r => r.ruleType === 'category').length}</div>
                        <div className="text-muted-foreground">قواعد التصنيفات</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-green-600">{rules.filter(r => r.ruleType === 'general').length}</div>
                        <div className="text-muted-foreground">القواعد العامة</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter className="flex-shrink-0 pt-3 sm:pt-4 gap-2 sm:gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-sm sm:text-base px-3 sm:px-4">إلغاء</Button>
          <Button onClick={handleSave} className="text-sm sm:text-base px-3 sm:px-4">حفظ التغييرات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageProfitsDialog;