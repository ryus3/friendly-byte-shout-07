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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>إدارة أرباح: {employee.fullName}</DialogTitle>
          <DialogDescription>
            قم بتعيين مبلغ ربح ثابت للموظف حسب المنتج أو التصنيف.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[70vh] overflow-y-auto pr-2 space-y-4">
            <Card>
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
                    <Label className="whitespace-nowrap">نسخ القواعد من:</Label>
                    <Select onValueChange={handleCopyRules}>
                        <SelectTrigger className="w-full sm:w-[250px]">
                            <SelectValue placeholder="اختر موظفاً لنسخ قواعده..." />
                        </SelectTrigger>
                        <SelectContent>
                            {employees.filter(e => e.id !== employee.id).map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

          <Tabs defaultValue="product" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="product">حسب المنتج</TabsTrigger>
              <TabsTrigger value="category">حسب التصنيف</TabsTrigger>
            </TabsList>
            <TabsContent value="product">
              <Card>
                <CardContent className="p-4 space-y-4">
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
          </Tabs>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave}>حفظ التغييرات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageProfitsDialog;