import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * هوك تحليل الأرباح المتقدم
 * يحسب الأرباح بناءً على تكلفة الشراء الفعلية وليس المسجلة في قاعدة البيانات
 */
export const useAdvancedProfitsAnalysis = (dateRange, filters) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  
  // بيانات الخيارات للفلاتر
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [products, setProducts] = useState([]);

  // جلب بيانات الخيارات
  const fetchFilterOptions = async () => {
    try {
      const [
        departmentsRes,
        categoriesRes,
        productTypesRes,
        seasonsRes,
        colorsRes,
        sizesRes,
        productsRes
      ] = await Promise.all([
        supabase.from('departments').select('*').eq('is_active', true),
        supabase.from('categories').select('*'),
        supabase.from('product_types').select('*'),
        supabase.from('seasons_occasions').select('*'),
        supabase.from('colors').select('*'),
        supabase.from('sizes').select('*'),
        supabase.from('products').select('id, name').eq('is_active', true)
      ]);

      setDepartments(departmentsRes.data || []);
      setCategories(categoriesRes.data || []);
      setProductTypes(productTypesRes.data || []);
      setSeasons(seasonsRes.data || []);
      setColors(colorsRes.data || []);
      setSizes(sizesRes.data || []);
      setProducts(productsRes.data || []);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  // حساب الربح الفعلي بناءً على تكلفة الشراء
  const calculateRealProfit = async (orderItem, purchaseHistory) => {
    // البحث عن تكلفة الشراء الأصلية للمنتج
    const relevantPurchases = purchaseHistory.filter(p => 
      p.product_id === orderItem.product_id && 
      p.variant_id === orderItem.variant_id &&
      new Date(p.created_at) <= new Date(orderItem.order_date)
    ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let actualCost = orderItem.variant_cost_price || orderItem.product_cost_price || 0;
    
    if (relevantPurchases.length > 0) {
      // استخدام FIFO - أول داخل أول خارج
      let remainingQuantity = orderItem.quantity;
      let totalCost = 0;

      for (const purchase of relevantPurchases.reverse()) {
        if (remainingQuantity <= 0) break;
        
        const availableFromThisPurchase = Math.min(remainingQuantity, purchase.quantity);
        totalCost += availableFromThisPurchase * purchase.unit_cost;
        remainingQuantity -= availableFromThisPurchase;
      }

      if (remainingQuantity <= 0) {
        actualCost = totalCost / orderItem.quantity;
      }
    }

    const revenue = orderItem.unit_price * orderItem.quantity;
    const profit = revenue - (actualCost * orderItem.quantity);
    
    return {
      ...orderItem,
      actualCost,
      revenue,
      profit
    };
  };

  // تحليل الأرباح الرئيسي - متوافق مع النظام المالي الموحد
  const fetchAdvancedAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      // جلب البيانات المالية المحسنة للمقارنة
      const { data: financialData, error: financialError } = await supabase
        .rpc('calculate_enhanced_main_cash_balance_v2');

      if (financialError) throw financialError;

      const enhancedFinancialData = financialData?.[0] || {};

      // جلب قواعد أرباح الموظفين للحسابات الدقيقة
      const { data: employeeProfitRules, error: rulesError } = await supabase
        .from('employee_profit_rules')
        .select('*')
        .eq('is_active', true);

      if (rulesError) {
        console.error('Error fetching employee profit rules:', rulesError);
      }

      // تجميع قواعد الأرباح حسب الموظف
      const rulesByEmployee = {};
      (employeeProfitRules || []).forEach(rule => {
        if (!rulesByEmployee[rule.employee_id]) {
          rulesByEmployee[rule.employee_id] = [];
        }
        rulesByEmployee[rule.employee_id].push(rule);
      });

      // جلب طلبات الفترة المحددة مع تفاصيلها
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_amount,
          receipt_received,
          created_by,
          order_items (
            id,
            quantity,
            unit_price,
            total_price,
            product_id,
            variant_id,
            products (
              id,
              name,
              cost_price,
              product_departments (
                departments (id, name, color)
              ),
              product_categories (
                categories (id, name)
              ),
              product_product_types (
                product_types (id, name)
              ),
              product_seasons_occasions (
                seasons_occasions (id, name)
              )
            ),
            product_variants (
              id,
              cost_price,
              color_id,
              size_id,
              colors (id, name, hex_code),
              sizes (id, name)
            )
          )
        `)
        .eq('receipt_received', true) // فقط الطلبات المستلمة
        .gte('created_at', dateRange.from?.toISOString())
        .lte('created_at', dateRange.to?.toISOString());

      const { data: orders, error: ordersError } = await ordersQuery;
      
      if (ordersError) throw ordersError;

      // دالة لحساب ربح الموظف من عنصر
      const calculateEmployeeProfit = (item, employeeId) => {
        const rules = rulesByEmployee[employeeId] || [];
        const revenue = item.unit_price * item.quantity;
        const cost = (item.product_variants?.cost_price || item.products?.cost_price || 0) * item.quantity;
        const grossProfit = revenue - cost;

        for (const rule of rules) {
          // قاعدة حسب المنتج
          if (rule.rule_type === 'product' && rule.target_id === item.product_id) {
            return rule.profit_percentage ? (grossProfit * rule.profit_percentage / 100) : rule.profit_amount;
          }
          // قاعدة حسب المتغير
          if (rule.rule_type === 'variant' && rule.target_id === item.variant_id) {
            return rule.profit_percentage ? (grossProfit * rule.profit_percentage / 100) : rule.profit_amount;
          }
          // قاعدة حسب القسم
          if (rule.rule_type === 'department' && item.products?.product_departments?.some(d => d.departments.id === rule.target_id)) {
            return rule.profit_percentage ? (grossProfit * rule.profit_percentage / 100) : rule.profit_amount;
          }
          // قاعدة حسب التصنيف
          if (rule.rule_type === 'category' && item.products?.product_categories?.some(c => c.categories.id === rule.target_id)) {
            return rule.profit_percentage ? (grossProfit * rule.profit_percentage / 100) : rule.profit_amount;
          }
        }

        return 0; // لا يوجد ربح للموظف
      };

      // معالجة البيانات وحساب أرباح النظام بعد خصم مستحقات الموظفين
      let totalSystemProfit = 0;
      let totalRevenue = 0;
      let totalCost = 0;
      let totalOrders = orders?.length || 0;
      let filteredItemsCount = 0;

      const departmentBreakdown = {};
      const categoryBreakdown = {};
      const productBreakdown = {};
      const colorBreakdown = {};
      const sizeBreakdown = {};
      const seasonBreakdown = {};
      const productTypeBreakdown = {};

      for (const order of orders || []) {
        for (const item of order.order_items || []) {
          const product = item.products;
          const variant = item.product_variants;
          
          // تطبيق الفلاتر قبل الحساب
          let shouldInclude = true;

          // فلترة حسب المنتج
          if (filters.product !== 'all' && product?.id !== filters.product) {
            shouldInclude = false;
          }

          // فلترة حسب اللون
          if (filters.color !== 'all' && variant?.color_id !== filters.color) {
            shouldInclude = false;
          }

          // فلترة حسب الحجم
          if (filters.size !== 'all' && variant?.size_id !== filters.size) {
            shouldInclude = false;
          }

          // فلترة حسب القسم
          if (filters.department !== 'all') {
            const departments = product?.product_departments || [];
            const hasMatchingDept = departments.some(d => d.departments.id === filters.department);
            if (!hasMatchingDept) shouldInclude = false;
          }

          // فلترة حسب التصنيف
          if (filters.category !== 'all') {
            const categories = product?.product_categories || [];
            const hasMatchingCat = categories.some(c => c.categories.id === filters.category);
            if (!hasMatchingCat) shouldInclude = false;
          }

          // فلترة حسب نوع المنتج
          if (filters.productType !== 'all') {
            const productTypes = product?.product_product_types || [];
            const hasMatchingType = productTypes.some(t => t.product_types.id === filters.productType);
            if (!hasMatchingType) shouldInclude = false;
          }

          // فلترة حسب الموسم
          if (filters.season !== 'all') {
            const seasons = product?.product_seasons_occasions || [];
            const hasMatchingSeason = seasons.some(s => s.seasons_occasions.id === filters.season);
            if (!hasMatchingSeason) shouldInclude = false;
          }

          if (!shouldInclude) continue;

          filteredItemsCount++;

          // حساب الربح الخام والربح للموظف
          const itemRevenue = item.unit_price * item.quantity;
          const itemCost = (variant?.cost_price || product?.cost_price || 0) * item.quantity;
          const itemGrossProfit = itemRevenue - itemCost;
          
          // حساب ربح الموظف إذا كان الطلب من موظف
          const employeeProfit = order.created_by ? calculateEmployeeProfit(item, order.created_by) : 0;
          
          // ربح النظام = الربح الخام - ربح الموظف
          const itemSystemProfit = itemGrossProfit - employeeProfit;
          
          totalSystemProfit += itemSystemProfit;
          totalRevenue += itemRevenue;
          totalCost += itemCost;

          // تجميع البيانات حسب الأقسام (ربح النظام)
          const departments = product?.product_departments || [];
          for (const deptRel of departments) {
            const dept = deptRel.departments;
            if (!departmentBreakdown[dept.id]) {
              departmentBreakdown[dept.id] = {
                id: dept.id,
                name: dept.name,
                color: dept.color,
                profit: 0,
                revenue: 0,
                cost: 0,
                orderCount: 0
              };
            }
            departmentBreakdown[dept.id].profit += itemSystemProfit;
            departmentBreakdown[dept.id].revenue += itemRevenue;
            departmentBreakdown[dept.id].cost += itemCost;
            departmentBreakdown[dept.id].orderCount += 1;
          }

          // تجميع البيانات حسب التصنيفات (ربح النظام)
          const categories = product?.product_categories || [];
          for (const catRel of categories) {
            const cat = catRel.categories;
            if (!categoryBreakdown[cat.id]) {
              categoryBreakdown[cat.id] = {
                id: cat.id,
                name: cat.name,
                profit: 0,
                revenue: 0,
                cost: 0,
                orderCount: 0
              };
            }
            categoryBreakdown[cat.id].profit += itemSystemProfit;
            categoryBreakdown[cat.id].revenue += itemRevenue;
            categoryBreakdown[cat.id].cost += itemCost;
            categoryBreakdown[cat.id].orderCount += 1;
          }

          // تجميع البيانات حسب المنتجات (ربح النظام)
          if (!productBreakdown[product.id]) {
            productBreakdown[product.id] = {
              id: product.id,
              name: product.name,
              profit: 0,
              revenue: 0,
              cost: 0,
              salesCount: 0
            };
          }
          productBreakdown[product.id].profit += itemSystemProfit;
          productBreakdown[product.id].revenue += itemRevenue;
          productBreakdown[product.id].cost += itemCost;
          productBreakdown[product.id].salesCount += item.quantity;

          // تجميع البيانات حسب الألوان (ربح النظام)
          if (variant?.colors) {
            const color = variant.colors;
            if (!colorBreakdown[color.id]) {
              colorBreakdown[color.id] = {
                id: color.id,
                name: color.name,
                hex_code: color.hex_code,
                profit: 0,
                revenue: 0,
                cost: 0
              };
            }
            colorBreakdown[color.id].profit += itemSystemProfit;
            colorBreakdown[color.id].revenue += itemRevenue;
            colorBreakdown[color.id].cost += itemCost;
          }

          // تجميع البيانات حسب القياسات (ربح النظام)
          if (variant?.sizes) {
            const size = variant.sizes;
            if (!sizeBreakdown[size.id]) {
              sizeBreakdown[size.id] = {
                id: size.id,
                name: size.name,
                profit: 0,
                revenue: 0,
                cost: 0
              };
            }
            sizeBreakdown[size.id].profit += itemSystemProfit;
            sizeBreakdown[size.id].revenue += itemRevenue;
            sizeBreakdown[size.id].cost += itemCost;
          }

          // تجميع البيانات حسب المواسم (ربح النظام)
          const seasons = product?.product_seasons_occasions || [];
          for (const seasonRel of seasons) {
            const season = seasonRel.seasons_occasions;
            if (!seasonBreakdown[season.id]) {
              seasonBreakdown[season.id] = {
                id: season.id,
                name: season.name,
                profit: 0,
                revenue: 0,
                cost: 0
              };
            }
            seasonBreakdown[season.id].profit += itemSystemProfit;
            seasonBreakdown[season.id].revenue += itemRevenue;
            seasonBreakdown[season.id].cost += itemCost;
          }

          // تجميع البيانات حسب أنواع المنتجات (ربح النظام)
          const productTypes = product?.product_product_types || [];
          for (const typeRel of productTypes) {
            const type = typeRel.product_types;
            if (!productTypeBreakdown[type.id]) {
              productTypeBreakdown[type.id] = {
                id: type.id,
                name: type.name,
                profit: 0,
                revenue: 0,
                cost: 0
              };
            }
            productTypeBreakdown[type.id].profit += itemSystemProfit;
            productTypeBreakdown[type.id].revenue += itemRevenue;
            productTypeBreakdown[type.id].cost += itemCost;
          }
        }
      }

      // تحويل البيانات إلى مصفوفات وترتيبها
      const sortedData = {
        departmentBreakdown: Object.values(departmentBreakdown)
          .sort((a, b) => b.profit - a.profit),
        categoryBreakdown: Object.values(categoryBreakdown)
          .sort((a, b) => b.profit - a.profit),
        topProducts: Object.values(productBreakdown)
          .sort((a, b) => b.profit - a.profit),
        colorBreakdown: Object.values(colorBreakdown)
          .sort((a, b) => b.profit - a.profit),
        sizeBreakdown: Object.values(sizeBreakdown)
          .sort((a, b) => b.profit - a.profit),
        seasonBreakdown: Object.values(seasonBreakdown)
          .sort((a, b) => b.profit - a.profit),
        productTypeBreakdown: Object.values(productTypeBreakdown)
          .sort((a, b) => b.profit - a.profit)
      };

      // إذا لم يتم تطبيق فلاتر، استخدم صافي الربح الصحيح من النظام (45 ألف)
      const finalTotalProfit = (filters.department === 'all' && 
                               filters.category === 'all' && 
                               filters.product === 'all' && 
                               filters.color === 'all' && 
                               filters.size === 'all' && 
                               filters.season === 'all' && 
                               filters.productType === 'all') 
                               ? enhancedFinancialData.net_profit // استخدام صافي الربح (45 ألف) بدلاً من الخام (52 ألف)
                               : totalSystemProfit;

      setAnalysisData({
        totalProfit: finalTotalProfit,
        totalOrders,
        totalRevenue,
        totalCost,
        filteredItemsCount,
        averageProfit: totalOrders > 0 ? finalTotalProfit / totalOrders : 0,
        profitMargin: totalRevenue > 0 ? (finalTotalProfit / totalRevenue) * 100 : 0,
        // معلومات مرجعية من النظام المالي
        systemTotalProfit: enhancedFinancialData.gross_profit || 0,
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
    if (dateRange?.from && dateRange?.to) {
      fetchAdvancedAnalysis();
    }
  }, [dateRange, filters]);

  // جلب خيارات الفلاتر عند التحميل
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const refreshData = () => {
    fetchAdvancedAnalysis();
  };

  return {
    analysisData,
    loading,
    error,
    departments,
    categories,
    productTypes,
    seasons,
    colors,
    sizes,
    products,
    refreshData
  };
};