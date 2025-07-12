import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, List, LayoutGrid, Trash2, Printer, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

const ManageProductsToolbar = ({
  searchTerm,
  onSearchChange,
  onAddProduct,
  onManageCategories,
  viewMode,
  onViewModeChange,
  selectedCount,
  onClearSelection,
  onDeleteSelected,
  onPrintSelected,
  onBarcodeSearch,
  isMobile
}) => {
  return (
    <div className="p-4 bg-card rounded-lg shadow-sm">
      {selectedCount > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium text-center">{selectedCount} منتج(ات) محددة</div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="ghost" size="sm" onClick={onClearSelection} className="w-full">إلغاء</Button>
            <Button variant="outline" size="sm" onClick={onPrintSelected} className="w-full">
              <Printer className="w-4 h-4 ml-2" />
              طباعة
            </Button>
            <Button variant="destructive" size="sm" onClick={onDeleteSelected} className="w-full">
              <Trash2 className="w-4 h-4 ml-2" />
              حذف
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن منتج..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <Button variant="outline" size="sm" onClick={onBarcodeSearch} className="w-full">
              <QrCode className="w-4 h-4 ml-2" />
              بحث بالباركود
            </Button>
            <Button variant="outline" size="sm" onClick={() => onViewModeChange('list')} className={cn("w-full", viewMode === 'list' && 'bg-accent')}>
              <List className="w-4 h-4 ml-2" />
              قائمة
            </Button>
            {!isMobile && (
              <Button variant="outline" size="sm" onClick={() => onViewModeChange('grid')} className={cn("w-full", viewMode === 'grid' && 'bg-accent')}>
                <LayoutGrid className="w-4 h-4 ml-2" />
                شبكة
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onManageCategories} className="w-full col-span-1">
              إدارة المتغيرات
            </Button>
            <Button size="sm" onClick={onAddProduct} className="w-full col-span-2 sm:col-span-1">
              <Plus className="w-4 h-4 ml-2" />
              إضافة منتج
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageProductsToolbar;