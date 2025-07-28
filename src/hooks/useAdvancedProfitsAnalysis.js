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

      // بناء الاستعلام الأساسي
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_amount,
          discount,
          final_amount,
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
        .eq('receipt_received', true) // فقط الطلبات التي تم استلام فواتيرها
        .gte('created_at', dateRange.from?.toISOString())
        .lte('created_at', dateRange.to?.toISOString());

      const { data: orders, error: ordersError } = await ordersQuery;
      
      if (ordersError) throw ordersError;

      // جلب تاريخ المشتريات لحساب التكلفة الفعلية
      const { data: purchaseHistory, error: purchaseError } = await supabase
        .from('purchase_items')
        .select(`
          product_id,
          variant_id,
          quantity,
          unit_cost,
          created_at,
          purchases (created_at)
        `)
        .order('created_at', { ascending: true });

      if (purchaseError) throw purchaseError;

      // معالجة البيانات وحساب الأرباح الفعلية
      let totalProfit = 0;
      let totalOrders = orders?.length || 0;
      let totalRevenue = 0;
      let totalCost = 0;

      const departmentBreakdown = {};
      const categoryBreakdown = {};
      const productBreakdown = {};
      const colorBreakdown = {};
      const sizeBreakdown = {};
      const seasonBreakdown = {};
      const productTypeBreakdown = {};

      for (const order of orders || []) {
        for (const item of order.order_items || []) {
          // حساب الربح الفعلي
          const analysisItem = await calculateRealProfit({
            ...item,
            order_date: order.created_at,
            variant_cost_price: item.product_variants?.cost_price,
            product_cost_price: item.products?.cost_price
          }, purchaseHistory);

          totalProfit += analysisItem.profit;
          totalRevenue += analysisItem.revenue;
          totalCost += (analysisItem.actualCost * analysisItem.quantity);

          // تطبيق الفلاتر
          const product = item.products;
          const variant = item.product_variants;
          
          // فلترة حسب المعايير المختارة
          if (filters.product !== 'all' && product?.id !== filters.product) continue;
          if (filters.color !== 'all' && variant?.color_id !== filters.color) continue;
          if (filters.size !== 'all' && variant?.size_id !== filters.size) continue;

          // تجميع البيانات حسب الأقسام
          const departments = product?.product_departments || [];
          for (const deptRel of departments) {
            const dept = deptRel.departments;
            if (filters.department === 'all' || dept.id === filters.department) {
              if (!departmentBreakdown[dept.id]) {
                departmentBreakdown[dept.id] = {
                  id: dept.id,
                  name: dept.name,
                  color: dept.color,
                  profit: 0,
                  orderCount: 0
                };
              }
              departmentBreakdown[dept.id].profit += analysisItem.profit;
              departmentBreakdown[dept.id].orderCount += 1;
            }
          }

          // تجميع البيانات حسب التصنيفات
          const categories = product?.product_categories || [];
          for (const catRel of categories) {
            const cat = catRel.categories;
            if (filters.category === 'all' || cat.id === filters.category) {
              if (!categoryBreakdown[cat.id]) {
                categoryBreakdown[cat.id] = {
                  id: cat.id,
                  name: cat.name,
                  profit: 0,
                  orderCount: 0
                };
              }
              categoryBreakdown[cat.id].profit += analysisItem.profit;
              categoryBreakdown[cat.id].orderCount += 1;
            }
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
          productBreakdown[product.id].profit += analysisItem.profit;
          productBreakdown[product.id].salesCount += analysisItem.quantity;

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
            colorBreakdown[color.id].profit += analysisItem.profit;
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
            sizeBreakdown[size.id].profit += analysisItem.profit;
          }

          // تجميع البيانات حسب المواسم
          const seasons = product?.product_seasons_occasions || [];
          for (const seasonRel of seasons) {
            const season = seasonRel.seasons_occasions;
            if (filters.season === 'all' || season.id === filters.season) {
              if (!seasonBreakdown[season.id]) {
                seasonBreakdown[season.id] = {
                  id: season.id,
                  name: season.name,
                  profit: 0
                };
              }
              seasonBreakdown[season.id].profit += analysisItem.profit;
            }
          }

          // تجميع البيانات حسب أنواع المنتجات
          const productTypes = product?.product_product_types || [];
          for (const typeRel of productTypes) {
            const type = typeRel.product_types;
            if (filters.productType === 'all' || type.id === filters.productType) {
              if (!productTypeBreakdown[type.id]) {
                productTypeBreakdown[type.id] = {
                  id: type.id,
                  name: type.name,
                  profit: 0
                };
              }
              productTypeBreakdown[type.id].profit += analysisItem.profit;
            }
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
        totalRevenue,
        totalCost,
        averageProfit: totalOrders > 0 ? totalProfit / totalOrders : 0,
        profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
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