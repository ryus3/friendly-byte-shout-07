import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Grid3X3, List, LayoutGrid, QrCode } from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import QROrderScanner from './QROrderScanner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const OrdersToolbar = ({ filters, onFiltersChange, viewMode, onViewModeChange, onOrderFound, onUpdateOrderStatus }) => {
  const { hasPermission } = useAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [showQRScanner, setShowQRScanner] = useState(false);
  
  const handleSearchChange = (e) => {
    onFiltersChange({ searchTerm: e.target.value });
  };

  const handleStatusChange = (value) => {
    onFiltersChange({ status: value });
  };

  const handlePeriodChange = (value) => {
    onFiltersChange({ period: value });
  };

  const clearFilters = () => {
    onFiltersChange({ searchTerm: '', status: 'all', period: 'all' });
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

  const periodOptions = [
    { value: 'all', label: 'جميع الأوقات' },
    { value: 'today', label: 'اليوم' },
    { value: 'yesterday', label: 'أمس' },
    { value: 'week', label: 'هذا الأسبوع' },
    { value: 'month', label: 'هذا الشهر' },
    { value: 'year', label: 'هذا العام' },
  ];

  if (!hasPermission('view_orders')) return null;

  return (
    <div className="bg-card rounded-xl p-4 border">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* QR Scanner Button */}
        <div className="flex items-center">
          <Button 
            onClick={() => setShowQRScanner(true)}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 border-0 rounded-xl"
            title="مسح QR Code"
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center border rounded-lg p-1 bg-muted/30">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange?.('grid')}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange?.('list')}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative w-full sm:flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="البحث في الطلبات..." 
            value={filters.searchTerm} 
            onChange={handleSearchChange} 
            className="pr-10" 
          />
        </div>
        {/* Status Filter - إظهار فلتر الحالات دائماً في الأرشيف */}
        {(isMobile && (hasPermission('view_all_orders') || filters.status === 'archived')) ? (
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
            (hasPermission('view_all_orders') || filters.status === 'archived') && (
              <Select value={filters.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="حالة الطلب" /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
        )}
        
        {/* Period Filter */}
        <Select value={filters.period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="الفترة الزمنية" />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button variant="outline" className="w-full sm:w-auto" onClick={clearFilters}>
          <Filter className="w-4 h-4 ml-2" /> مسح الفلاتر
        </Button>
      </div>

      {/* QR Scanner Dialog */}
      <QROrderScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onOrderFound={onOrderFound}
        onUpdateOrderStatus={onUpdateOrderStatus}
      />
    </div>
  );
};

export default OrdersToolbar;