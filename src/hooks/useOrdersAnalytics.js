import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Hook موحد لجلب جميع إحصائيات الطلبات والعملاء
 * يستبدل التكرار في TopCustomersDialog, TopProductsDialog, TopProvincesDialog, PendingProfitsDialog
 */
const useOrdersAnalytics = () => {
  const { canViewAllOrders, user } = usePermissions();
  
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
      
      if (!user?.id) {
        console.log('لا يوجد مستخدم مسجل دخول');
        return;
      }

      // إذا كان المستخدم مدير، يرى كل البيانات
      // إذا كان موظف، يرى بياناته فقط
      const userFilter = canViewAllOrders ? {} : { created_by: user.id };
      
      console.log('جلب البيانات للمستخدم:', user.id, 'صلاحية المدير:', canViewAllOrders);

      // جلب الطلبات المكتملة
      const { data: completedOrders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          delivery_fee,
          status,
          created_at,
          created_by,
          customer_id,
          customers(name, phone, city, province)
        `)
        .match({
          status: 'completed',
          receipt_received: true,
          ...userFilter
        });

      if (ordersError) {
        console.error('خطأ في جلب الطلبات:', ordersError);
        setError(ordersError.message);
        return;
      }

      // جلب عناصر الطلبات مع تفاصيل المنتجات
      const orderIds = completedOrders?.map(o => o.id) || [];
      if (orderIds.length === 0) {
        setAnalytics({
          totalOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          totalRevenue: 0,
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
        return;
      }

      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          quantity,
          unit_price,
          total_price,
          order_id,
          product_variants(
            id,
            products(name),
            colors(name),
            sizes(name)
          )
        `)
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('خطأ في جلب عناصر الطلبات:', itemsError);
        setError(itemsError.message);
        return;
      }

      // معالجة البيانات
      const processedData = processAnalyticsData(completedOrders, orderItems);
      
      // جلب إحصائيات الطلبات العامة
      const { data: allOrders, error: allOrdersError } = await supabase
        .from('orders')
        .select('id, status')
        .match(userFilter);

      if (!allOrdersError && allOrders) {
        processedData.totalOrders = allOrders.length;
        processedData.pendingOrders = allOrders.filter(o => o.status === 'pending').length;
        processedData.completedOrders = completedOrders.length;
      }

      // جلب الأرباح المعلقة
      const { data: pendingProfits, error: profitsError } = await supabase
        .from('profits')
        .select('profit_amount, employee_profit')
        .match({
          status: 'pending',
          ...(canViewAllOrders ? {} : { employee_id: user.id })
        });

      if (!profitsError && pendingProfits) {
        processedData.pendingProfits = {
          total_pending_amount: pendingProfits.reduce((sum, p) => sum + (p.profit_amount || 0), 0),
          total_employee_profits: pendingProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
          employees_count: canViewAllOrders ? 1 : 1, // سيتم تحسينه لاحقاً
          orders_count: pendingProfits.length
        };
      }

      setAnalytics(processedData);
    } catch (err) {
      console.error('خطأ غير متوقع في جلب إحصائيات الطلبات:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // دالة معالجة البيانات
  const processAnalyticsData = (orders, orderItems) => {
    // تجميع الزبائن حسب رقم الهاتف
    const customerGroups = {};
    const cityGroups = {};
    const productGroups = {};

    let totalRevenue = 0;

    orders.forEach(order => {
      totalRevenue += (order.total_amount || 0);
      
      if (order.customers) {
        const customer = order.customers;
        const normalizedPhone = normalizePhoneNumber(customer.phone);
        
        if (!customerGroups[normalizedPhone]) {
          customerGroups[normalizedPhone] = {
            name: customer.name,
            phone: customer.phone,
            city: customer.city,
            province: customer.province,
            total_orders: 0,
            total_spent: 0,
            last_order_date: order.created_at
          };
        }
        
        customerGroups[normalizedPhone].total_orders += 1;
        customerGroups[normalizedPhone].total_spent += (order.total_amount || 0);
        
        if (new Date(order.created_at) > new Date(customerGroups[normalizedPhone].last_order_date)) {
          customerGroups[normalizedPhone].last_order_date = order.created_at;
        }

        // تجميع المدن
        const cityName = customer.city || 'غير محدد';
        if (!cityGroups[cityName]) {
          cityGroups[cityName] = {
            city_name: cityName,
            total_orders: 0,
            total_revenue: 0
          };
        }
        cityGroups[cityName].total_orders += 1;
        cityGroups[cityName].total_revenue += (order.total_amount || 0);
      }
    });

    // معالجة المنتجات
    orderItems.forEach(item => {
      if (item.product_variants) {
        const variant = item.product_variants;
        const productKey = `${variant.products?.name || 'منتج غير محدد'}_${variant.colors?.name || 'بدون لون'}_${variant.sizes?.name || 'بدون حجم'}`;
        
        if (!productGroups[productKey]) {
          productGroups[productKey] = {
            product_name: variant.products?.name || 'منتج غير محدد',
            color_name: variant.colors?.name || 'بدون لون',
            size_name: variant.sizes?.name || 'بدون حجم',
            total_sold: 0,
            total_revenue: 0,
            orders_count: 0
          };
        }
        
        productGroups[productKey].total_sold += (item.quantity || 0);
        productGroups[productKey].total_revenue += (item.total_price || 0);
        productGroups[productKey].orders_count += 1;
      }
    });

    return {
      totalRevenue,
      topCustomers: Object.values(customerGroups)
        .sort((a, b) => b.total_orders - a.total_orders)
        .slice(0, 10),
      topProvinces: Object.values(cityGroups)
        .sort((a, b) => b.total_orders - a.total_orders)
        .slice(0, 10),
      topProducts: Object.values(productGroups)
        .sort((a, b) => b.total_sold - a.total_sold)
        .slice(0, 10)
    };
  };

  // دالة تطبيع رقم الهاتف
  const normalizePhoneNumber = (phone) => {
    if (!phone) return 'غير محدد';
    let normalized = String(phone).replace(/[\s\-\(\)]/g, '');
    normalized = normalized.replace(/^(\+964|00964)/, '');
    normalized = normalized.replace(/^0/, '');
    return normalized;
  };

  // جلب البيانات عند تحميل المكون أو تغيير المستخدم
  useEffect(() => {
    if (user?.id) {
      fetchAnalytics();
    }
  }, [user?.id, canViewAllOrders]);

  // إرجاع البيانات والوظائف
  return {
    analytics,
    loading,
    error,
    refreshAnalytics: fetchAnalytics
  };
};

export default useOrdersAnalytics;