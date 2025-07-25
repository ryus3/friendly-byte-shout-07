import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Grid3X3, List, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const OrdersToolbar = ({ filters, onFiltersChange, viewMode, onViewModeChange }) => {
  const { hasPermission } = useAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const handleSearchChange = (e) => {
    onFiltersChange({ searchTerm: e.target.value });
  };

  const handleStatusChange = (value) => {
    onFiltersChange({ status: value, period: 'all' });
  };

  const clearFilters = () => {
    onFiltersChange({ searchTerm: '', status: 'all', period: 'today' });
  };
  
  const statusOptions = [
      { value: 'all', label: 'جميع الحالات' },
      { value: 'pending', label: 'قيد التجهيز' },
      { value: 'shipped', label: 'تم الشحن' },
      { value: 'delivery', label: 'قيد التوصيل' },
      { value: 'delivered', label: 'تم التسليم' },
      { value: 'completed', label: 'مكتمل' },
      { value: 'cancelled', label: 'ملغي' },
      { value: 'returned', label: 'راجعة' },
      { value: 'returned_in_stock', label: 'راجع للمخزن' },
      { value: 'archived', label: 'المؤرشفة' },
  ];

  if (!hasPermission('view_orders')) return null;

  return (
    <div className="bg-card rounded-xl p-4 border">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="البحث في الطلبات..." 
            value={filters.searchTerm} 
            onChange={handleSearchChange} 
            className="pr-10" 
          />
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex items-center border rounded-lg p-1 bg-muted/30">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange?.('grid')}
            className="h-8 px-3"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange?.('list')}
            className="h-8 px-3"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {isMobile ? (
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full"><Filter className="w-4 h-4 ml-2" /> فلترة حسب الحالة</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>حالة الطلب</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {statusOptions.map(option => (
                        <DropdownMenuCheckboxItem
                            key={option.value}
                            checked={filters.status === option.value}
                            onCheckedChange={() => handleStatusChange(option.value)}
                        >
                            {option.label}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        ) : (
            <Select value={filters.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="حالة الطلب" /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
        )}
        <Button variant="outline" className="w-full sm:w-auto" onClick={clearFilters}>
          <Filter className="w-4 h-4 ml-2" /> مسح الفلاتر
        </Button>
      </div>
    </div>
  );
};

export default OrdersToolbar;