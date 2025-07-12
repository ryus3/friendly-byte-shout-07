// نظام تخزين محلي للبيانات
export const localStorageKeys = {
  USER: 'ryus_user',
  PRODUCTS: 'ryus_products',
  ORDERS: 'ryus_orders',
  INVENTORY: 'ryus_inventory',
  SETTINGS: 'ryus_settings'
};

export const getFromStorage = (key) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
};

export const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    return false;
  }
};

export const removeFromStorage = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error removing from localStorage:', error);
    return false;
  }
};

// بيانات المستخدم الافتراضية
export const defaultUser = {
  id: 'admin',
  username: 'admin',
  email: 'admin@ryus.com',
  fullName: 'مدير النظام',
  role: 'admin',
  permissions: ['all'],
  status: 'active',
  defaultPage: '/',
  created_at: new Date().toISOString()
};

// إعدادات النظام الافتراضية
export const defaultSettings = {
  id: 1,
  shop_name: 'RYUS',
  currency: 'IQD',
  tax_rate: 0,
  low_stock_threshold: 10,
  created_at: new Date().toISOString()
};

// تهيئة البيانات الافتراضية
export const initializeDefaultData = () => {
  if (!getFromStorage(localStorageKeys.USER)) {
    saveToStorage(localStorageKeys.USER, defaultUser);
  }
  
  if (!getFromStorage(localStorageKeys.SETTINGS)) {
    saveToStorage(localStorageKeys.SETTINGS, defaultSettings);
  }
  
  if (!getFromStorage(localStorageKeys.PRODUCTS)) {
    saveToStorage(localStorageKeys.PRODUCTS, []);
  }
  
  if (!getFromStorage(localStorageKeys.ORDERS)) {
    saveToStorage(localStorageKeys.ORDERS, []);
  }
  
  if (!getFromStorage(localStorageKeys.INVENTORY)) {
    saveToStorage(localStorageKeys.INVENTORY, []);
  }
};