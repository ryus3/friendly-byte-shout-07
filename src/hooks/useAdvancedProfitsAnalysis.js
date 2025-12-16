import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSalesStats } from '@/hooks/useSalesStats';
import devLog from '@/lib/devLogger';

/**
 * هوك تحليل الأرباح المتقدم - يستخدم قواعد الأرباح المحددة لكل موظف ومنتج
 */
export const useAdvancedProfitsAnalysis = (dateRange, filters) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  
  // استخدام النظام المركزي للمبيعات
  const { summaryStats } = useSalesStats();
  
  // استخدام النظام التوحيدي للمرشحات
  const [products, setProducts] = useState([]);
  
  // قواعد الأرباح للموظفين
  const [employeeProfitRules, setEmployeeProfitRules] = useState([]);

  // جلب قائمة المنتجات فقط (باقي البيانات من النظام الموحد)
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true);
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  // جلب قواعد الأرباح
  const fetchEmployeeProfitRules = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_profit_rules')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      setEmployeeProfitRules(data || []);
    } catch (err) {
      console.error('Error fetching profit rules:', err);
    }
  };

  // حساب ربح الموظف والنظام بناءً على القواعد المحددة
  const calculateProfitSplit = (orderItem, employeeId) => {
    const itemRevenue = orderItem.unit_price * orderItem.quantity;
    const variant = orderItem.product_variants;
    const product = orderItem.products;
    const itemCost = (variant?.cost_price || product?.cost_price || 0) * orderItem.quantity;
    const grossProfit = itemRevenue - itemCost;

    // البحث عن قاعدة ربح خاصة بهذا المنتج للموظف
    const productRule = employeeProfitRules.find(rule => 
      rule.employee_id === employeeId && 
      rule.rule_type === 'product' && 
      rule.target_id === orderItem.product_id
    );

    // البحث عن قاعدة ربح عامة للموظف
    const generalRule = employeeProfitRules.find(rule => 
      rule.employee_id === employeeId && 
      rule.rule_type === 'general'
    );

    let employeeProfit = 0;
    let systemProfit = grossProfit;

    if (productRule) {
      // استخدام قاعدة المنتج المحددة
      if (productRule.profit_percentage) {
        employeeProfit = grossProfit * (productRule.profit_percentage / 100);
      } else if (productRule.profit_amount) {
        employeeProfit = productRule.profit_amount * orderItem.quantity;
      }
    } else if (generalRule) {
      // استخدام القاعدة العامة
      if (generalRule.profit_percentage) {
        employeeProfit = grossProfit * (generalRule.profit_percentage / 100);
      } else if (generalRule.profit_amount) {
        employeeProfit = generalRule.profit_amount * orderItem.quantity;
      }
    } else {
      // إذا لم توجد قاعدة، فالربح كله للنظام (طلب من المدير)
      employeeProfit = 0;
    }

    systemProfit = grossProfit - employeeProfit;

    return {
      grossProfit,
      employeeProfit,
      systemProfit,
      revenue: itemRevenue,
      cost: itemCost
    };
  };

  // تحليل الأرباح - استعلام محسّن بدون JOINs معقدة
  const fetchAdvancedAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      // ⚡ استعلام مبسط - جلب order_items مباشرة مع البيانات الأساسية فقط
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_amount,
          delivery_fee,
          created_by,
          order_items (
            id,
            quantity,
            unit_price,
            total_price,
            product_id,
            variant_id
          )
        `)
        .eq('receipt_received', true)
        .in('status', ['delivered', 'completed']);

      // تطبيق الفترة الزمنية
      if (filters.period !== 'all' && dateRange?.from && dateRange?.to) {
        ordersQuery = ordersQuery
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());
      }

      // ⚡ جلب البيانات بالتوازي
      const [ordersResult, productsResult, variantsResult] = await Promise.all([
        ordersQuery,
        supabase.from('products').select('id, name, cost_price, department_id, category_id'),
        supabase.from('product_variants').select('id, product_id, cost_price, color_id, size_id')
      ]);

      if (ordersResult.error) throw ordersResult.error;
      
      const orders = ordersResult.data || [];
      const productsMap = new Map((productsResult.data || []).map(p => [p.id, p]));
      const variantsMap = new Map((variantsResult.data || []).map(v => [v.id, v]));

      // معالجة البيانات وحساب الأرباح الفعلية
      let totalRevenue = 0;
      let totalCost = 0;
      let totalSystemProfit = 0;
      let totalEmployeeProfit = 0;
      let totalOrders = orders?.length || 0;
      let filteredItemsCount = 0;

      const productBreakdown = {};

      for (const order of orders || []) {
        for (const item of order.order_items || []) {
          // ⚡ استخدام الـ Maps بدلاً من JOINs المعقدة
          const product = productsMap.get(item.product_id);
          const variant = variantsMap.get(item.variant_id);
          
          // تطبيق الفلاتر الأساسية
          let shouldInclude = true;

          if (filters.product !== 'all' && item.product_id !== filters.product) {
            shouldInclude = false;
          }

          if (filters.color !== 'all' && variant?.color_id !== filters.color) {
            shouldInclude = false;
          }

          if (filters.size !== 'all' && variant?.size_id !== filters.size) {
            shouldInclude = false;
          }

          if (filters.department !== 'all' && product?.department_id !== filters.department) {
            shouldInclude = false;
          }

          if (filters.category !== 'all' && product?.category_id !== filters.category) {
            shouldInclude = false;
          }

          if (!shouldInclude) continue;

          // إضافة الكمية الفعلية المباعة
          filteredItemsCount += (item.quantity || 0);

          // حساب الأرباح المبسط
          const itemRevenue = (item.unit_price || 0) * (item.quantity || 0);
          const costPrice = variant?.cost_price || product?.cost_price || 0;
          const itemCost = costPrice * (item.quantity || 0);
          const itemSystemProfit = itemRevenue - itemCost;
          
          totalRevenue += itemRevenue;
          totalCost += itemCost;
          totalSystemProfit += itemSystemProfit;

          // تجميع بيانات المنتجات فقط
          if (product && !productBreakdown[product.id]) {
            productBreakdown[product.id] = {
              id: product.id,
              name: product.name,
              profit: 0,
              revenue: 0,
              cost: 0,
              salesCount: 0
            };
          }
          if (product) {
            productBreakdown[product.id].profit += itemSystemProfit;
            productBreakdown[product.id].revenue += itemRevenue;
            productBreakdown[product.id].cost += itemCost;
            productBreakdown[product.id].salesCount += item.quantity || 0;
          }
        }
      }

      // ترتيب المنتجات فقط
      const sortedData = {
        topProducts: Object.values(productBreakdown)
          .sort((a, b) => b.profit - a.profit)
          .slice(0, 20),
        departmentBreakdown: [],
        categoryBreakdown: [],
        colorBreakdown: [],
        sizeBreakdown: [],
        seasonBreakdown: [],
        productTypeBreakdown: []
      };

      devLog.log('📊 نتائج تحليل الأرباح باستخدام القواعد:', {
        totalSystemProfit,
        totalEmployeeProfit,
        totalRevenue,
        totalCost,
        totalOrders,
        filteredItemsCount
      });

      setAnalysisData({
        systemProfit: totalSystemProfit, // ربح النظام بناءً على القواعد المحددة
        totalProfit: totalSystemProfit, // للتوافق مع الكود القديم
        totalOrders,
        totalRevenue,
        totalCost,
        // استخدام البيانات المركزية للمنتجات المباعة
        totalProductsSold: summaryStats?.totalProductsSold || filteredItemsCount,
        filteredItemsCount,
        averageProfit: totalOrders > 0 ? totalSystemProfit / totalOrders : 0,
        profitMargin: totalRevenue > 0 ? (totalSystemProfit / totalRevenue) * 100 : 0,
        ...sortedData
      });

    } catch (err) {
      console.error('Error fetching advanced profits analysis:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // تحديث البيانات عند تغيير الفلاتر
  useEffect(() => {
    // إذا كان الفلتر "كل الفترات"، نستدعي التحليل مباشرة
    if (filters.period === 'all' || (dateRange?.from && dateRange?.to)) {
      if (employeeProfitRules.length >= 0) {
        fetchAdvancedAnalysis();
      }
    }
  }, [dateRange, filters, employeeProfitRules]);

  // جلب المنتجات وقواعد الأرباح عند التحميل
  useEffect(() => {
    fetchProducts();
    fetchEmployeeProfitRules();
  }, []);

  const refreshData = () => {
    fetchAdvancedAnalysis();
  };

  return {
    analysisData,
    loading,
    error,
    products,
    refreshData
  };
};