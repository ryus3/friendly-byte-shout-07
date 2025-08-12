import React, { useState, useEffect, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getUserUUID } from '@/utils/userIdUtils';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';

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

  const { canViewAllOrders, user, isAdmin } = usePermissions();
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

    // تعريف اكتمال الطلب وفق السياسة
    const isOrderCompletedForAnalytics = (order) => {
      const hasReceipt = !!order.receipt_received;
      if (!hasReceipt) return false;
      if (['cancelled', 'returned', 'returned_in_stock'].includes(order.status)) return false;
      if (isAdmin) return true; // المدير: يكفي استلام الفاتورة
      // الموظف: يجب أن تُسوى أرباحه لهذا الطلب
      return profits?.some(
        (p) => p.order_id === order.id && p.employee_id === userUUID && p.status === 'settled'
      );
    };

    // الطلبات المكتملة حسب السياسة أعلاه
    const completedOrders = filteredOrders.filter(isOrderCompletedForAnalytics);

    // حساب الإيرادات الإجمالية من المكتمل فقط
    const totalRevenue = completedOrders.reduce((sum, order) => {
      const gross = order.final_amount || order.total_amount || 0;
      const delivery = order.delivery_fee || 0;
      return sum + Math.max(0, gross - delivery);
    }, 0);


    // أفضل العملاء (تجميع حسب رقم هاتف مُطبع)
    const customerStats = new Map();
    completedOrders.forEach(order => {
      const rawPhone = extractOrderPhone(order);
      const phone = normalizePhone(rawPhone) || 'غير محدد';
      const name = order.customer_name || order.client_name || order.name || 'غير محدد';
      const city = order.customer_city || order.customer_province || order.city || order.province || 'غير محدد';
      const gross = order.final_amount || order.total_amount || 0;
      const delivery = order.delivery_fee || 0;
      const orderAmount = Math.max(0, gross - delivery);
      const createdAt = order.created_at ? new Date(order.created_at) : null;
      
      if (customerStats.has(phone)) {
        const existing = customerStats.get(phone);
        existing.orderCount++;
        existing.totalRevenue += orderAmount;
        existing.city = existing.city || city;
        if (createdAt && (!existing.lastOrderDate || createdAt > existing.lastOrderDate)) {
          existing.lastOrderDate = createdAt;
        }
      } else {
        customerStats.set(phone, {
          label: name,
          name,
          phone,
          city,
          orderCount: 1,
          totalRevenue: orderAmount,
          lastOrderDate: createdAt
        });
      }
    });

    const topCustomers = Array.from(customerStats.values())
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10)
      .map(customer => ({
        // الحقول الجديدة المتوافقة مع الواجهات
        name: customer.name || customer.label || 'زبون غير محدد',
        phone: customer.phone,
        city: customer.city || 'غير محدد',
        total_orders: customer.orderCount,
        total_spent: customer.totalRevenue,
        last_order_date: customer.lastOrderDate ? customer.lastOrderDate.toISOString() : null,
        // الحقول القديمة للإبقاء على التوافق العكسي
        label: customer.name || customer.label,
        orderCount: customer.orderCount,
        totalRevenue: customer.totalRevenue,
        value: `${customer.orderCount} طلب`
      }));

    // أفضل المحافظات
    const provinceStats = new Map();
    completedOrders.forEach(order => {
      const regionName = order.customer_city || order.customer_province || 'غير محدد';
      const revenue = order.final_amount || order.total_amount || 0;
      
      if (provinceStats.has(regionName)) {
        const existing = provinceStats.get(regionName);
        existing.orderCount++;
        existing.totalRevenue += revenue;
      } else {
        provinceStats.set(regionName, {
          label: regionName,
          city_name: regionName,
          orderCount: 1,
          totalRevenue: revenue
        });
      }
    });

    const topProvinces = Array.from(provinceStats.values())
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10)
      .map(province => ({
        // الحقول الجديدة
        city_name: province.city_name || province.label,
        total_orders: province.orderCount,
        total_revenue: province.totalRevenue,
        // الحقول القديمة للتوافق
        label: province.city_name || province.label,
        orderCount: province.orderCount,
        totalRevenue: province.totalRevenue,
        value: `${province.orderCount} طلبات`
      }));

    // أفضل المنتجات من عناصر الطلبات
    const productStats = new Map();
    completedOrders.forEach(order => {
      if (order.order_items && Array.isArray(order.order_items)) {
        order.order_items.forEach(item => {
          const productName = item.products?.name || item.product_name || 'منتج غير محدد';
          const quantity = item.quantity || 0;
          const revenue = (item.total_price != null)
            ? item.total_price
            : ((item.unit_price != null ? item.unit_price : item.price || 0) * quantity);
          
          if (productStats.has(productName)) {
            const existing = productStats.get(productName);
            existing.quantity += quantity;
            existing.totalRevenue = (existing.totalRevenue || 0) + revenue;
            existing.ordersCount = (existing.ordersCount || 0) + 1;
          } else {
            productStats.set(productName, {
              label: productName,
              quantity,
              totalRevenue: revenue,
              ordersCount: 1
            });
          }
        });
      }
    });

    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(product => ({
        // الحقول الجديدة
        product_name: product.label,
        total_sold: product.quantity,
        total_revenue: product.totalRevenue || 0,
        orders_count: product.ordersCount || 0,
        // الحقول القديمة للتوافق
        label: product.label,
        quantity: product.quantity,
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
      pendingOrders: filteredOrders.filter(o => !isOrderCompletedForAnalytics(o) && !['cancelled','returned','returned_in_stock'].includes(o.status)).length,
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