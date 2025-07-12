import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, List, LayoutGrid, Trash2, Printer, QrCode } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-sm font-medium">{selectedCount} منتج(ات) محددة</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClearSelection}>إلغاء</Button>
            <Button variant="outline" size="sm" onClick={onPrintSelected}>
              <Printer className="w-4 h-4 ml-2" />
              طباعة
            </Button>
            <Button variant="destructive" size="sm" onClick={onDeleteSelected}>
              <Trash2 className="w-4 h-4 ml-2" />
              حذف
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن منتج..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
             <Button variant="outline" size="icon" onClick={onBarcodeSearch}>
              <QrCode className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onViewModeChange('list')} className={viewMode === 'list' ? 'bg-accent' : ''}>
              <List className="w-4 h-4" />
            </Button>
            {!isMobile && (
              <Button variant="outline" size="icon" onClick={() => onViewModeChange('grid')} className={viewMode === 'grid' ? 'bg-accent' : ''}>
                <LayoutGrid className="w-4 h-4" />
              </Button>
            )}
            <Separator orientation="vertical" className="h-6 mx-2 hidden md:block" />
            <Button variant="outline" onClick={onManageCategories}>المتغيرات</Button>
            <Button onClick={onAddProduct}>
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