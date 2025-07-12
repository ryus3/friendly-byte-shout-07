import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, QrCode } from 'lucide-react';

const ProductHeader = ({ 
  title = "المنتجات", 
  description = "تصفح وأدر جميع المنتجات",
  onAddProduct, 
  showAddButton,
  onBarcodeSearch,
  showBarcodeButton,
  barcodeIconOnly
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-3xl font-bold gradient-text">{title}</h1>
      <p className="text-muted-foreground mt-1">{description}</p>
    </div>
    
    <div className="flex items-center gap-3">
      {showBarcodeButton && (
        <Button
          onClick={onBarcodeSearch}
          variant="outline"
          size={barcodeIconOnly ? "icon" : "default"}
          className="glass-effect border-border/80 hover:bg-accent"
        >
          <QrCode className={`w-4 h-4 ${!barcodeIconOnly ? 'ml-2' : ''}`} />
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