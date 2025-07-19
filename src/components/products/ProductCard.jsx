import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { useVariants } from '@/contexts/VariantsContext';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Skeleton } from '@/components/ui/skeleton';
import { useInventory } from '@/contexts/InventoryContext';
import { cn } from '@/lib/utils';

const ProductCard = React.memo(({ product, onSelect }) => {
  const { colors: allColors } = useVariants();
  const { settings } = useInventory();
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px 0px',
  });

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

  const uniqueColorsWithHex = useMemo(() => {
    if (!product || !product.variants) return [];
    const uniqueVariantColors = [...new Set(product.variants.map(item => item.color?.name || item.color))];
    return uniqueVariantColors.map(colorName => {
      const colorInfo = allColors.find(c => c.name === colorName);
      return { name: colorName, hex: colorInfo?.hex_code };
    }).filter(c => c.name).slice(0, 5);
  }, [product, allColors]);

  const getStockLevelClass = () => {
    if (totalStock <= (settings.lowStockThreshold || 5)) return 'bg-red-500/80 text-white';
    if (totalStock <= (settings.mediumStockThreshold || 10)) return 'bg-yellow-500/80 text-white';
    return 'bg-green-500/80 text-white';
  };

  return (
    <motion.div
      ref={ref}
      onClick={onSelect}
      className="group product-card cursor-pointer
                 shadow-lg shadow-black/10 
                 dark:shadow-lg dark:shadow-primary/20
                 transition-all duration-300 
                 hover:shadow-xl hover:shadow-primary/20
                 dark:hover:shadow-2xl dark:hover:shadow-primary/30"
      whileHover={{ y: -5 }}
    >
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
        <Badge className={cn("shadow-md", getStockLevelClass())}>
          {totalStock} قطعة
        </Badge>
        {reservedStock > 0 && (
          <Badge variant="secondary" className="shadow-md bg-amber-500/80 text-white">
            محجوز: {reservedStock}
          </Badge>
        )}
      </div>
      <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden relative">
        {inView ? (
          <img
            src={product.images?.[0] || "/api/placeholder/300/300"}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <Skeleton className="w-full h-full" />
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
          <div className="p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}>
            <h3 className="font-bold text-white text-lg truncate group-hover:gradient-text transition-colors">{product.name}</h3>
            <div className="flex justify-between items-center mt-2">
              <p className="text-sm font-semibold text-white">{parseFloat(product.variants[0]?.price || product.base_price || 0).toLocaleString()} د.ع</p>
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {uniqueColorsWithHex.map((color, idx) => (
                  <div
                    key={idx}
                    title={color.name}
                    className="w-5 h-5 rounded-full border-2 border-background/80 shadow-md"
                    style={{ backgroundColor: color.hex || '#ccc' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default ProductCard;