import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFromStorage, saveToStorage, localStorageKeys } from '@/lib/localStorage';

const InventoryContext = createContext();

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

export const InventoryProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setProducts(getFromStorage(localStorageKeys.PRODUCTS) || []);
    setOrders(getFromStorage(localStorageKeys.ORDERS) || []);
    setPurchases(getFromStorage('ryus_purchases') || []);
    setSettings(getFromStorage(localStorageKeys.SETTINGS));
    setLoading(false);
  };

  const saveData = (type, data) => {
    const key = localStorageKeys[type.toUpperCase()] || `ryus_${type}`;
    saveToStorage(key, data);
  };

  const addProduct = (product) => {
    const newProduct = {
      ...product,
      id: Date.now().toString(),
      created_at: new Date().toISOString()
    };
    const updatedProducts = [...products, newProduct];
    setProducts(updatedProducts);
    saveData('products', updatedProducts);
  };

  const updateProduct = (id, updates) => {
    const updatedProducts = products.map(p => 
      p.id === id ? { ...p, ...updates } : p
    );
    setProducts(updatedProducts);
    saveData('products', updatedProducts);
  };

  const deleteProduct = (id) => {
    const updatedProducts = products.filter(p => p.id !== id);
    setProducts(updatedProducts);
    saveData('products', updatedProducts);
  };

  const addOrder = (order) => {
    const newOrder = {
      ...order,
      id: Date.now().toString(),
      created_at: new Date().toISOString()
    };
    const updatedOrders = [...orders, newOrder];
    setOrders(updatedOrders);
    saveData('orders', updatedOrders);
  };

  const value = {
    products,
    orders,
    purchases,
    settings,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    addOrder,
    refreshData: loadData,
    // دوال فارغة للتوافق
    addExpense: () => {},
    updateOrder: () => {},
    deleteOrder: () => {},
    addPurchase: () => {},
    updatePurchase: () => {},
    deletePurchase: () => {}
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};