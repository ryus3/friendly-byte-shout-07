import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSuper } from '@/contexts/SuperProvider';
import { supabase } from '@/integrations/supabase/client';
import devLog from '@/lib/devLogger';

/**
 * هوك تحليل الأرباح المتقدم v4.0 - جلب كامل مع العلاقات
 * يحلل أرباح كل النظام مع دعم فلتر الموظف
 */
export const useAdvancedProfitsAnalysis = (dateRange, filters) => {
  const { allData, loading: superLoading } = useSuper();
  const [analysisData, setAnalysisData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalSoldProducts, setTotalSoldProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // استخراج البيانات الثابتة من SuperProvider
  const { 
    products: cachedProducts,
    employeeProfitRules: cachedProfitRules,
    departments: cachedDepartments,
    categories: cachedCategories,
    colors: cachedColors,
    sizes: cachedSizes,
    productTypes: cachedProductTypes,
    seasons: cachedSeasons
  } = allData || {};

  // جلب جميع البيانات المطلوبة مرة واحدة
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        // جلب الطلبات مع العلاقات الكاملة + اسم الموظف
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            *,
            profiles!created_by (user_id, full_name),
            order_items (
              *,
              products (
                *,
                product_departments (departments (*)),
                product_categories (categories (*)),
                product_product_types (product_types (*)),
                product_seasons_occasions (seasons_occasions (*))
              ),
              product_variants (*, colors (*), sizes (*))
            )
          `)
          .eq('receipt_received', true)
          .in('status', ['delivered', 'completed']);

        if (ordersError) throw ordersError;
        setOrders(ordersData || []);
        
        // جلب الموظفين النشطين
        const { data: employeesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .eq('is_active', true);
        setEmployees(employeesData || []);
        
        // جلب عدد المنتجات المباعة الفعلي من inventory
        const { data: soldData } = await supabase
          .from('inventory')
          .select('sold_quantity');
        const totalSold = soldData?.reduce((sum, i) => sum + (i.sold_quantity || 0), 0) || 0;
        setTotalSoldProducts(totalSold);
        
        devLog.log('📊 تم جلب البيانات الكاملة:', {
          orders: ordersData?.length,
          employees: employeesData?.length,
          totalSold
        });
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // حساب ربح الموظف والنظام بناءً على القواعد المحددة
  const calculateProfitSplit = useCallback((orderItem, employeeId, profitRules) => {
    const itemRevenue = (orderItem.unit_price || orderItem.price || 0) * (orderItem.quantity || 1);
    const variant = orderItem.product_variants;
    const product = orderItem.products;
    const itemCost = (variant?.cost_price || product?.cost_price || orderItem.cost_price || 0) * (orderItem.quantity || 1);
    const grossProfit = itemRevenue - itemCost;

    // البحث عن قاعدة ربح خاصة بهذا المنتج للموظف
    const productRule = profitRules?.find(rule => 
      rule.employee_id === employeeId && 
      rule.rule_type === 'product' && 
      rule.target_id === orderItem.product_id
    );

    // البحث عن قاعدة ربح عامة للموظف
    const generalRule = profitRules?.find(rule => 
      rule.employee_id === employeeId && 
      rule.rule_type === 'general'
    );

    let employeeProfit = 0;
    let systemProfit = grossProfit;

    if (productRule) {
      if (productRule.profit_percentage) {
        employeeProfit = grossProfit * (productRule.profit_percentage / 100);
      } else if (productRule.profit_amount) {
        employeeProfit = productRule.profit_amount * (orderItem.quantity || 1);
      }
    } else if (generalRule) {
      if (generalRule.profit_percentage) {
        employeeProfit = grossProfit * (generalRule.profit_percentage / 100);
      } else if (generalRule.profit_amount) {
        employeeProfit = generalRule.profit_amount * (orderItem.quantity || 1);
      }
    }

    systemProfit = grossProfit - employeeProfit;

    return {
      grossProfit,
      employeeProfit,
      systemProfit,
      revenue: itemRevenue,
      cost: itemCost
    };
  }, []);

  // بناء خريطة بحث سريعة للمنتجات
  const productLookup = useMemo(() => {
    const map = new Map();
    cachedProducts?.forEach(product => {
      map.set(product.id, product);
    });
    return map;
  }, [cachedProducts]);

  // تحليل الأرباح - حساب مباشر من البيانات المحملة
  const processAnalysis = useCallback(() => {
    try {
      if (!orders?.length) {
        setAnalysisData({
          totalProfit: 0,
          systemProfit: 0,
          totalEmployeeProfit: 0,
          totalOrders: 0,
          totalRevenue: 0,
          totalCost: 0,
          filteredItemsCount: 0,
          averageProfit: 0,
          profitMargin: 0,
          departmentBreakdown: [],
          categoryBreakdown: [],
          topProducts: [],
          colorBreakdown: [],
          sizeBreakdown: [],
          seasonBreakdown: [],
          productTypeBreakdown: []
        });
        return;
      }

      devLog.log('📊 بدء تحليل الأرباح المتقدم:', orders.length, 'طلب');

      // الطلبات جاهزة للتحليل (تم فلترتها مسبقاً في الجلب)
      let filteredOrders = [...orders];

      // تطبيق الفترة الزمنية
      if (filters?.period !== 'all' && dateRange?.from && dateRange?.to) {
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= fromDate && orderDate <= toDate;
        });
      }

      // ⭐ فلتر الموظف - تحليل كل النظام أو موظف معين
      if (filters?.employee && filters.employee !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.created_by === filters.employee);
      }

      let totalRevenue = 0;
      let totalCost = 0;
      let totalSystemProfit = 0;
      let totalEmployeeProfit = 0;
      let filteredItemsCount = 0;

      const departmentBreakdown = {};
      const categoryBreakdown = {};
      const productBreakdown = {};
      const colorBreakdown = {};
      const sizeBreakdown = {};
      const seasonBreakdown = {};
      const productTypeBreakdown = {};

      for (const order of filteredOrders) {
        const items = order.order_items || order.items || [];
        
        for (const item of items) {
          // الحصول على بيانات المنتج من cache
          const product = item.products || productLookup.get(item.product_id);
          const variant = item.product_variants;
          
          if (!product) continue;

          // تطبيق الفلاتر
          let shouldInclude = true;

          if (filters?.product !== 'all' && product.id !== filters.product) {
            shouldInclude = false;
          }

          if (filters?.color !== 'all' && variant?.color_id !== filters.color) {
            shouldInclude = false;
          }

          if (filters?.size !== 'all' && variant?.size_id !== filters.size) {
            shouldInclude = false;
          }

          if (filters?.department !== 'all') {
            const departments = product.product_departments || [];
            const hasMatchingDept = departments.some(d => d.departments?.id === filters.department);
            if (!hasMatchingDept) shouldInclude = false;
          }

          if (filters?.category !== 'all') {
            const categories = product.product_categories || [];
            const hasMatchingCat = categories.some(c => c.categories?.id === filters.category);
            if (!hasMatchingCat) shouldInclude = false;
          }

          if (filters?.productType !== 'all') {
            const productTypes = product.product_product_types || [];
            const hasMatchingType = productTypes.some(t => t.product_types?.id === filters.productType);
            if (!hasMatchingType) shouldInclude = false;
          }

          if (filters?.season !== 'all') {
            const seasons = product.product_seasons_occasions || [];
            const hasMatchingSeason = seasons.some(s => s.seasons_occasions?.id === filters.season);
            if (!hasMatchingSeason) shouldInclude = false;
          }

          if (!shouldInclude) continue;

          filteredItemsCount += (item.quantity || 1);

          // حساب الأرباح
          const profitSplit = calculateProfitSplit(item, order.created_by, cachedProfitRules);
          
          totalRevenue += profitSplit.revenue;
          totalCost += profitSplit.cost;
          totalSystemProfit += profitSplit.systemProfit;
          totalEmployeeProfit += profitSplit.employeeProfit;

          // تجميع البيانات للتفصيلات
          const departments = product.product_departments || [];
          for (const deptRel of departments) {
            const dept = deptRel.departments;
            if (!dept) continue;
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
            departmentBreakdown[dept.id].profit += profitSplit.systemProfit;
            departmentBreakdown[dept.id].revenue += profitSplit.revenue;
            departmentBreakdown[dept.id].cost += profitSplit.cost;
            departmentBreakdown[dept.id].orderCount += 1;
          }

          const categories = product.product_categories || [];
          for (const catRel of categories) {
            const cat = catRel.categories;
            if (!cat) continue;
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
            categoryBreakdown[cat.id].profit += profitSplit.systemProfit;
            categoryBreakdown[cat.id].revenue += profitSplit.revenue;
            categoryBreakdown[cat.id].cost += profitSplit.cost;
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
          productBreakdown[product.id].profit += profitSplit.systemProfit;
          productBreakdown[product.id].revenue += profitSplit.revenue;
          productBreakdown[product.id].cost += profitSplit.cost;
          productBreakdown[product.id].salesCount += (item.quantity || 1);

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
            colorBreakdown[color.id].profit += profitSplit.systemProfit;
            colorBreakdown[color.id].revenue += profitSplit.revenue;
            colorBreakdown[color.id].cost += profitSplit.cost;
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
            sizeBreakdown[size.id].profit += profitSplit.systemProfit;
            sizeBreakdown[size.id].revenue += profitSplit.revenue;
            sizeBreakdown[size.id].cost += profitSplit.cost;
          }

          const seasons = product.product_seasons_occasions || [];
          for (const seasonRel of seasons) {
            const season = seasonRel.seasons_occasions;
            if (!season) continue;
            if (!seasonBreakdown[season.id]) {
              seasonBreakdown[season.id] = {
                id: season.id,
                name: season.name,
                profit: 0,
                revenue: 0,
                cost: 0
              };
            }
            seasonBreakdown[season.id].profit += profitSplit.systemProfit;
            seasonBreakdown[season.id].revenue += profitSplit.revenue;
            seasonBreakdown[season.id].cost += profitSplit.cost;
          }

          const productTypes = product.product_product_types || [];
          for (const typeRel of productTypes) {
            const type = typeRel.product_types;
            if (!type) continue;
            if (!productTypeBreakdown[type.id]) {
              productTypeBreakdown[type.id] = {
                id: type.id,
                name: type.name,
                profit: 0,
                revenue: 0,
                cost: 0
              };
            }
            productTypeBreakdown[type.id].profit += profitSplit.systemProfit;
            productTypeBreakdown[type.id].revenue += profitSplit.revenue;
            productTypeBreakdown[type.id].cost += profitSplit.cost;
          }
        }
      }

      const sortedData = {
        departmentBreakdown: Object.values(departmentBreakdown).sort((a, b) => b.profit - a.profit),
        categoryBreakdown: Object.values(categoryBreakdown).sort((a, b) => b.profit - a.profit),
        topProducts: Object.values(productBreakdown).sort((a, b) => b.profit - a.profit),
        colorBreakdown: Object.values(colorBreakdown).sort((a, b) => b.profit - a.profit),
        sizeBreakdown: Object.values(sizeBreakdown).sort((a, b) => b.profit - a.profit),
        seasonBreakdown: Object.values(seasonBreakdown).sort((a, b) => b.profit - a.profit),
        productTypeBreakdown: Object.values(productTypeBreakdown).sort((a, b) => b.profit - a.profit)
      };

      devLog.log('📊 نتائج تحليل الأرباح (SuperProvider):', {
        totalSystemProfit,
        totalEmployeeProfit,
        totalRevenue,
        totalCost,
        totalOrders: filteredOrders.length,
        filteredItemsCount
      });

      setAnalysisData({
        systemProfit: totalSystemProfit,
        totalProfit: totalSystemProfit,
        totalEmployeeProfit,
        totalOrders: filteredOrders.length,
        totalRevenue,
        totalCost,
        filteredItemsCount,
        totalSoldProducts, // عدد المنتجات المباعة الفعلي
        averageProfit: filteredOrders.length > 0 ? totalSystemProfit / filteredOrders.length : 0,
        profitMargin: totalRevenue > 0 ? (totalSystemProfit / totalRevenue) * 100 : 0,
        ...sortedData
      });

    } catch (err) {
      console.error('Error processing advanced profits analysis:', err);
      setError(err.message);
    }
  }, [orders, cachedProfitRules, productLookup, dateRange, filters, calculateProfitSplit, totalSoldProducts]);

  // تحديث التحليل عند تغيير البيانات أو الفلاتر
  useEffect(() => {
    if (orders?.length > 0) {
      processAnalysis();
    }
  }, [orders, filters, dateRange, processAnalysis]);

  const refreshData = useCallback(() => {
    processAnalysis();
  }, [processAnalysis]);

  return {
    analysisData,
    loading: loading && !analysisData,
    error,
    products: cachedProducts || [],
    departments: cachedDepartments || [],
    categories: cachedCategories || [],
    colors: cachedColors || [],
    sizes: cachedSizes || [],
    productTypes: cachedProductTypes || [],
    seasons: cachedSeasons || [],
    employees,
    refreshData
  };
};
