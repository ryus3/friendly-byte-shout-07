import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, List, LayoutGrid, Trash2, Printer } from 'lucide-react';
import { QRButton } from '@/components/ui/qr-button';
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
    <div className="p-4 bg-card rounded-lg 
                 shadow-lg shadow-black/10 
                 dark:shadow-lg dark:shadow-primary/20
                 transition-all duration-300 
                 hover:shadow-xl hover:shadow-primary/20
                 dark:hover:shadow-2xl dark:hover:shadow-primary/30">
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
              <Button
                variant="outline"
                size="icon"
                onClick={onBarcodeSearch}
                className="bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl w-10 h-10"
                title="مسح QR Code"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <rect width="5" height="5" x="3" y="3" rx="1"/>
                  <rect width="5" height="5" x="16" y="3" rx="1"/>
                  <rect width="5" height="5" x="3" y="16" rx="1"/>
                  <path d="m21 16-3.5-3.5"/>
                  <path d="m21 21-3.5-3.5"/>
                  <path d="M3.5 8.5 7 12"/>
                  <path d="m7 8 .5-.5"/>
                  <path d="M8.5 16.5 12 13"/>
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
            <Button size="sm" onClick={onAddProduct} className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0 w-full col-span-2 sm:col-span-1">
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