import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Plus, Minus, Zap } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useVariants } from '@/contexts/VariantsContext';
import { ScrollArea } from '@/components/ui/scroll-area';

const ProductVariantDialog = ({ product, open, onClose, onCreateOrder }) => {
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const { settings, addToCart } = useInventory();
  const { hasPermission } = useAuth();
  const { colors: allColors } = useVariants();

  useEffect(() => {
    if (open && product) {
      const availableColors = getAvailableColors();
      if (availableColors.length === 1) {
        handleColorSelect(availableColors[0]);
      }
    } else {
      setSelectedColor(null);
      setSelectedSize(null);
      setQuantity(1);
    }
  }, [open, product]);

  useEffect(() => {
    if(selectedColor) {
      const availableSizes = getAvailableSizesForColor();
      if(availableSizes.length === 1){
        handleSizeSelect(availableSizes[0].size);
      }
    }
  }, [selectedColor]);

  const totalStock = useMemo(() => product?.variants.reduce((sum, v) => sum + v.quantity, 0) || 0, [product]);

  const getAvailableColors = () => {
    if (!product) return [];
    const colorNames = [...new Set(product.variants.map(v => v.color))];
    return colorNames.map(name => {
      const colorInfo = allColors.find(c => c.name === name);
      return { name, hex: colorInfo?.hex_code || '#ccc' };
    });
  };

  const getAvailableSizesForColor = () => {
    if (!product || !selectedColor) return [];
    return product.variants.filter(v => v.color === selectedColor.name);
  };

  const selectedVariant = useMemo(() => {
    if (!product || !selectedColor || !selectedSize) return null;
    const variant = product.variants.find(v => v.color === selectedColor.name && v.size === selectedSize);
    if (variant) {
      // التأكد من وجود جميع البيانات المطلوبة
      return {
        ...variant,
        id: variant.id, // التأكد من وجود ID
        sku: variant.sku || variant.barcode, // استخدام sku أو barcode
        quantity: variant.quantity || 0,
        reserved: variant.reserved || 0,
        cost_price: variant.cost_price || 0
      };
    }
    return null;
  }, [product, selectedColor, selectedSize]);

  const getStockLevelClass = (stock) => {
    if (stock <= (settings.lowStockThreshold || 5)) return 'bg-red-500/80 text-white';
    if (stock <= (settings.mediumStockThreshold || 10)) return 'bg-yellow-500/80 text-white';
    return 'bg-green-500/80 text-white';
  };

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    setSelectedSize(null);
    setQuantity(1);
  };

  const handleSizeSelect = (size) => {
    setSelectedSize(size);
    setQuantity(1);
  };

  const handleAction = (actionType) => {
    if (!selectedVariant) {
      toast({ title: "الرجاء اختيار اللون والقياس", variant: "destructive" });
      return;
    }
    if (quantity > selectedVariant.quantity) {
      toast({ title: "الكمية غير متوفرة", description: `المتوفر: ${selectedVariant.quantity}`, variant: "destructive" });
      return;
    }
    
    if (actionType === 'addToCart') {
      addToCart(product, selectedVariant, quantity);
    } else if (actionType === 'createOrder') {
      if (typeof onCreateOrder === 'function') {
        onCreateOrder(product, selectedVariant, quantity);
      } else {
        console.error("onCreateOrder is not a function");
      }
    }
    
    onClose();
  };

  if (!product) return null;
  const availableColors = getAvailableColors();
  const availableSizesForColor = getAvailableSizesForColor();


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>{product.description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow">
        <div className="grid gap-4 py-4 pr-4">
          <div className="relative">
            <img-replace src={product.images?.[0]} alt={product.name} className="w-full h-64 object-cover rounded-lg" />
            <Badge className={`absolute top-2 right-2 shadow-md ${getStockLevelClass(totalStock)}`}>
              المخزون الكلي: {totalStock}
            </Badge>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">1. اختر اللون:</h4>
            <div className="flex flex-wrap gap-2">
              {availableColors.map(color => (
                <Button
                  key={color.name}
                  variant={selectedColor?.name === color.name ? 'default' : 'outline'}
                  onClick={() => handleColorSelect(color)}
                  className="flex items-center gap-2"
                >
                  <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: color.hex }}></span>
                  {color.name}
                </Button>
              ))}
            </div>
          </div>

          {selectedColor && (
            <div>
              <h4 className="font-semibold mb-2">2. اختر القياس:</h4>
              <div className="flex flex-wrap gap-2">
                {availableSizesForColor.map(variant => (
                  <Button
                    key={variant.id}
                    variant={selectedSize === variant.size ? 'default' : 'outline'}
                    onClick={() => handleSizeSelect(variant.size)}
                    disabled={variant.quantity === 0}
                    className="relative"
                  >
                    {variant.size}
                    {variant.quantity > 0 && <Badge variant="secondary" className="absolute -top-2 -right-2 px-1.5 py-0.5 text-xs">{variant.quantity}</Badge>}
                    {variant.quantity === 0 && <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500 border border-background"></span>}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedVariant && (
            <div>
              <h4 className="font-semibold mb-2">3. حدد الكمية:</h4>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="w-4 h-4" /></Button>
                <Input type="number" value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 text-center" />
                <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.min(selectedVariant.quantity, q + 1))}><Plus className="w-4 h-4" /></Button>
                <p className="text-sm text-muted-foreground mr-auto">المتوفر: {selectedVariant.quantity}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg mt-4">
                <p className="font-bold text-lg text-primary">{selectedVariant.price.toLocaleString()} د.ع</p>
              </div>
            </div>
          )}
        </div>
        </ScrollArea>
        <DialogFooter className="flex-col sm:flex-row gap-2 flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">إلغاء</Button>
          <div className="flex-grow flex gap-2">
            <Button onClick={() => handleAction('addToCart')} disabled={!selectedVariant} className="flex-1">
              <ShoppingCart className="ml-2 h-4 w-4" />
              إضافة للسلة
            </Button>
            {hasPermission('create_order') && (
              <Button onClick={() => handleAction('createOrder')} disabled={!selectedVariant} className="flex-1">
                <Zap className="ml-2 h-4 w-4" />
                طلب سريع
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductVariantDialog;