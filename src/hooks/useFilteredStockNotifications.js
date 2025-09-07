import { useMemo } from 'react';
import { useFilteredProducts } from './useFilteredProducts';

/**
 * Hook لفلترة منتجات تنبيهات المخزون حسب صلاحيات المستخدم
 */
export const useFilteredStockNotifications = (products) => {
  // استخدام hook المنتجات المفلترة الموجود
  const filteredProducts = useFilteredProducts(products);
  
  // إرجاع المنتجات المفلترة مع معلومات إضافية خاصة بتنبيهات المخزون
  const filteredStockProducts = useMemo(() => {
    if (!filteredProducts || !Array.isArray(filteredProducts)) {
      return [];
    }
    
    return filteredProducts.map(product => ({
      ...product,
      // حساب مستوى المخزون الكلي للمنتج
      totalStock: product.variants?.reduce((total, variant) => 
        total + (variant.inventory?.quantity || 0), 0) || 0,
      
      // التحقق من وجود منتجات منخفضة المخزون
      hasLowStock: product.variants?.some(variant => 
        (variant.inventory?.quantity || 0) <= (variant.inventory?.low_stock_threshold || 10)) || false,
      
      // التحقق من وجود منتجات نفدت من المخزون
      hasOutOfStock: product.variants?.some(variant => 
        (variant.inventory?.quantity || 0) === 0) || false
    }));
  }, [filteredProducts]);
  
  return filteredStockProducts;
};