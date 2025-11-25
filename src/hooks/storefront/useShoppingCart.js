import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook لإدارة سلة التسوق (localStorage-based)
 */
export const useShoppingCart = (slug) => {
  const CART_KEY = `cart_${slug}`;
  
  const [cart, setCart] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  // تحميل السلة من localStorage
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
        calculateTotal(parsedCart);
      }
    } catch (err) {
      console.error('Error loading cart:', err);
    }
  }, [CART_KEY]);

  // حفظ السلة في localStorage
  const saveCart = useCallback((updatedCart) => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(updatedCart));
      setCart(updatedCart);
      calculateTotal(updatedCart);
    } catch (err) {
      console.error('Error saving cart:', err);
    }
  }, [CART_KEY]);

  // حساب الإجمالي
  const calculateTotal = useCallback((items) => {
    const total = items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
    setCartTotal(total);
  }, []);

  // إضافة منتج للسلة
  const addToCart = useCallback((product, quantity = 1) => {
    const existingItemIndex = cart.findIndex(
      item => item.id === product.id && 
              item.color === product.color && 
              item.size === product.size
    );

    let updatedCart;
    if (existingItemIndex > -1) {
      // تحديث الكمية
      updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += quantity;
    } else {
      // إضافة منتج جديد
      updatedCart = [...cart, { ...product, quantity }];
    }

    saveCart(updatedCart);
  }, [cart, saveCart]);

  // تحديث كمية منتج
  const updateQuantity = useCallback((itemIndex, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemIndex);
      return;
    }

    const updatedCart = [...cart];
    updatedCart[itemIndex].quantity = newQuantity;
    saveCart(updatedCart);
  }, [cart, saveCart]);

  // حذف منتج من السلة
  const removeFromCart = useCallback((itemIndex) => {
    const updatedCart = cart.filter((_, index) => index !== itemIndex);
    saveCart(updatedCart);
  }, [cart, saveCart]);

  // تفريغ السلة
  const clearCart = useCallback(() => {
    saveCart([]);
  }, [saveCart]);

  // عدد العناصر في السلة
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return {
    cart,
    cartTotal,
    itemCount,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart
  };
};
