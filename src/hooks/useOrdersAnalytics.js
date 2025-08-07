import React, { useState, useEffect, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getUserUUID } from '@/utils/userIdUtils';

/**
 * Hook موحد لجلب جميع إحصائيات الطلبات والعملاء
 * يستخدم البيانات الموحدة من useInventory() بدلاً من الطلبات المنفصلة
 * إصلاح جذري: لا مزيد من استخدام supabase مباشرة!
 */
const useOrdersAnalytics = () => {
  // Defensive check to ensure React hooks are available
  if (!React || typeof useState !== 'function') {
    console.error('React hooks not available in useOrdersAnalytics');
    return {
      analytics: {
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        totalRevenue: 0,
        topCustomers: [],
        topProducts: [],
        topProvinces: [],
        pendingProfits: 0,
        pendingProfitOrders: []
      },
      loading: false,
      error: null,
      refreshAnalytics: () => {},
      setDateRange: () => {}
    };
  }

  const { canViewAllOrders, user } = usePermissions();
  const { orders, profits, customers } = useInventory(); // استخدام البيانات الموحدة فقط!
  
  const [dateRange, setDateRange] = useState({
    from: null,
    to: null
  });

  // حساب الإحصائيات من البيانات الموحدة - بدون طلبات منفصلة
  const analytics = useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return {
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        totalRevenue: 0,
        topCustomers: [],
        topProducts: [],
        topProvinces: [],
        pendingProfits: 0,
        pendingProfitOrders: []
      };
    }
    
    console.log('📊 حساب الإحصائيات من البيانات الموحدة - بدون طلبات منفصلة');
    
    const userUUID = getUserUUID(user);
    
    // فلترة الطلبات حسب الصلاحيات
    const visibleOrders = canViewAllOrders ? orders : orders.filter(order => 
      order.created_by === userUUID
    );

    // فلترة حسب التاريخ إذا كان محدد
    let filteredOrders = visibleOrders;
    if (dateRange.from && dateRange.to) {
      filteredOrders = visibleOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= dateRange.from && orderDate <= dateRange.to;
      });
    }

    // الطلبات المكتملة
    const completedOrders = filteredOrders.filter(order => 
      ['completed', 'delivered'].includes(order.status) && order.receipt_received
    );

    // حساب الإيرادات الإجمالية
    const totalRevenue = completedOrders.reduce((sum, order) => 
      sum + (order.final_amount || order.total_amount || 0), 0
    );

    // أفضل العملاء
    const customerStats = new Map();
    completedOrders.forEach(order => {
      const phone = order.customer_phone;
      const name = order.customer_name;
      
      if (customerStats.has(phone)) {
        const existing = customerStats.get(phone);
        existing.orderCount++;
        existing.totalRevenue += order.final_amount || order.total_amount || 0;
      } else {
        customerStats.set(phone, {
          label: name,
          phone,
          orderCount: 1,
          totalRevenue: order.final_amount || order.total_amount || 0
        });
      }
    });

    const topCustomers = Array.from(customerStats.values())
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 5)
      .map(customer => ({
        ...customer,
        value: `${customer.orderCount} طلب`
      }));

    // أفضل المحافظات
    const provinceStats = new Map();
    completedOrders.forEach(order => {
      const province = order.customer_province || 'غير محدد';
      
      if (provinceStats.has(province)) {
        const existing = provinceStats.get(province);
        existing.orderCount++;
        existing.totalRevenue += order.final_amount || order.total_amount || 0;
      } else {
        provinceStats.set(province, {
          label: province,
          orderCount: 1,
          totalRevenue: order.final_amount || order.total_amount || 0
        });
      }
    });

    const topProvinces = Array.from(provinceStats.values())
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 5)
      .map(province => ({
        ...province,
        value: `${province.orderCount} طلبات`
      }));

    // أفضل المنتجات من عناصر الطلبات
    const productStats = new Map();
    completedOrders.forEach(order => {
      if (order.order_items && Array.isArray(order.order_items)) {
        order.order_items.forEach(item => {
          const productName = item.products?.name || item.product_name || 'منتج غير محدد';
          const quantity = item.quantity || 0;
          
          if (productStats.has(productName)) {
            const existing = productStats.get(productName);
            existing.quantity += quantity;
          } else {
            productStats.set(productName, {
              label: productName,
              quantity
            });
          }
        });
      }
    });

    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .map(product => ({
        ...product,
        value: `${product.quantity} قطعة`
      }));

    // الأرباح المعلقة (من البيانات الموحدة)
    const visibleProfits = canViewAllOrders ? profits : profits?.filter(profit => 
      profit.employee_id === userUUID
    );
    
    const pendingProfits = visibleProfits?.filter(profit => 
      profit.status === 'pending'
    ).reduce((sum, profit) => sum + (profit.employee_profit || 0), 0) || 0;

    console.log('✅ تم حساب الإحصائيات من البيانات الموحدة:', {
      totalOrders: filteredOrders.length,
      completedOrders: completedOrders.length,
      totalRevenue,
      topCustomersCount: topCustomers.length,
      pendingProfits
    });

    return {
      totalOrders: filteredOrders.length,
      pendingOrders: filteredOrders.filter(o => o.status === 'pending').length,
      completedOrders: completedOrders.length,
      totalRevenue,
      topCustomers,
      topProducts,
      topProvinces,
      pendingProfits,
      pendingProfitOrders: visibleProfits?.filter(p => p.status === 'pending') || []
    };

  }, [orders, profits, customers, canViewAllOrders, user, dateRange]);

  // دالة تحديث فترة التاريخ
  const refreshAnalytics = () => {
    console.log('🔄 تحديث الإحصائيات (من البيانات الموحدة الحالية)');
    // لا حاجة لطلبات منفصلة - البيانات محدثة تلقائياً من useInventory
  };

  return {
    analytics,
    loading: false, // لا حاجة للتحميل - البيانات متوفرة فوراً
    error: null,
    refreshAnalytics,
    setDateRange
  };
};

export default useOrdersAnalytics;