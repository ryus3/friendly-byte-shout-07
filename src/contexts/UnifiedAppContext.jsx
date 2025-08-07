/**
 * ========================================
 * Context موحد ثوري - استبدال كل الـ 15 contexts
 * إدارة حالة واحدة، أداء خارق، بساطة مطلقة
 * ========================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/core/api';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/hooks/use-toast';

const UnifiedAppContext = createContext();

export const useApp = () => {
  const context = useContext(UnifiedAppContext);
  if (!context) {
    throw new Error('useApp must be used within UnifiedAppProvider');
  }
  return context;
};

export const UnifiedAppProvider = ({ children }) => {
  const { user } = useAuth();
  const { hasPermission, filterDataByUser } = usePermissions();
  const { hasPermission, filterDataByUser } = usePermissions();

  // ===== الحالة الموحدة =====
  const [state, setState] = useState({
    // البيانات
    products: [],
    orders: [],
    customers: [],
    financialData: {},
    
    // حالة التحميل
    loading: {
      products: false,
      orders: false,
      customers: false,
      financial: false
    },
    
    // الأخطاء
    errors: {},
    
    // الفلاتر والبحث
    filters: {
      products: {},
      orders: {},
      customers: {}
    },
    
    // واجهة المستخدم
    ui: {
      selectedItems: [],
      openDialogs: new Set(),
      notifications: []
    }
  });

  // ===== وظائف مساعدة للحالة =====
  const updateState = useCallback((updates) => {
    setState(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  const updateNestedState = useCallback((path, value) => {
    setState(prev => {
      const newState = { ...prev };
      const keys = path.split('.');
      let current = newState;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newState;
    });
  }, []);

  // ===== تحميل البيانات =====
  const loadProducts = useCallback(async (filters = {}) => {
    updateNestedState('loading.products', true);
    updateNestedState('errors.products', null);
    
    try {
      const products = await api.getProducts(filters);
      
      // فلترة حسب الصلاحيات
      const filteredProducts = hasPermission('view_all_products') 
        ? products 
        : filterDataByUser(products, 'created_by');
      
      updateState({
        products: filteredProducts,
        'filters.products': filters
      });
      
    } catch (error) {
      updateNestedState('errors.products', error.message);
      toast({
        title: 'خطأ في تحميل المنتجات',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      updateNestedState('loading.products', false);
    }
  }, [api, hasPermission, filterDataByUser, updateState, updateNestedState]);

  const loadOrders = useCallback(async (filters = {}) => {
    updateNestedState('loading.orders', true);
    updateNestedState('errors.orders', null);
    
    try {
      const orders = await api.getOrders(filters);
      
      // فلترة حسب الصلاحيات
      const filteredOrders = hasPermission('view_all_orders') 
        ? orders 
        : filterDataByUser(orders, 'created_by');
      
      updateState({
        orders: filteredOrders,
        'filters.orders': filters
      });
      
    } catch (error) {
      updateNestedState('errors.orders', error.message);
      toast({
        title: 'خطأ في تحميل الطلبات',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      updateNestedState('loading.orders', false);
    }
  }, [api, hasPermission, filterDataByUser, updateState, updateNestedState]);

  const loadCustomers = useCallback(async (filters = {}) => {
    updateNestedState('loading.customers', true);
    updateNestedState('errors.customers', null);
    
    try {
      const customers = await api.getCustomers(filters);
      
      // فلترة حسب الصلاحيات
      const filteredCustomers = hasPermission('view_all_customers') 
        ? customers 
        : filterDataByUser(customers, 'created_by');
      
      updateState({
        customers: filteredCustomers,
        'filters.customers': filters
      });
      
    } catch (error) {
      updateNestedState('errors.customers', error.message);
      toast({
        title: 'خطأ في تحميل العملاء',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      updateNestedState('loading.customers', false);
    }
  }, [api, hasPermission, filterDataByUser, updateState, updateNestedState]);

  const loadFinancialData = useCallback(async (period = 'all') => {
    updateNestedState('loading.financial', true);
    updateNestedState('errors.financial', null);
    
    try {
      const financialData = await api.getFinancialData(period);
      updateState({ financialData });
      
    } catch (error) {
      updateNestedState('errors.financial', error.message);
      toast({
        title: 'خطأ في تحميل البيانات المالية',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      updateNestedState('loading.financial', false);
    }
  }, [api, updateState, updateNestedState]);

  // ===== العمليات =====
  const createOrder = useCallback(async (orderData) => {
    try {
      const newOrder = await api.createOrder(orderData);
      
      // إعادة تحميل الطلبات والمنتجات (للمخزون)
      await Promise.all([
        loadOrders(state.filters.orders),
        loadProducts(state.filters.products)
      ]);
      
      toast({
        title: 'تم إنشاء الطلب بنجاح',
        description: `رقم الطلب: ${newOrder.order_number}`
      });
      
      return newOrder;
      
    } catch (error) {
      toast({
        title: 'خطأ في إنشاء الطلب',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [api, loadOrders, loadProducts, state.filters]);

  // ===== البيانات المحسوبة =====
  const computedData = useMemo(() => {
    // إحصائيات سريعة
    const totalProducts = state.products.length;
    const lowStockProducts = state.products.filter(p => p.available_stock <= 5).length;
    const pendingOrders = state.orders.filter(o => o.status === 'pending').length;
    const todayOrders = state.orders.filter(o => {
      const orderDate = new Date(o.created_at).toDateString();
      const today = new Date().toDateString();
      return orderDate === today;
    }).length;

    return {
      stats: {
        totalProducts,
        lowStockProducts,
        pendingOrders,
        todayOrders,
        totalCustomers: state.customers.length,
        totalRevenue: state.financialData.revenue?.total || 0
      },
      
      // بيانات مفلترة للعرض السريع
      recentOrders: state.orders.slice(0, 10),
      lowStockItems: state.products.filter(p => p.available_stock <= 5).slice(0, 5),
      topCustomers: state.customers
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 5)
    };
  }, [state.products, state.orders, state.customers, state.financialData]);

  // ===== واجهة المستخدم =====
  const ui = useMemo(() => ({
    openDialog: (dialogName) => {
      updateNestedState('ui.openDialogs', new Set([...state.ui.openDialogs, dialogName]));
    },
    
    closeDialog: (dialogName) => {
      const newDialogs = new Set(state.ui.openDialogs);
      newDialogs.delete(dialogName);
      updateNestedState('ui.openDialogs', newDialogs);
    },
    
    toggleSelection: (itemId) => {
      const currentSelection = state.ui.selectedItems;
      const newSelection = currentSelection.includes(itemId)
        ? currentSelection.filter(id => id !== itemId)
        : [...currentSelection, itemId];
      updateNestedState('ui.selectedItems', newSelection);
    },
    
    clearSelection: () => {
      updateNestedState('ui.selectedItems', []);
    },
    
    isDialogOpen: (dialogName) => state.ui.openDialogs.has(dialogName),
    isSelected: (itemId) => state.ui.selectedItems.includes(itemId)
  }), [state.ui, updateNestedState]);

  // ===== التحميل الأولي =====
  useEffect(() => {
    if (user) {
      // تحميل البيانات الأساسية
      Promise.all([
        loadProducts(),
        loadOrders(),
        loadCustomers(),
        loadFinancialData()
      ]).catch(console.error);
    }
  }, [user, loadProducts, loadOrders, loadCustomers, loadFinancialData]);

  // ===== قيمة Context =====
  const contextValue = {
    // البيانات
    ...state,
    computedData,
    
    // وظائف التحميل
    loadProducts,
    loadOrders,
    loadCustomers,
    loadFinancialData,
    
    // العمليات
    createOrder,
    
    // واجهة المستخدم
    ui,
    
    // مساعدة
    updateState,
    updateNestedState,
    refreshAll: () => {
      Promise.all([
        loadProducts(state.filters.products),
        loadOrders(state.filters.orders),
        loadCustomers(state.filters.customers),
        loadFinancialData()
      ]);
    }
  };

  return (
    <UnifiedAppContext.Provider value={contextValue}>
      {children}
    </UnifiedAppContext.Provider>
  );
};

export default UnifiedAppProvider;