import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from '@/components/ui/use-toast';
import { Loader, Shield, User, Settings, Eye, Edit } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import useCleanPermissions from '@/hooks/useCleanPermissions';
import { useVariants } from '@/contexts/VariantsContext';

// تعريف الأدوار المتاحة
const AVAILABLE_ROLES = [
  { id: 'super_admin', name: 'مدير عام', level: 1, description: 'صلاحيات كاملة على النظام' },
  { id: 'department_manager', name: 'مدير قسم', level: 2, description: 'إدارة قسم محدد' },
  { id: 'warehouse_employee', name: 'موظف مخزن', level: 3, description: 'إدارة المخزون والمشتريات' },
  { id: 'cashier', name: 'كاشير', level: 4, description: 'معالجة الطلبات والمدفوعات' },
  { id: 'sales_employee', name: 'موظف مبيعات', level: 5, description: 'إنشاء الطلبات فقط' }
];

// تعريف الصلاحيات المتاحة
const AVAILABLE_PERMISSIONS = [
  // عرض البيانات
  { id: 'view_all_data', name: 'عرض جميع البيانات', category: 'عرض', description: 'رؤية جميع البيانات في النظام' },
  { id: 'view_all_orders', name: 'عرض جميع الطلبات', category: 'عرض', description: 'رؤية طلبات جميع الموظفين' },
  { id: 'view_all_profits', name: 'عرض جميع الأرباح', category: 'عرض', description: 'رؤية أرباح جميع الموظفين' },
  { id: 'view_dashboard', name: 'عرض لوحة التحكم', category: 'عرض', description: 'الوصول للوحة التحكم الرئيسية' },
  { id: 'view_reports', name: 'عرض التقارير', category: 'عرض', description: 'الوصول للتقارير والإحصائيات' },
  
  // إدارة الموظفين
  { id: 'manage_users', name: 'إدارة المستخدمين', category: 'موظفين', description: 'إضافة وتعديل المستخدمين' },
  { id: 'manage_employees', name: 'إدارة الموظفين', category: 'موظفين', description: 'إدارة صلاحيات الموظفين' },
  { id: 'view_all_employees', name: 'عرض جميع الموظفين', category: 'موظفين', description: 'رؤية قائمة جميع الموظفين' },
  
  // إدارة المنتجات
  { id: 'manage_products', name: 'إدارة المنتجات', category: 'منتجات', description: 'إضافة وتعديل المنتجات' },
  { id: 'manage_inventory', name: 'إدارة المخزون', category: 'منتجات', description: 'تحديث كميات المخزون' },
  { id: 'manage_purchases', name: 'إدارة المشتريات', category: 'منتجات', description: 'إضافة المشتريات والموردين' },
  { id: 'manage_variants', name: 'إدارة المتغيرات', category: 'منتجات', description: 'إدارة الألوان والأحجام والتصنيفات' },
  
  // إدارة الطلبات
  { id: 'create_orders', name: 'إنشاء طلبات', category: 'طلبات', description: 'إنشاء طلبات جديدة' },
  { id: 'manage_orders', name: 'إدارة الطلبات', category: 'طلبات', description: 'تعديل وإلغاء الطلبات' },
  { id: 'view_orders', name: 'عرض الطلبات', category: 'طلبات', description: 'رؤية قائمة الطلبات' },
  
  // إدارة الأرباح
  { id: 'view_profits', name: 'عرض الأرباح', category: 'أرباح', description: 'رؤية الأرباح الشخصية' },
  { id: 'manage_profit_settlement', name: 'إدارة تسوية الأرباح', category: 'أرباح', description: 'الموافقة على طلبات التسوية' },
  { id: 'request_profit_settlement', name: 'طلب تسوية أرباح', category: 'أرباح', description: 'تقديم طلبات تسوية الأرباح' },
  
  // إدارة النظام
  { id: 'manage_settings', name: 'إدارة الإعدادات', category: 'نظام', description: 'تعديل إعدادات النظام' },
  { id: 'view_accounting', name: 'عرض المحاسبة', category: 'نظام', description: 'الوصول لصفحة المحاسبة' },
  { id: 'manage_finances', name: 'إدارة المالية', category: 'نظام', description: 'إدارة المعاملات المالية' },
  
  // إدارة المساعد الذكي
  { id: 'use_ai_assistant', name: 'استخدام المساعد الذكي', category: 'ذكي', description: 'الوصول للمساعد الذكي وطلبات التليغرام' }
];

export const UnifiedPermissionsManager = ({ 
  open, 
  onClose, 
  employee,
  onSave 
}) => {
  const { permissions: userPermissions, isAdmin } = useCleanPermissions();
  const { categories, colors, sizes, departments, productTypes, seasonsOccasions } = useVariants();
  
  const [loading, setLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [variantPermissions, setVariantPermissions] = useState({
    category: { has_full_access: true, allowed_items: [] },
    color: { has_full_access: true, allowed_items: [] },
    size: { has_full_access: true, allowed_items: [] },
    department: { has_full_access: true, allowed_items: [] },
    product_type: { has_full_access: true, allowed_items: [] },
    season_occasion: { has_full_access: true, allowed_items: [] }
  });

  // تحديد الأدوار والصلاحيات عند فتح النافذة
  React.useEffect(() => {
    if (employee && open) {
      // جلب الأدوار الحالية
      fetchUserRoles();
      // جلب الصلاحيات الحالية
      fetchUserPermissions();
      // جلب صلاحيات المنتجات
      fetchProductPermissions();
    }
  }, [employee, open]);

  const fetchUserRoles = async () => {
    if (!employee?.user_id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles!inner(name, display_name)
        `)
        .eq('user_id', employee.user_id)
        .eq('is_active', true);

      if (error) throw error;
      
      setSelectedRoles(data?.map(r => r.roles.name) || []);
    } catch (error) {
      console.error('خطأ في جلب الأدوار:', error);
    }
  };

  const fetchUserPermissions = async () => {
    if (!employee?.user_id) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_user_permissions', { p_user_id: employee.user_id });

      if (error) throw error;
      
      setSelectedPermissions(data || []);
    } catch (error) {
      console.error('خطأ في جلب الصلاحيات:', error);
    }
  };

  const fetchProductPermissions = async () => {
    if (!employee?.user_id) return;
    
    try {
      const permissionTypes = ['category', 'color', 'size', 'department', 'product_type', 'season_occasion'];
      const permissions = {};

      for (const type of permissionTypes) {
        const { data, error } = await supabase
          .rpc('get_user_product_access', { 
            p_user_id: employee.user_id, 
            p_permission_type: type 
          });

        if (!error && data) {
          permissions[type] = data;
        } else {
          permissions[type] = { has_full_access: true, allowed_items: [] };
        }
      }

      setVariantPermissions(permissions);
    } catch (error) {
      console.error('خطأ في جلب صلاحيات المنتجات:', error);
    }
  };

  const handleSave = async () => {
    if (!employee?.user_id) return;
    
    setLoading(true);
    try {
      // حفظ الأدوار
      await saveUserRoles();
      
      // حفظ الصلاحيات
      await saveUserPermissions();
      
      // حفظ صلاحيات المنتجات
      await saveProductPermissions();
      
      toast({
        title: "تم الحفظ بنجاح",
        description: "تم تحديث صلاحيات الموظف بنجاح",
      });
      
      onSave?.();
      onClose();
    } catch (error) {
      console.error('خطأ في الحفظ:', error);
      toast({
        title: "خطأ في الحفظ",
        description: "حدث خطأ أثناء تحديث الصلاحيات",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveUserRoles = async () => {
    // حذف الأدوار الحالية
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', employee.user_id);

    // إضافة الأدوار الجديدة
    if (selectedRoles.length > 0) {
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, name')
        .in('name', selectedRoles);

      if (rolesData) {
        const userRoles = rolesData.map(role => ({
          user_id: employee.user_id,
          role_id: role.id,
          assigned_by: userPermissions.user?.id
        }));

        await supabase
          .from('user_roles')
          .insert(userRoles);
      }
    }
  };

  const saveUserPermissions = async () => {
    // يتم التعامل مع الصلاحيات عبر الأدوار، لا حاجة لحفظها منفصلة
    // في المستقبل يمكن إضافة صلاحيات مخصصة هنا
  };

  const saveProductPermissions = async () => {
    // حذف الصلاحيات الحالية
    await supabase
      .from('user_product_permissions')
      .delete()
      .eq('user_id', employee.user_id);

    // إضافة الصلاحيات الجديدة
    const permissionsToSave = [];
    
    Object.entries(variantPermissions).forEach(([type, permission]) => {
      if (!permission.has_full_access || permission.allowed_items.length > 0) {
        permissionsToSave.push({
          user_id: employee.user_id,
          permission_type: type,
          has_full_access: permission.has_full_access,
          allowed_items: permission.allowed_items
        });
      }
    });

    if (permissionsToSave.length > 0) {
      await supabase
        .from('user_product_permissions')
        .insert(permissionsToSave);
    }
  };

  const updateVariantPermission = (type, updates) => {
    setVariantPermissions(prev => ({
      ...prev,
      [type]: { ...prev[type], ...updates }
    }));
  };

  // تجميع الصلاحيات حسب الفئة
  const permissionsByCategory = useMemo(() => {
    return AVAILABLE_PERMISSIONS.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    }, {});
  }, []);

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            إدارة صلاحيات الموظف: {employee.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* الأدوار */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              الأدوار
            </h3>
            
            <div className="grid gap-3">
              {AVAILABLE_ROLES.map(role => (
                <Label 
                  key={role.id} 
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRoles([...selectedRoles, role.id]);
                      } else {
                        setSelectedRoles(selectedRoles.filter(r => r !== role.id));
                      }
                    }}
                    disabled={!isAdmin}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{role.name}</span>
                      <Badge variant="outline" className="text-xs">
                        مستوى {role.level}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  </div>
                </Label>
              ))}
            </div>
          </div>

          {/* صلاحيات المنتجات والمتغيرات */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              صلاحيات المنتجات والمتغيرات
            </h3>
            
            <Accordion type="multiple" className="w-full">
              {/* التصنيفات */}
              <AccordionItem value="categories">
                <AccordionTrigger className="text-right">
                  التصنيفات ({categories?.length || 0})
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Checkbox
                      checked={variantPermissions.category.has_full_access}
                      onCheckedChange={(checked) => 
                        updateVariantPermission('category', { 
                          has_full_access: checked,
                          allowed_items: checked ? [] : variantPermissions.category.allowed_items
                        })
                      }
                    />
                    جميع التصنيفات
                  </Label>
                  
                  {!variantPermissions.category.has_full_access && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {categories?.map(category => (
                        <Label key={category.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={variantPermissions.category.allowed_items.includes(category.id)}
                            onCheckedChange={(checked) => {
                              const items = variantPermissions.category.allowed_items;
                              if (checked) {
                                updateVariantPermission('category', {
                                  allowed_items: [...items, category.id]
                                });
                              } else {
                                updateVariantPermission('category', {
                                  allowed_items: items.filter(id => id !== category.id)
                                });
                              }
                            }}
                          />
                          {category.name}
                        </Label>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* الألوان */}
              <AccordionItem value="colors">
                <AccordionTrigger className="text-right">
                  الألوان ({colors?.length || 0})
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Checkbox
                      checked={variantPermissions.color.has_full_access}
                      onCheckedChange={(checked) => 
                        updateVariantPermission('color', { 
                          has_full_access: checked,
                          allowed_items: checked ? [] : variantPermissions.color.allowed_items
                        })
                      }
                    />
                    جميع الألوان
                  </Label>
                  
                  {!variantPermissions.color.has_full_access && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {colors?.map(color => (
                        <Label key={color.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={variantPermissions.color.allowed_items.includes(color.id)}
                            onCheckedChange={(checked) => {
                              const items = variantPermissions.color.allowed_items;
                              if (checked) {
                                updateVariantPermission('color', {
                                  allowed_items: [...items, color.id]
                                });
                              } else {
                                updateVariantPermission('color', {
                                  allowed_items: items.filter(id => id !== color.id)
                                });
                              }
                            }}
                          />
                          <div className="flex items-center gap-2">
                            {color.hex_code && (
                              <div 
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: color.hex_code }}
                              />
                            )}
                            {color.name}
                          </div>
                        </Label>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* الأحجام */}
              <AccordionItem value="sizes">
                <AccordionTrigger className="text-right">
                  الأحجام ({sizes?.length || 0})
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Checkbox
                      checked={variantPermissions.size.has_full_access}
                      onCheckedChange={(checked) => 
                        updateVariantPermission('size', { 
                          has_full_access: checked,
                          allowed_items: checked ? [] : variantPermissions.size.allowed_items
                        })
                      }
                    />
                    جميع الأحجام
                  </Label>
                  
                  {!variantPermissions.size.has_full_access && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {sizes?.map(size => (
                        <Label key={size.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={variantPermissions.size.allowed_items.includes(size.id)}
                            onCheckedChange={(checked) => {
                              const items = variantPermissions.size.allowed_items;
                              if (checked) {
                                updateVariantPermission('size', {
                                  allowed_items: [...items, size.id]
                                });
                              } else {
                                updateVariantPermission('size', {
                                  allowed_items: items.filter(id => id !== size.id)
                                });
                              }
                            }}
                          />
                          {size.name}
                        </Label>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* الأقسام */}
              <AccordionItem value="departments">
                <AccordionTrigger className="text-right">
                  الأقسام ({departments?.length || 0})
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Checkbox
                      checked={variantPermissions.department.has_full_access}
                      onCheckedChange={(checked) => 
                        updateVariantPermission('department', { 
                          has_full_access: checked,
                          allowed_items: checked ? [] : variantPermissions.department.allowed_items
                        })
                      }
                    />
                    جميع الأقسام
                  </Label>
                  
                  {!variantPermissions.department.has_full_access && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {departments?.map(department => (
                        <Label key={department.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={variantPermissions.department.allowed_items.includes(department.id)}
                            onCheckedChange={(checked) => {
                              const items = variantPermissions.department.allowed_items;
                              if (checked) {
                                updateVariantPermission('department', {
                                  allowed_items: [...items, department.id]
                                });
                              } else {
                                updateVariantPermission('department', {
                                  allowed_items: items.filter(id => id !== department.id)
                                });
                              }
                            }}
                          />
                          {department.name}
                        </Label>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* أنواع المنتجات */}
              <AccordionItem value="product-types">
                <AccordionTrigger className="text-right">
                  أنواع المنتجات ({productTypes?.length || 0})
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Checkbox
                      checked={variantPermissions.product_type.has_full_access}
                      onCheckedChange={(checked) => 
                        updateVariantPermission('product_type', { 
                          has_full_access: checked,
                          allowed_items: checked ? [] : variantPermissions.product_type.allowed_items
                        })
                      }
                    />
                    جميع أنواع المنتجات
                  </Label>
                  
                  {!variantPermissions.product_type.has_full_access && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {productTypes?.map(type => (
                        <Label key={type.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={variantPermissions.product_type.allowed_items.includes(type.id)}
                            onCheckedChange={(checked) => {
                              const items = variantPermissions.product_type.allowed_items;
                              if (checked) {
                                updateVariantPermission('product_type', {
                                  allowed_items: [...items, type.id]
                                });
                              } else {
                                updateVariantPermission('product_type', {
                                  allowed_items: items.filter(id => id !== type.id)
                                });
                              }
                            }}
                          />
                          {type.name}
                        </Label>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* المواسم والمناسبات */}
              <AccordionItem value="seasons-occasions">
                <AccordionTrigger className="text-right">
                  المواسم والمناسبات ({seasonsOccasions?.length || 0})
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Checkbox
                      checked={variantPermissions.season_occasion.has_full_access}
                      onCheckedChange={(checked) => 
                        updateVariantPermission('season_occasion', { 
                          has_full_access: checked,
                          allowed_items: checked ? [] : variantPermissions.season_occasion.allowed_items
                        })
                      }
                    />
                    جميع المواسم والمناسبات
                  </Label>
                  
                  {!variantPermissions.season_occasion.has_full_access && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {seasonsOccasions?.map(item => (
                        <Label key={item.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={variantPermissions.season_occasion.allowed_items.includes(item.id)}
                            onCheckedChange={(checked) => {
                              const items = variantPermissions.season_occasion.allowed_items;
                              if (checked) {
                                updateVariantPermission('season_occasion', {
                                  allowed_items: [...items, item.id]
                                });
                              } else {
                                updateVariantPermission('season_occasion', {
                                  allowed_items: items.filter(id => id !== item.id)
                                });
                              }
                            }}
                          />
                          <div>
                            <span>{item.name}</span>
                            <Badge variant="outline" className="mr-2 text-xs">
                              {item.type === 'season' ? 'موسم' : 'مناسبة'}
                            </Badge>
                          </div>
                        </Label>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            حفظ الصلاحيات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedPermissionsManager;