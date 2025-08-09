/**
 * نظام الإحصائيات الموحد - رقم واحد، مصدر واحد، حقيقة واحدة
 * يضمن أن نفس الرقم يظهر في جميع الصفحات
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSuper } from '@/contexts/SuperProvider';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export const useUnifiedStats = () => {
  const { orders, products, customers, expenses, cashSources, computed } = useSuper();
  const { user } = useAuth();
  const { canViewAllData } = usePermissions();
  
  // البيانات المصفاة حسب الصلاحيات
  const filteredData = useMemo(() => {
    const userOrders = canViewAllData ? orders : orders.filter(o => o.created_by === user?.id);
    const userProducts = canViewAllData ? products : products.filter(p => p.created_by === user?.id);
    
    return {
      orders: userOrders || [],
      products: userProducts || [],
      customers: customers || [],
      expenses: expenses || [],
      cashSources: cashSources || []
    };
  }, [orders, products, customers, expenses, cashSources, canViewAllData, user?.id]);

  // إحصائيات الطلبات - رقم واحد موحد
  const ordersStats = useMemo(() => {
    const completedOrders = filteredData.orders.filter(o => 
      ['completed', 'delivered'].includes(o.status) && o.receipt_received
    );
    
    const pendingOrders = filteredData.orders.filter(o => o.status === 'pending');
    const shippedOrders = filteredData.orders.filter(o => o.status === 'shipped');
    
    // إجمالي الإيرادات - حساب موحد
    const totalRevenue = completedOrders.reduce((sum, order) => {
      return sum + (order.final_amount || order.total_amount || 0);
    }, 0);
    
    // رسوم التوصيل - حساب موحد
    const deliveryFees = completedOrders.reduce((sum, order) => {
      return sum + (order.delivery_fee || 0);
    }, 0);
    
    // المبيعات بدون توصيل - حساب موحد
    const salesWithoutDelivery = totalRevenue - deliveryFees;
    
    return {
      total: filteredData.orders.length,
      completed: completedOrders.length,
      pending: pendingOrders.length,
      shipped: shippedOrders.length,
      totalRevenue, // رقم موحد
      deliveryFees, // رقم موحد
      salesWithoutDelivery, // رقم موحد
      avgOrderValue: completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0
    };
  }, [filteredData.orders]);

  // إحصائيات المنتجات - رقم واحد موحد
  const productsStats = useMemo(() => {
    const activeProducts = filteredData.products.filter(p => p.is_active !== false);
    
    // حساب المخزون بطريقة موحدة
    const lowStockProducts = activeProducts.filter(product => {
      return product.variants?.some(variant => {
        const inventory = variant.inventory?.[0];
        const currentStock = inventory?.quantity || 0;
        const minStock = inventory?.min_stock || 5;
        return currentStock <= minStock;
      });
    });
    
    const outOfStockProducts = activeProducts.filter(product => {
      return product.variants?.every(variant => {
        const inventory = variant.inventory?.[0];
        return (inventory?.quantity || 0) === 0;
      });
    });
    
    // قيمة المخزون الإجمالية - حساب موحد
    const totalInventoryValue = activeProducts.reduce((sum, product) => {
      return sum + (product.variants || []).reduce((variantSum, variant) => {
        const inventory = variant.inventory?.[0];
        const quantity = inventory?.quantity || 0;
        const costPrice = variant.cost_price || 0;
        return variantSum + (quantity * costPrice);
      }, 0);
    }, 0);
    
    return {
      total: activeProducts.length,
      lowStock: lowStockProducts.length,
      outOfStock: outOfStockProducts.length,
      totalInventoryValue // رقم موحد
    };
  }, [filteredData.products]);

  // إحصائيات العملاء - رقم واحد موحد
  const customersStats = useMemo(() => {
    const uniqueCustomers = new Set();
    filteredData.orders.forEach(order => {
      if (order.customer_phone) {
        uniqueCustomers.add(order.customer_phone);
      }
    });
    
    return {
      total: filteredData.customers.length,
      fromOrders: uniqueCustomers.size,
      active: uniqueCustomers.size // العملاء النشطين
    };
  }, [filteredData.customers, filteredData.orders]);

  // إحصائيات مالية موحدة
  const financialStats = useMemo(() => {
    const approvedExpenses = filteredData.expenses.filter(e => e.status === 'approved');
    const totalExpenses = approvedExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    
    const mainCash = filteredData.cashSources.find(cs => cs.name === 'القاصة الرئيسية');
    const cashBalance = mainCash?.current_balance || 0;
    
    // حساب الربح الصافي - رقم موحد
    const netProfit = ordersStats.salesWithoutDelivery - totalExpenses;
    const profitMargin = ordersStats.salesWithoutDelivery > 0 ? 
      ((netProfit / ordersStats.salesWithoutDelivery) * 100) : 0;
    
    return {
      totalRevenue: ordersStats.totalRevenue, // نفس الرقم
      totalExpenses,
      netProfit, // رقم موحد
      profitMargin, // رقم موحد
      cashBalance,
      totalCapital: cashBalance + productsStats.totalInventoryValue
    };
  }, [ordersStats, productsStats, filteredData.expenses, filteredData.cashSources]);

  // قوائم أفضل العناصر - بيانات موحدة
  const topLists = useMemo(() => {
    // أفضل العملاء - حساب موحد
    const customerOrderMap = new Map();
    filteredData.orders.forEach(order => {
      if (!['completed', 'delivered'].includes(order.status)) return;
      
      const phone = order.customer_phone;
      const name = order.customer_name;
      const revenue = order.final_amount || order.total_amount || 0;
      
      if (customerOrderMap.has(phone)) {
        const existing = customerOrderMap.get(phone);
        existing.orderCount++;
        existing.totalRevenue += revenue;
        existing.avgOrderValue = existing.totalRevenue / existing.orderCount;
      } else {
        customerOrderMap.set(phone, {
          label: name,
          phone,
          orderCount: 1,
          totalRevenue: revenue,
          avgOrderValue: revenue
        });
      }
    });
    
    const topCustomers = Array.from(customerOrderMap.values())
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 5)
      .map(customer => ({
        ...customer,
        value: `${customer.orderCount} طلب`
      }));

    // أفضل المنتجات - حساب موحد
    const productSalesMap = new Map();
    filteredData.orders.forEach(order => {
      if (!['completed', 'delivered'].includes(order.status)) return;
      
      (order.order_items || []).forEach(item => {
        const productName = item.products?.name || item.product_name || 'منتج غير محدد';
        const quantity = item.quantity || 0;
        const revenue = item.total_price || (item.unit_price * quantity) || 0;
        
        if (productSalesMap.has(productName)) {
          const existing = productSalesMap.get(productName);
          existing.quantity += quantity;
          existing.totalRevenue += revenue;
          existing.ordersCount++;
        } else {
          productSalesMap.set(productName, {
            label: productName,
            quantity,
            totalRevenue: revenue,
            ordersCount: 1
          });
        }
      });
    });
    
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .map(product => ({
        ...product,
        value: `${product.quantity} قطعة`
      }));

    // أفضل المحافظات - حساب موحد
    const provinceOrderMap = new Map();
    filteredData.orders.forEach(order => {
      if (!['completed', 'delivered'].includes(order.status)) return;
      
      const province = order.customer_province || 'غير محدد';
      const revenue = order.final_amount || order.total_amount || 0;
      
      if (provinceOrderMap.has(province)) {
        const existing = provinceOrderMap.get(province);
        existing.ordersCount++;
        existing.totalRevenue += revenue;
      } else {
        provinceOrderMap.set(province, {
          label: province,
          ordersCount: 1,
          totalRevenue: revenue
        });
      }
    });
    
    const topProvinces = Array.from(provinceOrderMap.values())
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 5)
      .map(province => ({
        ...province,
        value: `${province.ordersCount} طلبات`
      }));

    return {
      customers: topCustomers,
      products: topProducts,
      provinces: topProvinces
    };
  }, [filteredData.orders]);

  // تنسيق العملة - موحد
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0) + ' د.ع';
  }, []);

  // تنسيق النسبة المئوية - موحد
  const formatPercentage = useCallback((percentage) => {
    return `${(percentage || 0).toFixed(1)}%`;
  }, []);

  return {
    // الإحصائيات الموحدة
    orders: ordersStats,
    products: productsStats,
    customers: customersStats,
    financial: financialStats,
    
    // القوائم الموحدة
    topLists,
    
    // دوال التنسيق الموحدة
    formatCurrency,
    formatPercentage,
    
    // معلومات النظام
    lastUpdated: new Date(),
    dataSource: 'unified_stats_system'
  };
};

export default useUnifiedStats;