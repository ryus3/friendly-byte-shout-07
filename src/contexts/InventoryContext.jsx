
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast.js';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useProducts } from '@/hooks/useProducts';
import { useOrders } from '@/hooks/useOrders';
import { useCart } from '@/hooks/useCart';
import { usePurchases } from '@/hooks/usePurchases';
import { v4 as uuidv4 } from 'uuid';

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
  const { user, hasPermission } = useAuth();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [employeeProfitRules, setEmployeeProfitRules] = useState({});
  const [settings, setSettings] = useState({ 
    deliveryFee: 5000, 
    lowStockThreshold: 5, 
    mediumStockThreshold: 10, 
    sku_prefix: "PROD", 
    lastPurchaseId: 0,
    printer: { paperSize: 'a4', orientation: 'portrait' }
  });
  const [accounting, setAccounting] = useState({ capital: 10000000, expenses: [] });
  const [orders, setOrders] = useState([]);
  const [aiOrders, setAiOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState({});

  // Stock update logic when order status changes
  function handleStockUpdate(oldOrder, newOrder) {
    const stockChanges = [];
    if (['pending', 'processing'].includes(oldOrder.status) && ['shipped', 'delivered'].includes(newOrder.status)) {
      // From reserved to sold
      oldOrder.items.forEach(item => {
        stockChanges.push(supabase.rpc('update_stock_on_sale', {
          p_sku: item.sku,
          p_quantity: item.quantity
        }));
      });
    } else if ((newOrder.status === 'returned' || newOrder.status === 'cancelled') && oldOrder.status !== newOrder.status) {
      // From sold/reserved back to available
      oldOrder.items.forEach(item => {
        stockChanges.push(supabase.rpc('update_stock_on_return', {
          p_sku: item.sku,
          p_quantity: item.quantity,
          p_old_status: oldOrder.status
        }));
      });
    }
    Promise.all(stockChanges).catch(err => console.error("Stock update failed:", err));
  }

  // Using custom hooks
  const { products, setProducts, addProduct, updateProduct, deleteProducts, updateVariantStock, getLowStockProducts } = useProducts([], settings);
  const { orders, setOrders, aiOrders, setAiOrders, createOrder, updateOrder, deleteOrders, approveAiOrder } = useOrders([], [], settings, handleStockUpdate, addNotification, hasPermission, user);
  const { cart, addToCart, removeFromCart, updateCartItemQuantity, clearCart } = useCart();
  
  async function addExpense(expense) {
    // هذه الميزة غير متاحة حالياً - سيتم تطويرها لاحقاً  
    // يمكن استخدام نظام الإشعارات لتسجيل المصاريف مؤقتاً
    const newExpense = {
      id: Date.now(),
      ...expense,
      date: expense.date || new Date().toISOString()
    };
    
    setAccounting(prev => ({ 
      ...prev, 
      expenses: [...prev.expenses, newExpense] 
    }));

    if (expense.category !== 'شراء بضاعة' && expense.category !== 'شحن' && expense.category !== 'مستحقات الموظفين') {
      toast({ title: "تمت إضافة المصروف", variant: "success" });
    }
  }

  const { purchases, setPurchases, addPurchase, deletePurchase, deletePurchases } = usePurchases([], addExpense);

  const fetchInitialData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [productsRes, ordersRes, purchasesRes, settingsRes, aiOrdersRes] = await Promise.all([
        supabase.from('products').select('*, variants:product_variants(*)').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*').limit(1).maybeSingle(),
        supabase.from('orders').select('*').eq('delivery_status', 'ai_pending').order('created_at', { ascending: false })
      ]);

      if (productsRes.error) throw productsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (purchasesRes.error) throw purchasesRes.error;

      setProducts(productsRes.data || []);
      setOrders(ordersRes.data || []);
      setAiOrders(aiOrdersRes.data || []);
      setPurchases(purchasesRes.data || []);
      setSettings(settingsRes.data?.value || {});
    } catch (error) {
      console.error("Error fetching initial data:", error);
      toast({ title: "خطأ في تحميل البيانات", description: "لم نتمكن من تحميل البيانات الأولية. قد تكون هناك مشكلة في صلاحيات الوصول.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, setProducts, setOrders, setPurchases, setAiOrders]);

  useEffect(() => {
    if (user) {
      fetchInitialData();
    } else {
      setLoading(false);
    }
  }, [fetchInitialData, user]);

  const getEmployeeProfitRules = useCallback((employeeId) => {
    return employeeProfitRules[employeeId] || [];
  }, [employeeProfitRules]);

  const setEmployeeProfitRule = async (employeeId, rules) => {
    // هذه الميزة غير متاحة حالياً - سيتم تطويرها لاحقاً
    toast({ title: "تنبيه", description: "ميزة قواعد أرباح الموظفين ستكون متاحة قريباً.", variant: "default" });
  };

  const calculateProfit = useCallback((item, employeeId) => {
    const profitRules = employeeProfitRules[employeeId] || [];
    if (!item.price || !item.cost_price || !employeeId) return 0;
  
    const productInfo = products.find(p => p.id === item.productId);
    if (!productInfo) return 0;

    const specificRule = profitRules.find(r => r.rule_type === 'product' && r.target_id === String(item.productId));
    if(specificRule?.profit_amount > 0) {
      return specificRule.profit_amount * item.quantity;
    }

    if (productInfo.categories?.main_category) {
        const categoryRule = profitRules.find(r => r.rule_type === 'category' && r.target_id === productInfo.categories.main_category);
        if(categoryRule?.profit_amount > 0) {
            return categoryRule.profit_amount * item.quantity;
        }
    }

    const defaultProfit = (item.price - item.cost_price) * item.quantity;
    return defaultProfit > 0 ? defaultProfit : 0;
  }, [employeeProfitRules, products]);

  const calculateManagerProfit = useCallback((order) => {
    if (!order || !order.items || !order.created_by) return 0;
    const employeeProfitShare = order.items.reduce((sum, item) => sum + calculateProfit(item, order.created_by), 0);
    const totalProfit = order.items.reduce((sum, item) => sum + ((item.price || 0) - (item.cost_price || 0)) * item.quantity, 0);
    return totalProfit - employeeProfitShare;
  }, [calculateProfit]);

  const updateSettings = async (newSettings) => {
    setSettings(prev => ({...prev, ...newSettings}));
    toast({ title: "نجاح", description: "تم تحديث الإعدادات.", variant: 'success' });
  };

  const requestProfitSettlement = async (employeeId, amount, orderIds) => {
    const employee = user; // Assuming the user requesting is the employee
    addNotification({
      type: 'profit_settlement_request',
      title: 'طلب محاسبة جديد',
      message: `الموظف ${employee.full_name} يطلب محاسبته على مبلغ ${amount.toLocaleString()} د.ع.`,
      link: `/profit-settlement/${employeeId}?orders=${orderIds.join(',')}`,
      user_id: null, // send to all admins
      data: { employeeId, employeeName: employee.full_name, amount, orderIds },
      color: 'purple',
      icon: 'UserPlus'
    });
    toast({ title: "تم إرسال الطلب", description: "تم إرسال طلب المحاسبة إلى المدير.", variant: "success" });
  }

  const settleEmployeeProfits = async (employeeId, amount, employeeName, orderIds) => {
    // تسجيل عملية التسوية في الإشعارات بدلاً من جدول منفصل
    const notificationData = {
      type: 'settlement',
      title: 'تسوية أرباح',
      message: `تمت تسوية مستحقات ${employeeName} بقيمة ${amount} دينار`,
      data: {
        employee_id: employeeId,
        settlement_amount: amount,
        order_ids: orderIds,
        invoice_number: `INV-${Date.now()}`
      }
    };

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notificationData);

    if (notificationError) {
      console.error('Error creating settlement notification:', notificationError);
    }

    // إضافة المصروف
    await addExpense({
      date: new Date().toISOString(),
      category: 'مستحقات الموظفين',
      description: `دفع مستحقات الموظف ${employeeName}`,
      amount: amount,
    });
    
    // تحديث حالة الطلبات
    if (orderIds && orderIds.length > 0) {
        const { error } = await supabase
            .from('profits')
            .update({ status: 'settled', settled_at: new Date().toISOString() })
            .eq('employee_id', employeeId)
            .in('order_id', orderIds);
            
        if(error) {
            console.error("Error updating profit status:", error);
        }
    }

    // إرسال إشعار للموظف
    addNotification({
        type: 'profit_settlement_paid',
        title: 'تمت تسوية مستحقاتك',
        message: `قام المدير بتسوية مستحقاتك بمبلغ ${amount.toLocaleString()} د.ع.`,
        user_id: employeeId,
        color: 'green',
        icon: 'CheckCircle'
    });
    toast({title: "نجاح", description: `تمت تسوية مستحقات ${employeeName} بنجاح.`});
  };

  const updateCapital = async (newCapital) => {
    // البحث عن أول إعداد متاح أو إنشاء واحد جديد
    const { data: existingSettings } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .maybeSingle();

    let error;
    if (existingSettings) {
        // تحديث الإعدادات الموجودة
        const result = await supabase
            .from('settings')
            .update({ value: { ...existingSettings.value, capital: newCapital } })
            .eq('id', existingSettings.id);
        error = result.error;
    } else {
        // إنشاء إعدادات جديدة
        const result = await supabase
            .from('settings')
            .insert({ 
                key: 'app_settings', 
                value: { capital: newCapital },
                description: 'إعدادات التطبيق الأساسية'
            });
        error = result.error;
    }

    if (error) {
        toast({ title: "خطأ", description: "فشل تحديث رأس المال.", variant: "destructive" });
    } else {
        setAccounting(prev => ({ ...prev, capital: newCapital }));
        setSettings(prev => ({ ...prev, capital: newCapital }));
        toast({ title: "نجاح", description: "تم تحديث رأس المال بنجاح.", variant: "success" });
    }
  };

  const deleteExpense = async (expenseId) => {
    // هذه الميزة غير متاحة حالياً
    toast({ title: "تنبيه", description: "ميزة حذف المصاريف ستكون متاحة قريباً.", variant: "default" });
  };

  const value = {
    products, orders, aiOrders, purchases, loading, cart, settings, accounting,
    setProducts,
    addProduct, updateProduct, deleteProducts, 
    addPurchase, deletePurchase, deletePurchases,
    createOrder: (customerInfo, cartItems, trackingNumber, discount, status, qrLink, deliveryPartnerData) => createOrder(customerInfo, cartItems, trackingNumber, discount, status, qrLink, deliveryPartnerData),
    updateOrder, deleteOrders, updateSettings, addToCart, removeFromCart, updateCartItemQuantity,
    clearCart, getLowStockProducts, 
    approveAiOrder,
    updateVariantStock, calculateProfit, requestProfitSettlement,
    getEmployeeProfitRules, setEmployeeProfitRule, settleEmployeeProfits,
    updateCapital, addExpense, deleteExpense,
    refetchProducts: fetchInitialData,
    calculateManagerProfit,
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};
