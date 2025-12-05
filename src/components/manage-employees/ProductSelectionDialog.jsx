import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, Check, X, Palette, Ruler, ShoppingBag } from 'lucide-react';

/**
 * نافذة اختيار المنتجات الاحترافية
 * تصميم Grid متجاوب مع دعم اللمس الكامل
 */
const ProductSelectionDialog = ({ 
  open, 
  onOpenChange, 
  products = [], 
  selectedProducts = [],
  onToggleProduct,
  onConfirm,
  loading = false,
  title = "اختر المنتجات"
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // فلترة المنتجات حسب البحث
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  // حساب الألوان والقياسات المتاحة
  const getAvailableVariants = (product) => {
    const colors = new Map();
    const sizes = new Map();
    let totalStock = 0;
    
    product?.variants?.forEach(v => {
      const qty = v.inventory?.quantity || v.inventory?.[0]?.quantity || 0;
      const reserved = v.inventory?.reserved_quantity || v.inventory?.[0]?.reserved_quantity || 0;
      const available = qty - reserved;
      
      if (available > 0) {
        totalStock += available;
        if (v.color?.name) {
          const existing = colors.get(v.color.name) || { count: 0, hex: v.color.hex_code };
          colors.set(v.color.name, { count: existing.count + available, hex: existing.hex });
        }
        if (v.size?.name) {
          const existing = sizes.get(v.size.name) || 0;
          sizes.set(v.size.name, existing + available);
        }
      }
    });
    
    return { 
      colors: Array.from(colors.entries()).slice(0, 4), 
      sizes: Array.from(sizes.entries()).slice(0, 4),
      totalStock
    };
  };

  // الحصول على صورة المنتج
  const getProductImage = (product) => {
    if (product.images?.[0]) return product.images[0];
    if (product.variants?.[0]?.images?.[0]) return product.variants[0].images[0];
    return '/placeholder.png';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header مع بحث */}
        <DialogHeader className="sticky top-0 z-10 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 p-4 sm:p-6 border-b">
          <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl">
            <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span>{title}</span>
            {selectedProducts.length > 0 && (
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 mr-auto">
                {selectedProducts.length} محدد
              </Badge>
            )}
          </DialogTitle>
          
          <div className="relative mt-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="ابحث عن منتج بالاسم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-11 h-12 text-base border-2 border-purple-200 focus:border-purple-400 rounded-xl"
            />
          </div>
        </DialogHeader>

        {/* Grid المنتجات */}
        <ScrollArea className="flex-1 max-h-[calc(90vh-220px)]">
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent"></div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  {searchTerm ? 'لا توجد منتجات مطابقة للبحث' : 'لا توجد منتجات متاحة'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product, index) => {
                    const isSelected = selectedProducts.includes(product.id);
                    const { colors, sizes, totalStock } = getAvailableVariants(product);
                    
                    return (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: index * 0.02, duration: 0.2 }}
                        onClick={() => onToggleProduct(product.id)}
                        className={`
                          relative cursor-pointer rounded-2xl border-2 p-3 sm:p-4
                          transition-all duration-200 touch-manipulation select-none
                          active:scale-[0.98] hover:shadow-lg
                          ${isSelected 
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 shadow-purple-200 dark:shadow-purple-900/20' 
                            : 'border-border hover:border-purple-300 bg-card'
                          }
                        `}
                      >
                        {/* Checkbox */}
                        <div className={`
                          absolute top-2 left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center
                          transition-all duration-200
                          ${isSelected 
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                            : 'bg-white dark:bg-gray-800 border-2 border-muted'
                          }
                        `}>
                          {isSelected && <Check className="h-4 w-4 text-white" />}
                        </div>

                        {/* صورة المنتج */}
                        <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-muted">
                          <img 
                            src={getProductImage(product)}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {totalStock > 0 && (
                            <Badge className="absolute bottom-2 right-2 bg-green-500/90 text-white text-[10px] px-1.5">
                              {totalStock} متاح
                            </Badge>
                          )}
                        </div>

                        {/* معلومات المنتج */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-sm sm:text-base line-clamp-2 leading-tight">
                            {product.name}
                          </h3>
                          
                          <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                            {product.base_price?.toLocaleString('ar-IQ')} IQD
                          </p>

                          {/* الألوان */}
                          {colors.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Palette className="h-3 w-3 text-muted-foreground shrink-0" />
                              <div className="flex gap-1 flex-wrap">
                                {colors.map(([name, { hex }]) => (
                                  <span 
                                    key={name}
                                    className="w-4 h-4 rounded-full border border-white shadow-sm"
                                    style={{ backgroundColor: hex || '#ccc' }}
                                    title={name}
                                  />
                                ))}
                                {product.variants?.length > 4 && (
                                  <span className="text-[10px] text-muted-foreground">+{product.variants.length - 4}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* القياسات */}
                          {sizes.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Ruler className="h-3 w-3 text-muted-foreground shrink-0" />
                              <div className="flex gap-1 flex-wrap">
                                {sizes.map(([name]) => (
                                  <span 
                                    key={name}
                                    className="text-[10px] bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer مع زر الإضافة */}
        <DialogFooter className="sticky bottom-0 bg-background border-t p-4 sm:p-6 flex-row gap-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none"
          >
            <X className="h-4 w-4 ml-2" />
            إلغاء
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={selectedProducts.length === 0}
            className="flex-1 sm:flex-none bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 hover:opacity-90"
          >
            <Check className="h-4 w-4 ml-2" />
            إضافة {selectedProducts.length > 0 ? `(${selectedProducts.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductSelectionDialog;
