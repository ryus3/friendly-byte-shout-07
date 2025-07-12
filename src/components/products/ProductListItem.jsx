import React, { useMemo } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const ProductListItem = React.memo(({ product, onSelect }) => {
  const { colors: allColors } = useVariants();

  const totalStock = useMemo(() => product.variants.reduce((sum, v) => sum + v.quantity, 0), [product.variants]);
  const reservedStock = useMemo(() => product.variants.reduce((sum, v) => sum + (v.reserved || 0), 0), [product.variants]);

  const availableColorsWithHex = useMemo(() => {
    if (!product) return [];
    const uniqueVariantColors = [...new Set(product.variants.filter(v => v.quantity > 0).map(item => item.color))];
    return uniqueVariantColors.map(colorName => {
        const colorInfo = allColors.find(c => c.name === colorName);
        return { name: colorName, hex: colorInfo?.hex_code };
    }).slice(0, 5);
  }, [product, allColors]);

  const availableSizes = useMemo(() => {
    const sizeValues = new Set(product.variants.filter(v => v.quantity > 0).map(v => v.size));
    return [...sizeValues];
  }, [product.variants]);

  return (
    <div
      className="product-list-item p-4"
      onClick={onSelect}
    >
      <div className="flex flex-col gap-3 w-full">
        <div className="flex justify-between items-start">
          <div className="flex-1 text-right">
            <h3 className="font-semibold text-foreground text-lg group-hover:gradient-text transition-colors">{product.name}</h3>
            <p className="font-bold text-primary text-xl">{parseFloat(product.variants[0]?.price || 0).toLocaleString()} د.ع</p>
          </div>
          <div className="w-auto text-left font-medium text-muted-foreground">
            <p>المتوفر: <span className="font-bold text-green-500">{totalStock.toLocaleString()}</span></p>
            <p>المحجوز: <span className="font-bold text-amber-500">{reservedStock.toLocaleString()}</span></p>
          </div>
        </div>
        
        <div className="flex items-center gap-3" title="الألوان والقياسات المتوفرة">
          <div className="flex items-center gap-2">
            {availableColorsWithHex.map((color, idx) => (
              <div
                key={idx}
                className="w-6 h-6 rounded-full border-2 border-background/50 shadow-md"
                style={{ backgroundColor: color.hex || '#ccc' }}
              />
            ))}
          </div>
          
          {availableColorsWithHex.length > 0 && availableSizes.length > 0 && <Separator orientation="vertical" className="h-6" />}

          <div className="flex items-center gap-1.5">
            {availableSizes.map((size, idx) => (
              <div
                key={idx}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm bg-primary text-primary-foreground"
              >
                {size}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProductListItem;