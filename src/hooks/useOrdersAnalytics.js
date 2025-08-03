import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook موحد لجلب جميع إحصائيات الطلبات والعملاء
 * يستبدل التكرار في TopCustomersDialog, TopProductsDialog, TopProvincesDialog, PendingProfitsDialog
 */
const useOrdersAnalytics = () => {
  const [analytics, setAnalytics] = useState({
    // إحصائيات عامة
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    
    // البيانات التفصيلية
    topCustomers: [],
    topProducts: [],
    topProvinces: [],
    pendingProfits: {
      total_pending_amount: 0,
      total_employee_profits: 0,
      employees_count: 0,
      orders_count: 0
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 جلب إحصائيات الطلبات...');
      
      // جلب الطلبات مع تفاصيلها
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            variant_id,
            quantity,
            unit_price,
            total_price,
            products (
              id,
              name
            )
          )
        `)
        .not('status', 'in', '(returned,cancelled)')
        .neq('isArchived', true);

      if (ordersError) {
        console.error('خطأ في جلب الطلبات:', ordersError);
        setError(ordersError.message);
        return;
      }

      const orders = ordersData || [];
      console.log('📊 تم جلب الطلبات:', orders.length);

      // حساب الإحصائيات الأساسية
      const totalOrders = orders.length;
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const completedOrders = orders.filter(o => ['completed', 'delivered'].includes(o.status)).length;
      const completedOrdersList = orders.filter(o => ['completed', 'delivered'].includes(o.status));
      const totalRevenue = completedOrdersList.reduce((sum, o) => sum + (o.final_amount || 0), 0);

      // حساب أفضل العملاء
      const customersMap = {};
      completedOrdersList.forEach(order => {
        const phone = order.customer_phone;
        const name = order.customer_name;
        if (phone && phone !== 'غير محدد') {
          if (!customersMap[phone]) {
            customersMap[phone] = {
              phone,
              name,
              totalOrders: 0,
              totalAmount: 0
            };
          }
          customersMap[phone].totalOrders += 1;
          customersMap[phone].totalAmount += order.final_amount || 0;
        }
      });

      const topCustomers = Object.values(customersMap)
        .sort((a, b) => b.totalOrders - a.totalOrders)
        .slice(0, 10);

      // حساب أفضل المحافظات
      const provincesMap = {};
      completedOrdersList.forEach(order => {
        const province = order.customer_city || order.customer_province || 'غير محدد';
        if (!provincesMap[province]) {
          provincesMap[province] = {
            name: province,
            totalOrders: 0,
            totalAmount: 0
          };
        }
        provincesMap[province].totalOrders += 1;
        provincesMap[province].totalAmount += order.final_amount || 0;
      });

      const topProvinces = Object.values(provincesMap)
        .sort((a, b) => b.totalOrders - a.totalOrders)
        .slice(0, 10);

      // حساب أفضل المنتجات
      const productsMap = {};
      completedOrdersList.forEach(order => {
        if (order.order_items) {
          order.order_items.forEach(item => {
            const productName = item.products?.name || `منتج ${item.product_id}`;
            if (!productsMap[productName]) {
              productsMap[productName] = {
                name: productName,
                totalQuantity: 0,
                totalAmount: 0
              };
            }
            productsMap[productName].totalQuantity += item.quantity || 0;
            productsMap[productName].totalAmount += item.total_price || 0;
          });
        }
      });

      const topProducts = Object.values(productsMap)
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10);

      // جلب بيانات الأرباح المعلقة
      const { data: profitsData, error: profitsError } = await supabase
        .from('profits')
        .select('*')
        .eq('status', 'pending');

      let pendingProfits = {
        total_pending_amount: 0,
        total_employee_profits: 0,
        employees_count: 0,
        orders_count: 0
      };

      if (!profitsError && profitsData) {
        const uniqueEmployees = new Set(profitsData.map(p => p.employee_id));
        pendingProfits = {
          total_pending_amount: profitsData.reduce((sum, p) => sum + (p.profit_amount || 0), 0),
          total_employee_profits: profitsData.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
          employees_count: uniqueEmployees.size,
          orders_count: profitsData.length
        };
      }

      console.log('✅ تم حساب الإحصائيات:', {
        totalOrders,
        topCustomers: topCustomers.length,
        topProducts: topProducts.length,
        topProvinces: topProvinces.length
      });

      setAnalytics({
        totalOrders,
        pendingOrders,
        completedOrders,
        totalRevenue,
        topCustomers,
        topProducts,
        topProvinces,
        pendingProfits
      });
      
    } catch (err) {
      console.error('خطأ غير متوقع في جلب إحصائيات الطلبات:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    fetchAnalytics();
  }, []);

  // إرجاع البيانات والوظائف
  return {
    analytics,
    loading,
    error,
    refreshAnalytics: fetchAnalytics
  };
};

export default useOrdersAnalytics;