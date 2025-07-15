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
      className="product-list-item p-4 cursor-pointer hover:bg-accent/50 transition-colors rounded-lg border border-border/30"
      onClick={onSelect}
    >
      <div className="flex items-center gap-4 w-full">
        {/* إزالة الصورة لتوفير البيانات وتحسين الأداء */}
        <div className="flex-1 text-right">
          <h3 className="font-semibold text-foreground text-lg">{product.name}</h3>
          <p className="font-bold text-primary text-xl">{parseFloat(product.variants[0]?.price || product.base_price || 0).toLocaleString()} د.ع</p>
          
          {/* معلومات المخزون والألوان في سطر واحد */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              {/* الألوان المتوفرة */}
              <div className="flex items-center gap-1">
                {availableColorsWithHex.slice(0, 3).map((color, idx) => (
                  <div
                    key={idx}
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: color.hex || '#ccc' }}
                  />
                ))}
                {availableColorsWithHex.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{availableColorsWithHex.length - 3}</span>
                )}
              </div>
              
              {/* القياسات */}
              {availableSizes.length > 0 && (
                <div className="flex items-center gap-1">
                  {availableSizes.slice(0, 3).map((size, idx) => (
                    <span key={idx} className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                      {size}
                    </span>
                  ))}
                  {availableSizes.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{availableSizes.length - 3}</span>
                  )}
                </div>
              )}
            </div>
            
            {/* معلومات المخزون */}
            <div className="text-left font-medium text-sm">
              <span className="text-green-600">متوفر: {(totalStock || 0).toLocaleString()}</span>
              {reservedStock > 0 && (
                <span className="text-amber-600 mr-2">محجوز: {reservedStock.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProductListItem;