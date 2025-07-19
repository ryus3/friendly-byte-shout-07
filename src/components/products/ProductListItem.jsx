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
      const reserved = v.inventory?.[0]?.reserved_stock || v.inventory?.[0]?.reserved_quantity || v.reserved || 0;
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
      className="product-list-item p-3 cursor-pointer hover:bg-accent/50 transition-colors rounded-lg border border-border/30
                  shadow-lg shadow-black/10 
                  dark:shadow-lg dark:shadow-primary/20
                  hover:shadow-xl hover:shadow-primary/20
                  dark:hover:shadow-2xl dark:hover:shadow-primary/30"
      onClick={onSelect}
    >
      <div className="flex items-center gap-4 w-full">
        <div className="flex-1 text-right">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-foreground text-lg truncate">{product.name}</h3>
            <p className="font-bold text-primary text-lg">{parseFloat(product.variants[0]?.price || product.base_price || 0).toLocaleString()} د.ع</p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* الألوان المتوفرة */}
              <div className="flex items-center gap-1">
                {availableColorsWithHex.slice(0, 3).map((color, idx) => (
                  <div
                    key={idx}
                    className="w-3 h-3 rounded-full border border-border"
                    style={{ backgroundColor: color.hex || '#ccc' }}
                  />
                ))}
                {availableColorsWithHex.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{availableColorsWithHex.length - 3}</span>
                )}
              </div>
              
              {/* القياسات - عرض جميع القياسات بشكل مضغوط */}
              {availableSizes.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {availableSizes.map((size, idx) => (
                    <span key={idx} className="text-xs bg-secondary px-1 py-0.5 rounded text-xs">
                      {size}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* معلومات المخزون - المتوفر والمحجوز بشكل مضغوط */}
            <div className="text-left text-sm">
              <div className="flex items-center gap-3">
                <span className="text-green-600 font-medium">
                  متوفر: <span className="font-bold">{(totalStock || 0).toLocaleString()}</span>
                </span>
                <span className="text-amber-600 font-medium">
                  محجوز: <span className="font-bold">{(reservedStock || 0).toLocaleString()}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProductListItem;