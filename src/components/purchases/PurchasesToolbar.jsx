import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Grid3X3, List } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PurchasesToolbar = ({ filters, onFiltersChange, viewMode, onViewModeChange }) => {
  const handleSearchChange = (e) => {
    onFiltersChange(prev => ({ ...prev, searchTerm: e.target.value }));
  };

  const handleDateFilterChange = (value) => {
    onFiltersChange(prev => ({ ...prev, dateFilter: value }));
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن فاتورة أو مورد..."
            value={filters.searchTerm}
            onChange={handleSearchChange}
            className="pr-10"
          />
        </div>
        <Select value={filters.dateFilter} onValueChange={handleDateFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="فلترة حسب التاريخ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الوقت</SelectItem>
            <SelectItem value="this_month">هذا الشهر</SelectItem>
            <SelectItem value="this_year">هذه السنة</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* أزرار تبديل العرض */}
      <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
        <Button
          variant={viewMode === 'grid' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange?.('grid')}
          className="h-8 px-3"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'table' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange?.('table')}
          className="h-8 px-3"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default PurchasesToolbar;