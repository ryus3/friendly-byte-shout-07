import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';
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

const OrdersToolbar = ({ filters, onFiltersChange }) => {
  const { hasPermission } = useAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const handleSearchChange = (e) => {
    onFiltersChange(prev => ({ ...prev, searchTerm: e.target.value }));
  };

  const handleStatusChange = (value) => {
    onFiltersChange(prev => ({ ...prev, status: value, period: 'all' }));
  };

  const clearFilters = () => {
    onFiltersChange({ searchTerm: '', status: 'all', period: 'today' });
  };
  
  const statusOptions = [
      { value: 'all', label: 'جميع الحالات' },
      { value: 'pending', label: 'قيد التجهيز' },
      { value: 'processing', label: 'قيد المعالجة' },
      { value: 'shipped', label: 'تم الشحن' },
      { value: 'delivery', label: 'قيد التوصيل' },
      { value: 'delivered', label: 'تم التسليم' },
      { value: 'cancelled', label: 'ملغي' },
      { value: 'returned', label: 'راجع' },
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