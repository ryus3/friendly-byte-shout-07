/**
 * تحديث Dashboard ليستخدم التخزين الذكي
 * نفس التصميم بالضبط - فقط تحسين خفي في الأداء
 */

import { useMemo } from 'react';
import { useSmartData } from '@/hooks/useSmartCache';
import { useInventory } from '@/contexts/InventoryContext';

export const useOptimizedDashboard = () => {
  const { orders, products, accounting } = useInventory();
  const { fetchData } = useSmartData();

  // إحصائيات محسوبة مرة واحدة فقط (بدلاً من التكرار)
  const dashboardStats = useMemo(() => {
    // منع إعادة الحساب إذا لم تتغير البيانات
    if (!orders || !products) return null;

    console.log('📊 حساب الإحصائيات مرة واحدة...');

    // إحصائيات الطلبات - حساب واحد
    const completedOrders = orders.filter(o => 
      ['completed', 'delivered'].includes(o.status) && o.receipt_received
    );
    
    const totalRevenue = completedOrders.reduce((sum, order) => {
      return sum + (order.final_amount || order.total_amount || 0);
    }, 0);

    // إحصائيات المنتجات - حساب واحد
    const lowStockProducts = products.filter(product => {
      return product.variants?.some(variant => {
        const inventory = variant.inventory?.[0];
        const currentStock = inventory?.quantity || 0;
        const minStock = inventory?.min_stock || 5;
        return currentStock <= minStock;
      });
    });

    // أفضل العملاء - حساب واحد
    const customerStats = new Map();
    completedOrders.forEach(order => {
      const phone = order.customer_phone;
      const name = order.customer_name;
      const revenue = order.final_amount || order.total_amount || 0;
      
      if (customerStats.has(phone)) {
        const existing = customerStats.get(phone);
        existing.orderCount++;
        existing.totalRevenue += revenue;
      } else {
        customerStats.set(phone, {
          label: name,
          phone,
          orderCount: 1,
          totalRevenue: revenue
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

    // أفضل المنتجات - حساب واحد
    const productStats = new Map();
    completedOrders.forEach(order => {
      (order.order_items || []).forEach(item => {
        const productName = item.products?.name || item.product_name || 'منتج غير محدد';
        const quantity = item.quantity || 0;
        const revenue = item.total_price || (item.unit_price * quantity) || 0;
        
        if (productStats.has(productName)) {
          const existing = productStats.get(productName);
          existing.quantity += quantity;
          existing.totalRevenue += revenue;
        } else {
          productStats.set(productName, {
            label: productName,
            quantity,
            totalRevenue: revenue
          });
        }
      });
    });

    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .map(product => ({
        ...product,
        value: `${product.quantity} قطعة`
      }));

    // أفضل المحافظات - حساب واحد
    const provinceStats = new Map();
    completedOrders.forEach(order => {
      const province = order.customer_province || 'غير محدد';
      const revenue = order.final_amount || order.total_amount || 0;
      
      if (provinceStats.has(province)) {
        const existing = provinceStats.get(province);
        existing.ordersCount++;
        existing.totalRevenue += revenue;
      } else {
        provinceStats.set(province, {
          label: province,
          ordersCount: 1,
          totalRevenue: revenue
        });
      }
    });

    const topProvinces = Array.from(provinceStats.values())
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 5)
      .map(province => ({
        ...province,
        value: `${province.ordersCount} طلبات`
      }));

    console.log('✅ تم حساب جميع الإحصائيات بنجاح');

    return {
      // الإحصائيات الأساسية
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      totalRevenue,
      lowStockCount: lowStockProducts.length,
      
      // القوائم العلوية (مرة واحدة)
      topCustomers,
      topProducts,
      topProvinces,
      
      // الطابع الزمني للحساب
      calculatedAt: new Date(),
      dataCount: {
        orders: orders.length,
        products: products.length,
        completedOrders: completedOrders.length
      }
    };
    
  }, [orders, products, accounting]); // يُعاد الحساب فقط عند تغيير البيانات الأساسية

  return dashboardStats;
};

export default useOptimizedDashboard;