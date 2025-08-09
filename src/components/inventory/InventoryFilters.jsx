import React, { useMemo, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, QrCode, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useFiltersData } from '@/hooks/useFiltersData';
import { useInventory } from '@/contexts/SuperProvider';

const InventoryFilters = ({ filters, setFilters, onFilterChange, onBarcodeSearch }) => {
  const { user } = useAuth();
  
  // استخدام النظام التوحيدي للمرشحات
  const {
    departments,
    categories: allCategories,
    colors,
    sizes,
    productTypes,
    seasonsOccasions,
    allowedDepartments,
    allowedCategories,
    hasFullAccess,
    loading: filtersLoading
  } = useFiltersData();

  // استخدام البيانات المفلترة من النظام التوحيدي
  const { products: allProducts = [] } = useInventory();

  const allowedData = useMemo(() => {
    console.log('🔍 InventoryFilters - البيانات المتوفرة:', {
      hasFullAccess,
      allCategoriesCount: allCategories?.length || 0,
      departmentsCount: departments?.length || 0,
      allCategories: allCategories
    });

    // اشتقاق بدائل من المنتجات عند غياب بيانات التصفية الموحدة
    const fallbackDepartmentsMap = new Map();
    const fallbackCategoriesMap = new Map();
    (allProducts || []).forEach(p => {
      // أقسام
      if (Array.isArray(p?.product_departments)) {
        p.product_departments.forEach(pd => {
          const id = pd.department_id || pd.department?.id || pd.departments?.id || pd.id || pd;
          const name = pd.department?.name || pd.departments?.name || pd.name || p?.categories?.department_name || 'قسم';
          if (id && !fallbackDepartmentsMap.has(id)) fallbackDepartmentsMap.set(id, { id, name });
        });
      }
      const depId = p.department_id || p?.categories?.department_id || p?.categories?.department?.id || p?.categories?.departments?.id;
      const depName = p.department || p.department_name || p?.categories?.department?.name || p?.categories?.departments?.name || p?.categories?.department_name;
      if (depId && !fallbackDepartmentsMap.has(depId)) fallbackDepartmentsMap.set(depId, { id: depId, name: depName || 'قسم' });

      // تصنيفات
      if (Array.isArray(p?.product_categories)) {
        p.product_categories.forEach(pc => {
          const id = pc.category_id || pc.category?.id || pc.categories?.id || pc.id || pc;
          const name = pc.category?.name || pc.categories?.name || pc.name || p?.categories?.main_category_name || 'تصنيف';
          if (id && !fallbackCategoriesMap.has(id)) fallbackCategoriesMap.set(id, { id, name });
        });
      }
      const catId = p?.categories?.main_category_id || p?.categories?.main_category?.id;
      const catName = p?.categories?.main_category?.name || p?.categories?.main_category_name || p?.categories?.main_category;
      if (catId && !fallbackCategoriesMap.has(catId)) fallbackCategoriesMap.set(catId, { id: catId, name: catName || 'تصنيف' });
    });

    const fallbackDepartments = Array.from(fallbackDepartmentsMap.values());
    const fallbackCategories = Array.from(fallbackCategoriesMap.values());

    if (hasFullAccess) {
      return {
        allowedCategories: (allCategories && allCategories.length ? allCategories : fallbackCategories),
        allowedColors: colors || [],
        allowedSizes: sizes || [],
        allowedProductTypes: productTypes || [],
        allowedDepartments: (departments && departments.length ? departments : fallbackDepartments),
        allowedSeasonsOccasions: seasonsOccasions || []
      };
    }

    return {
      allowedCategories: (allowedCategories && allowedCategories.length ? allowedCategories : fallbackCategories),
      allowedColors: colors || [],
      allowedSizes: sizes || [],
      allowedProductTypes: productTypes || [],
      allowedDepartments: (allowedDepartments && allowedDepartments.length ? allowedDepartments : fallbackDepartments),
      allowedSeasonsOccasions: seasonsOccasions || []
    };
  }, [hasFullAccess, allCategories, colors, sizes, productTypes, departments, seasonsOccasions, allowedCategories, allowedDepartments, allProducts]);
  
  const handleFilterChange = (key, value) => {
    console.log('InventoryFilters handleFilterChange called with:', key, value);
    console.log('onFilterChange exists:', !!onFilterChange);
    if (onFilterChange) {
      onFilterChange(key, value);
    } else {
      setFilters(prev => ({ ...prev, [key]: value }));
    }
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      category: 'all',
      stockFilter: 'all',
      color: 'all',
      size: 'all',
      price: [0, 500000],
      productType: 'all',
      department: 'all',
      seasonOccasion: 'all'
    });
  };

  return (
    <div className="bg-card rounded-xl p-4 border space-y-4 flex-grow">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            {/* زر قارئ QR أولاً (عكس الترتيب السابق) */}
            <Button
              variant="outline"
              size="icon"
              onClick={onBarcodeSearch}
              className="flex-shrink-0 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
              title="قراءة QR Code"
            >
              <QrCode className="w-5 h-5" />
            </Button>

            {/* حقل البحث */}
            <div className="relative flex-grow">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="البحث..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
          
          {/* الصف الثاني: فلاتر المخزون والأقسام */}
          <div className="flex items-center gap-2 w-full">
            
            <Select value={filters.stockFilter} onValueChange={(value) => handleFilterChange('stockFilter', value)}>
              <SelectTrigger className="w-full flex-grow">
                <SelectValue placeholder="مستوى المخزون" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع مستويات المخزون</SelectItem>
                <SelectItem value="high">مخزون جيد</SelectItem>
                <SelectItem value="medium">مخزون متوسط</SelectItem>
                <SelectItem value="low">مخزون منخفض</SelectItem>
                <SelectItem value="reserved">مخزون محجوز</SelectItem>
                <SelectItem value="out-of-stock">مخزون نافذ</SelectItem>
                <SelectItem value="archived">منتجات مؤرشفة</SelectItem>
              </SelectContent>
            </Select>
            
            {/* فلتر الأقسام */}
            <Select value={filters.department || 'all'} onValueChange={(value) => handleFilterChange('department', value)}>
              <SelectTrigger className="w-full flex-grow">
                <SelectValue placeholder="القسم" />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-md z-[9999]">
                <SelectItem value="all">جميع الأقسام</SelectItem>
                {allowedData.allowedDepartments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-shrink-0">
                  <SlidersHorizontal className="w-4 h-4 ml-2" />
                  فلترة متقدمة
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 z-[9999] bg-popover border shadow-md">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">الفلاتر</h4>
                    <p className="text-sm text-muted-foreground">
                      قم بتخصيص البحث في المخزون.
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                      <SelectTrigger><SelectValue placeholder="التصنيف" /></SelectTrigger>
                      <SelectContent className="bg-popover border shadow-md z-[9999]">
                        <SelectItem value="all">جميع التصنيفات</SelectItem>
                        {allowedData.allowedCategories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filters.productType || 'all'} onValueChange={(value) => handleFilterChange('productType', value)}>
                      <SelectTrigger><SelectValue placeholder="نوع المنتج" /></SelectTrigger>
                      <SelectContent className="bg-popover border shadow-md z-[9999]">
                        <SelectItem value="all">جميع الأنواع</SelectItem>
                        {allowedData.allowedProductTypes.map(pt => (
                          <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filters.department || 'all'} onValueChange={(value) => handleFilterChange('department', value)}>
                      <SelectTrigger><SelectValue placeholder="القسم" /></SelectTrigger>
                      <SelectContent className="bg-popover border shadow-md z-[9999]">
                        <SelectItem value="all">جميع الأقسام</SelectItem>
                        {allowedData.allowedDepartments.map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filters.seasonOccasion || 'all'} onValueChange={(value) => handleFilterChange('seasonOccasion', value)}>
                      <SelectTrigger><SelectValue placeholder="الموسم/المناسبة" /></SelectTrigger>
                      <SelectContent className="bg-popover border shadow-md z-[9999]">
                        <SelectItem value="all">جميع المواسم والمناسبات</SelectItem>
                        {allowedData.allowedSeasonsOccasions.map(so => (
                          <SelectItem key={so.id} value={so.id}>
                            {so.name} ({so.type === 'season' ? 'موسم' : 'مناسبة'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filters.color} onValueChange={(value) => handleFilterChange('color', value)}>
                      <SelectTrigger><SelectValue placeholder="اللون" /></SelectTrigger>
                      <SelectContent className="bg-popover border shadow-md z-[9999]">
                        <SelectItem value="all">جميع الألوان</SelectItem>
                         {allowedData.allowedColors.map(c => (
                           <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              {c.hex_code && (
                                <div 
                                  className="w-4 h-4 rounded-full border border-gray-300" 
                                  style={{ backgroundColor: c.hex_code }}
                                />
                              )}
                              {c.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filters.size} onValueChange={(value) => handleFilterChange('size', value)}>
                     <SelectTrigger><SelectValue placeholder="القياس" /></SelectTrigger>
                      <SelectContent className="bg-popover border shadow-md z-[9999]">
                        <SelectItem value="all">جميع القياسات</SelectItem>
                        {allowedData.allowedSizes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-1 items-center gap-2">
                      <Label htmlFor="price">نطاق السعر</Label>
                      <Slider
                        id="price"
                        min={0}
                        max={500000}
                        step={1000}
                        value={filters.price}
                        onValueChange={(value) => handleFilterChange('price', value)}
                        className="py-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{filters.price[0].toLocaleString()} د.ع</span>
                        <span>{filters.price[1].toLocaleString()} د.ع</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={resetFilters} className="text-sm w-full justify-center">
                    <X className="w-4 h-4 ml-2" />
                    إعادة تعيين
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
      </div>
    </div>
  );
};

export default InventoryFilters;