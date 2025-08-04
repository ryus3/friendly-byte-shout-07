/**
 * 🎣 Hook موحد لإدارة البيانات
 * 
 * يستبدل جميع الـ useState و useEffect المكررة
 * - تحميل تلقائي للبيانات
 * - real-time updates
 * - error handling
 * - loading states
 * - كاش ذكي
 */

import { useState, useEffect, useCallback } from 'react';
import { useAPI } from '../api';

export const useData = (table, options = {}) => {
  const {
    filters = {},
    select = '*',
    autoLoad = true,
    realtime = false,
    dependencies = []
  } = options;

  const api = useAPI();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // تحميل البيانات
  const loadData = useCallback(async () => {
    if (loading) return; // منع التحميل المتعدد

    setLoading(true);
    setError(null);

    try {
      const result = await api.get(table, { filters, select });
      setData(result || []);
    } catch (err) {
      setError(err);
      console.error(`خطأ في تحميل بيانات ${table}:`, err);
    } finally {
      setLoading(false);
    }
  }, [table, JSON.stringify(filters), select, api]);

  // تحميل تلقائي عند التركيب
  useEffect(() => {
    if (autoLoad) {
      loadData();
    }
  }, [autoLoad, loadData, ...dependencies]);

  // اشتراك real-time
  useEffect(() => {
    if (!realtime) return;

    const unsubscribe = api.subscribe(table, ({ event, data: changeData }) => {
      setData(currentData => {
        switch (event) {
          case 'INSERT':
            return [...currentData, changeData];
          
          case 'UPDATE':
            return currentData.map(item => 
              item.id === changeData.id ? { ...item, ...changeData } : item
            );
          
          case 'DELETE':
            return currentData.filter(item => item.id !== changeData.id);
          
          default:
            return currentData;
        }
      });
    });

    return unsubscribe;
  }, [realtime, table, api]);

  // العمليات الأساسية
  const create = useCallback(async (newData) => {
    try {
      const result = await api.create(table, newData);
      if (!realtime) {
        setData(current => [...current, result]);
      }
      return result;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [table, api, realtime]);

  const update = useCallback(async (id, updateData) => {
    try {
      const result = await api.update(table, id, updateData);
      if (!realtime) {
        setData(current => 
          current.map(item => 
            item.id === id ? { ...item, ...result } : item
          )
        );
      }
      return result;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [table, api, realtime]);

  const remove = useCallback(async (id) => {
    try {
      await api.remove(table, id);
      if (!realtime) {
        setData(current => current.filter(item => item.id !== id));
      }
      return true;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [table, api, realtime]);

  return {
    data,
    loading,
    error,
    loadData,
    create,
    update,
    remove,
    refresh: loadData
  };
};

// Hooks متخصصة للجداول الأساسية
export const useProducts = (filters = {}) => {
  return useData('products', {
    filters,
    select: `
      *,
      product_variants (
        id, color_id, size_id, cost_price, selling_price, barcode,
        colors (name, hex_code),
        sizes (name)
      )
    `,
    realtime: true
  });
};

export const useOrders = (filters = {}) => {
  return useData('orders', {
    filters,
    select: `
      *,
      order_items (
        id, product_id, variant_id, quantity, unit_price,
        products (name),
        product_variants (
          colors (name),
          sizes (name)
        )
      )
    `,
    realtime: true
  });
};

export const useUsers = (filters = {}) => {
  return useData('profiles', {
    filters,
    select: `
      *,
      user_roles (
        role_id,
        roles (name, display_name)
      )
    `,
    realtime: true
  });
};

export const useExpenses = (filters = {}) => {
  return useData('expenses', {
    filters,
    realtime: true
  });
};

export const useInventory = (filters = {}) => {
  return useData('inventory', {
    filters,
    select: `
      *,
      products (name),
      product_variants (
        colors (name),
        sizes (name)
      )
    `,
    realtime: true
  });
};