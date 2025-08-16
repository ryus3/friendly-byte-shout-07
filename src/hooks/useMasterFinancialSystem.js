/**
 * النظام المالي الموحد النهائي - إصدار 2.0
 * يستبدل جميع الأنظمة المالية المبعثرة بنظام واحد موحد
 */

import { useState, useEffect, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';

export const useMasterFinancialSystem = (options = {}) => {
  const { orders, accounting, loading: inventoryLoading } = useInventory();
  const { user } = useAuth();
  const { canViewAllData, canViewAllOrders } = usePermissions();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [masterData, setMasterData] = useState(null);
  
  const { enableDebugLogs = false } = options;

  // حساب النظام المالي الموحد الشامل
  const calculateMasterFinancials = useMemo(async () => {
    if (inventoryLoading) return null;

    try {
      setLoading(true);
      setError(null);

      if (enableDebugLogs) {
        console.log('🏦 النظام المالي الموحد الشامل: بدء العمليات...');
      }

      // 1. جلب الطلبات المكتملة والمستلمة مع جميع التفاصيل
      const userFilter = canViewAllOrders ? {} : { created_by: user?.id };
      
      const { data: completedOrders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            unit_price,
            total_price,
            product_variants (
              cost_price,
              products (name),
              colors (name),
              sizes (name)
            )
          ),
          customers (name, phone, city, province)
        `)
        .in('status', ['completed', 'delivered'])
        .eq('receipt_received', true)
        .match(userFilter);

      if (ordersError) throw ordersError;

      // 2. جلب المصاريف المعتمدة
      const { data: approvedExpenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('status', 'approved');

      // 3. جلب الأرباح
      const { data: allProfits } = await supabase
        .from('profits')
        .select('*');

      // 4. جلب رأس المال
      const { data: mainCash } = await supabase
        .from('cash_sources')
        .select('current_balance')
        .eq('name', 'القاصة الرئيسية')
        .maybeSingle();

      // 5. جلب قيمة المخزون
      const { data: inventoryValue } = await supabase
        .from('inventory')
        .select(`
          quantity,
          product_variants (cost_price)
        `);

      // معالجة البيانات
      const safeOrders = completedOrders || [];
      const safeExpenses = approvedExpenses || [];
      const safeProfits = allProfits || [];

      // **الحسابات المالية الأساسية الصحيحة**
      
      // 1. إجمالي الإيرادات
      const totalRevenue = safeOrders.reduce((sum, order) => {
        return sum + (order.final_amount || order.total_amount || 0);
      }, 0);

      // 2. رسوم التوصيل
      const deliveryFees = safeOrders.reduce((sum, order) => {
        return sum + (order.delivery_fee || 0);
      }, 0);

      // 3. المبيعات بدون توصيل (الرقم الصحيح)
      const salesWithoutDelivery = totalRevenue - deliveryFees;

      // 4. تكلفة البضاعة المباعة
      const cogs = safeOrders.reduce((orderSum, order) => {
        if (!order.order_items) return orderSum;
        return orderSum + order.order_items.reduce((itemSum, item) => {
          const costPrice = item.product_variants?.cost_price || 0;
          return itemSum + (costPrice * (item.quantity || 0));
        }, 0);
      }, 0);

      // 5. إجمالي الربح
      const grossProfit = salesWithoutDelivery - cogs;

      // 6. المصاريف العامة (بدون المستحقات)
      const generalExpenses = safeExpenses.filter(expense => 
        expense.expense_type !== 'system' || expense.category !== 'مستحقات الموظفين'
      ).reduce((sum, expense) => sum + (expense.amount || 0), 0);

      // 7. المستحقات المدفوعة
      const employeeDuesPaid = safeExpenses.filter(expense =>
        expense.expense_type === 'system' && expense.category === 'مستحقات الموظفين'
      ).reduce((sum, expense) => sum + (expense.amount || 0), 0);

      // 8. المستحقات المعلقة
      const pendingDues = safeProfits.filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + (p.employee_profit || 0), 0);

      // 9. صافي ربح النظام
      const netProfit = grossProfit - generalExpenses;

      // 10. رأس المال
      const cashBalance = mainCash?.current_balance || 0;
      const inventoryTotalValue = inventoryValue?.reduce((sum, item) => {
        return sum + ((item.quantity || 0) * (item.product_variants?.cost_price || 0));
      }, 0) || 0;
      const totalCapital = cashBalance + inventoryTotalValue;

      // **إحصائيات التحليل التفصيلي**
      
      // تحليل الزبائن (بدون رسوم التوصيل)
      const customerGroups = {};
      const cityGroups = {};
      const productGroups = {};

      safeOrders.forEach(order => {
        const orderRevenue = (order.final_amount || order.total_amount || 0) - (order.delivery_fee || 0);
        
        // تجميع الزبائن
        if (order.customers) {
          const phone = normalizePhoneNumber(order.customers.phone);
          if (!customerGroups[phone]) {
            customerGroups[phone] = {
              name: order.customers.name,
              phone: order.customers.phone,
              city: order.customers.city,
              province: order.customers.province,
              total_orders: 0,
              total_spent: 0,
              last_order_date: order.created_at
            };
          }
          customerGroups[phone].total_orders += 1;
          customerGroups[phone].total_spent += orderRevenue; // بدون توصيل
          if (new Date(order.created_at) > new Date(customerGroups[phone].last_order_date)) {
            customerGroups[phone].last_order_date = order.created_at;
          }

          // تجميع المدن
          const cityName = order.customers.city || 'غير محدد';
          if (!cityGroups[cityName]) {
            cityGroups[cityName] = {
              city_name: cityName,
              total_orders: 0,
              total_revenue: 0
            };
          }
          cityGroups[cityName].total_orders += 1;
          cityGroups[cityName].total_revenue += orderRevenue; // بدون توصيل
        }

        // تجميع المنتجات
        if (order.order_items) {
          order.order_items.forEach(item => {
            if (item.product_variants) {
              const variant = item.product_variants;
              const productKey = `${variant.products?.name || 'منتج غير محدد'}_${variant.colors?.name || ''}_${variant.sizes?.name || ''}`;
              
              if (!productGroups[productKey]) {
                productGroups[productKey] = {
                  product_name: variant.products?.name || 'منتج غير محدد',
                  color_name: variant.colors?.name || '',
                  size_name: variant.sizes?.name || '',
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
        }
      });

      // النتيجة النهائية الموحدة
      const masterFinancialData = {
        // **البيانات المالية الأساسية**
        totalRevenue,           // 136,000
        deliveryFees,          // 15,000
        salesWithoutDelivery,  // 121,000 ✅ الرقم الصحيح
        cogs,                  // 69,000
        grossProfit,           // 52,000
        generalExpenses,       // 0
        employeeDuesPaid,      // 7,000
        pendingDues,           // الأرباح المعلقة
        netProfit,             // 45,000
        
        // **رأس المال**
        totalCapital,
        cashBalance,
        inventoryValue: inventoryTotalValue,
        
        // **الإحصائيات التفصيلية** 
        ordersCount: safeOrders.length,
        avgOrderValue: safeOrders.length > 0 ? salesWithoutDelivery / safeOrders.length : 0,
        profitMargin: salesWithoutDelivery > 0 ? ((netProfit / salesWithoutDelivery) * 100) : 0,
        
        // **البيانات التحليلية الموحدة**
        topCustomers: Object.values(customerGroups)
          .sort((a, b) => b.total_orders - a.total_orders)
          .slice(0, 10),
        topProvinces: Object.values(cityGroups)
          .sort((a, b) => b.total_orders - a.total_orders)
          .slice(0, 10),
        topProducts: Object.values(productGroups)
          .sort((a, b) => b.total_sold - a.total_sold)
          .slice(0, 10),
        
        // **معلومات النظام**
        lastCalculated: new Date(),
        dataSource: 'master_unified_system',
        isUnified: true
      };

      if (enableDebugLogs) {
        console.log('🏦 النظام المالي الموحد الشامل - النتائج:', masterFinancialData);
      }

      setMasterData(masterFinancialData);
      return masterFinancialData;

    } catch (error) {
      console.error('❌ خطأ في النظام المالي الموحد:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [orders, accounting, inventoryLoading, canViewAllOrders, user?.id]);

  // تشغيل الحسابات
  useEffect(() => {
    if (!inventoryLoading) {
      calculateMasterFinancials;
    }
  }, [calculateMasterFinancials]);

  // دالة تطبيع رقم الهاتف
  const normalizePhoneNumber = (phone) => {
    if (!phone) return 'غير محدد';
    return String(phone).replace(/[\s\-\(\)]/g, '')
                        .replace(/^(\+964|00964)/, '')
                        .replace(/^0/, '');
  };

  // دوال التنسيق
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0) + ' د.ع';
  };

  const formatPercentage = (percentage) => {
    return `${(percentage || 0).toFixed(1)}%`;
  };

  return {
    // البيانات الموحدة
    ...masterData,
    
    // حالة النظام
    loading: loading || inventoryLoading,
    error,
    
    // دوال التنسيق
    formatCurrency,
    formatPercentage,
    
    // معلومات النظام
    isDataValid: !error && !loading && masterData !== null,
    lastUpdate: masterData?.lastCalculated,
    
    // دالة إعادة التحميل
    refreshData: () => calculateMasterFinancials
  };
};

export default useMasterFinancialSystem;