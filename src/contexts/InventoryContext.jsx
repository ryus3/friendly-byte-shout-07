
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
  const [settlementInvoices, setSettlementInvoices] = useState([]);

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
    const newExpense = {
        type: 'expense',
        amount: expense.amount,
        description: expense.description,
        transaction_date: expense.date,
        user_id: user.id,
        related_data: { category: expense.category }
    };
    const { data, error } = await supabase.from('financial_transactions').insert(newExpense).select().single();

    if (error) {
      console.error("Error adding expense:", error);
      return;
    }

    setAccounting(prev => ({ ...prev, expenses: [...prev.expenses, data] }));

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
      const [productsRes, ordersRes, purchasesRes, settingsRes, aiOrdersRes, expensesRes, profitRulesRes, invoicesRes] = await Promise.all([
        supabase.from('products').select('*, variants:product_variants(*)').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*').eq('id', 1).single(),
        supabase.from('ai_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('financial_transactions').select('*'),
        supabase.from('employee_profit_rules').select('*'),
        supabase.from('settlement_invoices').select('*').order('settlement_date', { ascending: false }),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (purchasesRes.error) throw purchasesRes.error;
      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error; // Ignore if no settings row found
      if (aiOrdersRes.error) throw aiOrdersRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (profitRulesRes.error) throw profitRulesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      if (productsRes.data) setProducts(productsRes.data);
      if (ordersRes.data) setOrders(ordersRes.data);
      if (purchasesRes.data) setPurchases(purchasesRes.data);
      if (settingsRes.data) {
        setSettings(prev => ({ ...prev, ...settingsRes.data.settings_data }));
        setAccounting(prev => ({ ...prev, capital: settingsRes.data.settings_data.capital || 10000000 }));
      }
      if (aiOrdersRes.data) setAiOrders(aiOrdersRes.data);
      if (expensesRes.data) setAccounting(prev => ({ ...prev, expenses: expensesRes.data }));
      if (invoicesRes.data) setSettlementInvoices(invoicesRes.data);
      if(profitRulesRes.data) {
          const rulesMap = {};
          profitRulesRes.data.forEach(rule => {
              if (!rulesMap[rule.employee_id]) {
                  rulesMap[rule.employee_id] = [];
              }
              rulesMap[rule.employee_id].push(rule);
          });
          setEmployeeProfitRules(rulesMap);
      }
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
    await supabase.from('employee_profit_rules').delete().eq('employee_id', employeeId);
    const rulesToInsert = rules.map(rule => ({
      employee_id: employeeId,
      rule_type: rule.ruleType,
      target_id: rule.targetId,
      profit_amount: rule.profitAmount,
    }));
    await supabase.from('employee_profit_rules').insert(rulesToInsert);

    setEmployeeProfitRules(prev => ({...prev, [employeeId]: rules}));
    toast({ title: 'نجاح', description: 'تم حفظ قواعد الربح للموظف بنجاح.', variant: 'success' });
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
    // 1. Create settlement invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('settlement_invoices')
      .insert({
        invoice_number: `INV-${Date.now()}`,
        employee_id: employeeId,
        settled_by_id: user.id,
        settlement_date: new Date().toISOString(),
        total_amount: amount,
        settled_orders: orderIds,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Error creating invoice:", invoiceError);
      toast({ title: "خطأ", description: "فشل إنشاء فاتورة التسوية.", variant: "destructive" });
      return;
    }

    // 2. Add expense
    await addExpense({
      date: new Date().toISOString(),
      category: 'مستحقات الموظفين',
      description: `دفع مستحقات الموظف ${employeeName} (فاتورة #${invoice.invoice_number})`,
      amount: amount,
    });
    
    // 3. Update orders
    if (orderIds && orderIds.length > 0) {
        const { error } = await supabase
            .from('orders')
            .update({ profitStatus: 'settled', isArchived: true, settlement_invoice_id: invoice.id })
            .in('id', orderIds);
        if(error) {
            console.error("Error updating orders on settlement:", error);
            toast({ title: "خطأ", description: "فشل تحديث حالة الطلبات.", variant: "destructive" });
            return;
        }
    }

    // 4. Send notification to employee
    addNotification({
        type: 'profit_settlement_paid',
        title: 'تمت تسوية مستحقاتك',
        message: `قام المدير بتسوية مستحقاتك بمبلغ ${amount.toLocaleString()} د.ع. فاتورة #${invoice.invoice_number}`,
        link: `/profits-summary?invoice=${invoice.id}`,
        user_id: employeeId,
        color: 'green',
        icon: 'CheckCircle'
    });
    toast({title: "نجاح", description: `تمت تسوية مستحقات ${employeeName} بنجاح.`});
  };

  const updateCapital = async (newCapital) => {
    const { error } = await supabase
        .from('settings')
        .update({ settings_data: { ...settings, capital: newCapital } })
        .eq('id', 1);

    if (error) {
        toast({ title: "خطأ", description: "فشل تحديث رأس المال.", variant: "destructive" });
    } else {
        setAccounting(prev => ({ ...prev, capital: newCapital }));
        setSettings(prev => ({ ...prev, capital: newCapital }));
        toast({ title: "نجاح", description: "تم تحديث رأس المال بنجاح.", variant: "success" });
    }
  };

  const deleteExpense = async (expenseId) => {
    await supabase.from('financial_transactions').delete().eq('id', expenseId);
    toast({ title: "تم حذف المصروف", variant: "success" });
  };

  const value = {
    products, orders, aiOrders, purchases, loading, cart, settings, accounting, settlementInvoices,
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
