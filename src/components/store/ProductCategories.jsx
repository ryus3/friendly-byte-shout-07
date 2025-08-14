import React from 'react';
import { motion } from 'framer-motion';
import { Package, Grid3X3, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ProductCategories = ({ categories, selectedCategory, onCategorySelect }) => {
  if (!categories || categories.length === 0) return null;

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12"
    >
      <div className="flex items-center gap-3 mb-6">
        <Grid3X3 className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-bold text-foreground">تصفح حسب التصنيف</h3>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* زر الكل */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            onClick={() => onCategorySelect(null)}
            className={`rounded-full px-6 py-2 transition-all duration-300 ${
              !selectedCategory 
                ? 'bg-gradient-to-r from-primary to-purple-500 text-white shadow-lg hover:shadow-xl' 
                : 'border-2 border-primary/30 hover:border-primary/60'
            }`}
          >
            <Package className="w-4 h-4 ml-2" />
            جميع المنتجات
          </Button>
        </motion.div>

        {categories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant={selectedCategory?.id === category.id ? "default" : "outline"}
              onClick={() => onCategorySelect(category)}
              className={`rounded-full px-6 py-2 transition-all duration-300 ${
                selectedCategory?.id === category.id
                  ? 'bg-gradient-to-r from-primary to-purple-500 text-white shadow-lg hover:shadow-xl' 
                  : 'border-2 border-primary/30 hover:border-primary/60'
              }`}
            >
              {category.name}
              <Badge 
                variant="secondary" 
                className="mr-2 bg-white/20 text-xs"
              >
                {Math.floor(Math.random() * 50) + 10}
              </Badge>
            </Button>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

export default ProductCategories;