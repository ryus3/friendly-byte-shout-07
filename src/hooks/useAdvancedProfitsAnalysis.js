import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * هوك تحليل الأرباح المتقدم - يستخدم قواعد الأرباح المحددة لكل موظف ومنتج
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
  
  // قواعد الأرباح للموظفين
  const [employeeProfitRules, setEmployeeProfitRules] = useState([]);

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

  // تحليل الأرباح - حساب مباشر بناءً على القواعد المحددة
  const fetchAdvancedAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 بدء تحليل الأرباح المتقدم باستخدام قواعد الأرباح...');

      // جلب الطلبات المُسلمة والمُستلمة الفواتير في النطاق الزمني
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_amount,
          delivery_fee,
          receipt_received,
          created_by,
          status,
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
        .eq('receipt_received', true)
        .in('status', ['delivered', 'completed'])
        .gte('created_at', dateRange.from?.toISOString())
        .lte('created_at', dateRange.to?.toISOString());

      const { data: orders, error: ordersError } = await ordersQuery;
      
      if (ordersError) throw ordersError;

      // معالجة البيانات وحساب الأرباح الفعلية
      let totalRevenue = 0;
      let totalCost = 0;
      let totalSystemProfit = 0;
      let totalEmployeeProfit = 0;
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
          
          // تطبيق الفلاتر
          let shouldInclude = true;

          if (filters.product !== 'all' && product?.id !== filters.product) {
            shouldInclude = false;
          }

          if (filters.color !== 'all' && variant?.color_id !== filters.color) {
            shouldInclude = false;
          }

          if (filters.size !== 'all' && variant?.size_id !== filters.size) {
            shouldInclude = false;
          }

          if (filters.department !== 'all') {
            const departments = product?.product_departments || [];
            const hasMatchingDept = departments.some(d => d.departments.id === filters.department);
            if (!hasMatchingDept) shouldInclude = false;
          }

          if (filters.category !== 'all') {
            const categories = product?.product_categories || [];
            const hasMatchingCat = categories.some(c => c.categories.id === filters.category);
            if (!hasMatchingCat) shouldInclude = false;
          }

          if (filters.productType !== 'all') {
            const productTypes = product?.product_product_types || [];
            const hasMatchingType = productTypes.some(t => t.product_types.id === filters.productType);
            if (!hasMatchingType) shouldInclude = false;
          }

          if (filters.season !== 'all') {
            const seasons = product?.product_seasons_occasions || [];
            const hasMatchingSeason = seasons.some(s => s.seasons_occasions.id === filters.season);
            if (!hasMatchingSeason) shouldInclude = false;
          }

          if (!shouldInclude) continue;

          filteredItemsCount++;

          // حساب الأرباح بناءً على القواعد المحددة
          const profitSplit = calculateProfitSplit(item, order.created_by);
          const itemRevenue = profitSplit.revenue;
          const itemCost = profitSplit.cost;
          const grossItemProfit = profitSplit.grossProfit;
          const itemSystemProfit = profitSplit.systemProfit;
          const itemEmployeeProfit = profitSplit.employeeProfit;
          
          totalRevenue += itemRevenue;
          totalCost += itemCost;
          totalSystemProfit += itemSystemProfit;
          totalEmployeeProfit += itemEmployeeProfit;

          // تجميع البيانات للتفصيلات
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

      console.log('📊 نتائج تحليل الأرباح باستخدام القواعد:', {
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
        totalProductsSold: filteredItemsCount,
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
    if (dateRange?.from && dateRange?.to && employeeProfitRules.length >= 0) {
      fetchAdvancedAnalysis();
    }
  }, [dateRange, filters, employeeProfitRules]);

  // جلب خيارات الفلاتر وقواعد الأرباح عند التحميل
  useEffect(() => {
    fetchFilterOptions();
    fetchEmployeeProfitRules();
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