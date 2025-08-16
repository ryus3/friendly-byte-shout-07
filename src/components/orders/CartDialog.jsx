import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, Trash2, Tag, PackagePlus } from 'lucide-react';
import { QRButton } from '@/components/ui/qr-button';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/components/ui/use-toast';
import UnifiedQRScanner from '@/components/shared/UnifiedQRScanner';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';

const CartDialog = ({ open, onOpenChange, onCheckout }) => {
  const { products, cart, addToCart, removeFromCart, updateCartItemQuantity, clearCart, settings } = useInventory();
  const { hasPermission } = useAuth();
  const [discount, setDiscount] = useState(0);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);

  const safeCart = useMemo(() => Array.isArray(cart) ? cart : [], [cart]);

  const subtotal = useMemo(() => safeCart.reduce((sum, item) => sum + item.total, 0), [safeCart]);
  const deliveryFee = settings?.deliveryFee || 0;
  const total = useMemo(() => subtotal + deliveryFee - discount, [subtotal, deliveryFee, discount]);

  const handleCheckout = () => {
    if (safeCart.length === 0) {
      toast({ title: "السلة فارغة!", variant: "destructive" });
      return;
    }
    onCheckout();
    onOpenChange(false);
  };
  
  const handleScanSuccess = useCallback((decodedText) => {
    // البحث في المنتجات
    let foundVariant = null;
    let foundProduct = null;

    for (const p of products) {
        foundVariant = p.variants.find(v => 
          v.sku === decodedText || 
          v.barcode === decodedText ||
          v.id?.toString() === decodedText
        );
        if (foundVariant) {
            foundProduct = p;
            break;
        }
    }
    
    if (foundProduct && foundVariant) {
      if(foundVariant.quantity > 0) {
        addToCart(foundProduct, foundVariant, 1);
        toast({ 
          title: "✅ تمت إضافة المنتج!", 
          description: `${foundProduct.name} - ${foundVariant.color} ${foundVariant.size}`,
          variant: "success"
        });
      } else {
        toast({ 
          title: "⚠️ نفذت الكمية", 
          description: `${foundProduct.name} - ${foundVariant.color} ${foundVariant.size}`, 
          variant: "destructive" 
        });
      }
    } else {
      // رسالة عدم العثور على المنتج
      toast({ 
        title: "❌ لم يتم العثور على المنتج", 
        description: `الكود المقروء: ${decodedText}\n\nهذا المنتج غير موجود في النظام أو تم حذفه.`, 
        variant: "destructive" 
      });
    }
  }, [products, addToCart]);
  
  const handleUpdateQuantity = (itemId, newQuantity) => {
    const item = safeCart.find(i => i.id === itemId);
    if(newQuantity > item.stock) {
        toast({ title: "الكمية غير متوفرة", description: `المخزون المتوفر: ${item.stock}`, variant: "destructive" });
        return;
    }
    updateCartItemQuantity(itemId, newQuantity);
  }

  const handleProductSelectConfirm = (selectedItems) => {
    clearCart();
    selectedItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product.variants.find(v => v.id === item.variantId);
      if (product && variant) {
        addToCart(product, variant, item.quantity, false);
      }
    });
    setIsProductSelectorOpen(false);
    toast({ title: "تم تحديث السلة", description: `تمت إضافة ${selectedItems.length} أنواع من المنتجات.`, variant: 'success' });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="gradient-text flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><ShoppingCart /> سلة التسوق</div>
            <div className='flex gap-2'>
              <QRButton 
                variant="outline" 
                size="sm" 
                onClick={() => setIsScannerOpen(true)} 
                className="hover:bg-primary/10 border-primary/30" 
              >
                <span className="sr-only">مسح</span>
              </QRButton>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {safeCart.length > 0 ? (
            <>
              <div className="space-y-3 max-h-64 overflow-y-auto p-1 -mr-2 pr-2">
                {safeCart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-3">
                       <img src={item.image} alt={item.productName} className="w-12 h-12 rounded-md object-cover" />
                      <div>
                        <p className="font-medium text-foreground">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">{item.color} - {item.size}</p>
                        <div className="flex items-center gap-1 mt-1">
                            <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                                className="w-16 h-8 text-sm"
                                min="1"
                                max={item.stock}
                            />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-primary font-semibold">{item.total.toLocaleString()} د.ع</span>
                      <Button size="icon" variant="ghost" onClick={() => removeFromCart(item.id)} className="w-8 h-8 text-red-500 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المجموع الفرعي</span>
                  <span>{subtotal.toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">أجور التوصيل</span>
                  <span>{deliveryFee.toLocaleString()} د.ع</span>
                </div>
                {hasPermission('apply_order_discounts') && (
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="discount" className="text-muted-foreground flex items-center gap-1"><Tag className="w-4 h-4" /> الخصم</Label>
                    <Input 
                      id="discount"
                      type="number" 
                      value={discount} 
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} 
                      className="w-28 h-8"
                      placeholder="0"
                    />
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-foreground">المجموع الكلي</span>
                  <span className="text-primary">{total.toLocaleString()} د.ع</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">السلة فارغة</h3>
              <p className="text-muted-foreground mb-4">أضف بعض المنتجات لتبدأ.</p>
            </div>
          )}
           <Button variant="outline" className="w-full" onClick={() => setIsProductSelectorOpen(true)}>
                <PackagePlus className="w-4 h-4 ml-2" /> إضافة/تعديل المنتجات
            </Button>
        </div>
        <DialogFooter className="mt-4">
          <Button onClick={clearCart} variant="outline" disabled={safeCart.length === 0}>مسح السلة</Button>
          <Button onClick={handleCheckout} className="flex-1" disabled={safeCart.length === 0}>إتمام الطلب</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <UnifiedQRScanner
      open={isScannerOpen}
      onOpenChange={setIsScannerOpen}
      onScanSuccess={handleScanSuccess}
      title="🔍 قارئ الباركود للسلة"
      description="📱 امسح باركود المنتج لإضافته للسلة"
      elementId="cart-barcode-scanner"
    />
    <ProductSelectionDialog
        open={isProductSelectorOpen}
        onOpenChange={setIsProductSelectorOpen}
        onConfirm={handleProductSelectConfirm}
        initialCart={cart}
    />
    </>
  );
};

export default CartDialog;