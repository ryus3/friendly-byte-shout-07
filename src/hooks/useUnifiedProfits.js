import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { parseISO, isValid, startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';

/**
 * هوك موحد لجلب بيانات الأرباح - يستخدم نفس منطق AccountingPage
 * يضمن عرض نفس البيانات بطريقتين مختلفتين في التصميم
 */
export const useUnifiedProfits = (timePeriod = 'all') => {
  const { orders, accounting, products } = useInventory();
  const { user: currentUser, allUsers } = useAuth();
  const [profitData, setProfitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allProfits, setAllProfits] = useState([]);

  // دالة للحصول على ربح النظام من الطلب
  const getSystemProfitFromOrder = (orderId, allProfits) => {
    const orderProfits = allProfits?.find(p => p.order_id === orderId);
    if (!orderProfits) return 0;
    return (orderProfits.profit_amount || 0) - (orderProfits.employee_profit || 0);
  };

  const fetchUnifiedProfitData = async () => {
    try {
      setLoading(true);
      setError(null);

      // جلب بيانات الأرباح
      const { data: profitsData } = await supabase
        .from('profits')
        .select(`
          *,
          order:orders(order_number, status, receipt_received),
          employee:profiles!employee_id(full_name)
        `);
      setAllProfits(profitsData || []);

      // استخدام نفس منطق AccountingPage
      if (!orders || !Array.isArray(orders)) {
        console.warn('⚠️ لا توجد بيانات طلبات');
        setProfitData({
          totalRevenue: 0,
          deliveryFees: 0, 
          salesWithoutDelivery: 0,
          cogs: 0,
          grossProfit: 0,
          netProfit: 0,
          employeeSettledDues: 0,
          managerSales: 0,
          employeeSales: 0,
          chartData: []
        });
        return;
      }

      const safeOrders = Array.isArray(orders) ? orders : [];
      const safeExpenses = Array.isArray(accounting?.expenses) ? accounting.expenses : [];

      // تطبيق فلتر الفترة الزمنية
      const now = new Date();
      let dateFrom, dateTo;
      
      switch (timePeriod) {
        case 'today':
          dateFrom = subDays(now, 1);
          dateTo = now;
          break;
        case 'week':
          dateFrom = startOfWeek(now, { weekStartsOn: 1 });
          dateTo = now;
          break;
        case 'month':
          dateFrom = startOfMonth(now);
          dateTo = endOfMonth(now);
          break;
        case 'year':
          dateFrom = startOfYear(now);
          dateTo = now;
          break;
        default:
          dateFrom = null;
          dateTo = null;
      }

      console.log(`📅 تطبيق فلتر الفترة: ${timePeriod}`, { dateFrom, dateTo });

      const filterByDate = (dateStr) => {
        if (!dateFrom || !dateTo || !dateStr) return true;
        try {
          const itemDate = parseISO(dateStr);
          return isValid(itemDate) && itemDate >= dateFrom && itemDate <= dateTo;
        } catch (e) {
          return true;
        }
      };

      // الطلبات المُستلمة الفواتير وضمن الفترة المحددة
      const deliveredOrders = safeOrders.filter(o => {
        const isDeliveredStatus = o && (o.status === 'delivered' || o.status === 'completed');
        const isReceiptReceived = o.receipt_received === true;
        const isInDateRange = filterByDate(o.updated_at || o.created_at);
        
        console.log('🔍 فحص الطلب:', {
          orderId: o.id,
          orderNumber: o.order_number,
          status: o.status,
          receiptReceived: o.receipt_received,
          totalAmount: o.total_amount,
          finalAmount: o.final_amount,
          isValid: isDeliveredStatus && isReceiptReceived
        });
        
        return isDeliveredStatus && isReceiptReceived && isInDateRange;
      });

      console.log('🔍 Unified Profits - Delivered Orders:', deliveredOrders.length);

      const expensesInRange = safeExpenses.filter(e => filterByDate(e.transaction_date)); // فلترة المصاريف حسب الفترة

      // حساب إجمالي الإيرادات
      const totalRevenue = deliveredOrders.reduce((sum, o) => {
        const amount = o.final_amount || o.total_amount || 0;
        return sum + amount;
      }, 0);

      const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
      const salesWithoutDelivery = totalRevenue - deliveryFees;

      // حساب تكلفة البضاعة المباعة
      const cogs = deliveredOrders.reduce((sum, o) => {
        if (!o.order_items || !Array.isArray(o.order_items)) return sum;
        
        const orderCogs = o.order_items.reduce((itemSum, item) => {
          const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
          const quantity = item.quantity || 0;
          return itemSum + (costPrice * quantity);
        }, 0);
        return sum + orderCogs;
      }, 0);

      const grossProfit = salesWithoutDelivery - cogs;

      // حساب ربح النظام (نفس منطق AccountingPage)
      const managerOrdersInRange = deliveredOrders.filter(o => !o.created_by || o.created_by === currentUser?.id);
      const employeeOrdersInRange = deliveredOrders.filter(o => o.created_by && o.created_by !== currentUser?.id);

      const managerTotalProfit = managerOrdersInRange.reduce((sum, order) => {
        if (!order.order_items || !Array.isArray(order.order_items)) return sum;
        const orderProfit = order.order_items.reduce((itemSum, item) => {
          const sellPrice = item.unit_price || 0;
          const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
          const quantity = item.quantity || 0;
          return itemSum + ((sellPrice - costPrice) * quantity);
        }, 0);
        return sum + orderProfit;
      }, 0);

      // حساب ربح النظام من طلبات الموظفين
      const employeeSystemProfit = employeeOrdersInRange.reduce((sum, order) => {
        return sum + getSystemProfitFromOrder(order.id, profitsData || []);
      }, 0);

      const systemProfit = managerTotalProfit + employeeSystemProfit;

      // المصاريف العامة
      const generalExpenses = expensesInRange.filter(e => {
        if (e.expense_type === 'system') return false;
        if (e.category === 'مستحقات الموظفين') return false;
        if (e.related_data?.category === 'شراء بضاعة') return false;
        return true;
      }).reduce((sum, e) => sum + (e.amount || 0), 0);

      // مستحقات الموظفين المسددة
      const employeeSettledDues = expensesInRange.filter(e => 
        e.related_data?.category === 'مستحقات الموظفين'
      ).reduce((sum, e) => sum + (e.amount || 0), 0);

      // صافي الربح
      const netProfit = systemProfit - generalExpenses;

      // مبيعات المدير والموظفين
      const managerSales = managerOrdersInRange.reduce((sum, o) => {
        const orderTotal = o.final_amount || o.total_amount || 0;
        const deliveryFee = o.delivery_fee || 0;
        return sum + (orderTotal - deliveryFee);
      }, 0);

      const employeeSales = employeeOrdersInRange.reduce((sum, o) => {
        const orderTotal = o.final_amount || o.total_amount || 0;
        const deliveryFee = o.delivery_fee || 0;
        return sum + (orderTotal - deliveryFee);
      }, 0);

      // بيانات الرسم البياني
      const chartData = [
        { name: 'الإيرادات', value: totalRevenue },
        { name: 'التكاليف', value: cogs + generalExpenses },
        { name: 'صافي الربح', value: netProfit }
      ];

      const resultData = {
        totalRevenue,
        deliveryFees,
        salesWithoutDelivery,
        cogs,
        grossProfit,
        netProfit,
        generalExpenses, // إضافة المصاريف العامة
        employeeSettledDues,
        managerSales,
        employeeSales,
        chartData
      };

      console.log('💰 Unified Profits Result:', resultData);
      console.log('💰 Net Profit Value:', netProfit);
      setProfitData(resultData);

    } catch (error) {
      console.error('Error fetching unified profit data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orders && Array.isArray(orders) && orders.length > 0) {
      fetchUnifiedProfitData();
    }
  }, [orders, accounting, currentUser?.id, timePeriod]);

  // دالة لإعادة تحميل البيانات
  const refreshData = () => {
    fetchUnifiedProfitData();
  };

  return {
    profitData,
    loading,
    error,
    refreshData
  };
};

export default useUnifiedProfits;