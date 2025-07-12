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

  const totalStock = useMemo(() => product.variants.reduce((sum, v) => sum + v.quantity, 0), [product.variants]);

  const uniqueColorsWithHex = useMemo(() => {
    if (!product) return [];
    const uniqueVariantColors = [...new Set(product.variants.map(item => item.color))];
    return uniqueVariantColors.map(colorName => {
      const colorInfo = allColors.find(c => c.name === colorName);
      return { name: colorName, hex: colorInfo?.hex_code };
    }).slice(0, 5);
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
      className="group product-card cursor-pointer"
      whileHover={{ y: -5 }}
    >
      <div className="absolute top-2 right-2 z-10">
        <Badge className={cn("shadow-md", getStockLevelClass())}>
          {totalStock} قطعة
        </Badge>
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
              <p className="text-sm font-semibold text-white">{product.variants[0]?.price.toLocaleString()} د.ع</p>
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