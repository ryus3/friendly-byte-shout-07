import React, { createContext, useContext, useState, useCallback } from 'react';
import { useStorefrontSettings } from '@/hooks/storefront/useStorefrontSettings';
import { useActivePromotions } from '@/hooks/storefront/useActivePromotions';
import { useShoppingCart } from '@/hooks/storefront/useShoppingCart';
import { useStorefrontAnalytics } from '@/hooks/storefront/useStorefrontAnalytics';

const StorefrontContext = createContext(null);

export const useStorefront = () => {
  const context = useContext(StorefrontContext);
  if (!context) {
    throw new Error('useStorefront must be used within StorefrontProvider');
  }
  return context;
};

export const StorefrontProvider = ({ children, slug }) => {
  const { settings, loading: settingsLoading, error } = useStorefrontSettings(slug);
  const { promotions, calculateDiscountedPrice } = useActivePromotions(settings?.employee_id);
  const cart = useShoppingCart(slug);
  const analytics = useStorefrontAnalytics(settings?.employee_id);

  const [filters, setFilters] = useState({
    category: null,
    department: null,
    minPrice: 0,
    maxPrice: 1000000,
    colors: [],
    sizes: [],
    search: ''
  });

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      category: null,
      department: null,
      minPrice: 0,
      maxPrice: 1000000,
      colors: [],
      sizes: [],
      search: ''
    });
  }, []);

  const value = {
    // Settings
    settings,
    settingsLoading,
    error,
    
    // Promotions
    promotions,
    calculateDiscountedPrice,
    
    // Shopping Cart
    ...cart,
    
    // Analytics
    ...analytics,
    
    // Filters
    filters,
    updateFilters,
    resetFilters
  };

  return (
    <StorefrontContext.Provider value={value}>
      {children}
    </StorefrontContext.Provider>
  );
};
