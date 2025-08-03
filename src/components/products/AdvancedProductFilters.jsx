import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, X, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useFiltersData } from '@/hooks/useFiltersData';

const AdvancedProductFilters = ({ open, onOpenChange, filters, setFilters }) => {
  const { isAdmin } = useAuth();
  const { products } = useInventory();
  
  // استخدام النظام التوحيدي للمرشحات
  const {
    categories,
    departments,
    seasonsOccasions,
    productTypes,
    colors,
    sizes,
    allowedCategories,
    allowedDepartments,
    hasFullAccess,
    loading: filtersLoading
  } = useFiltersData();
  
  // حفظ إعدادات الفلاتر
  const [savedFilters, setSavedFilters] = useLocalStorage('advancedProductFilters', {});

  // تحديث الفلاتر المحفوظة عند التغيير
  useEffect(() => {
    setSavedFilters(filters);
  }, [filters, setSavedFilters]);

  // الحصول على البيانات المسموحة من النظام التوحيدي
  const allowedData = useMemo(() => {
    console.log('🎯 AdvancedProductFilters - البيانات المتوفرة:', {
      hasFullAccess,
      categoriesCount: categories?.length || 0,
      departmentsCount: departments?.length || 0,
      categories: categories,
      filtersLoading
    });

    // استخدام البيانات المفلترة من النظام التوحيدي
    if (hasFullAccess) {
      return {
        categories,
        departments,
        seasonsOccasions,
        productTypes,
        colors,
        sizes
      };
    }

    return {
      categories: allowedCategories || [],
      departments: allowedDepartments || [],
      seasonsOccasions,
      productTypes,
      colors,
      sizes
    };
  }, [hasFullAccess, categories, departments, seasonsOccasions, productTypes, colors, sizes, allowedCategories, allowedDepartments, filtersLoading]);

  // استخراج العلامات التجارية من المنتجات المتاحة
  const availableBrands = useMemo(() => {
    return [...new Set(products.map(p => p.brand).filter(Boolean))];
  }, [products]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      category: 'all',
      department: 'all',
      seasonOccasion: 'all',
      productType: 'all',
      brand: 'all',
      color: 'all',
      size: 'all',
      price: [0, 500000],
    });
  };

  // حساب عدد الفلاتر النشطة
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.category !== 'all') count++;
    if (filters.department !== 'all') count++;
    if (filters.seasonOccasion !== 'all') count++;
    if (filters.productType !== 'all') count++;
    if (filters.brand !== 'all') count++;
    if (filters.color !== 'all') count++;
    if (filters.size !== 'all') count++;
    if (filters.price[0] !== 0 || filters.price[1] !== 500000) count++;
    return count;
  }, [filters]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogContent 
          className="max-w-2xl max-h-[95vh] w-[95vw] mx-auto overflow-hidden flex flex-col" 
          style={{zIndex: 9999}}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <SlidersHorizontal className="w-5 h-5" />
              فلترة متقدمة للمنتجات
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount} فلتر نشط
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-grow overflow-y-auto space-y-4 py-2">
            {/* الأقسام */}
            {allowedData.departments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">القسم</Label>
                <Select value={filters.department} onValueChange={(value) => handleFilterChange('department', value)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg" style={{zIndex: 99999}}>
                    <SelectItem value="all">جميع الأقسام</SelectItem>
                    {allowedData.departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* التصنيفات */}
            {allowedData.categories.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">التصنيف</Label>
                <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر التصنيف" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg" style={{zIndex: 99999}}>
                    <SelectItem value="all">جميع التصنيفات</SelectItem>
                    {allowedData.categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* المواسم والمناسبات */}
            {allowedData.seasonsOccasions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">الموسم/المناسبة</Label>
                <Select value={filters.seasonOccasion} onValueChange={(value) => handleFilterChange('seasonOccasion', value)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر الموسم أو المناسبة" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg" style={{zIndex: 99999}}>
                    <SelectItem value="all">جميع المواسم والمناسبات</SelectItem>
                    {allowedData.seasonsOccasions.map(season => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* أنواع المنتجات */}
            {allowedData.productTypes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">نوع المنتج</Label>
                <Select value={filters.productType} onValueChange={(value) => handleFilterChange('productType', value)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر نوع المنتج" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg" style={{zIndex: 99999}}>
                    <SelectItem value="all">جميع أنواع المنتجات</SelectItem>
                    {allowedData.productTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* الألوان */}
              {allowedData.colors.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">اللون</Label>
                  <Select value={filters.color} onValueChange={(value) => handleFilterChange('color', value)}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر اللون" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg" style={{zIndex: 99999}}>
                      <SelectItem value="all">جميع الألوان</SelectItem>
                      {allowedData.colors.map(color => (
                        <SelectItem key={color.id} value={color.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full border" 
                              style={{ backgroundColor: color.hex_code }}
                            />
                            {color.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* الأحجام */}
              {allowedData.sizes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">الحجم</Label>
                  <Select value={filters.size} onValueChange={(value) => handleFilterChange('size', value)}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر الحجم" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg" style={{zIndex: 99999}}>
                      <SelectItem value="all">جميع الأحجام</SelectItem>
                      {allowedData.sizes.map(size => (
                        <SelectItem key={size.id} value={size.id}>
                          {size.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* العلامة التجارية */}
            {availableBrands.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">العلامة التجارية</Label>
                <Select value={filters.brand} onValueChange={(value) => handleFilterChange('brand', value)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر العلامة التجارية" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg" style={{zIndex: 99999}}>
                    <SelectItem value="all">جميع العلامات التجارية</SelectItem>
                    {availableBrands.map(brand => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* نطاق السعر */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">نطاق السعر</Label>
              <div className="px-2">
                <Slider
                  min={0}
                  max={500000}
                  step={1000}
                  value={filters.price}
                  onValueChange={(value) => handleFilterChange('price', value)}
                  className="py-4"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground px-2">
                <span>{filters.price[0].toLocaleString()} د.ع</span>
                <span>{filters.price[1].toLocaleString()} د.ع</span>
              </div>
            </div>
          </div>

          {/* الأزرار */}
          <div className="flex-shrink-0 flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={resetFilters} className="flex-1">
              <RefreshCw className="w-4 h-4 ml-2" />
              إعادة تعيين
            </Button>
            <Button onClick={() => onOpenChange(false)} className="flex-1">
              تطبيق الفلاتر
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export default AdvancedProductFilters;