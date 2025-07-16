import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Users, Filter, Tag, Palette, Package, Calendar, Ruler, Building } from 'lucide-react';

const PermissionBasedEmployeeSettings = ({ employeeId, onClose }) => {
  const { user: currentUser } = useAuth();
  const { 
    filterCategoriesByPermission,
    filterSizesByPermission,
    filterColorsByPermission,
    filterDepartmentsByPermission,
    filterProductTypesByPermission,
    filterSeasonsOccasionsByPermission
  } = usePermissionBasedData();

  const [employee, setEmployee] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [seasonsOccasions, setSeasonsOccasions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [permissions, setPermissions] = useState({
    categories: [],
    sizes: [],
    colors: [],
    departments: [],
    productTypes: [],
    seasonsOccasions: []
  });

  useEffect(() => {
    loadData();
  }, [employeeId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // جلب بيانات الموظف
      const { data: employeeData, error: employeeError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', employeeId)
        .single();

      if (employeeError) throw employeeError;
      setEmployee(employeeData);

      // جلب جميع البيانات
      const [categoriesRes, sizesRes, colorsRes, departmentsRes, productTypesRes, seasonsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('display_order', { nullsFirst: false }),
        supabase.from('colors').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
        supabase.from('product_types').select('*').order('name'),
        supabase.from('seasons_occasions').select('*').order('name')
      ]);

      setCategories(categoriesRes.data || []);
      setSizes(sizesRes.data || []);
      setColors(colorsRes.data || []);
      setDepartments(departmentsRes.data || []);
      setProductTypes(productTypesRes.data || []);
      setSeasonsOccasions(seasonsRes.data || []);

      // تعيين الصلاحيات الحالية
      setPermissions({
        categories: employeeData?.category_permissions || [],
        sizes: employeeData?.size_permissions || [],
        colors: employeeData?.color_permissions || [],
        departments: employeeData?.department_permissions || [],
        productTypes: employeeData?.product_type_permissions || [],
        seasonsOccasions: employeeData?.season_occasion_permissions || []
      });

    } catch (error) {
      console.error('خطأ في جلب البيانات:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في جلب بيانات الموظف',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (type, itemId, checked) => {
    setPermissions(prev => {
      const newPermissions = { ...prev };
      
      if (checked) {
        // إضافة العنصر
        if (!newPermissions[type].includes(itemId)) {
          newPermissions[type] = [...newPermissions[type], itemId];
        }
      } else {
        // إزالة العنصر
        newPermissions[type] = newPermissions[type].filter(id => id !== itemId);
      }
      
      return newPermissions;
    });
  };

  const handleSelectAll = (type, allItems) => {
    setPermissions(prev => ({
      ...prev,
      [type]: allItems.map(item => item.id)
    }));
  };

  const handleSelectNone = (type) => {
    setPermissions(prev => ({
      ...prev,
      [type]: []
    }));
  };

  const savePermissions = async () => {
    try {
      setLoading(true);

      const updateData = {
        category_permissions: permissions.categories,
        size_permissions: permissions.sizes,
        color_permissions: permissions.colors,
        department_permissions: permissions.departments,
        product_type_permissions: permissions.productTypes,
        season_occasion_permissions: permissions.seasonsOccasions,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', employeeId);

      if (error) throw error;

      toast({
        title: 'تم الحفظ',
        description: 'تم تحديث صلاحيات الموظف بنجاح',
        variant: 'success'
      });

      onClose();
    } catch (error) {
      console.error('خطأ في حفظ الصلاحيات:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في حفظ الصلاحيات',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const PermissionSection = ({ title, icon: Icon, type, items, selectedItems }) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {title}
        </CardTitle>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleSelectAll(type, items)}
          >
            اختيار الكل
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleSelectNone(type)}
          >
            إلغاء الكل
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id={`${type}-${item.id}`}
                checked={selectedItems.includes(item.id)}
                onCheckedChange={(checked) => 
                  handlePermissionChange(type, item.id, checked)
                }
              />
              <Label 
                htmlFor={`${type}-${item.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {item.name}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">
          إدارة صلاحيات الموظف: {employee?.full_name}
        </h2>
        <p className="text-muted-foreground mt-2">
          تحديد المتغيرات والفئات التي يمكن للموظف الوصول إليها
        </p>
      </div>

      <PermissionSection
        title="التصنيفات"
        icon={Tag}
        type="categories"
        items={categories}
        selectedItems={permissions.categories}
      />

      <PermissionSection
        title="الأقسام"
        icon={Building}
        type="departments"
        items={departments}
        selectedItems={permissions.departments}
      />

      <PermissionSection
        title="الألوان"
        icon={Palette}
        type="colors"
        items={colors}
        selectedItems={permissions.colors}
      />

      <PermissionSection
        title="المقاسات"
        icon={Ruler}
        type="sizes"
        items={sizes}
        selectedItems={permissions.sizes}
      />

      <PermissionSection
        title="أنواع المنتجات"
        icon={Package}
        type="productTypes"
        items={productTypes}
        selectedItems={permissions.productTypes}
      />

      <PermissionSection
        title="المواسم والمناسبات"
        icon={Calendar}
        type="seasonsOccasions"
        items={seasonsOccasions}
        selectedItems={permissions.seasonsOccasions}
      />

      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button variant="outline" onClick={onClose}>
          إلغاء
        </Button>
        <Button onClick={savePermissions} disabled={loading}>
          {loading ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
        </Button>
      </div>
    </div>
  );
};

export default PermissionBasedEmployeeSettings;