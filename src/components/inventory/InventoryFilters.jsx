import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, QrCode, SlidersHorizontal, X } from 'lucide-react';
import { useVariants } from '@/contexts/VariantsContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const InventoryFilters = ({ filters, setFilters, categories, onBarcodeSearch }) => {
  const { colors, sizes } = useVariants();
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      category: 'all',
      stockFilter: 'all',
      color: 'all',
      size: 'all',
      price: [0, 500000],
    });
  };

  return (
    <div className="bg-card rounded-xl p-4 border space-y-4 flex-grow">
      <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-grow w-full md:flex-grow-0 md:w-auto">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="البحث..."
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              className="pr-10 md:w-48"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto flex-grow">
            <Button
              variant="outline"
              size="icon"
              onClick={onBarcodeSearch}
              className="flex-shrink-0"
            >
              <QrCode className="w-5 h-5" />
            </Button>
            
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
                      <SelectTrigger><SelectValue placeholder="الفئة" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفئات</SelectItem>
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filters.color} onValueChange={(value) => handleFilterChange('color', value)}>
                      <SelectTrigger><SelectValue placeholder="اللون" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الألوان</SelectItem>
                        {colors.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filters.size} onValueChange={(value) => handleFilterChange('size', value)}>
                      <SelectTrigger><SelectValue placeholder="القياس" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع القياسات</SelectItem>
                        {sizes.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
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