import React, { useState, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getUserUUID } from '@/utils/userIdUtils';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';
import devLog from '@/lib/devLogger';

/**
 * Hook موحد لجلب جميع إحصائيات الطلبات والعملاء
 * يستخدم البيانات الموحدة من useInventory() بدلاً من الطلبات المنفصلة
 */
const useOrdersAnalytics = (forceUserDataOnly = false) => {
  if (!React || typeof useState !== 'function') {
    devLog.error('React hooks not available in useOrdersAnalytics');
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
  const { orders, profits, customers } = useInventory();
  
  const [dateRange, setDateRange] = useState({
    from: null,
    to: null
  });

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
    
    devLog.log('📊 حساب الإحصائيات من البيانات الموحدة');
    
    const userUUID = getUserUUID(user);
    
    const visibleOrders = (canViewAllOrders && !forceUserDataOnly) ? orders : orders.filter(order => 
      order.created_by === userUUID
    );

    let filteredOrders = visibleOrders;
    if (dateRange.from && dateRange.to) {
      filteredOrders = visibleOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= dateRange.from && orderDate <= dateRange.to;
      });
    }

    const isOrderCompletedForAnalytics = (order) => {
      const hasReceipt = !!order.receipt_received;
      if (!hasReceipt) return false;
      if (['cancelled', 'returned', 'returned_in_stock'].includes(order.status)) return false;
      if (isAdmin) return true;
      return profits?.some(
        (p) => p.order_id === order.id && p.employee_id === userUUID && p.status === 'settled'
      );
    };

    const completedOrders = filteredOrders.filter(isOrderCompletedForAnalytics);

    const totalRevenue = completedOrders.reduce((sum, order) => {
      const gross = order.final_amount || order.total_amount || 0;
      const delivery = order.delivery_fee || 0;
      return sum + Math.max(0, gross - delivery);
    }, 0);

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
        name: customer.name || customer.label || 'زبون غير محدد',
        phone: customer.phone,
        city: customer.city || 'غير محدد',
        total_orders: customer.orderCount,
        total_spent: customer.totalRevenue,
        last_order_date: customer.lastOrderDate ? customer.lastOrderDate.toISOString() : null,
        label: customer.name || customer.label,
        orderCount: customer.orderCount,
        totalRevenue: customer.totalRevenue,
        value: `${customer.orderCount} طلب`
      }));

    const provinceStats = new Map();
    completedOrders.forEach(order => {
      const regionName = order.customer_city || order.customer_province || 'غير محدد';
      const gross = order.final_amount || order.total_amount || 0;
      const delivery = order.delivery_fee || 0;
      const revenue = Math.max(0, gross - delivery);
      
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
        city_name: province.city_name || province.label,
        total_orders: province.orderCount,
        total_revenue: province.totalRevenue,
        label: province.city_name || province.label,
        orderCount: province.orderCount,
        totalRevenue: province.totalRevenue,
        value: `${province.orderCount} طلبات`
      }));

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
        product_name: product.label,
        total_sold: product.quantity,
        total_revenue: product.totalRevenue || 0,
        orders_count: product.ordersCount || 0,
        label: product.label,
        quantity: product.quantity,
        value: `${product.quantity} قطعة`
      }));

    const visibleProfits = (canViewAllOrders && !forceUserDataOnly) ? profits : profits?.filter(profit => 
      profit.employee_id === userUUID
    );
    
    const pendingProfits = visibleProfits?.filter(profit => 
      profit.status === 'pending'
    ).reduce((sum, profit) => sum + (profit.employee_profit || 0), 0) || 0;

    devLog.log('✅ تم حساب الإحصائيات:', {
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

  const refreshAnalytics = () => {
    devLog.log('🔄 تحديث الإحصائيات');
  };

  return {
    analytics,
    loading: false,
    error: null,
    refreshAnalytics,
    setDateRange
  };
};

export default useOrdersAnalytics;
