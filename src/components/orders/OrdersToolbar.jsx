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

  const handleArchiveSubStatusChange = (value) => {
    onFiltersChange({ archiveSubStatus: value });
  };

  const clearFilters = () => {
    onFiltersChange({ searchTerm: '', status: 'all', period: 'all', archiveSubStatus: 'all' });
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

  const archiveSubStatusOptions = [
    { value: 'all', label: 'جميع الحالات' },
    { value: 'completed', label: 'مكتمل' },
    { value: 'returned_in_stock', label: 'راجع للمخزن' },
    { value: 'cancelled', label: 'ملغي' },
  ];

  if (!hasPermission('view_orders')) return null;

  return (
    <div className="bg-card rounded-xl p-3 sm:p-4 border">
      {/* الصف الأول: QR Scanner + View Mode + Search */}
      <div className="flex items-center gap-3 mb-3">
        {/* QR Scanner Button */}
        <Button 
          onClick={() => setShowQRScanner(true)}
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 border-0 rounded-xl flex-shrink-0"
          title="مسح QR Code"
        >
          <QrCode className="h-4 w-4" />
        </Button>

        {/* View Mode Toggle */}
        <div className="flex items-center border rounded-lg p-1 bg-muted/30 flex-shrink-0">
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

        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="البحث في الطلبات..." 
            value={filters.searchTerm} 
            onChange={handleSearchChange} 
            className="pr-9 h-9 text-sm" 
          />
        </div>
      </div>

      {/* الصف الثاني: الفلاتر */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {/* Status Filter */}
        {(hasPermission('view_all_orders') || filters.status === 'archived') && (
          <Select value={filters.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
              <SelectValue placeholder="جميع الحالات" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
          
        {/* Period Filter */}
        <Select value={filters.period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
            <SelectValue placeholder="جميع الأوقات" />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Archive Sub-Status Filter */}
        {filters.status === 'archived' && (
          <Select value={filters.archiveSubStatus || 'all'} onValueChange={handleArchiveSubStatusChange}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
              <SelectValue placeholder="حالة الأرشيف" />
            </SelectTrigger>
            <SelectContent>
              {archiveSubStatusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
          
        <Button 
          variant="outline" 
          className="w-full sm:w-auto h-9 text-sm px-3" 
          onClick={clearFilters}
        >
          <Filter className="w-4 h-4 ml-1" /> 
          مسح الفلاتر
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