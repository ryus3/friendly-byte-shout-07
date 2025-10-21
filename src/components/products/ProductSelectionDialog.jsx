import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Minus, Search, X, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';

const VariantSelector = ({ variants, onSelect, selectedVariantId, onQuickAdd }) => {
  const [expandedColors, setExpandedColors] = useState(new Set());

  // تجميع المتغيرات حسب اللون مع ترتيب الألوان
  const variantsByColor = variants.reduce((acc, variant) => {
    if (!acc[variant.color]) {
      acc[variant.color] = [];
    }
    acc[variant.color].push(variant);
    return acc;
  }, {});

  // خريطة الألوان الشاملة مع الأكواد الصحيحة
  const colorMap = {
    'اسود': '#000000',
    'ابيض': '#ffffff',
    'جوزي': '#8B4513',
    'ماروني': '#800000',
    'ازرق': '#0066cc',
    'اخضر': '#10b981',
    'سمائي': '#87ceeb',
    'نيلي': '#000080',
    'وردي': '#ffc0cb',
    'ليموني': '#ffff00',
    'فستقي': '#93c47d',
    'افتراضي': '#6b7280',
    'غير محدد': '#6b7280'
  };

  // ترتيب الألوان حسب الأولوية
  const colorPriority = { 
    'ابيض': 1, 'اسود': 2, 'ازرق': 3, 'اخضر': 4, 'جوزي': 5, 'ماروني': 6, 
    'وردي': 7, 'سمائي': 8, 'نيلي': 9, 'ليموني': 10, 'فستقي': 11, 'افتراضي': 12, 'غير محدد': 13 
  };
  
  // فلترة الألوان التي لها قياسات متوفرة فقط (quantity > 0)
  const availableColors = Object.keys(variantsByColor).filter(color => {
    const availableVariants = variantsByColor[color].filter(variant => variant.quantity > 0);
    return availableVariants.length > 0;
  });
  
  const sortedColors = availableColors.sort((a, b) => {
    const priorityA = colorPriority[a] || 999;
    const priorityB = colorPriority[b] || 999;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.localeCompare(b, 'ar');
  });

  // ترتيب القياسات داخل كل لون
  const sizePriority = { 'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6 };
  const sortVariantsBySize = (variants) => {
    return variants.sort((a, b) => {
      const priorityA = sizePriority[a.size] || 999;
      const priorityB = sizePriority[b.size] || 999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.size.localeCompare(b.size, 'ar');
    });
  };

  const toggleColor = (color) => {
    const newExpanded = new Set(expandedColors);
    if (newExpanded.has(color)) {
      newExpanded.delete(color);
    } else {
      newExpanded.add(color);
    }
    setExpandedColors(newExpanded);
  };

  const handleSizeDoubleClick = (variant) => {
    if (onQuickAdd) {
      onQuickAdd(variant);
    }
  };

  return (
    <div className="space-y-3 my-3">
      {sortedColors.map(color => {
        // فلترة القياسات المتوفرة فقط (quantity > 0)
        const availableVariants = variantsByColor[color].filter(variant => variant.quantity > 0);
        const colorVariants = sortVariantsBySize(availableVariants);
        const isExpanded = expandedColors.has(color);
        
        // تخطي الألوان التي لا تحتوي على قياسات متوفرة
        if (colorVariants.length === 0) return null;
        
        return (
          <div key={color} className="bg-muted/30 rounded-lg border overflow-hidden">
            {/* عنوان اللون - قابل للنقر */}
            <div 
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleColor(color)}
            >
              <div 
                className="w-5 h-5 rounded-full border-2 border-border shadow-sm flex-shrink-0" 
                style={{ 
                  backgroundColor: colorMap[color] || '#6b7280',
                  border: color === 'ابيض' ? '2px solid #e5e7eb' : 'none'
                }}
              />
              <span className="text-sm font-bold text-foreground">{color}</span>
              <span className="text-xs text-muted-foreground">({colorVariants.length} قياس)</span>
              <div className="mr-auto">
                {isExpanded ? 
                  <ChevronUp className="w-4 h-4 text-muted-foreground" /> : 
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                }
              </div>
            </div>
            
            {/* قياسات هذا اللون - قابلة للتوسيع */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3">
                    <div className="bg-background/50 rounded-md p-3">
                      <div className="flex flex-wrap gap-2">
                        {colorVariants.map(variant => (
                          <div key={variant.id} className="flex items-center gap-1">
                            {/* زر القياس الأساسي */}
                            <Button
                              size="sm"
                              variant={selectedVariantId === variant.id ? 'default' : 'outline'}
                              onClick={() => onSelect(variant)}
                              onDoubleClick={() => handleSizeDoubleClick(variant)}
                              disabled={variant.quantity === 0}
                              className="relative h-9 min-w-[3rem] font-medium transition-all hover:scale-105"
                              title="نقر مزدوج للإضافة السريعة"
                            >
                              {variant.size}
                              <span className="absolute -bottom-1 -right-1 text-[10px] bg-primary/10 text-primary px-1 rounded">
                                {variant.quantity}
                              </span>
                            </Button>
                            
                            {/* زر + للإضافة السريعة - يظهر فقط عند اختيار القياس */}
                            {selectedVariantId === variant.id && variant.quantity > 0 && (
                              <motion.button
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSizeDoubleClick(variant);
                                }}
                                className="h-9 w-9 rounded-md bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all active:scale-95"
                                title="إضافة سريعة"
                              >
                                <Plus className="w-5 h-5" />
                              </motion.button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        💡 نقر مزدوج على القياس للإضافة السريعة
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

const QuantityControl = ({ quantity, setQuantity, maxQuantity, onAdd }) => {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="w-4 h-4" /></Button>
        <Input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className="w-14 h-8 text-center" min="1" max={maxQuantity} />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}><Plus className="w-4 h-4" /></Button>
      </div>
      <p className="text-xs text-muted-foreground">المتوفر: {maxQuantity}</p>
      <Button size="sm" onClick={onAdd} className="mr-auto">
        <Check className="w-4 h-4 ml-1" />
        إضافة
      </Button>
    </div>
  );
};

const ProductItem = ({ product, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const handleAdd = () => {
    if (!selectedVariant) {
      toast({ title: "الرجاء اختيار متغير", variant: "destructive" });
      return;
    }
    if (quantity > selectedVariant.quantity) {
      toast({ title: "الكمية غير متوفرة", description: `المتوفر: ${selectedVariant.quantity}`, variant: "destructive" });
      return;
    }
    onSelect(product, selectedVariant, quantity);
    // Reset for next selection
    setSelectedVariant(null);
    setQuantity(1);
  };

  const handleQuickAdd = (variant) => {
    if (variant.quantity === 0) {
      toast({ title: "غير متوفر", description: "هذا القياس غير متوفر حالياً", variant: "destructive" });
      return;
    }
    onSelect(product, variant, 1);
    toast({ 
      title: "تمت الإضافة السريعة ✨", 
      description: `${product.name} (${variant.size}, ${variant.color})`, 
      variant: 'success' 
    });
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-3 border rounded-lg"
    >
      <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <img src={product.images?.[0] || '/default-product-image.jpg'} alt={product.name} className="w-12 h-12 object-cover rounded-md" />
        <h4 className="font-semibold flex-grow">{product.name}</h4>
        <p className="text-sm text-muted-foreground">{product.base_price?.toLocaleString()} د.ع</p>
        <Button variant="ghost" size="icon">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <VariantSelector 
                variants={product.variants} 
                onSelect={setSelectedVariant} 
                selectedVariantId={selectedVariant?.id}
                onQuickAdd={handleQuickAdd}
              />
              {selectedVariant && (
                <QuantityControl 
                  quantity={quantity} 
                  setQuantity={setQuantity} 
                  maxQuantity={selectedVariant.quantity}
                  onAdd={handleAdd}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ProductSelectionDialog = ({ open, onOpenChange, onConfirm, initialCart = [] }) => {
  const { products } = useInventory();
  const { filterProductsByPermissions } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSearchReadOnly, setIsSearchReadOnly] = useState(true);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSelectedItems(initialCart);
      setIsSearchReadOnly(true); // إعادة تعيين حالة البحث عند فتح النافذة
    }
  }, [open, initialCart]);

  const handleSearchClick = () => {
    setIsSearchReadOnly(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // تطبيق فلترة الصلاحيات أولاً
  const permissionFilteredProducts = useMemo(() => {
    return filterProductsByPermissions ? filterProductsByPermissions(products) : products;
  }, [products, filterProductsByPermissions]);

  const filteredProducts = useMemo(() => {
    return permissionFilteredProducts.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      p.variants && p.variants.length > 0 &&
      p.is_active !== false // فقط المنتجات المرئية للعملاء
    );
  }, [permissionFilteredProducts, searchTerm]);

  const handleSelectProduct = (product, variant, quantity) => {
    const newItem = {
      id: `${product.id}-${variant.id}`,
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      color: variant.color,
      size: variant.size,
      price: variant.price || product.base_price || 0,
      costPrice: variant.cost_price || product.cost_price || 0,
      quantity,
      total: quantity * (variant.price || product.base_price || 0),
      image: variant.images?.[0] || product.images?.[0] || '/default-product-image.jpg',
      sku: variant.barcode || product.barcode || `${product.id}-${variant.id}`,
      stock: variant.quantity,
      reserved: variant.reserved || 0
    };

    setSelectedItems(prev => {
      const existing = prev.find(item => item.id === newItem.id);
      if (existing) {
        const newQuantity = existing.quantity + newItem.quantity;
        if (newQuantity > variant.quantity) {
          toast({ title: "الكمية غير متوفرة", description: `لا يمكنك إضافة المزيد. المتوفر: ${variant.quantity}`, variant: "destructive" });
          return prev;
        }
        return prev.map(item => item.id === newItem.id ? { ...item, quantity: newQuantity, total: newQuantity * variant.price } : item);
      }
      return [...prev, newItem];
    });
    toast({ title: "تمت الإضافة", description: `${newItem.productName} (${newItem.size}, ${newItem.color})`, variant: 'success' });
  };

  const handleRemoveItem = (itemId) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleConfirm = () => {
    onConfirm(selectedItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[95vh] w-[95vw] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0 flex-shrink-0 border-b">
          <DialogTitle className="text-lg font-bold">اختر المنتجات</DialogTitle>
          <DialogDescription className="text-sm">ابحث واختر المنتجات لإضافتها إلى الطلب.</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search - Always visible */}
          <div className="p-4 pb-0 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                ref={searchInputRef}
                placeholder={isSearchReadOnly ? "انقر هنا للبحث عن منتج..." : "ابحث عن منتج..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={handleSearchClick}
                readOnly={isSearchReadOnly}
                className="pl-10 h-12 text-base cursor-pointer"
                autoFocus={false}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Main Content Area - Responsive Layout */}
          <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 pt-2 overflow-hidden">
            
            {/* Products List - Takes priority on mobile */}
            <div className="flex-1 lg:flex-[2] flex flex-col min-h-0">
              <h3 className="font-semibold text-base mb-3 lg:hidden">المنتجات المتاحة</h3>
              <ScrollArea className="flex-1 border rounded-lg max-h-[70vh] lg:max-h-none">
                <div className="p-3 space-y-3">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(p => <ProductItem key={p.id} product={p} onSelect={handleSelectProduct} />)
                  ) : (
                    <p className="text-center text-muted-foreground py-8">لا توجد منتجات مطابقة.</p>
                  )}
                </div>
              </ScrollArea>
            </div>
            
            {/* Cart Sidebar - Sticky on large screens, collapsible on mobile */}
            <div className="w-full lg:w-80 flex flex-col border rounded-lg bg-secondary/20 max-h-[50vh] lg:max-h-none">
              <div className="p-4 border-b bg-secondary/30 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base">السلة المختارة</h3>
                  <div className="text-sm text-muted-foreground bg-primary/10 px-2 py-1 rounded-full">
                    {selectedItems.length} منتج
                  </div>
                </div>
              </div>
              
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-3">
                  {selectedItems.length > 0 ? (
                    selectedItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-background rounded-lg shadow-sm border">
                        <img src={item.image} alt={item.productName} className="w-12 h-12 object-cover rounded flex-shrink-0" />
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-medium truncate">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.size}, {item.color}</p>
                          <p className="text-xs text-primary font-semibold">{item.quantity}x - {item.total.toLocaleString()} د.ع</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 flex-shrink-0 hover:bg-destructive/10" 
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">لم يتم اختيار منتجات بعد</p>
                      <p className="text-xs mt-1">اختر المنتجات من القائمة</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="p-4 border-t bg-secondary/30 flex-shrink-0">
                <Button 
                  onClick={handleConfirm} 
                  disabled={selectedItems.length === 0}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  <Check className="w-5 h-5 ml-2" />
                  تأكيد الاختيار ({selectedItems.length})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductSelectionDialog;