import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Star, Package, DollarSign, Palette, Ruler, Hash, Calendar, Info, ShoppingCart, Zap, Plus, Minus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { AnimatePresence, motion } from 'framer-motion';

const DetailItem = ({ icon: Icon, label, value, isBadge = false }) => (
  <div className="flex items-start gap-4">
    <Icon className="w-5 h-5 text-primary mt-1" />
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {isBadge ? (
        <Badge variant="secondary">{value}</Badge>
      ) : (
        <p className="font-semibold text-foreground">{value}</p>
      )}
    </div>
  </div>
);

const ProductDetailsDialog = ({ product, open, onOpenChange, onAddToCart, onDirectOrder }) => {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const mainImage = selectedVariant?.image || product.images?.[0] || product.image || "https://via.placeholder.com/150";
  const totalStock = product.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;

  const handleVariantSelect = (variant) => {
    setSelectedVariant(variant);
    setQuantity(1);
  };

  const handleAddToCartClick = () => {
    if (!selectedVariant) {
      toast({ title: "خطأ", description: "الرجاء اختيار اللون والمقاس أولاً.", variant: "destructive" });
      return;
    }
    onAddToCart(product, selectedVariant, quantity);
    onOpenChange(false);
  };

  const handleDirectOrderClick = () => {
    if (!selectedVariant) {
      toast({ title: "خطأ", description: "الرجاء اختيار اللون والمقاس أولاً.", variant: "destructive" });
      return;
    }
    onDirectOrder(product, selectedVariant, quantity);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{product.name}</DialogTitle>
          <DialogDescription>
            اختر المتغيرات المطلوبة وأضفها للسلة أو قم بطلب سريع.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Image Section */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.img
                key={mainImage}
                src={mainImage}
                alt={product.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-80 object-cover rounded-lg border"
              />
            </AnimatePresence>
          </div>

          {/* Details and Actions Section */}
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-lg mb-2">اختر اللون</h4>
              <div className="flex flex-wrap gap-2">
                {[...new Map(product.variants.map(item => [item['color'], item])).values()].map(variant => (
                  <Button
                    key={variant.color}
                    variant={selectedVariant?.color === variant.color ? 'default' : 'outline'}
                    onClick={() => handleVariantSelect(product.variants.find(v => v.color === variant.color && v.quantity > 0) || variant)}
                    className="flex items-center gap-2"
                  >
                    <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: variant.color_hex }}></div>
                    {variant.color}
                  </Button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {selectedVariant && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <h4 className="font-semibold text-lg mb-2">اختر المقاس</h4>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.filter(v => v.color === selectedVariant.color).map(variant => (
                      <Button
                        key={variant.id}
                        variant={selectedVariant.id === variant.id ? 'default' : 'outline'}
                        onClick={() => handleVariantSelect(variant)}
                        disabled={variant.quantity === 0}
                        className="relative"
                      >
                        {variant.size}
                        {variant.quantity === 0 && <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500 border border-background"></span>}
                      </Button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <h4 className="font-semibold text-lg">الكمية</h4>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={!selectedVariant}>
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                  disabled={!selectedVariant}
                />
                <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.min(selectedVariant?.quantity || 1, q + 1))} disabled={!selectedVariant}>
                  <Plus className="w-4 h-4" />
                </Button>
                {selectedVariant && <p className="text-sm text-muted-foreground">المتوفر: {selectedVariant.quantity}</p>}
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-2xl font-bold text-primary">
                {selectedVariant ? (selectedVariant.price * quantity).toLocaleString() : product.price.toLocaleString()} د.ع
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="flex-1" onClick={handleAddToCartClick} disabled={!selectedVariant}>
            <ShoppingCart className="w-4 h-4 ml-2" />
            إضافة للسلة
          </Button>
          <Button className="flex-1" onClick={handleDirectOrderClick} disabled={!selectedVariant}>
            <Zap className="w-4 h-4 ml-2" />
            طلب سريع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailsDialog;