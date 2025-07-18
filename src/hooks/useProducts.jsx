
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { generateUniqueBarcode } from '@/lib/barcode-utils';

export const useProducts = (initialProducts, settings, addNotification, user) => {
  const [products, setProducts] = useState(initialProducts);

  const uploadImage = async (file, bucket, path) => {
    if (typeof file === 'string') return file; // It's already a URL
    if (!file) return null;
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  };

  const addProduct = useCallback(async (productData, imageFiles, setUploadProgress) => {
    try {
      // 1. Insert the main product data
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          name: productData.name,
          description: productData.description,
          base_price: productData.price,
          cost_price: productData.costPrice,
          profit_amount: productData.profitAmount || 0,
          barcode: generateUniqueBarcode(productData.name, 'PRODUCT', 'MAIN', Date.now().toString()),
          is_active: productData.isVisible,
          created_by: user?.user_id || user?.id
        })
        .select()
        .single();

      if (productError) throw productError;

      let uploadedImageUrls = [];
      const generalImageFiles = imageFiles.general.filter(img => img && !(typeof img === 'string'));
      const existingImageUrls = imageFiles.general.filter(img => img && typeof img === 'string');
      let totalImagesToUpload = generalImageFiles.length;

      const colorImageFiles = {};
      Object.entries(imageFiles.colorImages).forEach(([colorId, file]) => {
          if (file && !(typeof file === 'string')) {
              colorImageFiles[colorId] = file;
              totalImagesToUpload++;
          }
      });
      
      let uploadedCount = 0;
      const progressCallback = () => {
          uploadedCount++;
          if (totalImagesToUpload > 0) {
              setUploadProgress((uploadedCount / totalImagesToUpload) * 100);
          }
      };

      if (generalImageFiles.length > 0) {
        const uploadPromises = generalImageFiles.map((file) => {
          if (!file) return null;
          const path = `public/${newProduct.id}/general_${Date.now()}_${Math.random()}`;
          const promise = uploadImage(file, 'product-images', path);
          promise.then(progressCallback);
          return promise;
        });
        const newUrls = await Promise.all(uploadPromises);
        uploadedImageUrls = [...existingImageUrls, ...newUrls.filter(Boolean)];
      } else {
        uploadedImageUrls = existingImageUrls;
      }

      // 2. Update product with general image URLs
      await supabase
        .from('products')
        .update({ images: uploadedImageUrls })
        .eq('id', newProduct.id);

      // 3. Handle categorization relationships
      if (productData.selectedCategories && productData.selectedCategories.length > 0) {
        const categoryRelations = productData.selectedCategories.map(categoryId => ({
          product_id: newProduct.id,
          category_id: categoryId
        }));
        await supabase.from('product_categories').insert(categoryRelations);
      }

      if (productData.selectedProductTypes && productData.selectedProductTypes.length > 0) {
        const productTypeRelations = productData.selectedProductTypes.map(typeId => ({
          product_id: newProduct.id,
          product_type_id: typeId
        }));
        await supabase.from('product_product_types').insert(productTypeRelations);
      }

      if (productData.selectedSeasonsOccasions && productData.selectedSeasonsOccasions.length > 0) {
        const seasonRelations = productData.selectedSeasonsOccasions.map(seasonId => ({
          product_id: newProduct.id,
          season_occasion_id: seasonId
        }));
        await supabase.from('product_seasons_occasions').insert(seasonRelations);
      }

      if (productData.selectedDepartments && productData.selectedDepartments.length > 0) {
        const departmentRelations = productData.selectedDepartments.map(deptId => ({
          product_id: newProduct.id,
          department_id: deptId
        }));
        await supabase.from('product_departments').insert(departmentRelations);
      }
      
      // 4. Handle variants
      const colorImageUploads = {};

      for (const colorId in colorImageFiles) {
          const file = colorImageFiles[colorId];
          const path = `public/${newProduct.id}/color_${colorId}_${Date.now()}`;
          const promise = uploadImage(file, 'product-images', path);
          promise.then(progressCallback);
          colorImageUploads[colorId] = promise;
      }
      
      const uploadedColorUrls = {};
      const colorIds = Object.keys(colorImageUploads);
      if (colorIds.length > 0) {
          const colorUrlPromises = Object.values(colorImageUploads);
          const resolvedUrls = await Promise.all(colorUrlPromises);
          colorIds.forEach((id, index) => {
            uploadedColorUrls[id] = resolvedUrls[index];
          });
      }
      
      const finalVariants = [];
      console.log("productData.variants:", productData.variants);
      for (const variant of productData.variants) {
          let imageUrl = uploadedColorUrls[variant.colorId] || null;
          if (!imageUrl && imageFiles.colorImages[variant.colorId] && typeof imageFiles.colorImages[variant.colorId] === 'string') {
              imageUrl = imageFiles.colorImages[variant.colorId];
          }

          // توليد باركود فريد لكل متغير باستخدام المكتبة الجديدة
          const uniqueBarcode = generateUniqueBarcode(
            productData.name,
            variant.color || 'DEFAULT',
            variant.size || 'DEFAULT',
            newProduct.id
          );

          finalVariants.push({
            product_id: newProduct.id,
            color_id: variant.colorId,
            size_id: variant.sizeId,
            price: parseFloat(variant.price) || 0,
            cost_price: parseFloat(variant.costPrice) || 0,
            profit_amount: parseFloat(variant.profitAmount) || productData.profitAmount || 0,
            barcode: uniqueBarcode,
            images: imageUrl ? [imageUrl] : []
          });
      }

      console.log("finalVariants:", finalVariants);

      if (finalVariants.length > 0) {
        const { data: insertedVariants, error: variantsError } = await supabase
          .from('product_variants')
          .insert(finalVariants)
          .select();
        if (variantsError) throw variantsError;

        // إنشاء سجلات inventory للمتغيرات الجديدة
        const inventoryRecords = insertedVariants.map((variant, index) => ({
          product_id: newProduct.id,
          variant_id: variant.id,
          quantity: productData.variants[index].quantity || 0,
          min_stock: productData.variants[index].minStock || 5,
          last_updated_by: user?.user_id || user?.id
        }));

        const { error: inventoryError } = await supabase
          .from('inventory')
          .insert(inventoryRecords);
        if (inventoryError) throw inventoryError;
      }
      
      if(totalImagesToUpload === 0) setUploadProgress(100);
      
      const { data: finalProduct, error: finalProductError } = await supabase
        .from('products')
        .select('*, variants:product_variants(*)')
        .eq('id', newProduct.id)
        .single();

      if (finalProductError) throw finalProductError;

      return { success: true, data: finalProduct };
    } catch (error) {
      console.error("Error adding product:", error);
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return { success: false, error: error.message };
    }
  }, [settings, user]);

  const updateProduct = useCallback(async (productId, productData, imageFiles, setUploadProgress) => {
    try {
        // 1. Update product basic info
        await supabase
            .from('products')
            .update({
                name: productData.name,
                description: productData.description,
                base_price: productData.price,
                cost_price: productData.costPrice,
                profit_amount: productData.profitAmount || 0,
                is_active: productData.isVisible,
            })
            .eq('id', productId);

        // 2. Update categorization relationships
        // Delete existing relationships
        await Promise.all([
          supabase.from('product_categories').delete().eq('product_id', productId),
          supabase.from('product_product_types').delete().eq('product_id', productId),
          supabase.from('product_seasons_occasions').delete().eq('product_id', productId),
          supabase.from('product_departments').delete().eq('product_id', productId)
        ]);

        // Insert new relationships
        if (productData.selectedCategories && productData.selectedCategories.length > 0) {
          const categoryRelations = productData.selectedCategories.map(categoryId => ({
            product_id: productId,
            category_id: categoryId
          }));
          await supabase.from('product_categories').insert(categoryRelations);
        }

        if (productData.selectedProductTypes && productData.selectedProductTypes.length > 0) {
          const productTypeRelations = productData.selectedProductTypes.map(typeId => ({
            product_id: productId,
            product_type_id: typeId
          }));
          await supabase.from('product_product_types').insert(productTypeRelations);
        }

        if (productData.selectedSeasonsOccasions && productData.selectedSeasonsOccasions.length > 0) {
          const seasonRelations = productData.selectedSeasonsOccasions.map(seasonId => ({
            product_id: productId,
            season_occasion_id: seasonId
          }));
          await supabase.from('product_seasons_occasions').insert(seasonRelations);
        }

        if (productData.selectedDepartments && productData.selectedDepartments.length > 0) {
          const departmentRelations = productData.selectedDepartments.map(deptId => ({
            product_id: productId,
            department_id: deptId
          }));
          await supabase.from('product_departments').insert(departmentRelations);
        }

        // 3. Handle images upload
            
        const generalImageFiles = imageFiles.general.filter(img => img && !(typeof img === 'string'));
        const existingImageUrls = imageFiles.general.filter(img => img && typeof img === 'string');
        let totalImagesToUpload = generalImageFiles.length;

        const colorImageFiles = {};
        const existingColorImageUrls = {};
        Object.entries(imageFiles.colorImages).forEach(([colorId, fileOrUrl]) => {
            if (fileOrUrl && typeof fileOrUrl === 'string') {
                existingColorImageUrls[colorId] = fileOrUrl;
            } else if (fileOrUrl) {
                colorImageFiles[colorId] = fileOrUrl;
                totalImagesToUpload++;
            }
        });

        let uploadedCount = 0;
        const progressCallback = () => {
            uploadedCount++;
            if (totalImagesToUpload > 0) {
                setUploadProgress((uploadedCount / totalImagesToUpload) * 100);
            }
        };

        let uploadedGeneralUrls = [];
        if(generalImageFiles.length > 0) {
            const uploadPromises = generalImageFiles.map(file => {
                const path = `public/${productId}/general_${Date.now()}_${Math.random()}`;
                const promise = uploadImage(file, 'product-images', path);
                promise.then(progressCallback);
                return promise;
            });
            uploadedGeneralUrls = (await Promise.all(uploadPromises)).filter(Boolean);
        }
        
        const finalGeneralImages = [...existingImageUrls, ...uploadedGeneralUrls];

        await supabase
            .from('products')
            .update({ images: finalGeneralImages })
            .eq('id', productId);

        const colorImageUploads = {};
        for (const colorId in colorImageFiles) {
            const file = colorImageFiles[colorId];
            const path = `public/${productId}/color_${colorId}_${Date.now()}`;
            const promise = uploadImage(file, 'product-images', path);
            promise.then(progressCallback);
            colorImageUploads[colorId] = promise;
        }

        const uploadedColorUrls = {};
        const colorIds = Object.keys(colorImageUploads);
        if (colorIds.length > 0) {
            const resolvedUrls = await Promise.all(Object.values(colorImageUploads));
            colorIds.forEach((id, index) => {
                uploadedColorUrls[id] = resolvedUrls[index];
            });
        }
        
        // 4. Handle variants
        await supabase.from('product_variants').delete().eq('product_id', productId);
        
        const finalVariants = productData.variants.map(v => {
            let imageUrl = uploadedColorUrls[v.colorId] || existingColorImageUrls[v.colorId] || v.image || null;
            return {
                product_id: productId,
                color_id: v.colorId,
                size_id: v.sizeId,
                price: v.price,
                cost_price: v.costPrice,
                profit_amount: v.profitAmount || productData.profitAmount || 0,
                barcode: v.barcode,
                images: imageUrl ? [imageUrl] : []
            };
        });

        if (finalVariants.length > 0) {
            await supabase.from('product_variants').insert(finalVariants);
        }

        if(totalImagesToUpload === 0) setUploadProgress(100);

        toast({ title: 'نجاح', description: 'تم تحديث المنتج بنجاح!' });
        return { success: true };
    } catch (error) {
        console.error("Error updating product:", error);
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        return { success: false, error: error.message };
    }
  }, []);

  const deleteProduct = useCallback(async (productId) => {
    toast({ title: 'تنبيه', description: 'حذف المنتج لم يتم تنفيذه بعد.' });
    return { success: true };
  }, []);

  const deleteProducts = useCallback(async (productIds) => {
    try {
        const imagePaths = [];
        for (const productId of productIds) {
            const { data: files, error } = await supabase.storage.from('product-images').list(`public/${productId}`, {
                limit: 100,
                offset: 0,
            });
            if (error) {
                console.warn(`Could not list images for product ${productId}:`, error.message);
            } else if (files) {
                files.forEach(file => imagePaths.push(`public/${productId}/${file.name}`));
            }
        }

        const { error: dbError } = await supabase.from('products').delete().in('id', productIds);
        if (dbError) throw dbError;
        
        if (imagePaths.length > 0) {
            const { error: storageError } = await supabase.storage.from('product-images').remove(imagePaths);
            if (storageError) {
                console.error("Error deleting product images from storage:", storageError);
                toast({ title: 'تحذير', description: 'تم حذف المنتجات من قاعدة البيانات ولكن فشل حذف بعض الصور.', variant: 'default' });
            }
        }

        setProducts(prev => prev.filter(p => !productIds.includes(p.id)));
        return { success: true };
    } catch(error) {
        console.error("Error deleting products:", error);
        toast({ title: 'خطأ', description: 'فشل حذف المنتجات.', variant: 'destructive' });
        return { success: false, error: error.message };
    }
  }, [setProducts]);
  
  const updateVariantStock = useCallback(async (productId, variantIdentifier, newQuantity) => {
    try {
      // تحديث الكمية في جدول inventory بدلاً من product_variants
      const { data: updatedInventory, error } = await supabase
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('product_id', productId)
        .eq('variant_id', variantIdentifier.variantId)
        .select()
        .single();

      if (error) throw error;

      const product = products.find(p => p.id === productId);
      if (updatedInventory && newQuantity <= (settings.lowStockThreshold || 5)) {
        addNotification({
          type: 'low_stock',
          title: 'انخفاض المخزون',
          message: `مخزون المنتج ${product?.name || 'غير معروف'} منخفض.`,
          icon: 'AlertTriangle',
          color: 'orange',
          link: `/inventory?stockFilter=low&highlight=${product?.name || ''}`
        });
      }
      
      // تحديث البيانات المحلية (إذا كانت متاحة)
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p.id === productId 
            ? { ...p, variants: p.variants?.map(v => 
                v.id === variantIdentifier.variantId ? { ...v, quantity: newQuantity } : v
              )}
            : p
        )
      );

      return { success: true };
    } catch (error) {
      console.error("Error updating variant stock:", error);
      toast({ title: 'خطأ', description: 'فشل تحديث مخزون المتغير.', variant: 'destructive' });
      return { success: false };
    }
  }, [products, settings, addNotification, setProducts]);

  const getLowStockProducts = useCallback((limit) => {
    if (!products || !settings) return [];
    
    const lowStockVariants = [];
    products.forEach(product => {
        if (product.is_visible) {
            product.variants.forEach(variant => {
                const lowStockThreshold = product.minStock || settings.lowStockThreshold || 5;
                // منتج منخفض: أقل من أو يساوي الحد الأدنى وليس صفر
                // منتج جيد: 11 فما فوق
                if (variant.quantity > 0 && variant.quantity <= lowStockThreshold) {
                    lowStockVariants.push({
                        ...variant,
                        productName: product.name,
                        productId: product.id,
                        productImage: product.images?.[0] || null,
                        lowStockThreshold: lowStockThreshold,
                    });
                }
            });
        }
    });

    const sortedLowStock = lowStockVariants.sort((a, b) => a.quantity - b.quantity);
    
    return limit ? sortedLowStock.slice(0, limit) : sortedLowStock;
  }, [products, settings]);

  return {
    products,
    setProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    deleteProducts,
    updateVariantStock,
    getLowStockProducts,
  };
};
