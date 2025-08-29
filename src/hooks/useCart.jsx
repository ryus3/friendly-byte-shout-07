
import React, { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export const useCart = (isEditMode = false) => {
  const [cart, setCart] = useState([]);

  const addToCart = useCallback((product, variant, quantity, showToast = true, skipStockCheck = false) => {
    const totalStock = Math.max(0, variant.quantity || 0);
    const reservedStock = Math.max(0, variant.reserved || 0);
    const availableStock = Math.max(0, totalStock - reservedStock);

    // تجاهل فحص المخزون في وضع التعديل أو عند طلب تجاهل الفحص
    if (!isEditMode && !skipStockCheck && quantity > availableStock) {
      toast({ title: "الكمية غير متوفرة", description: `لا يمكنك إضافة هذا المنتج. الكمية المتاحة للبيع: ${availableStock}`, variant: "destructive" });
      return false;
    }

    const cartItem = {
      id: `${product.id}-${variant.id || variant.sku}`,
      productId: product.id,
      variantId: variant.id, // استخدام variant.id كـ UUID
      sku: variant.sku,
      productName: product.name,
      image: variant.image || product.images?.[0] || null,
      color: variant.color,
      size: variant.size,
      quantity,
      price: variant.price || product.price,
      costPrice: variant.cost_price || product.cost_price,
      stock: variant.quantity,
      reserved: variant.reserved || 0,
      total: (variant.price || product.price) * quantity
    };
    
    setCart(prev => {
      const existingItem = prev.find(item => item.id === cartItem.id);
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        const availableStockForExisting = (existingItem.stock || 0) - (existingItem.reserved || 0);
        
        // تجاهل فحص المخزون في وضع التعديل أو عند طلب تجاهل الفحص
        if (!isEditMode && !skipStockCheck && newQuantity > availableStockForExisting) {
          toast({ title: "الكمية غير متوفرة", description: `لا يمكنك إضافة المزيد. الكمية المتاحة للبيع: ${availableStockForExisting}`, variant: "destructive" });
          return prev;
        }
        return prev.map(item => item.id === cartItem.id ? { ...item, quantity: newQuantity, total: item.price * newQuantity } : item);
      }
      return [...prev, cartItem];
    });
    
    if (showToast) {
      toast({ title: "تمت الإضافة إلى السلة", description: `${product.name} (${variant.size}, ${variant.color})`, variant: 'success' });
    }
    return true;
  }, []);

  // إضافة منتج من QR Scanner
  const addFromQRScan = useCallback((scannedData, products) => {
    try {
      if (scannedData?.product_id && scannedData?.variant_id) {
        // QR Code يحتوي على معرف المنتج والمتغير
        const product = products?.find(p => p.id === scannedData.product_id);
        if (product) {
          const variant = product.variants?.find(v => v.id === scannedData.variant_id);
          if (variant) {
            return addToCart(product, variant, 1, true);
          }
        }
      } else if (scannedData?.barcode || typeof scannedData === 'string') {
        // البحث بالباركود
        const barcode = scannedData?.barcode || scannedData;
        for (const product of products || []) {
          // البحث في باركود المنتج الرئيسي
          if (product.barcode === barcode) {
            // استخدام أول متغير متاح
            const firstVariant = product.variants?.[0];
            if (firstVariant) {
              return addToCart(product, firstVariant, 1, true);
            }
          }
          // البحث في باركود المتغيرات
          if (product.variants) {
            for (const variant of product.variants) {
              if (variant.barcode === barcode) {
                return addToCart(product, variant, 1, true);
              }
            }
          }
        }
      }
      toast({
        title: "المنتج غير موجود",
        description: "لم يتم العثور على المنتج المقروء",
        variant: "destructive"
      });
      return false;
    } catch (error) {
      console.error('خطأ في إضافة منتج من QR:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة المنتج",
        variant: "destructive"
      });
      return false;
    }
  }, [addToCart]);

  const removeFromCart = useCallback((itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateCartItemQuantity = useCallback((itemId, newQuantity, skipStockCheck = false) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const totalStock = Math.max(0, item.stock || 0);
        const reservedStock = Math.max(0, item.reserved || 0);
        const availableStock = Math.max(0, totalStock - reservedStock);
        
        // تجاهل فحص المخزون في وضع التعديل أو عند طلب تجاهل الفحص
        if (!isEditMode && !skipStockCheck && newQuantity > availableStock) {
          toast({ title: "الكمية غير متوفرة", description: `المخزون المتاح للبيع: ${availableStock}`, variant: "destructive" });
          return { ...item, quantity: Math.max(0, availableStock), total: item.price * Math.max(0, availableStock) };
        }
        return newQuantity <= 0 ? null : { ...item, quantity: newQuantity, total: item.price * newQuantity };
      }
      return item;
    }).filter(Boolean));
  }, [isEditMode]);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  return {
    cart,
    setCart,
    addToCart,
    addFromQRScan,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    isEditMode,
  };
};
