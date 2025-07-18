import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useVariants } from '@/contexts/VariantsContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ProductCategoryFilter = ({ onFilterChange, products }) => {
  const { isAdmin, hasPermission, productPermissions } = useAuth();
  const { categories, departments } = useVariants();
  
  // حفظ إعدادات الفلتر محلياً
  const [savedFilters, setSavedFilters] = useLocalStorage('productCategoryFilters', {
    category: 'all',
    department: 'all'
  });

  const [activeFilters, setActiveFilters] = useState(savedFilters);

  // الحصول على التصنيفات والأقسام المسموحة للمستخدم
  const allowedData = useMemo(() => {
    if (isAdmin) {
      return {
        allowedCategories: categories,
        allowedDepartments: departments
      };
    }

    // للموظفين - فقط ما هو مسموح
    const categoryPerm = productPermissions?.category;
    const departmentPerm = productPermissions?.department;

    const allowedCategories = categoryPerm?.has_full_access 
      ? categories 
      : categories.filter(cat => categoryPerm?.allowed_items?.includes(cat.id)) || [];

    const allowedDepartments = departmentPerm?.has_full_access 
      ? departments 
      : departments.filter(dept => departmentPerm?.allowed_items?.includes(dept.id)) || [];

    return {
      allowedCategories,
      allowedDepartments
    };
  }, [isAdmin, categories, departments, productPermissions]);

  // تحديث الفلاتر عند تغييرها
  useEffect(() => {
    setSavedFilters(activeFilters);
    onFilterChange?.(activeFilters);
  }, [activeFilters, setSavedFilters, onFilterChange]);

  const handleFilterChange = (type, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const resetFilters = () => {
    const resetValues = { category: 'all', department: 'all' };
    setActiveFilters(resetValues);
  };

  const hasActiveFilters = activeFilters.category !== 'all' || activeFilters.department !== 'all';

  // إذا لم يكن لدى المستخدم صلاحيات متعددة، لا نعرض الفلتر
  if (!isAdmin && allowedData.allowedCategories.length <= 1 && allowedData.allowedDepartments.length <= 1) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <CardTitle className="text-sm">فلترة المنتجات</CardTitle>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs h-7"
            >
              <X className="w-3 h-3 ml-1" />
              إعادة تعيين
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* فلتر الأقسام */}
          {allowedData.allowedDepartments.length > 1 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">القسم</Label>
              <Select
                value={activeFilters.department}
                onValueChange={(value) => handleFilterChange('department', value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأقسام</SelectItem>
                  {allowedData.allowedDepartments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* فلتر التصنيفات */}
          {allowedData.allowedCategories.length > 1 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">التصنيف الرئيسي</Label>
              <Select
                value={activeFilters.category}
                onValueChange={(value) => handleFilterChange('category', value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="اختر التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع التصنيفات</SelectItem>
                  {allowedData.allowedCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* معلومات الفلترة الحالية */}
        {hasActiveFilters && (
          <div className="pt-2 border-t">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {activeFilters.department !== 'all' && (
                <span className="bg-accent px-2 py-1 rounded">
                  القسم: {allowedData.allowedDepartments.find(d => d.id === activeFilters.department)?.name}
                </span>
              )}
              {activeFilters.category !== 'all' && (
                <span className="bg-accent px-2 py-1 rounded">
                  التصنيف: {allowedData.allowedCategories.find(c => c.id === activeFilters.category)?.name}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductCategoryFilter;