import React, { useState, useEffect, useCallback } from 'react';
import { useSuper } from '@/contexts/InventoryContext'; // النظام الموحد
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/hooks/use-toast';

export const useProductsDB = () => {
  // استخدام البيانات من النظام الموحد
  const { 
    products: unifiedProducts, 
    loading: unifiedLoading, 
    addProduct: superAddProduct, 
    updateProduct: superUpdateProduct, 
    deleteProduct: superDeleteProduct, 
    updateVariantStock: superUpdateStock 
  } = useSuper();
  const { user } = useAuth();
  
  // استخدام البيانات الموحدة
  const products = unifiedProducts || [];
  const loading = unifiedLoading;

  // لا حاجة لـ fetchProducts - البيانات تأتي من النظام الموحد
  const fetchProducts = useCallback(() => {
    // النظام الموحد يتولى تحديث البيانات تلقائياً عبر real-time
    console.log('fetchProducts: البيانات محدثة تلقائياً من النظام الموحد');
  }, []);

  const addProduct = useCallback(async (productData, imageFiles = { general: [], colorImages: {} }, setUploadProgress) => {
    try {
      // استخدام النظام الموحد لإضافة المنتج
      const result = await superAddProduct(productData, imageFiles, setUploadProgress);
      
      if (result.success) {
        toast({
          title: 'تم إضافة المنتج بنجاح',
          description: `تم إضافة ${productData.name} إلى قاعدة البيانات`
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: 'خطأ في إضافة المنتج',
        description: error.message,
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    }
  }, [superAddProduct]);

  const updateProduct = useCallback(async (productId, productData, imageFiles = { general: [], colorImages: {} }, setUploadProgress) => {
    try {
      // استخدام النظام الموحد لتحديث المنتج
      const result = await superUpdateProduct(productId, productData, imageFiles, setUploadProgress);
      
      if (result.success) {
        toast({
          title: 'تم تحديث المنتج بنجاح',
          description: `تم تحديث ${productData.name}`
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: 'خطأ في تحديث المنتج',
        description: error.message,
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    }
  }, [superUpdateProduct]);

  const deleteProduct = useCallback(async (productId) => {
    try {
      // استخدام النظام الموحد لحذف المنتج
      const result = await superDeleteProduct(productId);
      
      if (result.success) {
        toast({
          title: 'تم حذف المنتج',
          description: 'تم حذف المنتج بنجاح'
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'خطأ في حذف المنتج',
        description: error.message,
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    }
  }, [superDeleteProduct]);

  const updateVariantStock = useCallback(async (productId, variantId, newQuantity) => {
    try {
      // استخدام النظام الموحد لتحديث المخزون
      const result = await superUpdateStock(productId, variantId, newQuantity);
      
      if (result.success) {
        toast({
          title: 'تم تحديث المخزون',
          description: 'تم تحديث المخزون بنجاح'
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error updating variant stock:', error);
      toast({
        title: 'خطأ في تحديث المخزون',
        description: error.message,
        variant: 'destructive'
      });
      return { success: false };
    }
  }, [superUpdateStock]);

  const getLowStockProducts = useCallback((limit, threshold = 5) => {
    const lowStockItems = [];
    
    products.forEach(product => {
      if (product.inventory && product.inventory.length > 0) {
        product.inventory.forEach(inv => {
          if (inv.quantity <= threshold && inv.quantity > 0) {
            lowStockItems.push({
              ...inv,
              productName: product.name,
              productId: product.id,
              productImage: product.images?.[0] || null,
              lowStockThreshold: threshold
            });
          }
        });
      }
    });

    const sortedLowStock = lowStockItems.sort((a, b) => a.quantity - b.quantity);
    return limit ? sortedLowStock.slice(0, limit) : sortedLowStock;
  }, [products]);

  return {
    products,
    loading,
    setProducts: () => {}, // غير مستخدمة في النظام الموحد
    addProduct,
    updateProduct,
    deleteProduct,
    deleteProducts: async (productIds) => {
      // تحديث للعمل مع النظام الموحد
      const deletePromises = productIds.map(id => superDeleteProduct(id));
      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.success).length;
      
      toast({
        title: 'تم حذف المنتجات',
        description: `تم حذف ${successCount} منتج بنجاح`
      });
      
      return { success: successCount === productIds.length };
    },
    updateVariantStock,
    getLowStockProducts,
    refetch: fetchProducts
  };
};