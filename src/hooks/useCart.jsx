import React, { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export const useCart = (isEditMode = false) => {
  const [cart, setCart] = useState([]);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const addToCart = useCallback((product, variant, quantity, showToast = true, skipStockCheck = false) => {
    // التحقق من صحة البيانات المدخلة أولاً
    if (!product || !variant || typeof product !== 'object' || typeof variant !== 'object') {
      console.error('❌ addToCart: بيانات غير صالحة:', { product, variant });
      return false;
    }

    const safeQuantity = Number(quantity) || 1;
    const totalStock = Math.max(0, Number(variant?.quantity) || 0);
    const reservedStock = Math.max(0, Number(variant?.reserved) || 0);
    const availableStock = Math.max(0, totalStock - reservedStock);

    // تجاهل فحص المخزون في وضع التعديل أو عند طلب تجاهل الفحص
    if (!isEditMode && !skipStockCheck && safeQuantity > availableStock) {
      toast({ title: "الكمية غير متوفرة", description: `لا يمكنك إضافة هذا المنتج. الكمية المتاحة للبيع: ${availableStock}`, variant: "destructive" });
      return false;
    }

    const cartItem = {
      id: `${product?.id || 'temp'}-${variant?.id || variant?.sku || 'no-variant'}`,
      productId: product?.id || 'temp-product',
      variantId: variant?.id || variant?.sku || 'temp-variant',
      sku: variant?.sku || variant?.id || 'temp-sku',
      productName: product?.name || 'منتج',
      image: variant?.image || product?.images?.[0] || '/placeholder.svg',
      color: variant?.color || variant?.colors?.name || 'افتراضي',
      size: variant?.size || variant?.sizes?.name || 'افتراضي',
      quantity: safeQuantity,
      price: Number(variant?.price) || Number(product?.price) || 0,
      costPrice: Number(variant?.cost_price) || Number(product?.cost_price) || 0,
      stock: Number(variant?.quantity) || 999,
      reserved: Number(variant?.reserved) || 0,
      total: (Number(variant?.price) || Number(product?.price) || 0) * safeQuantity
    };
    
    setCart(prev => {
      const filteredPrev = (prev || []).filter(item => item != null);
      const existingItem = filteredPrev.find(item => item?.id === cartItem.id);
      if (existingItem) {
        const newQuantity = Number(existingItem?.quantity || 0) + safeQuantity;
        const availableStockForExisting = Math.max(0, Number(existingItem?.stock || 0) - Number(existingItem?.reserved || 0));
        
        // تجاهل فحص المخزون في وضع التعديل أو عند طلب تجاهل الفحص
        if (!isEditMode && !skipStockCheck && newQuantity > availableStockForExisting) {
          toast({ title: "الكمية غير متوفرة", description: `لا يمكنك إضافة المزيد. الكمية المتاحة للبيع: ${availableStockForExisting}`, variant: "destructive" });
          return filteredPrev;
        }
        return filteredPrev.map(item => item?.id === cartItem.id ? { 
          ...item, 
          quantity: newQuantity, 
          total: (Number(item?.price) || 0) * newQuantity 
        } : item);
      }
      return [...filteredPrev, cartItem];
    });
    
    if (showToast) {
      toast({ 
        title: "تمت الإضافة إلى السلة", 
        description: `${product?.name || 'منتج'} (${variant?.size || variant?.sizes?.name || 'افتراضي'}, ${variant?.color || variant?.colors?.name || 'افتراضي'})`, 
        variant: 'success' 
      });
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
    setCart(prev => (prev || []).filter(item => item != null && item?.id !== itemId));
  }, []);

  const updateCartItemQuantity = useCallback((itemId, newQuantity, skipStockCheck = false) => {
    const safeNewQuantity = Number(newQuantity) || 0;
    setCart(prev => (prev || []).filter(item => item != null).map(item => {
      if (item?.id === itemId) {
        const totalStock = Math.max(0, Number(item?.stock) || 0);
        const reservedStock = Math.max(0, Number(item?.reserved) || 0);
        const availableStock = Math.max(0, totalStock - reservedStock);
        
        // تجاهل فحص المخزون في وضع التعديل أو عند طلب تجاهل الفحص
        if (!isEditMode && !skipStockCheck && safeNewQuantity > availableStock) {
          toast({ title: "الكمية غير متوفرة", description: `المخزون المتاح للبيع: ${availableStock}`, variant: "destructive" });
          return { ...item, quantity: Math.max(0, availableStock), total: (Number(item?.price) || 0) * Math.max(0, availableStock) };
        }
        return safeNewQuantity <= 0 ? null : { 
          ...item, 
          quantity: safeNewQuantity, 
          total: (Number(item?.price) || 0) * safeNewQuantity 
        };
      }
      return item;
    }).filter(Boolean));
  }, [isEditMode]);

  const clearCart = useCallback(() => {
    if (!isMountedRef.current) {
      console.warn('⚠️ clearCart: تم الاستدعاء بعد unmount - تم التجاهل');
      return;
    }
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
