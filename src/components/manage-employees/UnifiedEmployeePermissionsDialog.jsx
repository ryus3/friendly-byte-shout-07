import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useVariants } from '@/contexts/VariantsContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Trash2, Loader2, Check, X, Shield, Eye, Home, Package } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { permissionsMap } from '@/lib/permissions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const defaultPages = [
  { value: '/', label: 'لوحة التحكم' },
  { value: '/quick-order', label: 'طلب سريع' },
  { value: '/products', label: 'عرض المنتجات' },
  { value: '/manage-products', label: 'إدارة المنتجات' },
  { value: '/inventory', label: 'الجرد' },
  { value: '/orders', label: 'الطلبات' },
  { value: '/purchases', label: 'المشتريات' },
  { value: '/settings', label: 'الإعدادات' },
  { value: '/my-orders', label: 'طلباتي (خاص بالموظف)' },
  { value: '/my-profits', label: 'أرباحي (خاص بالموظف)' },
];

const getDefaultPermissions = (role) => {
  if (role === 'admin' || role === 'deputy') {
    return ['*'];
  }
  
  return [
    'view_products',
    'create_orders', 
    'view_orders',
    'edit_orders',
    'view_inventory',
    'view_customers',
    'create_customers',
    'edit_customers',
    'view_profits',
    'manage_all_customers' // إضافة صلاحية إدارة جميع العملاء
  ];
};

const UnifiedEmployeePermissionsDialog = ({ 
  employee, 
  open, 
  onOpenChange, 
  mode = 'edit', // 'edit' or 'approve'
  onApprove,
  onReject 
}) => {
  const { updateUser, refetchAdminData } = useAuth();
  const { categories, colors, sizes, departments, productTypes, seasonsOccasions } = useVariants();
  
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [role, setRole] = useState('employee');
  const [status, setStatus] = useState('pending');
  const [defaultPage, setDefaultPage] = useState('/');
  const [orderCreationMode, setOrderCreationMode] = useState('choice');
  const [categoryPermissions, setCategoryPermissions] = useState(['all']);
  const [colorPermissions, setColorPermissions] = useState(['all']);
  const [sizePermissions, setSizePermissions] = useState(['all']);
  const [departmentPermissions, setDepartmentPermissions] = useState(['all']);
  const [productTypePermissions, setProductTypePermissions] = useState(['all']);
  const [seasonOccasionPermissions, setSeasonOccasionPermissions] = useState(['all']);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (employee) {
      setRole(employee.role || 'employee');
      setStatus(employee.status || 'pending');
      setSelectedPermissions(employee.permissions || getDefaultPermissions(employee.role || 'employee'));
      setDefaultPage(employee.default_page || '/');
      setOrderCreationMode(employee.order_creation_mode || 'choice');
      
      // Parse JSON strings for permissions
      try {
        setCategoryPermissions(JSON.parse(employee.category_permissions || '["all"]'));
        setColorPermissions(JSON.parse(employee.color_permissions || '["all"]'));
        setSizePermissions(JSON.parse(employee.size_permissions || '["all"]'));
        setDepartmentPermissions(JSON.parse(employee.department_permissions || '["all"]'));
        setProductTypePermissions(JSON.parse(employee.product_type_permissions || '["all"]'));
        setSeasonOccasionPermissions(JSON.parse(employee.season_occasion_permissions || '["all"]'));
      } catch (e) {
        // Fallback to default values if parsing fails
        setCategoryPermissions(['all']);
        setColorPermissions(['all']);
        setSizePermissions(['all']);
        setDepartmentPermissions(['all']);
        setProductTypePermissions(['all']);
        setSeasonOccasionPermissions(['all']);
      }
    }
  }, [employee]);

  if (!employee) return null;

  const handlePermissionChange = (permissionId, checked) => {
    setSelectedPermissions(prev =>
      checked
        ? [...prev, permissionId]
        : prev.filter(p => p !== permissionId)
    );
  };

  const handleCategoryPermissionChange = (category, checked) => {
    if (category === 'all') {
      setCategoryPermissions(checked ? ['all'] : []);
    } else {
      setCategoryPermissions(prev => {
        const filtered = prev.filter(c => c !== 'all' && c !== category);
        return checked ? [...filtered, category] : filtered;
      });
    }
  };

  const handleColorPermissionChange = (color, checked) => {
    if (color === 'all') {
      setColorPermissions(checked ? ['all'] : []);
    } else {
      setColorPermissions(prev => {
        const filtered = prev.filter(c => c !== 'all' && c !== color);
        return checked ? [...filtered, color] : filtered;
      });
    }
  };

  const handleSizePermissionChange = (size, checked) => {
    if (size === 'all') {
      setSizePermissions(checked ? ['all'] : []);
    } else {
      setSizePermissions(prev => {
        const filtered = prev.filter(c => c !== 'all' && c !== size);
        return checked ? [...filtered, size] : filtered;
      });
    }
  };

  const handleDepartmentPermissionChange = (department, checked) => {
    if (department === 'all') {
      setDepartmentPermissions(checked ? ['all'] : []);
    } else {
      setDepartmentPermissions(prev => {
        const filtered = prev.filter(c => c !== 'all' && c !== department);
        return checked ? [...filtered, department] : filtered;
      });
    }
  };

  const handleProductTypePermissionChange = (productType, checked) => {
    if (productType === 'all') {
      setProductTypePermissions(checked ? ['all'] : []);
    } else {
      setProductTypePermissions(prev => {
        const filtered = prev.filter(c => c !== 'all' && c !== productType);
        return checked ? [...filtered, productType] : filtered;
      });
    }
  };

  const handleSeasonOccasionPermissionChange = (seasonOccasion, checked) => {
    if (seasonOccasion === 'all') {
      setSeasonOccasionPermissions(checked ? ['all'] : []);
    } else {
      setSeasonOccasionPermissions(prev => {
        const filtered = prev.filter(c => c !== 'all' && c !== seasonOccasion);
        return checked ? [...filtered, seasonOccasion] : filtered;
      });
    }
  };
  
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setSelectedPermissions(getDefaultPermissions(newRole));
    
    if (newRole === 'admin' || newRole === 'deputy') {
      setCategoryPermissions(['all']);
      setColorPermissions(['all']);
      setSizePermissions(['all']);
      setDepartmentPermissions(['all']);
      setProductTypePermissions(['all']);
      setSeasonOccasionPermissions(['all']);
    } else {
      setCategoryPermissions(['all']);
      setColorPermissions(['all']);
      setSizePermissions(['all']);
      setDepartmentPermissions(['all']);
      setProductTypePermissions(['all']);
      setSeasonOccasionPermissions(['all']);
    }
  };

  const getCurrentData = () => {
    const finalPermissions = (role === 'admin' || role === 'deputy') ? ['*'] : selectedPermissions;
    const isAdminOrDeputy = role === 'admin' || role === 'deputy';
    
    return {
      role,
      status: mode === 'approve' ? 'active' : status,
      permissions: JSON.stringify(finalPermissions),
      default_page: defaultPage,
      order_creation_mode: orderCreationMode,
      category_permissions: JSON.stringify(isAdminOrDeputy ? ['all'] : categoryPermissions),
      color_permissions: JSON.stringify(isAdminOrDeputy ? ['all'] : colorPermissions),
      size_permissions: JSON.stringify(isAdminOrDeputy ? ['all'] : sizePermissions),
      department_permissions: JSON.stringify(isAdminOrDeputy ? ['all'] : departmentPermissions),
      product_type_permissions: JSON.stringify(isAdminOrDeputy ? ['all'] : productTypePermissions),
      season_occasion_permissions: JSON.stringify(isAdminOrDeputy ? ['all'] : seasonOccasionPermissions)
    };
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const data = getCurrentData();
      
      console.log('Approving user:', employee.user_id, 'with data:', data);
      
      const result = await updateUser(employee.user_id, data);
      
      console.log('User approved successfully:', result);
      
      await refetchAdminData();
      
      toast({
        title: "تمت الموافقة",
        description: "تم تفعيل حساب الموظف وتطبيق الصلاحيات بنجاح",
        variant: "default"
      });
      
      if (onApprove) {
        onApprove(employee.user_id, data);
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الموافقة على الحساب",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsProcessing(true);
    try {
      const data = getCurrentData();
      
      console.log('Updating user:', employee.user_id, 'with data:', data);
      
      const result = await updateUser(employee.user_id, data);
      
      console.log('User updated successfully:', result);
      
      await refetchAdminData();
      
      toast({
        title: "تم التحديث",
        description: "تم تحديث بيانات وصلاحيات الموظف بنجاح",
        variant: "default"
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحديث بيانات الموظف",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await updateUser(employee.user_id, { status: 'rejected', permissions: JSON.stringify([]) });
      
      await refetchAdminData();
      
      toast({
        title: "تم الرفض",
        description: "تم رفض طلب التسجيل",
        variant: "default"
      });
      
      if (onReject) {
        onReject(employee.user_id);
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء رفض الطلب",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisableUser = async () => {
    setIsProcessing(true);
    try {
      await updateUser(employee.user_id, { status: 'suspended' });
      await refetchAdminData();
      
      toast({
        title: "تم التعطيل",
        description: "تم تعطيل حساب الموظف",
        variant: "default"
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error disabling user:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تعطيل الحساب",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {mode === 'approve' ? `موافقة على تسجيل: ${employee.full_name}` : `تعديل الموظف: ${employee.full_name}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'approve' 
              ? 'قم بتحديد الدور والصلاحيات للموظف الجديد ثم اضغط موافقة لتفعيل الحساب'
              : 'تعديل حالة الحساب، الدور، والصلاحيات للموظف'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* معلومات الموظف */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="font-semibold mb-2">معلومات الموظف</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium">الاسم:</span> {employee.full_name}</div>
              <div><span className="font-medium">اسم المستخدم:</span> @{employee.username}</div>
              <div><span className="font-medium">البريد الإلكتروني:</span> {employee.email}</div>
              <div><span className="font-medium">الحالة الحالية:</span> 
                <span className={`ml-2 px-2 py-1 rounded text-xs ${
                  employee.status === 'active' ? 'bg-green-100 text-green-700' :
                  employee.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {employee.status === 'active' ? 'نشط' : 
                   employee.status === 'pending' ? 'قيد المراجعة' : 'معطل'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                الدور
              </h4>
              <Select value={role} onValueChange={handleRoleChange}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">موظف</SelectItem>
                  <SelectItem value="deputy">نائب مدير</SelectItem>
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="warehouse">مخزن</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {mode === 'edit' && (
              <div>
                <Label>حالة الحساب</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="pending">قيد المراجعة</SelectItem>
                    <SelectItem value="suspended">معلق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Home className="w-5 h-5 text-primary" />
                الصفحة الرئيسية للموظف
              </h4>
              <Select value={defaultPage} onValueChange={setDefaultPage}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الصفحة الرئيسية" />
                </SelectTrigger>
                <SelectContent>
                  {defaultPages.map(page => (
                    <SelectItem key={page.value} value={page.value}>{page.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                نمط إنشاء الطلب
              </h4>
              <Select value={orderCreationMode} onValueChange={setOrderCreationMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="choice">السماح بالاختيار</SelectItem>
                  <SelectItem value="local_only">إجباري محلي</SelectItem>
                  <SelectItem value="partner_only">إجباري شركة توصيل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* الصلاحيات العامة */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              الصلاحيات العامة
            </h4>
            <Accordion type="multiple" className="w-full" defaultValue={permissionsMap.map(p => p.category)}>
              {permissionsMap.map(category => (
                <AccordionItem value={category.category} key={category.category}>
                  <AccordionTrigger disabled={role === 'admin' || role === 'deputy'}>
                    {category.categoryLabel}
                    {(role === 'admin' || role === 'deputy') && (
                      <span className="text-xs text-muted-foreground ml-2">(جميع الصلاحيات)</span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4">
                      {category.permissions.map(permission => (
                        <div key={permission.id} className="flex items-center space-x-2 space-x-reverse">
                          <Checkbox
                            id={`${employee.id}-${permission.id}`}
                            checked={role === 'admin' || role === 'deputy' || selectedPermissions.includes(permission.id)}
                            onCheckedChange={(checked) => handlePermissionChange(permission.id, checked)}
                            disabled={role === 'admin' || role === 'deputy'}
                          />
                          <Label htmlFor={`${employee.id}-${permission.id}`} className="text-sm cursor-pointer">
                            {permission.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* صلاحيات التصنيفات والمتغيرات */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              صلاحيات المنتجات والجرد
            </h4>
            <div className="p-4 border rounded-lg space-y-4">
              
              {/* التصنيفات */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">التصنيفات المسموحة:</h5>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCategoryPermissions(['all'])}
                    disabled={role === 'admin' || role === 'deputy'}
                  >
                    تحديد كل التصنيفات
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map(category => (
                    <div key={category.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded">
                       <Checkbox
                         id={`cat-${category.id}-${employee.id}`}
                         checked={categoryPermissions.includes(category.id) || categoryPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                         onCheckedChange={(checked) => handleCategoryPermissionChange(category.id, checked)}
                         disabled={role === 'admin' || role === 'deputy'}
                       />
                      <Label htmlFor={`cat-${category.id}-${employee.id}`} className="text-sm font-medium cursor-pointer">
                        {category.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <Separator />
              
              {/* الألوان */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">الألوان المسموحة:</h5>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setColorPermissions(['all'])}
                    disabled={role === 'admin' || role === 'deputy'}
                  >
                    تحديد كل الألوان
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {colors.map(color => (
                    <div key={color.id} className="flex items-center space-x-2 space-x-reverse p-1">
                       <Checkbox
                         id={`color-${color.id}-${employee.id}`}
                         checked={colorPermissions.includes(color.id) || colorPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                         onCheckedChange={(checked) => handleColorPermissionChange(color.id, checked)}
                         disabled={role === 'admin' || role === 'deputy'}
                       />
                      <Label htmlFor={`color-${color.id}-${employee.id}`} className="text-xs cursor-pointer flex items-center gap-1">
                        <div 
                          className="w-3 h-3 rounded border" 
                          style={{ backgroundColor: color.hex_code }}
                        ></div>
                        {color.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
              
              {/* الأحجام */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">الأحجام المسموحة:</h5>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSizePermissions(['all'])}
                    disabled={role === 'admin' || role === 'deputy'}
                  >
                    تحديد كل الأحجام
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {sizes.map(size => (
                    <div key={size.id} className="flex items-center space-x-2 space-x-reverse p-1">
                       <Checkbox
                         id={`size-${size.id}-${employee.id}`}
                         checked={sizePermissions.includes(size.id) || sizePermissions.includes('all') || role === 'admin' || role === 'deputy'}
                         onCheckedChange={(checked) => handleSizePermissionChange(size.id, checked)}
                         disabled={role === 'admin' || role === 'deputy'}
                       />
                      <Label htmlFor={`size-${size.id}-${employee.id}`} className="text-xs cursor-pointer">{size.name}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
              
              {/* الأقسام */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">الأقسام المسموحة:</h5>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDepartmentPermissions(['all'])}
                    disabled={role === 'admin' || role === 'deputy'}
                  >
                    تحديد كل الأقسام
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {departments.map(department => (
                    <div key={department.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded">
                       <Checkbox
                         id={`dept-${department.id}-${employee.id}`}
                         checked={departmentPermissions.includes(department.id) || departmentPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                         onCheckedChange={(checked) => handleDepartmentPermissionChange(department.id, checked)}
                         disabled={role === 'admin' || role === 'deputy'}
                       />
                      <Label htmlFor={`dept-${department.id}-${employee.id}`} className="text-sm cursor-pointer">
                        {department.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
              
              {/* أنواع المنتجات */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">أنواع المنتجات المسموحة:</h5>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProductTypePermissions(['all'])}
                    disabled={role === 'admin' || role === 'deputy'}
                  >
                    تحديد كل الأنواع
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {productTypes.map(productType => (
                    <div key={productType.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded">
                       <Checkbox
                         id={`pt-${productType.id}-${employee.id}`}
                         checked={productTypePermissions.includes(productType.id) || productTypePermissions.includes('all') || role === 'admin' || role === 'deputy'}
                         onCheckedChange={(checked) => handleProductTypePermissionChange(productType.id, checked)}
                         disabled={role === 'admin' || role === 'deputy'}
                       />
                      <Label htmlFor={`pt-${productType.id}-${employee.id}`} className="text-sm cursor-pointer">
                        {productType.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
              
              {/* المواسم والمناسبات */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">المواسم والمناسبات المسموحة:</h5>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSeasonOccasionPermissions(['all'])}
                    disabled={role === 'admin' || role === 'deputy'}
                  >
                    تحديد كل المواسم
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {seasonsOccasions.map(seasonOccasion => (
                    <div key={seasonOccasion.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded">
                       <Checkbox
                         id={`so-${seasonOccasion.id}-${employee.id}`}
                         checked={seasonOccasionPermissions.includes(seasonOccasion.id) || seasonOccasionPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                         onCheckedChange={(checked) => handleSeasonOccasionPermissionChange(seasonOccasion.id, checked)}
                         disabled={role === 'admin' || role === 'deputy'}
                       />
                      <Label htmlFor={`so-${seasonOccasion.id}-${employee.id}`} className="text-sm cursor-pointer">
                        {seasonOccasion.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* منطقة الخطر - للتعديل فقط */}
          {mode === 'edit' && (
            <div className="space-y-2">
              <Label className="text-destructive">منطقة الخطر</Label>
              <Alert variant="destructive">
                <AlertTitle>تعطيل الحساب</AlertTitle>
                <AlertDescription className="flex justify-between items-center">
                  <p>سيؤدي هذا إلى منع الموظف من تسجيل الدخول. يمكن إعادة تفعيله لاحقًا.</p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="w-4 h-4 ml-2" /> تعطيل الحساب
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد تماماً؟</AlertDialogTitle>
                        <AlertDialogDescription>
                          سيتم تعطيل حساب الموظف {employee.full_name} ومنعه من الوصول للنظام.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisableUser} className="bg-destructive hover:bg-destructive/90">
                          نعم، قم بالتعطيل
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          {mode === 'approve' ? (
            <>
              <Button 
                variant="outline" 
                className="text-red-500 border-red-500 hover:bg-red-500/10 hover:text-red-500" 
                onClick={handleReject} 
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2"/> : <X className="w-4 h-4 ml-2" />}
                رفض
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700" 
                onClick={handleApprove} 
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2"/> : <Check className="w-4 h-4 ml-2" />}
                موافقة وتفعيل
              </Button>
            </>
          ) : (
            <Button onClick={handleSaveChanges} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حفظ التغييرات
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedEmployeePermissionsDialog;