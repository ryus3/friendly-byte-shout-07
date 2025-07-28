import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

export const useProductsDB = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { db, storage } = useSupabase();
  const { user } = useAuth();

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await db.products.getAll();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'خطأ في تحميل المنتجات',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addProduct = useCallback(async (productData, imageFiles = { general: [], colorImages: {} }, setUploadProgress) => {
    try {
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');

      // Upload general images
      let uploadedGeneralImages = [];
      if (imageFiles.general && imageFiles.general.length > 0) {
        const uploadPromises = imageFiles.general.map(async (file, index) => {
          if (typeof file === 'string') return file; // Already uploaded
          if (!file) return null;
          
          try {
            const url = await storage.uploadProductImage(file, `temp-${Date.now()}-${index}`);
            return url;
          } catch (err) {
            console.error('Error uploading image:', err);
            return null;
          }
        });
        
        uploadedGeneralImages = (await Promise.all(uploadPromises)).filter(Boolean);
      }

      // Create product - use the first category as main category for compatibility
      const mainCategoryId = productData.selectedCategories?.length > 0 ? productData.selectedCategories[0].id : null;
      
      const newProduct = await db.products.create({
        name: productData.name,
        description: productData.description,
        category_id: mainCategoryId,
        base_price: productData.price || 0,
        cost_price: productData.costPrice || 0,
        profit_amount: productData.profitAmount || 0,
        barcode: productData.barcode,
        images: uploadedGeneralImages,
        is_active: true,
        created_by: user.id || user.user_id
      });

      // Create relationships for multiple categories
      if (productData.selectedCategories?.length > 0) {
        const categoryPromises = productData.selectedCategories.map(category =>
          supabase.from('product_categories').insert({
            product_id: newProduct.id,
            category_id: category.id
          })
        );
        await Promise.all(categoryPromises);
      }

      // Create relationships for product types
      if (productData.selectedProductTypes?.length > 0) {
        const productTypePromises = productData.selectedProductTypes.map(productType =>
          supabase.from('product_product_types').insert({
            product_id: newProduct.id,
            product_type_id: productType.id
          })
        );
        await Promise.all(productTypePromises);
      }

      // Create relationships for seasons/occasions
      if (productData.selectedSeasonsOccasions?.length > 0) {
        const seasonOccasionPromises = productData.selectedSeasonsOccasions.map(seasonOccasion =>
          supabase.from('product_seasons_occasions').insert({
            product_id: newProduct.id,
            season_occasion_id: seasonOccasion.id
          })
        );
        await Promise.all(seasonOccasionPromises);
      }

      // Create relationships for departments
      if (productData.selectedDepartments?.length > 0) {
        const departmentPromises = productData.selectedDepartments.map(department =>
          supabase.from('product_departments').insert({
            product_id: newProduct.id,
            department_id: department.id
          })
        );
        await Promise.all(departmentPromises);
      }

      // Create variants if any
      if (productData.variants && productData.variants.length > 0) {
        const variantPromises = productData.variants.map(async (variant) => {
          // Upload variant image if exists
          let variantImageUrl = null;
          if (variant.colorId && imageFiles.colorImages && imageFiles.colorImages[variant.colorId]) {
            const file = imageFiles.colorImages[variant.colorId];
            if (typeof file !== 'string' && file) {
              try {
                variantImageUrl = await storage.uploadProductImage(file, newProduct.id);
              } catch (err) {
                console.error('Error uploading variant image:', err);
              }
            } else if (typeof file === 'string') {
              variantImageUrl = file;
            }
          }

          return db.variants.create({
            product_id: newProduct.id,
            color_id: variant.colorId,
            size_id: variant.sizeId,
            price: variant.price || newProduct.base_price,
            cost_price: variant.costPrice || newProduct.cost_price,
            profit_amount: variant.profitAmount || productData.profitAmount || 0,
            hint: variant.hint || '',
            barcode: variant.barcode,
            images: variantImageUrl ? [variantImageUrl] : []
          });
        });

        await Promise.all(variantPromises);
      }

      // Create initial inventory records
      if (productData.variants && productData.variants.length > 0) {
        const inventoryPromises = productData.variants.map(variant => 
          db.inventory.updateStock(newProduct.id, variant.id, variant.quantity || 0)
        );
        await Promise.all(inventoryPromises);
      } else {
        // Create inventory for base product
        await db.inventory.updateStock(newProduct.id, null, productData.quantity || 0);
      }

      await fetchProducts();
      
      toast({
        title: 'تم إضافة المنتج بنجاح',
        description: `تم إضافة ${productData.name} إلى قاعدة البيانات`
      });

      if (setUploadProgress) setUploadProgress(100);
      
      return { success: true, data: newProduct };
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: 'خطأ في إضافة المنتج',
        description: error.message,
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    }
  }, [db, storage, user, fetchProducts]);

  const updateProduct = useCallback(async (productId, productData, imageFiles = { general: [], colorImages: {} }, setUploadProgress) => {
    try {
      // Upload new general images
      let updatedGeneralImages = [...(productData.existingImages || [])];
      if (imageFiles.general && imageFiles.general.length > 0) {
        const newImagePromises = imageFiles.general.map(async (file) => {
          if (typeof file === 'string') return file;
          if (!file) return null;
          
          try {
            return await storage.uploadProductImage(file, productId);
          } catch (err) {
            console.error('Error uploading image:', err);
            return null;
          }
        });
        
        const newImages = (await Promise.all(newImagePromises)).filter(Boolean);
        updatedGeneralImages = [...updatedGeneralImages, ...newImages];
      }

      // Update product
      await db.products.update(productId, {
        name: productData.name,
        description: productData.description,
        category_id: productData.categoryId,
        base_price: productData.price || 0,
        cost_price: productData.costPrice || 0,
        profit_amount: productData.profitAmount || 0,
        barcode: productData.barcode,
        images: updatedGeneralImages
      });

      // Update variants if provided
      if (productData.variants && productData.variants.length > 0) {
        const variantUpdatePromises = productData.variants.map(async (variant) => {
          if (variant.id) {
            // Update existing variant
            return await db.variants.update(variant.id, {
              price: variant.price || productData.price || 0,
              cost_price: variant.costPrice || productData.costPrice || 0,
              profit_amount: variant.profitAmount || productData.profitAmount || 0,
              hint: variant.hint || '',
              barcode: variant.barcode
            });
          }
        });
        
        await Promise.all(variantUpdatePromises.filter(Boolean));
      }

      await fetchProducts();
      
      toast({
        title: 'تم تحديث المنتج بنجاح',
        description: `تم تحديث ${productData.name}`
      });

      if (setUploadProgress) setUploadProgress(100);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: 'خطأ في تحديث المنتج',
        description: error.message,
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    }
  }, [db, storage, fetchProducts]);

  const deleteProduct = useCallback(async (productId) => {
    try {
      await db.products.delete(productId);
      await fetchProducts();
      
      toast({
        title: 'تم حذف المنتج',
        description: 'تم حذف المنتج بنجاح'
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'خطأ في حذف المنتج',
        description: error.message,
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    }
  }, [db, fetchProducts]);

  const deleteProducts = useCallback(async (productIds) => {
    try {
      const deletePromises = productIds.map(id => db.products.delete(id));
      await Promise.all(deletePromises);
      await fetchProducts();
      
      toast({
        title: 'تم حذف المنتجات',
        description: `تم حذف ${productIds.length} منتج بنجاح`
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting products:', error);
      toast({
        title: 'خطأ في حذف المنتجات',
        description: error.message,
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    }
  }, [db, fetchProducts]);

  const updateVariantStock = useCallback(async (productId, variantId, newQuantity) => {
    try {
      await db.inventory.updateStock(productId, variantId, newQuantity);
      await fetchProducts();
      
      return { success: true };
    } catch (error) {
      console.error('Error updating variant stock:', error);
      toast({
        title: 'خطأ في تحديث المخزون',
        description: error.message,
        variant: 'destructive'
      });
      return { success: false };
    }
  }, [db, fetchProducts]);

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
    deleteProducts,
    updateVariantStock,
    getLowStockProducts,
    refetch: fetchProducts
  };
};