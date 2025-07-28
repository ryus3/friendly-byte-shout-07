import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

import { useEnhancedFinancialData } from './useEnhancedFinancialData';

/**
 * هوك تحليل الأرباح المتقدم
 * يستخدم النظام المالي الموحد بدلاً من إعادة الحساب
 */
export const useAdvancedProfitsAnalysis = (dateRange, filters) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  
  // استخدام النظام المالي الموحد
  const { financialData: systemFinancialData, loading: systemLoading, refreshData: refreshSystemData } = useEnhancedFinancialData();
  
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

  // تحليل الأرباح - يستخدم النظام المالي الموحد
  const fetchAdvancedAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      // استخدام البيانات المالية من النظام الموحد
      if (!systemFinancialData || systemLoading) {
        console.log('انتظار البيانات المالية من النظام الموحد...');
        return;
      }

      console.log('📊 استخدام البيانات المالية الموحدة:', systemFinancialData);

      // جلب الطلبات فقط للتفصيل والفلترة
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
        .eq('receipt_received', true)
        .gte('created_at', dateRange.from?.toISOString())
        .lte('created_at', dateRange.to?.toISOString());

      const { data: orders, error: ordersError } = await ordersQuery;
      
      if (ordersError) throw ordersError;

      // معالجة البيانات للتفصيلات والفلترة فقط
      let filteredRevenue = 0;
      let filteredCost = 0;
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

          const itemRevenue = item.unit_price * item.quantity;
          const itemCost = (variant?.cost_price || product?.cost_price || 0) * item.quantity;
          const itemProfit = itemRevenue - itemCost;
          
          filteredRevenue += itemRevenue;
          filteredCost += itemCost;

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
            departmentBreakdown[dept.id].profit += itemProfit;
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
            categoryBreakdown[cat.id].profit += itemProfit;
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
          productBreakdown[product.id].profit += itemProfit;
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
            colorBreakdown[color.id].profit += itemProfit;
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
            sizeBreakdown[size.id].profit += itemProfit;
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
            seasonBreakdown[season.id].profit += itemProfit;
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
            productTypeBreakdown[type.id].profit += itemProfit;
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

      // استخدام البيانات من النظام المالي الموحد
      const isAllFiltersDefault = (filters.department === 'all' && 
                                 filters.category === 'all' && 
                                 filters.product === 'all' && 
                                 filters.color === 'all' && 
                                 filters.size === 'all' && 
                                 filters.season === 'all' && 
                                 filters.productType === 'all');

      // إذا لم يتم تطبيق فلاتر، استخدم البيانات من النظام الموحد
      const finalTotalProfit = isAllFiltersDefault ? systemFinancialData.netProfit : (filteredRevenue - filteredCost);
      const finalTotalRevenue = isAllFiltersDefault ? systemFinancialData.totalRevenue : filteredRevenue;
      const finalTotalCost = isAllFiltersDefault ? systemFinancialData.totalCogs : filteredCost;

      setAnalysisData({
        totalProfit: finalTotalProfit,
        totalOrders,
        totalRevenue: finalTotalRevenue,
        totalCost: finalTotalCost,
        filteredItemsCount,
        averageProfit: totalOrders > 0 ? finalTotalProfit / totalOrders : 0,
        profitMargin: finalTotalRevenue > 0 ? (finalTotalProfit / finalTotalRevenue) * 100 : 0,
        // معلومات مرجعية من النظام المالي الموحد
        systemTotalProfit: systemFinancialData.grossProfit || 0,
        ...sortedData
      });

    } catch (err) {
      console.error('Error fetching advanced profits analysis:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // تحديث البيانات عند تغيير الفلاتر أو عند توفر البيانات المالية
  useEffect(() => {
    if (dateRange?.from && dateRange?.to && systemFinancialData && !systemLoading) {
      fetchAdvancedAnalysis();
    }
  }, [dateRange, filters, systemFinancialData, systemLoading]);

  // جلب خيارات الفلاتر عند التحميل
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const refreshData = () => {
    fetchAdvancedAnalysis();
  };

  return {
    analysisData,
    loading: loading || systemLoading,
    error,
    departments,
    categories,
    productTypes,
    seasons,
    colors,
    sizes,
    products,
    refreshData: () => {
      fetchAdvancedAnalysis();
      refreshSystemData();
    }
  };
};