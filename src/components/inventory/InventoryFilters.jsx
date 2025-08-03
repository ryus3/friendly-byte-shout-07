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

const InventoryFilters = ({ filters, setFilters, onFilterChange, categories, onBarcodeSearch }) => {
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
  const allowedData = useMemo(() => {
    if (hasFullAccess) {
      return {
        allowedCategories: categories?.map(c => c.name) || [],
        allowedColors: colors || [],
        allowedSizes: sizes || [],
        allowedProductTypes: productTypes || [],
        allowedDepartments: departments || [],
        allowedSeasonsOccasions: seasonsOccasions || []
      };
    }

    return {
      allowedCategories: allowedCategories?.map(c => c.name) || [],
      allowedColors: colors || [],
      allowedSizes: sizes || [],
      allowedProductTypes: productTypes || [],
      allowedDepartments: allowedDepartments || [],
      allowedSeasonsOccasions: seasonsOccasions || []
    };
  }, [hasFullAccess, categories, colors, sizes, productTypes, departments, seasonsOccasions, allowedCategories, allowedDepartments]);
  
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
          {/* الصف الأول للهاتف: البحث وزر QR */}
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="البحث..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                className="pr-10"
              />
            </div>
            
            {/* QR Scanner button في طرف الشريط */}
            <Button
              variant="outline"
              size="icon"
              onClick={onBarcodeSearch}
              className="flex-shrink-0 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
              title="قراءة QR Code"
            >
              <QrCode className="w-5 h-5" />
            </Button>
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
              <SelectContent>
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
              <PopoverContent className="w-80">
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
                      <SelectContent>
                        <SelectItem value="all">جميع التصنيفات</SelectItem>
                        {allowedData.allowedCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filters.productType || 'all'} onValueChange={(value) => handleFilterChange('productType', value)}>
                      <SelectTrigger><SelectValue placeholder="نوع المنتج" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأنواع</SelectItem>
                        {allowedData.allowedProductTypes.map(pt => <SelectItem key={pt.id} value={pt.name}>{pt.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filters.department || 'all'} onValueChange={(value) => handleFilterChange('department', value)}>
                      <SelectTrigger><SelectValue placeholder="القسم" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأقسام</SelectItem>
                        {allowedData.allowedDepartments.map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filters.seasonOccasion || 'all'} onValueChange={(value) => handleFilterChange('seasonOccasion', value)}>
                      <SelectTrigger><SelectValue placeholder="الموسم/المناسبة" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع المواسم والمناسبات</SelectItem>
                        {allowedData.allowedSeasonsOccasions.map(so => (
                          <SelectItem key={so.id} value={so.name}>
                            {so.name} ({so.type === 'season' ? 'موسم' : 'مناسبة'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filters.color} onValueChange={(value) => handleFilterChange('color', value)}>
                      <SelectTrigger><SelectValue placeholder="اللون" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الألوان</SelectItem>
                        {allowedData.allowedColors.map(c => (
                          <SelectItem key={c.id} value={c.name}>
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
                      <SelectContent>
                        <SelectItem value="all">جميع القياسات</SelectItem>
                        {allowedData.allowedSizes.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
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