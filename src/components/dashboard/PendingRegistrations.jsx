import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, X, Shield, User, UserPlus, Home, Loader2, Package, Eye } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { permissionsMap } from '@/lib/permissions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/contexts/NotificationsContext';


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

// صلاحيات افتراضية للموظف العادي
const getDefaultPermissions = (role) => {
  if (role === 'admin' || role === 'deputy') {
    return ['*'];
  }
  
  // صلاحيات افتراضية للموظف
  return [
    'view_products',
    'create_orders', 
    'view_orders',
    'edit_orders',
    'view_inventory',
    'view_customers',
    'create_customers',
    'edit_customers',
    'view_profits'
  ];
};

const UserCard = ({ user, onApprove, onReject }) => {
  const { categories, colors, sizes, departments, productTypes, seasonsOccasions } = useVariants();
  const [selectedPermissions, setSelectedPermissions] = useState(getDefaultPermissions('employee'));
  const [role, setRole] = useState('employee');
  const [defaultPage, setDefaultPage] = useState('/');
  const [orderCreationMode, setOrderCreationMode] = useState('choice');
  const [categoryPermissions, setCategoryPermissions] = useState(['all']);
  const [colorPermissions, setColorPermissions] = useState(['all']);
  const [sizePermissions, setSizePermissions] = useState(['all']);
  const [departmentPermissions, setDepartmentPermissions] = useState(['all']);
  const [productTypePermissions, setProductTypePermissions] = useState(['all']);
  const [seasonOccasionPermissions, setSeasonOccasionPermissions] = useState(['all']);
  const [isProcessing, setIsProcessing] = useState(false);

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
    
    // تحديد صلاحيات المتغيرات حسب الدور
    if (newRole === 'admin' || newRole === 'deputy') {
      setCategoryPermissions(['all']);
      setColorPermissions(['all']);
      setSizePermissions(['all']);
      setDepartmentPermissions(['all']);
      setProductTypePermissions(['all']);
      setSeasonOccasionPermissions(['all']);
    } else {
      // للموظف العادي: صلاحيات محددة افتراضية
      setCategoryPermissions(['all']);
      setColorPermissions(['all']);
      setSizePermissions(['all']);
      setDepartmentPermissions(['all']);
      setProductTypePermissions(['all']);
      setSeasonOccasionPermissions(['all']);
    }
  }


  const handleAction = async (action, userId, data) => {
    setIsProcessing(true);
    try {
      await action(userId, data);
    } catch (error) {
      console.error('Error in action:', error);
    }
    setIsProcessing(false);
  };

  const handleApproveClick = () => {
    const finalPermissions = (role === 'admin' || role === 'deputy') ? ['*'] : selectedPermissions;
    const isAdminOrDeputy = role === 'admin' || role === 'deputy';
    
    handleAction(onApprove, user.id, { 
      permissions: finalPermissions, 
      role, 
      default_page: defaultPage,
      order_creation_mode: orderCreationMode,
      category_permissions: isAdminOrDeputy ? ['all'] : categoryPermissions,
      color_permissions: isAdminOrDeputy ? ['all'] : colorPermissions,
      size_permissions: isAdminOrDeputy ? ['all'] : sizePermissions,
      department_permissions: isAdminOrDeputy ? ['all'] : departmentPermissions,
      product_type_permissions: isAdminOrDeputy ? ['all'] : productTypePermissions,
      season_occasion_permissions: isAdminOrDeputy ? ['all'] : seasonOccasionPermissions
    });
  };

  const handleRejectClick = () => {
    handleAction(onReject, user.id);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className="bg-card/80 dark:bg-zinc-800/50 p-4 rounded-lg border border-border"
    >
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-full">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground">{user.full_name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              @{user.username}
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" className="text-red-500 border-red-500 hover:bg-red-500/10 hover:text-red-500" onClick={handleRejectClick} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <X className="w-4 h-4 mr-2" />}
            رفض
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleApproveClick} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4 mr-2" />}
            موافقة
          </Button>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-border space-y-4">
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
          <div className="md:col-span-2">
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
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            تحديد الصلاحيات
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
                          id={`${user.id}-${permission.id}`}
                          checked={role === 'admin' || role === 'deputy' || selectedPermissions.includes(permission.id)}
                          onCheckedChange={(checked) => handlePermissionChange(permission.id, checked)}
                          disabled={role === 'admin' || role === 'deputy'}
                        />
                        <Label htmlFor={`${user.id}-${permission.id}`} className="text-sm cursor-pointer">
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
            صلاحيات التصنيفات والمتغيرات
          </h4>
          <div className="p-4 border rounded-lg space-y-4">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-sm">التصنيفات الرئيسية:</h5>
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
                      id={`cat-${category.id}-${user.id}`}
                      checked={categoryPermissions.includes(category.id) || categoryPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                      onCheckedChange={(checked) => handleCategoryPermissionChange(category.id, checked)}
                      disabled={role === 'admin' || role === 'deputy' || categoryPermissions.includes('all')}
                    />
                    <Label htmlFor={`cat-${category.id}-${user.id}`} className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded border" 
                        style={{ backgroundColor: category.color_hex || '#666' }}
                      ></div>
                      {category.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-sm">الألوان المتاحة:</h5>
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
                      id={`color-${color.id}-${user.id}`}
                      checked={colorPermissions.includes(color.id) || colorPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                      onCheckedChange={(checked) => handleColorPermissionChange(color.id, checked)}
                      disabled={role === 'admin' || role === 'deputy' || colorPermissions.includes('all')}
                    />
                    <Label htmlFor={`color-${color.id}-${user.id}`} className="text-xs cursor-pointer flex items-center gap-1">
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
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-sm">الأحجام المتاحة:</h5>
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
                      id={`size-${size.id}-${user.id}`}
                      checked={sizePermissions.includes(size.id) || sizePermissions.includes('all') || role === 'admin' || role === 'deputy'}
                      onCheckedChange={(checked) => handleSizePermissionChange(size.id, checked)}
                      disabled={role === 'admin' || role === 'deputy' || sizePermissions.includes('all')}
                    />
                    <Label htmlFor={`size-${size.id}-${user.id}`} className="text-xs cursor-pointer">{size.name}</Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-sm">الأقسام المتاحة:</h5>
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
                      id={`dept-${department.id}-${user.id}`}
                      checked={departmentPermissions.includes(department.id) || departmentPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                      onCheckedChange={(checked) => handleDepartmentPermissionChange(department.id, checked)}
                      disabled={role === 'admin' || role === 'deputy' || departmentPermissions.includes('all')}
                    />
                    <Label htmlFor={`dept-${department.id}-${user.id}`} className="text-xs cursor-pointer">
                      {department.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-sm">أنواع المنتجات المتاحة:</h5>
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
                {productTypes.map(type => (
                  <div key={type.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded">
                    <Checkbox
                      id={`type-${type.id}-${user.id}`}
                      checked={productTypePermissions.includes(type.id) || productTypePermissions.includes('all') || role === 'admin' || role === 'deputy'}
                      onCheckedChange={(checked) => handleProductTypePermissionChange(type.id, checked)}
                      disabled={role === 'admin' || role === 'deputy' || productTypePermissions.includes('all')}
                    />
                    <Label htmlFor={`type-${type.id}-${user.id}`} className="text-xs cursor-pointer">
                      {type.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-sm">المواسم والمناسبات المتاحة:</h5>
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
                {seasonsOccasions.map(item => (
                  <div key={item.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded">
                    <Checkbox
                      id={`season-${item.id}-${user.id}`}
                      checked={seasonOccasionPermissions.includes(item.id) || seasonOccasionPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                      onCheckedChange={(checked) => handleSeasonOccasionPermissionChange(item.id, checked)}
                      disabled={role === 'admin' || role === 'deputy' || seasonOccasionPermissions.includes('all')}
                    />
                    <Label htmlFor={`season-${item.id}-${user.id}`} className="text-xs cursor-pointer">
                      {item.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const PendingRegistrations = ({ onClose }) => {
  const { pendingRegistrations, updateUser, refetchAdminData } = useAuth();
  const { deleteNotificationByTypeAndData } = useNotifications();
  
  const handleApprove = async (userId, data) => {
    await updateUser(userId, { ...data, status: 'active' });
    await deleteNotificationByTypeAndData('new_registration', { id: userId });
    refetchAdminData();
  };
  
  const handleReject = async (userId) => {
    await updateUser(userId, { status: 'rejected', permissions: [] });
    await deleteNotificationByTypeAndData('new_registration', { id: userId });
    refetchAdminData();
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="w-full max-w-4xl"
        onClick={e => e.stopPropagation()}
      >
        <Card className="max-h-[90vh] flex flex-col border-2 border-purple-500/30 shadow-2xl shadow-purple-500/10">
          <CardHeader className="border-b border-border">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl gradient-text flex items-center gap-2"><UserPlus /> طلبات التسجيل الجديدة</CardTitle>
                <CardDescription>قم بمراجعة ومنح الصلاحيات للموظفين الجدد.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-6 h-6" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 overflow-y-auto">
            <AnimatePresence>
              {pendingRegistrations && pendingRegistrations.length > 0 ? (
                <div className="space-y-4">
                  {pendingRegistrations.map(user => (
                    <UserCard
                      key={user.id}
                      user={user}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <UserPlus className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="font-bold text-xl">لا توجد طلبات تسجيل جديدة</p>
                  <p className="text-muted-foreground">سيتم عرض الطلبات هنا عند تسجيل الموظفين الجدد.</p>
                </div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default PendingRegistrations;