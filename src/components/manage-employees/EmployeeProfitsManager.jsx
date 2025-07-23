import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, TrendingUp, Calculator, Settings, Loader2 } from 'lucide-react';
import ProfitCalculatorResult from './ProfitCalculatorResult';

const EmployeeProfitsManager = ({ open, onOpenChange }) => {
  const { products, employeeProfitRules, setEmployeeProfitRule, getEmployeeProfitRules, calculateProfit } = useInventory();
  const { allUsers } = useAuth();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedEmployeeForCalculator, setSelectedEmployeeForCalculator] = useState('');
  const [selectedProductForCalculator, setSelectedProductForCalculator] = useState('');
  const [calculatorQuantity, setCalculatorQuantity] = useState(1);

  const employees = useMemo(() => {
    if (!Array.isArray(allUsers)) return [];
    return allUsers.filter(u => 
      u.is_active && 
      u.status === 'active' && 
      u.full_name && 
      u.full_name.trim() !== ''
    );
  }, [allUsers]);

  const employeeStats = useMemo(() => {
    return employees.map(emp => {
      const employeeId = emp.user_id || emp.id;
      const rules = getEmployeeProfitRules(employeeId);
      const productRules = rules.filter(r => r.rule_type === 'product').length;
      const categoryRules = rules.filter(r => r.rule_type === 'category').length;
      const generalRules = rules.filter(r => r.rule_type === 'general').length;
      
      return {
        ...emp,
        totalRules: rules.length,
        productRules,
        categoryRules,
        generalRules,
        hasRules: rules.length > 0
      };
    });
  }, [employees, getEmployeeProfitRules]);

  const handleManageEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeDialog(true);
  };

  const totalProducts = products.length;
  const totalEmployees = employees.length;
  const employeesWithRules = employeeStats.filter(e => e.hasRules).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-full sm:max-w-5xl h-[90vh] overflow-hidden flex flex-col bg-background border shadow-lg backdrop-blur-sm"
          style={{ zIndex: 9998 }}>
          <DialogHeader className="flex-shrink-0 pb-2 px-4 sm:px-6">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              إدارة قواعد الأرباح للموظفين
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              نظام شامل لإدارة قواعد الأرباح وحساب المستحقات للموظفين
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden min-h-0 px-4 sm:px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 mb-3 flex-shrink-0 h-10 sm:h-11">
                <TabsTrigger value="overview" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2">
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">نظرة عامة</span>
                  <span className="sm:hidden">عامة</span>
                </TabsTrigger>
                <TabsTrigger value="employees" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">إدارة الموظفين</span>
                  <span className="sm:hidden">موظفين</span>
                </TabsTrigger>
                <TabsTrigger value="calculator" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2">
                  <Calculator className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">حاسبة الأرباح</span>
                  <span className="sm:hidden">حاسبة</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto min-h-0 touch-pan-y overscroll-behavior-contain scroll-smooth">
                <TabsContent value="overview" className="space-y-3 sm:space-y-4 mt-0 pb-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
                      <CardContent className="p-3 sm:p-4 text-center">
                        <div className="text-xl sm:text-2xl font-bold text-blue-600">{totalEmployees}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">إجمالي الموظفين</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30">
                      <CardContent className="p-3 sm:p-4 text-center">
                        <div className="text-xl sm:text-2xl font-bold text-green-600">{employeesWithRules}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">موظفين لديهم قواعد</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30">
                      <CardContent className="p-3 sm:p-4 text-center">
                        <div className="text-xl sm:text-2xl font-bold text-purple-600">{totalProducts}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">إجمالي المنتجات</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30">
                      <CardContent className="p-3 sm:p-4 text-center">
                        <div className="text-xl sm:text-2xl font-bold text-orange-600">
                          {employeeStats.reduce((sum, emp) => sum + emp.totalRules, 0)}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground">إجمالي القواعد</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="text-base sm:text-lg">ملخص قواعد الموظفين</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4">
                      <div className="space-y-2 sm:space-y-3">
                        {employeeStats.map((emp) => (
                          <div key={emp.id} className="flex items-center justify-between p-2 sm:p-3 border rounded-lg">
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                               <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-white font-bold text-sm">
                                 {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : emp.username ? emp.username.charAt(0).toUpperCase() : '?'}
                               </div>
                               <div className="flex-1 min-w-0">
                                 <div className="font-semibold text-sm sm:text-base truncate">{emp.full_name || emp.username || 'موظف غير محدد'}</div>
                                 <div className="text-xs sm:text-sm text-muted-foreground truncate">{emp.email}</div>
                               </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                              <div className="hidden sm:flex items-center gap-2">
                                <div className="text-center">
                                  <div className="text-sm font-bold text-blue-600">{emp.productRules}</div>
                                  <div className="text-xs text-muted-foreground">منتجات</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-sm font-bold text-green-600">{emp.categoryRules}</div>
                                  <div className="text-xs text-muted-foreground">تصنيفات</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-sm font-bold text-purple-600">{emp.generalRules}</div>
                                  <div className="text-xs text-muted-foreground">عامة</div>
                                </div>
                              </div>
                              <div className="sm:hidden text-center">
                                <div className="text-sm font-bold text-primary">{emp.totalRules}</div>
                                <div className="text-xs text-muted-foreground">قواعد</div>
                              </div>
                              {emp.hasRules ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                  مُفعل
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                                  غير مُفعل
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="employees" className="space-y-3 sm:space-y-4 mt-0 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                    {employeeStats.map((emp) => (
                      <Card key={emp.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-center gap-2 sm:gap-3 mb-3">
                             <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-white font-bold">
                               {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : emp.username ? emp.username.charAt(0).toUpperCase() : '?'}
                             </div>
                             <div className="flex-1 min-w-0">
                               <div className="font-semibold text-sm sm:text-base truncate">{emp.full_name || emp.username || 'موظف غير محدد'}</div>
                               <div className="text-xs sm:text-sm text-muted-foreground truncate">{emp.email}</div>
                             </div>
                          </div>
                          
                          <div className="space-y-1 sm:space-y-2 mb-3 sm:mb-4">
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>قواعد المنتجات:</span>
                              <span className="font-semibold text-blue-600">{emp.productRules}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>قواعد التصنيفات:</span>
                              <span className="font-semibold text-green-600">{emp.categoryRules}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>القواعد العامة:</span>
                              <span className="font-semibold text-purple-600">{emp.generalRules}</span>
                            </div>
                          </div>
                          
                          <Button 
                            onClick={() => handleManageEmployee(emp)}
                            className="w-full text-sm"
                            variant={emp.hasRules ? "default" : "outline"}
                          >
                            <Settings className="h-3 w-3 sm:h-4 sm:w-4 ml-2" />
                            {emp.hasRules ? "تعديل القواعد" : "إضافة قواعد"}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="calculator" className="space-y-3 sm:space-y-4 mt-0 pb-4">
                  <Card>
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        حاسبة الأرباح المباشرة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                        <div>
                          <Label className="text-xs sm:text-sm">اختر موظف</Label>
                          <Select value={selectedEmployeeForCalculator} onValueChange={setSelectedEmployeeForCalculator}>
                            <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-10">
                              <SelectValue placeholder="اختر موظف..." />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg" style={{ zIndex: 10001 }}>
                               {employees.map(emp => (
                                 <SelectItem key={emp.user_id || emp.id} value={emp.user_id || emp.id}>
                                   {emp.full_name || emp.username || 'موظف غير محدد'}
                                 </SelectItem>
                               ))}
                               {employees.length === 0 && (
                                 <SelectItem disabled value="no-employees">
                                   جاري تحميل الموظفين...
                                 </SelectItem>
                               )}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs sm:text-sm">اختر منتج</Label>
                          <Select value={selectedProductForCalculator} onValueChange={setSelectedProductForCalculator}>
                            <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-10">
                              <SelectValue placeholder="اختر منتج..." />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg" style={{ zIndex: 10001 }}>
                              {products.slice(0, 50).map(product => (
                                <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                              ))}
                              {(!products || products.length === 0) && (
                                <SelectItem disabled value="no-products">
                                  جاري تحميل المنتجات...
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs sm:text-sm">الكمية</Label>
                          <Input 
                            type="number" 
                            placeholder="1" 
                            value={calculatorQuantity}
                            onChange={(e) => setCalculatorQuantity(parseInt(e.target.value) || 1)}
                            className="text-xs sm:text-sm h-8 sm:h-10" 
                          />
                        </div>
                      </div>
                      
                      <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-secondary/50 rounded-lg">
                        {selectedEmployeeForCalculator && selectedProductForCalculator ? (
                          <ProfitCalculatorResult 
                            employee={employees.find(e => e.user_id === selectedEmployeeForCalculator || e.id === selectedEmployeeForCalculator)}
                            product={products.find(p => p.id === selectedProductForCalculator)}
                            quantity={calculatorQuantity}
                            employeeProfitRules={employeeProfitRules}
                            calculateProfit={calculateProfit}
                          />
                        ) : (
                          <div className="text-center text-muted-foreground text-sm">
                            <Calculator className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>اختر موظف ومنتج لعرض حساب الربح</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                 </TabsContent>
              </div>
            </Tabs>
          </div>
          
          <div className="flex justify-end gap-2 pt-3 border-t px-4 sm:px-6 pb-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* حوار إدارة قواعد الموظف */}
      <EmployeeProfitRuleDialog
        open={showEmployeeDialog}
        onOpenChange={setShowEmployeeDialog}
        employee={selectedEmployee}
      />
    </>
  );
};

// مكون حوار قواعد الأرباح للموظف المحدد
const EmployeeProfitRuleDialog = ({ open, onOpenChange, employee }) => {
  const { products, categories, departments, employeeProfitRules, setEmployeeProfitRule, getEmployeeProfitRules } = useInventory();
  const [ruleType, setRuleType] = useState('product');
  const [targetId, setTargetId] = useState('');
  const [profitAmount, setProfitAmount] = useState('');
  const [profitPercentage, setProfitPercentage] = useState('');
  const [loading, setLoading] = useState(false);

  const employeeId = employee?.user_id || employee?.id;
  const employeeRules = employeeId ? getEmployeeProfitRules(employeeId) : [];

  const handleAddRule = async () => {
    if (!employeeId || (ruleType !== 'default' && !targetId)) {
      toast({
        title: "خطأ",
        description: "الرجاء ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    if (!profitAmount || parseFloat(profitAmount) <= 0) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال مبلغ ربح صحيح أكبر من صفر",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await setEmployeeProfitRule(employeeId, {
        rule_type: ruleType,
        target_id: ruleType === 'default' ? 'default' : targetId,
        profit_amount: parseFloat(profitAmount),
        profit_percentage: null,
        is_active: true
      });

      toast({
        title: "تم الحفظ",
        description: "تم إضافة قاعدة الربح بنجاح"
      });

      // إعادة تعيين النموذج
      setTargetId('');
      setProfitAmount('');
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ القاعدة",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const handleDeleteRule = async (ruleId) => {
    setLoading(true);
    try {
      await setEmployeeProfitRule(employeeId, { id: ruleId, is_active: false });
      toast({
        title: "تم الحذف",
        description: "تم حذف قاعدة الربح بنجاح"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف القاعدة",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const getTargetName = (rule) => {
    if (rule.rule_type === 'product') {
      const product = products.find(p => p.id === rule.target_id);
      return product ? product.name : 'منتج محذوف';
    } else if (rule.rule_type === 'category') {
      const category = categories.find(c => c.id === rule.target_id);
      return category ? category.name : 'فئة محذوفة';
    } else if (rule.rule_type === 'department') {
      const department = departments.find(d => d.id === rule.target_id);
      return department ? department.name : 'قسم محذوف';
    } else if (rule.rule_type === 'variant') {
      const product = products.find(p => p.variants?.some(v => v.id === rule.target_id));
      const variant = product?.variants?.find(v => v.id === rule.target_id);
      return variant ? `${product.name} - ${variant.color_name || ''} ${variant.size_name || ''}` : 'متغير محذوف';
    } else if (rule.rule_type === 'product_type') {
      return 'نوع منتج';
    }
    return 'غير محدد';
  };

  const getOptions = () => {
    switch (ruleType) {
      case 'product':
        return products.map(p => ({ value: p.id, label: p.name }));
      case 'variant':
        // يمكن إضافة جلب المتغيرات هنا لاحقاً
        return products.flatMap(p => 
          p.variants?.map(v => ({ 
            value: v.id, 
            label: `${p.name} - ${v.color_name || ''} ${v.size_name || ''}` 
          })) || []
        );
      case 'category':
        return categories.map(c => ({ value: c.id, label: c.name }));
      case 'department':
        return departments.map(d => ({ value: d.id, label: d.name }));
      case 'product_type':
        // يجب جلب أنواع المنتجات من السياق
        return [];
      default:
        return [];
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            قواعد الأرباح - {employee.full_name || employee.username}
          </DialogTitle>
          <DialogDescription>
            إدارة قواعد الأرباح بالمبالغ الثابتة (د.ع) - المديرون لا يحصلون على أرباح
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* إضافة قاعدة جديدة */}
          <Card>
            <CardHeader>
              <CardTitle>إضافة قاعدة ربح جديدة (مبلغ ثابت)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>نوع القاعدة</Label>
                  <Select value={ruleType} onValueChange={setRuleType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">افتراضي (لجميع المنتجات)</SelectItem>
                      <SelectItem value="product">منتج محدد</SelectItem>
                      <SelectItem value="variant">متغير محدد</SelectItem>
                      <SelectItem value="category">فئة المنتج</SelectItem>
                      <SelectItem value="department">قسم المنتج</SelectItem>
                      <SelectItem value="product_type">نوع المنتج</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>العنصر المستهدف</Label>
                  {ruleType === 'default' ? (
                    <Input value="افتراضي لجميع المنتجات" disabled />
                  ) : (
                    <Select value={targetId} onValueChange={setTargetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر العنصر..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {getOptions().map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label>مبلغ الربح الثابت (د.ع)</Label>
                  <Input
                    type="number"
                    value={profitAmount}
                    onChange={(e) => setProfitAmount(e.target.value)}
                    placeholder="مثال: 5000"
                    min="0"
                    step="1000"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    المبلغ الذي يحصل عليه الموظف لكل قطعة مباعة
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleAddRule} disabled={loading} className="min-w-[120px]">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  إضافة القاعدة
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* القواعد الحالية */}
          <Card>
            <CardHeader>
              <CardTitle>القواعد الحالية ({employeeRules.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {employeeRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد قواعد أرباح محددة لهذا الموظف</p>
                  <p className="text-sm">أضف قاعدة جديدة لتخصيص الأرباح</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>النوع</TableHead>
                        <TableHead>العنصر</TableHead>
                        <TableHead>مبلغ الربح (د.ع)</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <Badge variant="outline">
                              {rule.rule_type === 'default' ? 'افتراضي' :
                               rule.rule_type === 'product' ? 'منتج' : 
                               rule.rule_type === 'variant' ? 'متغير' :
                               rule.rule_type === 'category' ? 'فئة' : 
                               rule.rule_type === 'department' ? 'قسم' :
                               rule.rule_type === 'product_type' ? 'نوع' : 'غير محدد'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {rule.rule_type === 'default' ? 'جميع المنتجات' : getTargetName(rule)}
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {rule.profit_amount.toLocaleString()} د.ع
                          </TableCell>
                          <TableCell>
                            <Badge variant={rule.is_active ? "default" : "secondary"}>
                              {rule.is_active ? 'نشط' : 'معطل'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteRule(rule.id)}
                              disabled={loading}
                            >
                              حذف
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeProfitsManager;