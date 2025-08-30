import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { toast } from '@/hooks/use-toast';

// Generic hook for data operations
export const useSupabaseData = (entityName, dependencies = []) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { db } = useSupabase();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await db[entityName].getAll();
      setData(result);
    } catch (err) {
      setError(err.message);
      toast({
        title: 'خطأ في تحميل البيانات',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [db, entityName, ...dependencies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const create = useCallback(async (newItem) => {
    try {
      const result = await db[entityName].create(newItem);
      setData(prev => [result, ...prev]);
      toast({
        title: 'تم الحفظ بنجاح',
        description: 'تم إضافة العنصر الجديد بنجاح'
      });
      return result;
    } catch (err) {
      toast({
        title: 'خطأ في الحفظ',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  }, [db, entityName]);

  const update = useCallback(async (id, updates) => {
    try {
      const result = await db[entityName].update(id, updates);
      setData(prev => prev.map(item => item.id === id ? result : item));
      toast({
        title: 'تم التحديث بنجاح',
        description: 'تم تحديث العنصر بنجاح'
      });
      return result;
    } catch (err) {
      toast({
        title: 'خطأ في التحديث',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  }, [db, entityName]);

  const remove = useCallback(async (id) => {
    try {
      await db[entityName].delete(id);
      setData(prev => prev.filter(item => item.id !== id));
      toast({
        title: 'تم الحذف بنجاح',
        description: 'تم حذف العنصر بنجاح'
      });
    } catch (err) {
      toast({
        title: 'خطأ في الحذف',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  }, [db, entityName]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    create,
    update,
    remove
  };
};

// Specific hooks for each entity
export const useCategories = () => useSupabaseData('categories');
export const useColors = () => useSupabaseData('colors');
export const useSizes = () => useSupabaseData('sizes');
export const useProducts = () => useSupabaseData('products');
export const useCustomers = () => useSupabaseData('customers');
export const useSupabaseOrders = () => useSupabaseData('orders');
export const usePurchases = () => useSupabaseData('purchases');

// Hook for inventory with special operations
export const useInventory = () => {
  const baseHook = useSupabaseData('inventory');
  const { db } = useSupabase();

  const updateStock = useCallback(async (productId, variantId, quantity) => {
    try {
      const result = await db.inventory.updateStock(productId, variantId, quantity);
      baseHook.refetch();
      toast({
        title: 'تم تحديث المخزون',
        description: 'تم تحديث كمية المخزون بنجاح'
      });
      return result;
    } catch (err) {
      toast({
        title: 'خطأ في تحديث المخزون',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  }, [db, baseHook]);

  return {
    ...baseHook,
    updateStock
  };
};

// Hook for profits with special operations
export const useProfits = (employeeId) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { db } = useSupabase();

  const fetchProfits = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const result = await db.profits.getByEmployee(employeeId);
      setData(result);
    } catch (err) {
      toast({
        title: 'خطأ في تحميل الأرباح',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [db, employeeId]);

  useEffect(() => {
    fetchProfits();
  }, [fetchProfits]);

  const calculateForOrder = useCallback(async (orderId) => {
    try {
      await db.profits.calculateForOrder(orderId);
      fetchProfits();
      toast({
        title: 'تم حساب الربح',
        description: 'تم حساب ربح الطلبية بنجاح'
      });
    } catch (err) {
      toast({
        title: 'خطأ في حساب الربح',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  }, [db, fetchProfits]);

  return {
    data,
    loading,
    refetch: fetchProfits,
    calculateForOrder
  };
};

// Hook for notifications
export const useNotifications = (userId) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { db } = useSupabase();

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const result = await db.notifications.getForUser(userId);
      setData(result);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [db, userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id) => {
    try {
      await db.notifications.markAsRead(id);
      setData(prev => prev.map(notif => 
        notif.id === id ? { ...notif, is_read: true } : notif
      ));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [db]);

  const createNotification = useCallback(async (notification) => {
    try {
      const result = await db.notifications.create(notification);
      setData(prev => [result, ...prev]);
      return result;
    } catch (err) {
      console.error('Error creating notification:', err);
      throw err;
    }
  }, [db]);

  return {
    data,
    loading,
    refetch: fetchNotifications,
    markAsRead,
    createNotification
  };
};