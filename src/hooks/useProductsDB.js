import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

export const useProductsDB = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "خطأ في تحميل المنتجات",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addProduct = useCallback(async (productData, imageFiles = { general: [], colorImages: {} }, setUploadProgress) => {
    try {
      if (!user?.user_id) {
        throw new Error('يجب تسجيل الدخول أولاً');
      }

      // التأكد من وجود base_price وتعيين قيمة افتراضية إذا لم تكن موجودة
      const finalProductData = {
        name: productData.name || '',
        description: productData.description || null,
        category_id: productData.category_id || null,
        base_price: productData.base_price || 0,
        cost_price: productData.cost_price || 0,
        barcode: productData.barcode || null,
        images: productData.images || [],
        is_active: productData.is_active !== undefined ? productData.is_active : true,
        profit_amount: productData.profit_amount || 0,
        created_by: user.user_id,
      };

      const { data, error } = await supabase
        .from('products')
        .insert([finalProductData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "تم إضافة المنتج بنجاح",
        description: `تم إضافة ${finalProductData.name}`,
      });

      await fetchProducts();
      return { success: true, data };
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "خطأ في إضافة المنتج",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  }, [user, fetchProducts]);

  const updateProduct = useCallback(async (productId, productData, imageFiles = { general: [], colorImages: {} }, setUploadProgress) => {
    try {
      if (!user?.user_id) {
        throw new Error('يجب تسجيل الدخول أولاً');
      }

      const updateData = {
        ...productData,
        base_price: productData.base_price || 0,
        last_updated_by: user.user_id,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "تم تحديث المنتج بنجاح",
        description: `تم تحديث ${updateData.name || 'المنتج'}`,
      });

      await fetchProducts();
      return { success: true, data };
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "خطأ في تحديث المنتج",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  }, [user, fetchProducts]);

  const deleteProduct = useCallback(async (productId) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "تم حذف المنتج بنجاح",
      });

      await fetchProducts();
      return { success: true };
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "خطأ في حذف المنتج",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  }, [fetchProducts]);

  const updateVariantStock = useCallback(async (productId, variantId, newQuantity) => {
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('variant_id', variantId);

      if (error) throw error;

      toast({
        title: "تم تحديث المخزون بنجاح",
      });

      await fetchProducts();
      return { success: true };
    } catch (error) {
      console.error('Error updating variant stock:', error);
      toast({
        title: "خطأ في تحديث المخزون",
        description: error.message,
        variant: "destructive",
      });
      return { success: false };
    }
  }, [fetchProducts]);

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
    setProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    deleteProducts: async (productIds) => {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .in('id', productIds);

        if (error) throw error;

        toast({
          title: "تم حذف المنتجات بنجاح",
          description: `تم حذف ${productIds.length} منتج`,
        });

        await fetchProducts();
        return { success: true };
      } catch (error) {
        console.error('Error deleting products:', error);
        toast({
          title: "خطأ في حذف المنتجات",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }
    },
    updateVariantStock,
    getLowStockProducts,
    refetch: fetchProducts
  };
};