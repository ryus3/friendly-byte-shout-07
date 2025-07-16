import React, { useState, useEffect } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { permissionsMap } from '@/lib/permissions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Shield, Eye, Home, Package } from 'lucide-react';

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
    'view_profits'
  ];
};

const EmployeePermissionsForm = ({ employee, onUpdate }) => {
  const { categories, colors, sizes, departments, productTypes, seasonsOccasions } = useVariants();
  
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [role, setRole] = useState('employee');
  const [defaultPage, setDefaultPage] = useState('/');
  const [orderCreationMode, setOrderCreationMode] = useState('choice');
  const [categoryPermissions, setCategoryPermissions] = useState(['all']);
  const [colorPermissions, setColorPermissions] = useState(['all']);
  const [sizePermissions, setSizePermissions] = useState(['all']);
  const [departmentPermissions, setDepartmentPermissions] = useState(['all']);
  const [productTypePermissions, setProductTypePermissions] = useState(['all']);
  const [seasonOccasionPermissions, setSeasonOccasionPermissions] = useState(['all']);

  useEffect(() => {
    if (employee) {
      setRole(employee.role || 'employee');
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

  const getCurrentData = () => ({
    role,
    permissions: (role === 'admin' || role === 'deputy') ? ['*'] : selectedPermissions,
    default_page: defaultPage,
    order_creation_mode: orderCreationMode,
    category_permissions: (role === 'admin' || role === 'deputy') ? ['all'] : categoryPermissions,
    color_permissions: (role === 'admin' || role === 'deputy') ? ['all'] : colorPermissions,
    size_permissions: (role === 'admin' || role === 'deputy') ? ['all'] : sizePermissions,
    department_permissions: (role === 'admin' || role === 'deputy') ? ['all'] : departmentPermissions,
    product_type_permissions: (role === 'admin' || role === 'deputy') ? ['all'] : productTypePermissions,
    season_occasion_permissions: (role === 'admin' || role === 'deputy') ? ['all'] : seasonOccasionPermissions
  });

  // Expose current data to parent
  useEffect(() => {
    if (onUpdate) {
      onUpdate(getCurrentData());
    }
  }, [role, selectedPermissions, defaultPage, orderCreationMode, categoryPermissions, colorPermissions, sizePermissions, departmentPermissions, productTypePermissions, seasonOccasionPermissions]);

  return (
    <div className="space-y-4">
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
                        id={`${employee?.id || 'new'}-${permission.id}`}
                        checked={role === 'admin' || role === 'deputy' || selectedPermissions.includes(permission.id)}
                        onCheckedChange={(checked) => handlePermissionChange(permission.id, checked)}
                        disabled={role === 'admin' || role === 'deputy'}
                      />
                      <Label htmlFor={`${employee?.id || 'new'}-${permission.id}`} className="text-sm cursor-pointer">
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
                    id={`cat-${category.id}-${employee?.id || 'new'}`}
                    checked={categoryPermissions.includes(category.id) || categoryPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                    onCheckedChange={(checked) => handleCategoryPermissionChange(category.id, checked)}
                    disabled={role === 'admin' || role === 'deputy' || categoryPermissions.includes('all')}
                  />
                  <Label htmlFor={`cat-${category.id}-${employee?.id || 'new'}`} className="text-sm font-medium cursor-pointer flex items-center gap-2">
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
                    id={`color-${color.id}-${employee?.id || 'new'}`}
                    checked={colorPermissions.includes(color.id) || colorPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                    onCheckedChange={(checked) => handleColorPermissionChange(color.id, checked)}
                    disabled={role === 'admin' || role === 'deputy' || colorPermissions.includes('all')}
                  />
                  <Label htmlFor={`color-${color.id}-${employee?.id || 'new'}`} className="text-xs cursor-pointer flex items-center gap-1">
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
                    id={`size-${size.id}-${employee?.id || 'new'}`}
                    checked={sizePermissions.includes(size.id) || sizePermissions.includes('all') || role === 'admin' || role === 'deputy'}
                    onCheckedChange={(checked) => handleSizePermissionChange(size.id, checked)}
                    disabled={role === 'admin' || role === 'deputy' || sizePermissions.includes('all')}
                  />
                  <Label htmlFor={`size-${size.id}-${employee?.id || 'new'}`} className="text-xs cursor-pointer">{size.name}</Label>
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
                    id={`dept-${department.id}-${employee?.id || 'new'}`}
                    checked={departmentPermissions.includes(department.id) || departmentPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                    onCheckedChange={(checked) => handleDepartmentPermissionChange(department.id, checked)}
                    disabled={role === 'admin' || role === 'deputy' || departmentPermissions.includes('all')}
                  />
                  <Label htmlFor={`dept-${department.id}-${employee?.id || 'new'}`} className="text-sm font-medium cursor-pointer">
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
              {productTypes.map(productType => (
                <div key={productType.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded">
                  <Checkbox
                    id={`type-${productType.id}-${employee?.id || 'new'}`}
                    checked={productTypePermissions.includes(productType.id) || productTypePermissions.includes('all') || role === 'admin' || role === 'deputy'}
                    onCheckedChange={(checked) => handleProductTypePermissionChange(productType.id, checked)}
                    disabled={role === 'admin' || role === 'deputy' || productTypePermissions.includes('all')}
                  />
                  <Label htmlFor={`type-${productType.id}-${employee?.id || 'new'}`} className="text-sm font-medium cursor-pointer">
                    {productType.name}
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
              {seasonsOccasions.map(seasonOccasion => (
                <div key={seasonOccasion.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded">
                  <Checkbox
                    id={`season-${seasonOccasion.id}-${employee?.id || 'new'}`}
                    checked={seasonOccasionPermissions.includes(seasonOccasion.id) || seasonOccasionPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                    onCheckedChange={(checked) => handleSeasonOccasionPermissionChange(seasonOccasion.id, checked)}
                    disabled={role === 'admin' || role === 'deputy' || seasonOccasionPermissions.includes('all')}
                  />
                  <Label htmlFor={`season-${seasonOccasion.id}-${employee?.id || 'new'}`} className="text-sm font-medium cursor-pointer">
                    {seasonOccasion.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeePermissionsForm;