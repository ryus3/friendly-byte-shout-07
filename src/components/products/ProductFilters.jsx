import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, SlidersHorizontal, LayoutGrid, List, X } from 'lucide-react';
import { QRButton } from '@/components/ui/qr-button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useFiltersData } from '@/hooks/useFiltersData';

const ProductFilters = ({ filters, setFilters, categories, brands, colors, onBarcodeSearch, onAdvancedFilters, viewMode, setViewMode, onProductSelect }) => {
  const { products } = useInventory();
  const { user } = useAuth();
  
  // استخدام النظام التوحيدي للمرشحات
  const {
    allowedCategoryNames,
    allowedDepartmentNames,
    loading: filtersLoading,
    error: filtersError
  } = useFiltersData();
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // حفظ إعدادات العرض والفلاتر
  const [savedViewMode, setSavedViewMode] = useLocalStorage('productViewMode', 'grid');
  const [savedFilters, setSavedFilters] = useLocalStorage('productFilters', {});

  // تحديث وضع العرض عند التغيير
  useEffect(() => {
    if (viewMode !== savedViewMode) {
      setSavedViewMode(viewMode);
    }
  }, [viewMode, savedViewMode, setSavedViewMode]);

  // تحديث الفلاتر المحفوظة عند التغيير
  useEffect(() => {
    setSavedFilters(filters);
  }, [filters, setSavedFilters]);

  // استخراج البيانات المسموحة من النظام التوحيدي
  const allowedData = useMemo(() => {
    return {
      allowedCategories: allowedCategoryNames || [],
      allowedDepartments: allowedDepartmentNames || [],
      allowedBrands: [...new Set(products.map(p => p.brand).filter(Boolean))],
      allowedColors: [...new Set(products.flatMap(p => p.variants?.map(v => v.color).filter(Boolean) || []))],
      allowedSizes: [...new Set(products.flatMap(p => p.variants?.map(v => v.size).filter(Boolean) || []))]
    };
  }, [allowedCategoryNames, allowedDepartmentNames, products]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      category: 'all',
      brand: 'all',
      color: 'all',
      size: 'all',
      price: [0, 500000],
    });
  };

  const searchResults = useMemo(() => {
    if (!filters.searchTerm) return [];
    return products.filter(product => 
      product.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      (product.brand && product.brand.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
      product.variants?.some(v => 
        v.sku?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        v.barcode?.toLowerCase().includes(filters.searchTerm.toLowerCase())
      )
    ).slice(0, 10);
  }, [filters.searchTerm, products]);

  return (
    <div className="space-y-3 p-4 bg-card rounded-lg
                 shadow-lg shadow-black/10 
                 dark:shadow-lg dark:shadow-primary/20
                 transition-all duration-300 
                 hover:shadow-xl hover:shadow-primary/20
                 dark:hover:shadow-2xl dark:hover:shadow-primary/30">
      {/* البحث */}
      <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between text-muted-foreground glass-effect border-border/80 hover:bg-accent h-12"
          >
            {filters.searchTerm ? 
              <span className="text-foreground">{filters.searchTerm}</span> : 
              <span>البحث في المنتجات...</span>
            }
            <Search className="mr-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="اكتب اسم منتج أو علامة تجارية أو SKU..."
              value={filters.searchTerm}
              onValueChange={(search) => handleFilterChange('searchTerm', search)}
            />
            <CommandList>
              {searchResults.length === 0 && filters.searchTerm && (
                 <CommandEmpty>
                  <div className="p-4 text-center text-sm text-muted-foreground">لا توجد نتائج</div>
                </CommandEmpty>
              )}
              <CommandGroup>
                {searchResults.map(product => (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => {
                      onProductSelect(product);
                      setIsSearchOpen(false);
                      handleFilterChange('searchTerm', '');
                    }}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <img src={product.images?.[0] || "/api/placeholder/40/40"} alt={product.name} className="w-8 h-8 rounded-md object-cover" />
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.brand}</p>
                    </div>
                    <span className="text-xs text-primary font-semibold">{product.variants?.[0]?.price.toLocaleString()} د.ع</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* الأزرار المتجاورة والمتناسقة */}
      <div className="flex items-center gap-2">
        {/* QR Code Scanner مع تصميم احترافي */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onBarcodeSearch}
          className="h-9 w-9 p-0 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 border-0 rounded-xl"
          title="مسح QR Code"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <rect width="5" height="5" x="3" y="3" rx="1"/>
            <rect width="5" height="5" x="16" y="3" rx="1"/>
            <rect width="5" height="5" x="3" y="16" rx="1"/>
            <path d="m21 16-3.5-3.5"/>
            <path d="m21 21-3.5-3.5"/>
            <path d="M3.5 8.5 7 12"/>
            <path d="m7 8 .5-.5"/>
            <path d="M8.5 16.5 12 13"/>
          </svg>
        </Button>
        
        {/* قائمة */}
        <Button 
          variant={viewMode === 'list' ? 'default' : 'outline'} 
          size="icon"
          onClick={() => setViewMode('list')} 
          title="عرض قائمة"
          className="glass-effect border-border/80"
        >
          <List className="w-4 h-4" />
        </Button>
        
        {/* شبكة */}
        <Button 
          variant={viewMode === 'grid' ? 'default' : 'outline'} 
          size="icon"
          onClick={() => setViewMode('grid')} 
          title="عرض شبكة"
          className="glass-effect border-border/80"
        >
          <LayoutGrid className="w-4 h-4" />
        </Button>
        
        {/* فلترة متقدمة */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={onAdvancedFilters}
          className="glass-effect border-border/80 hover:bg-accent"
          title="فلترة متقدمة"
        >
          <SlidersHorizontal className="w-4 h-4 ml-2" />
          <span className="hidden sm:inline">فلاتر</span>
        </Button>
      </div>
    </div>
  );
};

export default ProductFilters;