import React, { createContext, useContext, useState, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [aiOrders, setAiOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ 
    deliveryFee: 5000,
    lastPurchaseId: 0 
  });

  // Simple cart functions
  const addToCart = useCallback((product, variant, quantity = 1) => {
    const cartItem = {
      id: `${product.id}-${variant.sku || variant.color + variant.size}`,
      productId: product.id,
      productName: product.name,
      image: variant.image || product.image,
      color: variant.color,
      size: variant.size,
      quantity,
      price: variant.price || product.price,
      total: (variant.price || product.price) * quantity,
    };
    
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === cartItem.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === cartItem.id
            ? { ...item, quantity: item.quantity + quantity, total: item.total + cartItem.total }
            : item
        );
      }
      return [...prevCart, cartItem];
    });
    
    toast({
      title: "تمت الإضافة للسلة",
      description: `${product.name} (${variant.color}, ${variant.size})`,
    });
  }, []);

  const removeFromCart = useCallback((itemId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  }, []);

  const updateCartItemQuantity = useCallback((itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    setCart(prevCart => prevCart.map(item =>
      item.id === itemId
        ? { ...item, quantity: newQuantity, total: item.price * newQuantity }
        : item
    ));
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Simple product functions
  const addProduct = async (productData) => {
    try {
      const newProduct = {
        id: Date.now().toString(),
        ...productData,
        createdAt: new Date(),
      };
      
      setProducts(prev => [...prev, newProduct]);
      toast({ title: "نجاح", description: "تم إضافة المنتج بنجاح" });
      return { success: true };
    } catch (error) {
      toast({ title: "خطأ", description: "فشل إضافة المنتج", variant: "destructive" });
      return { success: false, error: error.message };
    }
  };

  // Simple order functions
  const createOrder = async (customerInfo, items, trackingNumber = null, discount = 0, source = 'manual') => {
    if (items.length === 0) {
      toast({ title: "خطأ", description: "لا يمكن إنشاء طلب فارغ.", variant: "destructive" });
      return;
    }

    try {
      const itemsTotal = items.reduce((sum, item) => sum + item.total, 0);
      const finalTotal = itemsTotal + (settings.deliveryFee || 0) - discount;

      const newOrder = {
        id: Date.now().toString(),
        customerInfo,
        items,
        subtotal: itemsTotal,
        deliveryFee: settings.deliveryFee || 0,
        discount,
        total: finalTotal,
        status: source === 'ai' ? 'pending_ai_approval' : 'pending',
        source: source,
        createdAt: new Date(),
        trackingNumber: trackingNumber || `RYUS-${Date.now()}`,
      };

      if (source === 'ai') {
        setAiOrders(prev => [...prev, newOrder]);
      } else {
        setOrders(prev => [...prev, newOrder]);
        clearCart();
      }

      toast({ title: "نجاح", description: "تم إنشاء الطلب بنجاح." });
      return { success: true, orderId: newOrder.id };
    } catch (error) {
      toast({ title: "خطأ", description: `فشل إنشاء الطلب: ${error.message}`, variant: "destructive" });
      throw error;
    }
  };

  const updateOrder = async (orderId, data) => {
    try {
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, ...data } : order
      ));
      toast({ title: "نجاح", description: "تم تحديث الطلب بنجاح." });
      return { success: true };
    } catch (error) {
      toast({ title: "خطأ", description: `فشل تحديث الطلب: ${error.message}`, variant: "destructive" });
      return { success: false };
    }
  };

  const deleteOrders = async (orderIds) => {
    try {
      setOrders(prev => prev.filter(order => !orderIds.includes(order.id)));
      toast({ title: "نجاح", description: `تم حذف ${orderIds.length} طلب(ات) بنجاح.` });
      return { success: true };
    } catch (error) {
      toast({ title: "خطأ", description: `فشل حذف الطلبات: ${error.message}`, variant: "destructive" });
      return { success: false };
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      setSettings(prev => ({ ...prev, ...newSettings }));
      toast({ title: "نجاح", description: "تم تحديث الإعدادات بنجاح." });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل تحديث الإعدادات.", variant: "destructive" });
    }
  };

  const getLowStockProducts = useCallback(() => {
    const lowStock = [];
    products.forEach(product => {
      product.variants?.forEach(variant => {
        if (variant.quantity <= (product.minStock || 5)) {
          lowStock.push({
            name: product.name,
            variant: variant,
            stockLevel: variant.quantity,
          });
        }
      });
    });
    return lowStock;
  }, [products]);

  const value = {
    products,
    orders,
    aiOrders,
    purchases,
    cart,
    settings,
    loading,
    addProduct,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    createOrder,
    getLowStockProducts,
    updateSettings,
    updateOrder,
    deleteOrders,
    // Add empty functions for compatibility
    updateProduct: () => {},
    deleteProducts: () => {},
    addPurchase: () => {},
    deletePurchase: () => {},
    deletePurchases: () => {},
    approveAiOrder: () => {},
    updateVariantStock: () => {},
    calculateProfit: () => 0,
    requestProfitSettlement: () => {},
    getEmployeeProfitRules: () => [],
    setEmployeeProfitRule: () => {},
    settleEmployeeProfits: () => {},
    updateCapital: () => {},
    addExpense: () => {},
    deleteExpense: () => {},
    refetchProducts: () => {},
    calculateManagerProfit: () => 0,
    accounting: { capital: 10000000, expenses: [] },
    settlementInvoices: [],
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};