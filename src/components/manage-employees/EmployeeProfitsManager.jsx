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
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, TrendingUp, Calculator, Settings } from 'lucide-react';
import ManageProfitsDialog from './ManageProfitsDialog';

const EmployeeProfitsManager = ({ open, onOpenChange }) => {
  const { products, employeeProfitRules, setEmployeeProfitRule, getEmployeeProfitRules } = useInventory();
  const { allUsers } = useAuth();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const employees = useMemo(() => {
    if (!Array.isArray(allUsers)) return [];
    return allUsers.filter(u => (u.role === 'employee' || u.role === 'deputy' || u.role === 'manager') && u.is_active)
      .filter(u => u.full_name && u.full_name.trim() !== ''); // فلترة الموظفين الذين لديهم أسماء صحيحة
  }, [allUsers]);

  const employeeStats = useMemo(() => {
    return employees.map(emp => {
      const rules = getEmployeeProfitRules(emp.id);
      const productRules = rules.filter(r => r.ruleType === 'product').length;
      const categoryRules = rules.filter(r => r.ruleType === 'category').length;
      const generalRules = rules.filter(r => r.ruleType === 'general').length;
      
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
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-600" />
              إدارة قواعد الأرباح للموظفين
            </DialogTitle>
            <DialogDescription>
              نظام شامل لإدارة قواعد الأرباح وحساب المستحقات للموظفين بناءً على المنتجات والتصنيفات
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  نظرة عامة
                </TabsTrigger>
                <TabsTrigger value="employees" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  إدارة الموظفين
                </TabsTrigger>
                <TabsTrigger value="calculator" className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  حاسبة الأرباح
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-4">
                <TabsContent value="overview" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">{totalEmployees}</div>
                        <div className="text-sm text-muted-foreground">إجمالي الموظفين</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{employeesWithRules}</div>
                        <div className="text-sm text-muted-foreground">موظفين لديهم قواعد</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">{totalProducts}</div>
                        <div className="text-sm text-muted-foreground">إجمالي المنتجات</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {employeeStats.reduce((sum, emp) => sum + emp.totalRules, 0)}
                        </div>
                        <div className="text-sm text-muted-foreground">إجمالي القواعد</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>ملخص قواعد الموظفين</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {employeeStats.map((emp) => (
                          <div key={emp.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-white font-bold">
                                 {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : emp.username ? emp.username.charAt(0).toUpperCase() : '?'}
                               </div>
                               <div>
                                 <div className="font-semibold">{emp.full_name || emp.username || 'موظف غير محدد'}</div>
                                 <div className="text-sm text-muted-foreground">{emp.role}</div>
                               </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <div className="text-lg font-bold text-blue-600">{emp.productRules}</div>
                                <div className="text-xs text-muted-foreground">منتجات</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-green-600">{emp.categoryRules}</div>
                                <div className="text-xs text-muted-foreground">تصنيفات</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-purple-600">{emp.generalRules}</div>
                                <div className="text-xs text-muted-foreground">عامة</div>
                              </div>
                              {emp.hasRules ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  مُفعل
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
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

                <TabsContent value="employees" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employeeStats.map((emp) => (
                      <Card key={emp.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                             <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-white font-bold">
                               {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : emp.username ? emp.username.charAt(0).toUpperCase() : '?'}
                             </div>
                             <div className="flex-1">
                               <div className="font-semibold">{emp.full_name || emp.username || 'موظف غير محدد'}</div>
                               <div className="text-sm text-muted-foreground">{emp.role}</div>
                             </div>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span>قواعد المنتجات:</span>
                              <span className="font-semibold text-blue-600">{emp.productRules}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>قواعد التصنيفات:</span>
                              <span className="font-semibold text-green-600">{emp.categoryRules}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>القواعد العامة:</span>
                              <span className="font-semibold text-purple-600">{emp.generalRules}</span>
                            </div>
                          </div>
                          
                          <Button 
                            onClick={() => handleManageEmployee(emp)}
                            className="w-full"
                            variant={emp.hasRules ? "default" : "outline"}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            {emp.hasRules ? "تعديل القواعد" : "إضافة قواعد"}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="calculator" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>حاسبة الأرباح المباشرة</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>اختر موظف</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر موظف..." />
                            </SelectTrigger>
                            <SelectContent>
                               {employees.map(emp => (
                                 <SelectItem key={emp.id} value={emp.id}>
                                   {emp.full_name || emp.username || 'موظف غير محدد'}
                                 </SelectItem>
                               ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>اختر منتج</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر منتج..." />
                            </SelectTrigger>
                            <SelectContent>
                              {products.slice(0, 10).map(product => (
                                <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>الكمية</Label>
                          <Input type="number" placeholder="1" />
                        </div>
                      </div>
                      
                      <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">0 د.ع</div>
                          <div className="text-sm text-muted-foreground">ربح الموظف المتوقع</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <ManageProfitsDialog
        employee={selectedEmployee}
        open={showEmployeeDialog}
        onOpenChange={setShowEmployeeDialog}
      />
    </>
  );
};

export default EmployeeProfitsManager;