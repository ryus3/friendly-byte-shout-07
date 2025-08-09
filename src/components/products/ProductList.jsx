import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductListItem from './ProductListItem';
import { Package } from 'lucide-react';

const ProductList = React.memo(({ products, onProductSelect }) => {
  return (
    <div className="space-y-3">
      <AnimatePresence>
        {products.map((product, index) => (
          <motion.div
            key={product.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <ProductListItem
              product={product}
              onSelect={() => onProductSelect(product)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      {products.length === 0 && (
        <div className="text-center py-12 col-span-full">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground mb-2">لا توجد منتجات</h3>
          <p className="text-muted-foreground">جرب تغيير معايير البحث أو الفلترة</p>
        </div>
      )}
    </div>
  );
});

export default ProductList;