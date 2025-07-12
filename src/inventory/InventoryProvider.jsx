import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { subDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { generateMockProducts, generateMockOrders, generateEmployeeOrders } from '@/inventory/mockData';

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [aiOrders, setAiOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [employeeProfitRules, setEmployeeProfitRules] = useState({});
  const [settings, setSettings] = useState({ deliveryFee: 5000, lowStockThreshold: 5, mediumStockThreshold: 10, sku_prefix: "PROD", lastPurchaseId: 0 });

  useEffect(() => {
    if (products.length === 0) setProducts(generateMockProducts(100));
    if (orders.length === 0) {
        const adminOrders = generateMockOrders(50);
        const employeeOrders = generateEmployeeOrders();
        setOrders([...adminOrders, ...employeeOrders]);
    }
    setLoading(false);
  }, [products.length, orders.length]);

  const showLocalModeToast = () => {
    toast({
      title: "🚧 وضع العرض المحلي",
      description: "هذه العملية للعرض فقط ولن يتم حفظها بشكل دائم.",
    });
  };

  const addProduct = async (productData, imageFiles, setUploadProgress) => {
    showLocalModeToast();
    setUploadProgress(100);
    return { success: true };
  };

  const updateProduct = async (productId, productData, imageFiles, setUploadProgress) => {
    showLocalModeToast();
    if(setUploadProgress) setUploadProgress(100);
    return { success: true };
  };

  const deleteProduct = async (productId) => { showLocalModeToast(); return { success: true }; };
  const deleteProducts = async (productIds) => { showLocalModeToast(); return { success: true }; };
  
  const addPurchase = async (purchaseData) => {
    showLocalModeToast();
    const newPurchase = { id: `pur_local_${Date.now()}`, ...purchaseData, createdAt: new Date(), createdBy: user.id };
    setPurchases(prev => [newPurchase, ...prev]);
    setProducts(currentProducts => {
      const newProducts = [...currentProducts];
      for (const item of purchaseData.items) {
        const pIndex = newProducts.findIndex(p => p.id === item.productId);
        if (pIndex !== -1) {
          const vIndex = newProducts[pIndex].variants.findIndex(v => v.sku === item.sku);
          if (vIndex !== -1) newProducts[pIndex].variants[vIndex].quantity += item.quantity;
        }
      }
      return newProducts;
    });
    return { success: true };
  };

  const deletePurchase = async (purchaseId) => { showLocalModeToast(); return { success: true }; };
  const deletePurchases = async (purchaseIds) => { showLocalModeToast(); return { success: true }; };
  
  const getEmployeeProfitRules = useCallback((employeeId) => {
    return employeeProfitRules[employeeId] || [];
  }, [employeeProfitRules]);

  const setEmployeeProfitRule = (employeeId, rules) => {
    setEmployeeProfitRules(prev => ({...prev, [employeeId]: rules}));
    showLocalModeToast();
  };
  
  const calculateProfit = useCallback((item, employeeId) => {
    if (!item.price || !item.costPrice) return 0;
    const netProfit = (item.price - item.costPrice) * item.quantity;
    if (netProfit <= 0) return 0;

    const rules = employeeProfitRules[employeeId] || [];
    const product = products.find(p => p.id === item.productId);

    const specificRule = rules.find(r => r.ruleType === 'product' && r.targetId === item.productId);
    if(specificRule && specificRule.profitAmount > 0) return specificRule.profitAmount;

    const categoryRule = rules.find(r => r.ruleType === 'category' && r.targetId === product?.categories?.main_category);
    if(categoryRule && categoryRule.profitAmount > 0) return categoryRule.profitAmount;
    
    const generalRule = rules.find(r => r.ruleType === 'general' && r.targetId === 'default_percentage');
    if(generalRule && generalRule.profitAmount > 0) return netProfit * (generalRule.profitAmount / 100);

    return 0;
  }, [employeeProfitRules, products]);

  const createOrder = async (customerInfo, cartItems, trackingNumber, discount, status = 'pending') => {
    showLocalModeToast();
    setProducts(currentProducts => {
      const newProducts = [...currentProducts];
      for (const item of cartItems) {
        const pIndex = newProducts.findIndex(p => p.id === item.productId);
        if (pIndex !== -1) {
          const vIndex = newProducts[pIndex].variants.findIndex(v => v.sku === item.sku);
          if (vIndex !== -1) newProducts[pIndex].variants[vIndex].reserved += item.quantity;
        }
      }
      return newProducts;
    });

    const newOrder = {
      id: `order_local_${Date.now()}`,
      trackingNumber: trackingNumber || `RYUS-LOC-${Math.floor(Math.random()*90000) + 10000}`,
      customerInfo,
      items: cartItems,
      subtotal: cartItems.reduce((sum, item) => sum + item.total, 0),
      deliveryFee: settings.deliveryFee || 0,
      discount: discount || 0,
      total: cartItems.reduce((sum, item) => sum + item.total, 0) + (settings.deliveryFee || 0) - (discount || 0),
      status,
      createdAt: new Date(),
      createdBy: user.id
    };

    setOrders(prev => [newOrder, ...prev]);
    clearCart();
    return { success: true, orderId: newOrder.id, trackingNumber: newOrder.trackingNumber };
  };

  const updateOrder = async (orderId, data) => {
    const oldOrder = orders.find(o => o.id === orderId);
    if (!oldOrder) return { success: false };

    if (oldOrder.status !== data.status && data.status) {
      setProducts(currentProducts => {
        let newProducts = [...currentProducts];
        oldOrder.items.forEach(item => {
          const pIndex = newProducts.findIndex(p => p.id === item.productId);
          if (pIndex === -1) return;
          const vIndex = newProducts[pIndex].variants.findIndex(v => v.sku === item.sku);
          if (vIndex === -1) return;
          let variant = newProducts[pIndex].variants[vIndex];
          if (['pending', 'processing'].includes(oldOrder.status) && data.status === 'shipped') {
             variant.quantity -= item.quantity; variant.reserved -= item.quantity;
          } else if (data.status === 'returned' || data.status === 'cancelled') {
             if (['shipped', 'delivered'].includes(oldOrder.status)) variant.quantity += item.quantity;
             else if (['pending', 'processing'].includes(oldOrder.status)) variant.reserved -= item.quantity;
          }
          newProducts[pIndex].variants[vIndex] = variant;
        });
        return newProducts;
      });
    }

    setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? {...o, ...data} : o));
    showLocalModeToast();
    return { success: true };
  };

  const deleteOrders = async (orderIds) => {
    setOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
    showLocalModeToast();
    return { success: true };
  };

  const updateSettings = async (newSettings) => {
    setSettings(prev => ({...prev, ...newSettings}));
    toast({ title: "نجاح", description: "تم تحديث الإعدادات.", variant: 'success' });
  };
  
  const approveAiOrder = async (orderId) => { 
    showLocalModeToast();
    const aiOrder = aiOrders.find(o => o.id === orderId);
    if (aiOrder) {
      await createOrder(aiOrder.customerInfo, aiOrder.items, null, 0, 'processing');
      setAiOrders(prev => prev.filter(o => o.id !== orderId));
      addNotification({ type: 'order', title: 'طلب جديد من AI', message: `تمت الموافقة على طلب AI للزبون ${aiOrder.customerInfo.name}.`, link: '/orders?status=processing' });
    }
    return { success: true }; 
  }

  const addToCart = (product, variant, quantity) => {
    const cartItem = {
      id: `${product.id}-${variant.sku}`, productId: product.id, sku: variant.sku, productName: product.name,
      image: variant.image || product.images?.[0] || "https://via.placeholder.com/150",
      color: variant.color, size: variant.size, quantity, price: variant.price || product.price,
      costPrice: variant.costPrice, stock: variant.quantity, total: (variant.price || product.price) * quantity
    };
    setCart(prev => {
        const existingItem = prev.find(item => item.id === cartItem.id);
        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            return prev.map(item => item.id === cartItem.id ? { ...item, quantity: newQuantity, total: item.price * newQuantity } : item);
        }
        return [...prev, cartItem];
    });
    toast({ title: "تمت الإضافة إلى السلة", description: `${product.name} - ${variant.color} - ${variant.size}`, variant: 'success' });
  };
  const removeFromCart = (itemId) => { setCart(prev => prev.filter(item => item.id !== itemId)); };
  const updateCartItemQuantity = (itemId, newQuantity) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) return newQuantity <= 0 ? null : { ...item, quantity: newQuantity, total: item.price * newQuantity };
      return item;
    }).filter(Boolean));
  };
  const clearCart = () => { setCart([]); };
  
  const getLowStockProducts = useCallback((limit) => {
    if (!products || !settings) return [];
    const lowStock = products.map(product => {
      const totalStock = product.variants.reduce((acc, v) => acc + v.quantity, 0);
      const lowStockThreshold = product.minStock || settings.lowStockThreshold || 5;
      return { ...product, totalStock, isLow: totalStock > 0 && totalStock <= lowStockThreshold };
    }).filter(p => p.isLow).sort((a, b) => a.totalStock - b.totalStock);
    return limit ? lowStock.slice(0, limit) : lowStock;
  }, [products, settings]);
  
  const updateVariantStock = async (productId, variantIdentifier, newQuantity) => {
    showLocalModeToast();
    setProducts(prevProducts => {
      return prevProducts.map(p => {
        if (p.id === productId) {
          return { ...p, variants: p.variants.map(v => 
              (v.color === variantIdentifier.color && v.size === variantIdentifier.size) ? { ...v, quantity: newQuantity } : v
          )};
        }
        return p;
      });
    });
    return { success: true };
  };

  const requestProfitSettlement = async (employeeId, amount) => {
    addNotification({
      type: 'profit_settlement_request',
      title: 'طلب محاسبة جديد',
      message: `الموظف ${user.fullName} يطلب محاسبته على مبلغ ${amount.toLocaleString()} د.ع.`,
      link: '/employee-orders', data: { employeeId }
    });
    toast({ title: "تم إرسال الطلب", description: "تم إرسال طلب المحاسبة إلى المدير.", variant: "success" });
  }
  
  const value = {
    products, orders, aiOrders, purchases, loading, cart, settings,
    addProduct, updateProduct, deleteProduct, deleteProducts, addPurchase, deletePurchase, deletePurchases,
    createOrder, updateOrder, deleteOrders, updateSettings, addToCart, removeFromCart, updateCartItemQuantity,
    clearCart, getLowStockProducts, approveAiOrder, updateVariantStock, calculateProfit, requestProfitSettlement,
    getEmployeeProfitRules, setEmployeeProfitRule
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};