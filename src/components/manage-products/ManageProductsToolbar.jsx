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
  onQuickPrintLabels,
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
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            <div className="flex gap-1 col-span-1">
              <Button variant="outline" size="icon" onClick={onBarcodeSearch} className="flex-shrink-0 hover:bg-primary/10" title="قراءة الباركود">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 8h18M3 12h18M3 16h18M3 20h18" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 4v16M10 4v16M14 4v16M18 4v16" />
                </svg>
              </Button>
              <Button variant="outline" size="icon" onClick={onQuickPrintLabels} className="flex-shrink-0" title="طباعة ملصقات">
                <Printer className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => onViewModeChange('list')} className={cn("flex-shrink-0", viewMode === 'list' && 'bg-accent')} title="عرض قائمة">
                <List className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => onViewModeChange('grid')} className={cn("flex-shrink-0", viewMode === 'grid' && 'bg-accent')} title="عرض شبكة">
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
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