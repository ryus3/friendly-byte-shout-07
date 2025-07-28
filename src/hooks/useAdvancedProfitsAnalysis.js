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

  // تحليل الأرباح الرئيسي
  const fetchAdvancedAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      // جلب الأرباح مباشرة من جدول profits للطلبات المكتملة والمستلمة
      let profitsQuery = supabase
        .from('profits')
        .select(`
          id,
          profit_amount,
          employee_profit,
          order_id,
          created_at,
          orders!inner (
            id,
            created_at,
            status,
            receipt_received,
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
                color_id,
                size_id,
                colors (id, name, hex_code),
                sizes (id, name)
              )
            )
          )
        `)
        .eq('orders.receipt_received', true) // فقط الطلبات المستلمة
        .gte('orders.created_at', dateRange.from?.toISOString())
        .lte('orders.created_at', dateRange.to?.toISOString());

      const { data: profits, error: profitsError } = await profitsQuery;
      
      if (profitsError) throw profitsError;

      // معالجة البيانات وحساب الأرباح
      let totalProfit = 0;
      let totalOrders = 0;
      let processedOrders = new Set();

      const departmentBreakdown = {};
      const categoryBreakdown = {};
      const productBreakdown = {};
      const colorBreakdown = {};
      const sizeBreakdown = {};
      const seasonBreakdown = {};
      const productTypeBreakdown = {};

      for (const profit of profits || []) {
        const order = profit.orders;
        if (!order || !order.order_items) continue;

        // تسجيل الطلب المعالج
        if (!processedOrders.has(order.id)) {
          processedOrders.add(order.id);
          totalOrders += 1;
        }

        for (const item of order.order_items) {
          const product = item.products;
          const variant = item.product_variants;
          
          // تطبيق الفلاتر
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

          // حساب الربح من جدول الأرباح (ربح النظام + ربح الموظف = الربح الإجمالي)
          const itemProfit = (profit.profit_amount || 0) + (profit.employee_profit || 0);
          const itemRevenue = item.unit_price * item.quantity;
          
          totalProfit += itemProfit;

          // تجميع البيانات حسب الأقسام
          const departments = product?.product_departments || [];
          for (const deptRel of departments) {
            const dept = deptRel.departments;
            if (!departmentBreakdown[dept.id]) {
              departmentBreakdown[dept.id] = {
                id: dept.id,
                name: dept.name,
                color: dept.color,
                profit: 0,
                orderCount: 0
              };
            }
            departmentBreakdown[dept.id].profit += itemProfit;
            departmentBreakdown[dept.id].orderCount += 1;
          }

          // تجميع البيانات حسب التصنيفات
          const categories = product?.product_categories || [];
          for (const catRel of categories) {
            const cat = catRel.categories;
            if (!categoryBreakdown[cat.id]) {
              categoryBreakdown[cat.id] = {
                id: cat.id,
                name: cat.name,
                profit: 0,
                orderCount: 0
              };
            }
            categoryBreakdown[cat.id].profit += itemProfit;
            categoryBreakdown[cat.id].orderCount += 1;
          }

          // تجميع البيانات حسب المنتجات
          if (!productBreakdown[product.id]) {
            productBreakdown[product.id] = {
              id: product.id,
              name: product.name,
              profit: 0,
              salesCount: 0
            };
          }
          productBreakdown[product.id].profit += itemProfit;
          productBreakdown[product.id].salesCount += item.quantity;

          // تجميع البيانات حسب الألوان
          if (variant?.colors) {
            const color = variant.colors;
            if (!colorBreakdown[color.id]) {
              colorBreakdown[color.id] = {
                id: color.id,
                name: color.name,
                hex_code: color.hex_code,
                profit: 0
              };
            }
            colorBreakdown[color.id].profit += itemProfit;
          }

          // تجميع البيانات حسب القياسات
          if (variant?.sizes) {
            const size = variant.sizes;
            if (!sizeBreakdown[size.id]) {
              sizeBreakdown[size.id] = {
                id: size.id,
                name: size.name,
                profit: 0
              };
            }
            sizeBreakdown[size.id].profit += itemProfit;
          }

          // تجميع البيانات حسب المواسم
          const seasons = product?.product_seasons_occasions || [];
          for (const seasonRel of seasons) {
            const season = seasonRel.seasons_occasions;
            if (!seasonBreakdown[season.id]) {
              seasonBreakdown[season.id] = {
                id: season.id,
                name: season.name,
                profit: 0
              };
            }
            seasonBreakdown[season.id].profit += itemProfit;
          }

          // تجميع البيانات حسب أنواع المنتجات
          const productTypes = product?.product_product_types || [];
          for (const typeRel of productTypes) {
            const type = typeRel.product_types;
            if (!productTypeBreakdown[type.id]) {
              productTypeBreakdown[type.id] = {
                id: type.id,
                name: type.name,
                profit: 0
              };
            }
            productTypeBreakdown[type.id].profit += itemProfit;
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

      setAnalysisData({
        totalProfit,
        totalOrders,
        totalRevenue: totalProfit, // استخدام الربح كمرجع للإيراد
        totalCost: 0,
        averageProfit: totalOrders > 0 ? totalProfit / totalOrders : 0,
        profitMargin: totalProfit > 0 ? 100 : 0,
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