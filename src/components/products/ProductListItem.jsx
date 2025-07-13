import React, { useMemo } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const ProductListItem = React.memo(({ product, onSelect }) => {
  const { colors: allColors } = useVariants();

  const totalStock = useMemo(() => {
    if (!product.variants || product.variants.length === 0) return 0;
    return product.variants.reduce((sum, v) => {
      const quantity = v.inventory?.[0]?.quantity || v.quantity || 0;
      return sum + quantity;
    }, 0);
  }, [product.variants]);
  const reservedStock = useMemo(() => {
    if (!product.variants || product.variants.length === 0) return 0;
    return product.variants.reduce((sum, v) => {
      const reserved = v.inventory?.[0]?.reserved_quantity || v.reserved || 0;
      return sum + reserved;
    }, 0);
  }, [product.variants]);

  const availableColorsWithHex = useMemo(() => {
    if (!product || !product.variants) return [];
    const availableVariants = product.variants.filter(v => (v.inventory?.[0]?.quantity || v.quantity || 0) > 0);
    const uniqueVariantColors = [...new Set(availableVariants.map(item => item.color?.name || item.color))];
    return uniqueVariantColors.map(colorName => {
        const colorInfo = allColors.find(c => c.name === colorName);
        return { name: colorName, hex: colorInfo?.hex_code };
    }).filter(c => c.name).slice(0, 5);
  }, [product, allColors]);

  const availableSizes = useMemo(() => {
    if (!product || !product.variants) return [];
    const availableVariants = product.variants.filter(v => (v.inventory?.[0]?.quantity || v.quantity || 0) > 0);
    const sizeValues = new Set(availableVariants.map(v => v.size?.name || v.size));
    return [...sizeValues].filter(s => s);
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
            <p className="font-bold text-primary text-xl">{parseFloat(product.variants[0]?.price || product.base_price || 0).toLocaleString()} د.ع</p>
          </div>
          <div className="w-auto text-left font-medium text-muted-foreground">
            <p>المتوفر: <span className="font-bold text-green-500">{(totalStock || 0).toLocaleString()}</span></p>
            <p>المحجوز: <span className="font-bold text-amber-500">{(reservedStock || 0).toLocaleString()}</span></p>
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