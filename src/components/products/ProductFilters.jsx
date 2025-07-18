import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, QrCode, SlidersHorizontal, LayoutGrid, List, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useVariants } from '@/contexts/VariantsContext';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const ProductFilters = ({ filters, setFilters, categories, brands, colors, onBarcodeSearch, onAdvancedFilters, viewMode, setViewMode, onProductSelect }) => {
  const { products } = useInventory();
  const { user } = useAuth();
  const { categories: allCategories, colors: allColors, sizes: allSizes, departments: allDepartments, productTypes: allProductTypes, seasonsOccasions: allSeasonsOccasions } = useVariants();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // استخراج المتغيرات المسموحة للمستخدم
  const allowedData = useMemo(() => {
    // للمدير - عرض كل شيء
    if (!user || user.role === 'admin' || user.role === 'deputy' || user?.permissions?.includes('*')) {
      return {
        allowedCategories: [...new Set(products.map(p => p.categories?.main_category).filter(Boolean))],
        allowedBrands: [...new Set(products.map(p => p.brand).filter(Boolean))],
        allowedColors: [...new Set(products.flatMap(p => p.variants?.map(v => v.color).filter(Boolean) || []))],
        allowedSizes: [...new Set(products.flatMap(p => p.variants?.map(v => v.size).filter(Boolean) || []))],
        allowedDepartments: allDepartments.map(d => d.name),
        allowedProductTypes: allProductTypes.map(pt => pt.name),
        allowedSeasonsOccasions: allSeasonsOccasions.map(so => so.name)
      };
    }

    // للموظفين - فقط ما هو مسموح
    try {
      const categoryPermissions = JSON.parse(user?.category_permissions || '["all"]');
      const colorPermissions = JSON.parse(user?.color_permissions || '["all"]');
      const sizePermissions = JSON.parse(user?.size_permissions || '["all"]');
      const departmentPermissions = JSON.parse(user?.department_permissions || '["all"]');
      const productTypePermissions = JSON.parse(user?.product_type_permissions || '["all"]');
      const seasonOccasionPermissions = JSON.parse(user?.season_occasion_permissions || '["all"]');

      return {
        allowedCategories: categoryPermissions.includes('all') 
          ? allCategories.map(c => c.name)
          : allCategories.filter(c => categoryPermissions.includes(c.id)).map(c => c.name),
        allowedBrands: [...new Set(products.map(p => p.brand).filter(Boolean))],
        allowedColors: colorPermissions.includes('all')
          ? allColors.map(c => c.name)
          : allColors.filter(c => colorPermissions.includes(c.id)).map(c => c.name),
        allowedSizes: sizePermissions.includes('all')
          ? allSizes.map(s => s.name)
          : allSizes.filter(s => sizePermissions.includes(s.id)).map(s => s.name),
        allowedDepartments: departmentPermissions.includes('all')
          ? allDepartments.map(d => d.name)
          : allDepartments.filter(d => departmentPermissions.includes(d.id)).map(d => d.name),
        allowedProductTypes: productTypePermissions.includes('all')
          ? allProductTypes.map(pt => pt.name)
          : allProductTypes.filter(pt => productTypePermissions.includes(pt.id)).map(pt => pt.name),
        allowedSeasonsOccasions: seasonOccasionPermissions.includes('all')
          ? allSeasonsOccasions.map(so => so.name)
          : allSeasonsOccasions.filter(so => seasonOccasionPermissions.includes(so.id)).map(so => so.name)
      };
    } catch (e) {
      console.error('Error parsing permissions:', e);
      return {
        allowedCategories: [],
        allowedBrands: [],
        allowedColors: [],
        allowedSizes: [],
        allowedDepartments: [],
        allowedProductTypes: [],
        allowedSeasonsOccasions: []
      };
    }
  }, [products, user, allCategories, allColors, allSizes, allDepartments, allProductTypes, allSeasonsOccasions]);

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
    <div className="space-y-3">
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
        {/* باركود */}
        <Button
          variant="outline"
          size="icon"
          onClick={onBarcodeSearch}
          className="glass-effect border-border/80 hover:bg-accent"
          title="بحث بالباركود"
        >
          <QrCode className="w-4 h-4" />
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