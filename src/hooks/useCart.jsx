
import React, { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export const useCart = () => {
  const [cart, setCart] = useState([]);

  const addToCart = useCallback((product, variant, quantity, showToast = true) => {
    const totalStock = Math.max(0, variant.quantity || 0);
    const reservedStock = Math.max(0, variant.reserved || 0);
    const availableStock = Math.max(0, totalStock - reservedStock);

    if (quantity > availableStock) {
      toast({ title: "الكمية غير متوفرة", description: `لا يمكنك إضافة هذا المنتج. الكمية المتاحة للبيع: ${availableStock}`, variant: "destructive" });
      return;
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
        
        if (newQuantity > availableStockForExisting) {
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
  }, []);

  const removeFromCart = useCallback((itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateCartItemQuantity = useCallback((itemId, newQuantity) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const totalStock = Math.max(0, item.stock || 0);
        const reservedStock = Math.max(0, item.reserved || 0);
        const availableStock = Math.max(0, totalStock - reservedStock);
        
        if (newQuantity > availableStock) {
          toast({ title: "الكمية غير متوفرة", description: `المخزون المتاح للبيع: ${availableStock}`, variant: "destructive" });
          return { ...item, quantity: Math.max(0, availableStock), total: item.price * Math.max(0, availableStock) };
        }
        return newQuantity <= 0 ? null : { ...item, quantity: newQuantity, total: item.price * newQuantity };
      }
      return item;
    }).filter(Boolean));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  return {
    cart,
    setCart,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
  };
};
