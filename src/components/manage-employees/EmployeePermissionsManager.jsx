import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useVariants } from '@/contexts/VariantsContext';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Users, Settings, Shield, Copy, Eye, EyeOff, 
  Crown, UserCheck, UserX, AlertCircle, 
  FileText, Database, Package, ShoppingCart,
  BarChart3, Calculator, UserPlus, Search,
  Filter, Download, Upload, Lock, Unlock
} from 'lucide-react';
import { permissionsMap } from '@/lib/permissions';

// نظام الموظفين والصلاحيات الجديد - يدعم جميع المتغيرات والمواسم

const EmployeePermissionsManager = ({ open, onOpenChange }) => {
  const { allUsers, updateUser } = useAuth();
  const { 
    categories, 
    departments, 
    colors, 
    sizes, 
    productTypes, 
    seasonsOccasions,
    loading: variantsLoading 
  } = useVariants();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [permissionsToUpdate, setPermissionsToUpdate] = useState({});
  const [variantPermissions, setVariantPermissions] = useState({});

  // التأكد من توفر البيانات
  const hasVariantsData = !variantsLoading && categories && departments && colors && sizes;

  // جلب الموظفين
  useEffect(() => {
    if (allUsers && Array.isArray(allUsers)) {
      setEmployees(allUsers.filter(user => user.role !== 'super_admin'));
    }
  }, [allUsers]);

  // فلترة الموظفين
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           emp.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, searchTerm, roleFilter, statusFilter]);

  // تحديث الصلاحيات
  const handlePermissionUpdate = async (employeeId, newPermissions, newVariantPermissions) => {
    setLoading(true);
    try {
      const updateData = {
        permissions: newPermissions,
        category_permissions: newVariantPermissions.categories || '["all"]',
        department_permissions: newVariantPermissions.departments || '["all"]',
        color_permissions: newVariantPermissions.colors || '["all"]',
        size_permissions: newVariantPermissions.sizes || '["all"]',
        product_type_permissions: newVariantPermissions.productTypes || '["all"]',
        season_occasion_permissions: newVariantPermissions.seasonsOccasions || '["all"]'
      };
      
      await updateUser(employeeId, updateData);
      
      // تحديث البيانات المحلية
      setEmployees(prev => prev.map(emp => 
        emp.user_id === employeeId ? { ...emp, ...updateData } : emp
      ));
      
      toast({
        title: "تم تحديث الصلاحيات",
        description: "تم حفظ صلاحيات الموظف بنجاح.",
      });
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast({
        title: "خطأ في التحديث",
        description: "فشل في حفظ الصلاحيات. حاول مرة أخرى.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // نسخ الصلاحيات من موظف آخر
  const copyPermissionsFrom = (fromEmployee, toEmployee) => {
    const newPermissions = {
      permissions: fromEmployee.permissions || [],
      categories: fromEmployee.category_permissions || '["all"]',
      departments: fromEmployee.department_permissions || '["all"]',
      colors: fromEmployee.color_permissions || '["all"]',
      sizes: fromEmployee.size_permissions || '["all"]',
      productTypes: fromEmployee.product_type_permissions || '["all"]',
      seasonsOccasions: fromEmployee.season_occasion_permissions || '["all"]'
    };
    
    handlePermissionUpdate(toEmployee.user_id, newPermissions.permissions, {
      categories: newPermissions.categories,
      departments: newPermissions.departments,
      colors: newPermissions.colors,
      sizes: newPermissions.sizes,
      productTypes: newPermissions.productTypes,
      seasonsOccasions: newPermissions.seasonsOccasions
    });

    toast({
      title: "تم نسخ الصلاحيات",
      description: `تم نسخ صلاحيات ${fromEmployee.full_name} إلى ${toEmployee.full_name}`,
    });
  };

  const EmployeePermissionsEditor = ({ employee }) => {
    const [currentPermissions, setCurrentPermissions] = useState(employee?.permissions || []);
    const [currentVariantPermissions, setCurrentVariantPermissions] = useState({
      categories: employee?.category_permissions || '["all"]',
      departments: employee?.department_permissions || '["all"]',
      colors: employee?.color_permissions || '["all"]',
      sizes: employee?.size_permissions || '["all"]',
      productTypes: employee?.product_type_permissions || '["all"]',
      seasonsOccasions: employee?.season_occasion_permissions || '["all"]'
    });

    const handlePermissionChange = (permissionId, checked) => {
      setCurrentPermissions(prev => 
        checked 
          ? [...prev, permissionId]
          : prev.filter(p => p !== permissionId)
      );
    };

    const handleVariantPermissionChange = (type, itemId, checked) => {
      setCurrentVariantPermissions(prev => {
        try {
          const current = typeof prev[type] === 'string' ? JSON.parse(prev[type]) : prev[type];
          let updated;
          
          if (checked) {
            if (current.includes('all')) {
              updated = [itemId];
            } else {
              updated = [...current, itemId];
            }
          } else {
            updated = current.filter(id => id !== itemId);
          }
          
          return {
            ...prev,
            [type]: JSON.stringify(updated.length === 0 ? ['all'] : updated)
          };
        } catch (error) {
          console.error('Error updating variant permissions:', error);
          return prev;
        }
      });
    };

    const hasPermission = (permissionId) => {
      return currentPermissions.includes(permissionId);
    };

    const hasVariantPermission = (type, itemId) => {
      try {
        const permissions = typeof currentVariantPermissions[type] === 'string' 
          ? JSON.parse(currentVariantPermissions[type]) 
          : currentVariantPermissions[type];
        return permissions.includes('all') || permissions.includes(itemId);
      } catch {
        return true;
      }
    };

    return (
      <div className="space-y-4">
        {/* معلومات الموظف */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              معلومات الموظف
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>الاسم الكامل</Label>
                <div className="text-sm font-medium">{employee?.full_name}</div>
              </div>
              <div>
                <Label>اسم المستخدم</Label>
                <div className="text-sm font-medium">{employee?.username}</div>
              </div>
              <div>
                <Label>الدور الحالي</Label>
                <Badge variant={
                  employee?.role === 'admin' ? 'default' :
                  employee?.role === 'deputy' ? 'secondary' :
                  employee?.role === 'manager' ? 'outline' : 'destructive'
                }>
                  {employee?.role === 'admin' && 'مدير'}
                  {employee?.role === 'deputy' && 'نائب مدير'}
                  {employee?.role === 'manager' && 'مدير قسم'}
                  {employee?.role === 'employee' && 'موظف'}
                  {employee?.role === 'warehouse' && 'مخزن'}
                  {employee?.role === 'cashier' && 'كاشير'}
                </Badge>
              </div>
              <div>
                <Label>الحالة</Label>
                <Badge variant={employee?.status === 'active' ? 'default' : 'destructive'}>
                  {employee?.status === 'active' ? 'نشط' : 'معطل'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* الصلاحيات العامة */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              الصلاحيات العامة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {permissionsMap.map((category) => (
                <AccordionItem key={category.categoryLabel} value={category.categoryLabel}>
                  <AccordionTrigger className="text-sm">
                    {category.categoryLabel}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {category.permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center space-x-2 space-x-reverse">
                          <Checkbox
                            id={permission.id}
                            checked={hasPermission(permission.id)}
                            onCheckedChange={(checked) => handlePermissionChange(permission.id, checked)}
                            disabled={employee?.role === 'admin'}
                          />
                          <Label htmlFor={permission.id} className="text-sm font-normal">
                            {permission.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* صلاحيات المنتجات */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              صلاحيات المنتجات والمتغيرات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="categories" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="categories">التصنيفات</TabsTrigger>
                <TabsTrigger value="departments">الأقسام</TabsTrigger>
                <TabsTrigger value="colors">الألوان</TabsTrigger>
                <TabsTrigger value="sizes">المقاسات</TabsTrigger>
                <TabsTrigger value="types">الأنواع</TabsTrigger>
                <TabsTrigger value="seasons">المواسم</TabsTrigger>
              </TabsList>
              
              <TabsContent value="categories" className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {categories.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={`cat-${item.id}`}
                        checked={hasVariantPermission('categories', item.id)}
                        onCheckedChange={(checked) => handleVariantPermissionChange('categories', item.id, checked)}
                      />
                      <Label htmlFor={`cat-${item.id}`} className="text-sm">
                        {item.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="departments" className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {departments.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={`dept-${item.id}`}
                        checked={hasVariantPermission('departments', item.id)}
                        onCheckedChange={(checked) => handleVariantPermissionChange('departments', item.id, checked)}
                      />
                      <Label htmlFor={`dept-${item.id}`} className="text-sm">
                        {item.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="colors" className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {colors.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={`color-${item.id}`}
                        checked={hasVariantPermission('colors', item.id)}
                        onCheckedChange={(checked) => handleVariantPermissionChange('colors', item.id, checked)}
                      />
                      <Label htmlFor={`color-${item.id}`} className="text-sm flex items-center gap-2">
                        {item.hex_code && (
                          <div 
                            className="w-4 h-4 rounded border" 
                            style={{ backgroundColor: item.hex_code }}
                          />
                        )}
                        {item.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="sizes" className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sizes.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={`size-${item.id}`}
                        checked={hasVariantPermission('sizes', item.id)}
                        onCheckedChange={(checked) => handleVariantPermissionChange('sizes', item.id, checked)}
                      />
                      <Label htmlFor={`size-${item.id}`} className="text-sm">
                        {item.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="types" className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {productTypes.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={`type-${item.id}`}
                        checked={hasVariantPermission('productTypes', item.id)}
                        onCheckedChange={(checked) => handleVariantPermissionChange('productTypes', item.id, checked)}
                      />
                      <Label htmlFor={`type-${item.id}`} className="text-sm">
                        {item.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="seasons" className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {seasonsOccasions.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={`season-${item.id}`}
                        checked={hasVariantPermission('seasonsOccasions', item.id)}
                        onCheckedChange={(checked) => handleVariantPermissionChange('seasonsOccasions', item.id, checked)}
                      />
                      <Label htmlFor={`season-${item.id}`} className="text-sm flex items-center gap-2">
                        {item.name}
                        <Badge variant="outline" className="text-xs">
                          {item.type}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* أزرار الحفظ */}
        <div className="flex gap-2 justify-end">
          <Button 
            variant="outline" 
            onClick={() => setSelectedEmployee(null)}
          >
            إلغاء
          </Button>
          <Button 
            onClick={() => {
              handlePermissionUpdate(employee.user_id, currentPermissions, currentVariantPermissions);
              setSelectedEmployee(null);
            }}
            disabled={loading}
          >
            {loading ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
          </Button>
        </div>
      </div>
    );
  };

  if (selectedEmployee) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              إدارة صلاحيات: {selectedEmployee.full_name}
            </DialogTitle>
            <DialogDescription>
              تحديد الصلاحيات والوصول للموظف
            </DialogDescription>
          </DialogHeader>
          <EmployeePermissionsEditor employee={selectedEmployee} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            إدارة صلاحيات الموظفين
          </DialogTitle>
          <DialogDescription>
            نظام شامل لإدارة أدوار وصلاحيات الموظفين في النظام
          </DialogDescription>
        </DialogHeader>

        {/* أدوات البحث والفلترة */}
        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-secondary/20 rounded-lg">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="البحث في الموظفين..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9"
            />
          </div>
          
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="جميع الأدوار" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأدوار</SelectItem>
              <SelectItem value="admin">مدير</SelectItem>
              <SelectItem value="deputy">نائب مدير</SelectItem>
              <SelectItem value="manager">مدير قسم</SelectItem>
              <SelectItem value="employee">موظف</SelectItem>
              <SelectItem value="warehouse">مخزن</SelectItem>
              <SelectItem value="cashier">كاشير</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="جميع الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="pending">معلق</SelectItem>
              <SelectItem value="inactive">معطل</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            تصدير التقرير
          </Button>
        </div>

        {/* قائمة الموظفين */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {filteredEmployees.map((employee) => (
              <Card key={employee.user_id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-white font-bold">
                        {employee.full_name?.charAt(0).toUpperCase() || employee.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="font-semibold">{employee.full_name || employee.username}</div>
                        <div className="text-sm text-muted-foreground">{employee.email}</div>
                      </div>
                    </div>
                    <Badge variant={
                      employee.role === 'admin' ? 'default' :
                      employee.role === 'deputy' ? 'secondary' :
                      employee.role === 'manager' ? 'outline' : 'destructive'
                    }>
                      {employee.role === 'admin' && 'مدير'}
                      {employee.role === 'deputy' && 'نائب'}
                      {employee.role === 'manager' && 'مدير قسم'}
                      {employee.role === 'employee' && 'موظف'}
                      {employee.role === 'warehouse' && 'مخزن'}
                      {employee.role === 'cashier' && 'كاشير'}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>الحالة:</span>
                      <Badge variant={employee.status === 'active' ? 'default' : 'destructive'}>
                        {employee.status === 'active' ? 'نشط' : 'معطل'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>الصلاحيات:</span>
                      <span className="font-medium">
                        {employee.permissions?.length || 0} صلاحية
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      إدارة الصلاحيات
                    </Button>
                    
                    <Select onValueChange={(fromEmployeeId) => {
                      const fromEmployee = employees.find(e => e.user_id === fromEmployeeId);
                      if (fromEmployee) {
                        copyPermissionsFrom(fromEmployee, employee);
                      }
                    }}>
                      <SelectTrigger className="w-auto">
                        <Copy className="h-4 w-4" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter(e => e.user_id !== employee.user_id)
                          .map(emp => (
                            <SelectItem key={emp.user_id} value={emp.user_id}>
                              نسخ من {emp.full_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-8">
              <UserX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">لا توجد موظفين</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || roleFilter !== 'all' || statusFilter !== 'all' 
                  ? 'لا توجد نتائج تطابق معايير البحث'
                  : 'لم يتم العثور على موظفين في النظام'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeePermissionsManager;