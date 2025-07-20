import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useCapitalManager } from './useCapitalManager';
/**
 * Hook موحد لكل الحسابات المالية في الواجهة
 * جميع العمليات الحسابية تتم هنا بدون دوال قاعدة بيانات
 * رأس المال محفوظ في localStorage
 */
export const useFinancialCalculations = () => {
  // استخدام مدير رأس المال
  const { capital: initialCapital, updateCapital } = useCapitalManager();
  const [rawData, setRawData] = useState({
    orders: [],
    expenses: [],
    purchases: [],
    settings: {},
    cashMovements: []
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // جلب جميع البيانات الخام (بدون إعدادات أو حركات نقد)
  const fetchRawData = async () => {
    try {
      setLoading(true);
      
      // جلب البيانات الأساسية فقط - بدون إعدادات أو حركات نقد
      const [ordersResult, expensesResult, purchasesResult] = await Promise.all([
        // الطلبات مع التفاصيل
        supabase
          .from('orders')
          .select(`
            *,
            order_items (
              quantity,
              unit_price,
              total_price,
              product_id,
              variant_id,
              products (cost_price, name),
              product_variants (cost_price)
            )
          `),
        
        // المصاريف
        supabase
          .from('expenses')
          .select('*'),
        
        // المشتريات
        supabase
          .from('purchases')
          .select('*')
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (purchasesResult.error) throw purchasesResult.error;

      setRawData({
        orders: ordersResult.data || [],
        expenses: expensesResult.data || [],
        purchases: purchasesResult.data || [],
        settings: {}, // فارغ - لا نستخدم إعدادات من قاعدة البيانات
        cashMovements: [] // فارغ - لا نستخدم حركات نقد من قاعدة البيانات
      });
      
    } catch (err) {
      console.error('خطأ في جلب البيانات:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 1. حساب رأس المال (من localStorage - قابل للتعديل)
  const getInitialCapital = () => {
    return initialCapital; // من useCapitalManager
  };

  // 2. حساب الأرباح المحققة (طلبات مستلمة + فاتورة)
  const getRealizedProfits = () => {
    const realizedOrders = rawData.orders.filter(order => 
      order.status === 'delivered' && order.receipt_received === true
    );

    return realizedOrders.reduce((totalProfit, order) => {
      const orderRevenue = parseFloat(order.total_amount || 0);
      
      // حساب التكلفة الفعلية
      const orderCost = (order.order_items || []).reduce((itemCost, item) => {
        const costPrice = parseFloat(
          item.product_variants?.cost_price || 
          item.products?.cost_price || 
          0
        );
        return itemCost + (costPrice * parseInt(item.quantity || 0));
      }, 0);
      
      const orderProfit = orderRevenue - orderCost;
      return totalProfit + orderProfit;
    }, 0);
  };

  // 3. حساب الأرباح المعلقة (طلبات مستلمة بدون فاتورة)
  const getPendingProfits = () => {
    const pendingOrders = rawData.orders.filter(order => 
      order.status === 'delivered' && order.receipt_received !== true
    );

    return pendingOrders.reduce((totalProfit, order) => {
      const orderRevenue = parseFloat(order.total_amount || 0);
      
      // حساب التكلفة الفعلية
      const orderCost = (order.order_items || []).reduce((itemCost, item) => {
        const costPrice = parseFloat(
          item.product_variants?.cost_price || 
          item.products?.cost_price || 
          0
        );
        return itemCost + (costPrice * parseInt(item.quantity || 0));
      }, 0);
      
      const orderProfit = orderRevenue - orderCost;
      return totalProfit + orderProfit;
    }, 0);
  };

  // 4. حساب المصاريف العامة المعتمدة
  const getTotalExpenses = () => {
    return rawData.expenses
      .filter(expense => expense.status === 'approved')
      .reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
  };

  // 5. حساب إجمالي المشتريات المدفوعة
  const getTotalPurchases = () => {
    return rawData.purchases
      .reduce((sum, purchase) => sum + parseFloat(purchase.paid_amount || 0), 0);
  };

  // 6. حساب رصيد القاصة الرئيسية الحقيقي
  const getMainCashBalance = () => {
    const initialCapital = getInitialCapital();
    const realizedProfits = getRealizedProfits();
    const totalExpenses = getTotalExpenses();
    const totalPurchases = getTotalPurchases();
    
    const mainBalance = initialCapital + realizedProfits - totalExpenses - totalPurchases;
    
    return {
      balance: mainBalance,
      breakdown: {
        initialCapital,
        realizedProfits,
        totalExpenses,
        totalPurchases,
        calculation: `${initialCapital} + ${realizedProfits} - ${totalExpenses} - ${totalPurchases} = ${mainBalance}`
      }
    };
  };

  // 7. حساب أرباح المنتجات (تفصيلي)
  const getProductProfits = () => {
    const productProfits = {};
    
    rawData.orders
      .filter(order => order.status === 'delivered')
      .forEach(order => {
        (order.order_items || []).forEach(item => {
          const productId = item.product_id;
          const productName = item.products?.name || `منتج ${productId}`;
          const quantity = parseInt(item.quantity || 0);
          const revenue = parseFloat(item.total_price || 0);
          const costPrice = parseFloat(
            item.product_variants?.cost_price || 
            item.products?.cost_price || 
            0
          );
          const profit = revenue - (costPrice * quantity);
          
          if (!productProfits[productId]) {
            productProfits[productId] = {
              name: productName,
              totalQuantity: 0,
              totalRevenue: 0,
              totalCost: 0,
              totalProfit: 0,
              realized: 0,
              pending: 0
            };
          }
          
          productProfits[productId].totalQuantity += quantity;
          productProfits[productId].totalRevenue += revenue;
          productProfits[productId].totalCost += (costPrice * quantity);
          productProfits[productId].totalProfit += profit;
          
          // تصنيف الأرباح حسب استلام الفاتورة
          if (order.receipt_received === true) {
            productProfits[productId].realized += profit;
          } else {
            productProfits[productId].pending += profit;
          }
        });
      });
    
    return Object.values(productProfits);
  };

  // 8. حساب الإحصائيات الشاملة
  const getFinancialSummary = () => {
    const initialCapital = getInitialCapital();
    const realizedProfits = getRealizedProfits();
    const pendingProfits = getPendingProfits();
    const totalExpenses = getTotalExpenses();
    const totalPurchases = getTotalPurchases();
    const mainCashBalance = getMainCashBalance();
    
    const totalRevenue = rawData.orders
      .filter(order => order.status === 'delivered')
      .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
    
    const totalCost = rawData.orders
      .filter(order => order.status === 'delivered')
      .reduce((sum, order) => {
        const orderCost = (order.order_items || []).reduce((itemCost, item) => {
          const costPrice = parseFloat(
            item.product_variants?.cost_price || 
            item.products?.cost_price || 
            0
          );
          return itemCost + (costPrice * parseInt(item.quantity || 0));
        }, 0);
        return sum + orderCost;
      }, 0);

    return {
      initialCapital,
      totalRevenue,
      totalCost,
      grossProfit: totalRevenue - totalCost,
      realizedProfits,
      pendingProfits,
      totalProfits: realizedProfits + pendingProfits,
      totalExpenses,
      totalPurchases,
      netProfit: realizedProfits - totalExpenses,
      mainCashBalance: mainCashBalance.balance,
      mainCashBreakdown: mainCashBalance.breakdown
    };
  };

  useEffect(() => {
    fetchRawData();
  }, []);

  return {
    // البيانات الخام
    rawData,
    loading,
    error,
    
    // الدوال الحسابية
    getInitialCapital,
    getRealizedProfits,
    getPendingProfits,
    getTotalExpenses,
    getTotalPurchases,
    getMainCashBalance,
    getProductProfits,
    getFinancialSummary,
    
    // إدارة رأس المال
    updateCapital,
    currentCapital: initialCapital,
    
    // تحديث البيانات
    refreshData: fetchRawData
  };
};