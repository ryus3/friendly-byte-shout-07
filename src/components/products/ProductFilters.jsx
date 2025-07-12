import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, QrCode, SlidersHorizontal, LayoutGrid, List, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { useInventory } from '@/contexts/InventoryContext';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const ProductFilters = ({ filters, setFilters, categories, brands, colors, onBarcodeSearch, viewMode, setViewMode, onProductSelect }) => {
  const { products } = useInventory();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      category: 'all',
      brand: 'all',
      color: 'all',
      price: [0, 500000],
    });
  };

  const searchResults = useMemo(() => {
    if (!filters.searchTerm) return [];
    return products.filter(product => 
      product.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      (product.brand && product.brand.toLowerCase().includes(filters.searchTerm.toLowerCase()))
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
              placeholder="اكتب اسم منتج أو علامة تجارية..."
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
                    <img src={product.image || "/api/placeholder/40/40"} alt={product.name} className="w-8 h-8 rounded-md object-cover" />
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.brand}</p>
                    </div>
                    <span className="text-xs text-primary font-semibold">{product.variants[0]?.price.toLocaleString()} د.ع</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* الأزرار والفلاتر */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onBarcodeSearch}
          className="glass-effect border-border/80 hover:bg-accent"
          title="بحث بالباركود"
        >
          <QrCode className="w-4 h-4" />
        </Button>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="glass-effect border-border/80 hover:bg-accent col-span-1">
              <SlidersHorizontal className="w-4 h-4 sm:ml-2" />
              <span className="hidden sm:inline">فلترة</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">الفلاتر المتقدمة</h4>
                <p className="text-sm text-muted-foreground">
                  قم بتخصيص البحث عن المنتجات.
                </p>
              </div>
              <div className="grid gap-2">
                <div className="space-y-2">
                  <Label htmlFor="category">القسم</Label>
                  <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">العلامة</Label>
                  <Select value={filters.brand} onValueChange={(value) => handleFilterChange('brand', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {brands.map(brand => (
                        <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">اللون</Label>
                  <Select value={filters.color} onValueChange={(value) => handleFilterChange('color', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {colors.map(color => (
                        <SelectItem key={color.id} value={color.name}>{color.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
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
              <Button variant="ghost" onClick={resetFilters} className="text-sm">
                <X className="w-4 h-4 ml-2" />
                إعادة تعيين الفلاتر
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button 
          variant={viewMode === 'grid' ? 'default' : 'outline'} 
          size="icon"
          onClick={() => setViewMode('grid')} 
          className="col-span-1"
          title="عرض شبكة"
        >
          <LayoutGrid className="w-4 h-4" />
        </Button>
        <Button 
          variant={viewMode === 'list' ? 'default' : 'outline'} 
          size="icon"
          onClick={() => setViewMode('list')} 
          className="col-span-1"
          title="عرض قائمة"
        >
          <List className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ProductFilters;