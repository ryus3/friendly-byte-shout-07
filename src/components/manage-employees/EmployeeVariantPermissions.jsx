import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useVariants } from '@/contexts/VariantsContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Package, Palette, Ruler, Grid3X3, Tag, Calendar } from 'lucide-react';

const EmployeeVariantPermissions = ({ employee, onSave }) => {
  const { categories, colors, sizes, departments, productTypes, seasonsOccasions } = useVariants();
  const [permissions, setPermissions] = useState({
    categories: [],
    colors: [],
    sizes: [],
    departments: [],
    productTypes: [],
    seasonsOccasions: []
  });

  useEffect(() => {
    if (employee) {
      setPermissions({
        categories: JSON.parse(employee.category_permissions || '[]'),
        colors: JSON.parse(employee.color_permissions || '[]'),
        sizes: JSON.parse(employee.size_permissions || '[]'),
        departments: JSON.parse(employee.department_permissions || '[]'),
        productTypes: JSON.parse(employee.product_type_permissions || '[]'),
        seasonsOccasions: JSON.parse(employee.season_occasion_permissions || '[]')
      });
    }
  }, [employee]);

  const handlePermissionChange = (type, itemId, checked) => {
    setPermissions(prev => {
      const current = prev[type];
      if (checked) {
        if (itemId === 'all') {
          return { ...prev, [type]: ['all'] };
        } else if (current.includes('all')) {
          return { ...prev, [type]: [itemId] };
        } else {
          return { ...prev, [type]: [...current, itemId] };
        }
      } else {
        if (itemId === 'all') {
          return { ...prev, [type]: [] };
        } else {
          return { ...prev, [type]: current.filter(id => id !== itemId) };
        }
      }
    });
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          category_permissions: JSON.stringify(permissions.categories),
          color_permissions: JSON.stringify(permissions.colors),
          size_permissions: JSON.stringify(permissions.sizes),
          department_permissions: JSON.stringify(permissions.departments),
          product_type_permissions: JSON.stringify(permissions.productTypes),
          season_occasion_permissions: JSON.stringify(permissions.seasonsOccasions)
        })
        .eq('user_id', employee.user_id);

      if (error) throw error;

      toast({
        title: "تم الحفظ",
        description: "تم حفظ صلاحيات المتغيرات بنجاح"
      });

      if (onSave) onSave();
    } catch (error) {
      console.error('Error saving variant permissions:', error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ الصلاحيات",
        variant: "destructive"
      });
    }
  };

  const renderPermissionSection = (title, icon, items, type, permissionKey) => {
    const Icon = icon;
    const currentPermissions = permissions[permissionKey] || [];
    const hasAll = currentPermissions.includes('all');

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse p-2 bg-primary/5 rounded">
              <Checkbox
                id={`${type}-all`}
                checked={hasAll}
                onCheckedChange={(checked) => handlePermissionChange(permissionKey, 'all', checked)}
              />
              <Label htmlFor={`${type}-all`} className="font-medium">
                الوصول لجميع {title}
              </Label>
            </div>
            
            {!hasAll && (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {items.map(item => (
                  <div key={item.id} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id={`${type}-${item.id}`}
                      checked={currentPermissions.includes(item.id)}
                      onCheckedChange={(checked) => handlePermissionChange(permissionKey, item.id, checked)}
                    />
                    <Label htmlFor={`${type}-${item.id}`} className="text-sm">
                      {item.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderPermissionSection('التصنيفات الرئيسية', Package, categories, 'categories', 'categories')}
        {renderPermissionSection('الأقسام', Grid3X3, departments, 'departments', 'departments')}
        {renderPermissionSection('الألوان', Palette, colors, 'colors', 'colors')}
        {renderPermissionSection('الأحجام', Ruler, sizes, 'sizes', 'sizes')}
        {renderPermissionSection('أنواع المنتجات', Tag, productTypes, 'productTypes', 'productTypes')}
        {renderPermissionSection('المواسم والمناسبات', Calendar, seasonsOccasions, 'seasonsOccasions', 'seasonsOccasions')}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          حفظ صلاحيات المتغيرات
        </Button>
      </div>
    </div>
  );
};

export default EmployeeVariantPermissions;