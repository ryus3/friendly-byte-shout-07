import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook لحساب رصيد القاصة الرئيسية بشكل مبسط
 * يحسب: رأس المال + الأرباح المستلمة - المصاريف - المشتريات
 */
export const useMainCashBalance = () => {
  const [mainCashBalance, setMainCashBalance] = useState(0);
  const [breakdown, setBreakdown] = useState({
    initialCapital: 0,
    capitalInjections: 0,
    capitalWithdrawals: 0,
    realizedProfits: 0,
    totalExpenses: 0,
    totalPurchases: 0,
    netBalance: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const calculateMainCashBalance = async () => {
    try {
      setLoading(true);
      
      // 1. رأس المال الأساسي من الإعدادات
      const { data: capitalSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'initial_capital')
        .single();
      
      const initialCapital = parseFloat(capitalSetting?.value || 0);
      
      // 2. الحقن والسحوبات الرأسمالية
      const { data: capitalMovements } = await supabase
        .from('cash_movements')
        .select('amount, reference_type')
        .in('reference_type', ['capital_injection', 'capital_withdrawal']);
      
      const capitalInjections = capitalMovements
        ?.filter(m => m.reference_type === 'capital_injection')
        .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0) || 0;
      
      const capitalWithdrawals = capitalMovements
        ?.filter(m => m.reference_type === 'capital_withdrawal')
        .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0) || 0;
      
      // 3. الأرباح المحققة من الطلبات المستلمة فقط
      const { data: deliveredOrders } = await supabase
        .from('orders')
        .select(`
          total_amount,
          delivery_fee,
          order_items (
            quantity,
            unit_price,
            product_id,
            variant_id,
            products (cost_price),
            product_variants (cost_price)
          )
        `)
        .eq('status', 'delivered')
        .eq('receipt_received', true);
      
      let realizedProfits = 0;
      deliveredOrders?.forEach(order => {
        const revenue = parseFloat(order.total_amount || 0);
        
        // حساب التكلفة الفعلية للطلب
        const totalCost = order.order_items?.reduce((sum, item) => {
          const costPrice = parseFloat(
            item.product_variants?.cost_price || 
            item.products?.cost_price || 
            0
          );
          return sum + (costPrice * parseInt(item.quantity || 0));
        }, 0) || 0;
        
        // الربح = الإيرادات - التكلفة (بدون رسوم التوصيل)
        const orderProfit = revenue - totalCost;
        realizedProfits += orderProfit;
      });
      
      // 4. إجمالي المصاريف المعتمدة
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('status', 'approved');
      
      const totalExpenses = expenses?.reduce((sum, exp) => 
        sum + parseFloat(exp.amount || 0), 0) || 0;
      
      // 5. إجمالي المشتريات المدفوعة
      const { data: purchases } = await supabase
        .from('purchases')
        .select('paid_amount');
      
      const totalPurchases = purchases?.reduce((sum, purchase) => 
        sum + parseFloat(purchase.paid_amount || 0), 0) || 0;
      
      // 6. حساب الرصيد النهائي
      const netBalance = initialCapital + capitalInjections - capitalWithdrawals + realizedProfits - totalExpenses - totalPurchases;
      
      const calculatedBreakdown = {
        initialCapital,
        capitalInjections,
        capitalWithdrawals,
        realizedProfits,
        totalExpenses,
        totalPurchases,
        netBalance
      };
      
      setBreakdown(calculatedBreakdown);
      setMainCashBalance(netBalance);
      
      console.log('💰 تفاصيل رصيد القاصة الرئيسية:', calculatedBreakdown);
      
    } catch (err) {
      console.error('خطأ في حساب رصيد القاصة الرئيسية:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateMainCashBalance();
  }, []);

  return {
    mainCashBalance,
    breakdown,
    loading,
    error,
    refreshBalance: calculateMainCashBalance
  };
};