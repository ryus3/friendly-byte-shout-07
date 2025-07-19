import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, QrCode, List, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProductHeader = ({ 
  title = "المنتجات", 
  description = "تصفح وأدر جميع المنتجات",
  onAddProduct, 
  showAddButton,
  onBarcodeSearch,
  showBarcodeButton,
  barcodeIconOnly,
  viewMode,
  onViewModeChange
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-3xl font-bold gradient-text">{title}</h1>
      <p className="text-muted-foreground mt-1">{description}</p>
    </div>
    
    <div className="flex items-center gap-3">
      {onViewModeChange && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onViewModeChange('list')}
            className={cn("glass-effect border-border/80 hover:bg-accent", viewMode === 'list' && 'bg-accent')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onViewModeChange('grid')}
            className={cn("glass-effect border-border/80 hover:bg-accent", viewMode === 'grid' && 'bg-accent')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      )}
      {showBarcodeButton && (
        <Button
          onClick={onBarcodeSearch}
          variant="outline"
          size={barcodeIconOnly ? "icon" : "default"}
          className="glass-effect border-border/80 hover:bg-accent"
        >
          <svg className={`w-4 h-4 ${!barcodeIconOnly ? 'ml-2' : ''}`} viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="6" width="20" height="12" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/>
            <rect x="4" y="8" width="2" height="8" fill="currentColor"/>
            <rect x="7" y="8" width="1" height="8" fill="currentColor"/>
            <rect x="9" y="8" width="3" height="8" fill="currentColor"/>
            <rect x="13" y="8" width="1" height="8" fill="currentColor"/>
            <rect x="15" y="8" width="2" height="8" fill="currentColor"/>
            <rect x="18" y="8" width="2" height="8" fill="currentColor"/>
          </svg>
          {!barcodeIconOnly && 'إضافة بالباركود'}
        </Button>
      )}
      {showAddButton && (
        <Button
          onClick={onAddProduct}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة منتج جديد
        </Button>
      )}
    </div>
  </div>
);

export default ProductHeader;