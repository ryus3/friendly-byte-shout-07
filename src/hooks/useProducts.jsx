
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { generateUniqueBarcode } from '@/lib/barcode-utils';

export const useProducts = (initialProducts, settings, addNotification, user, departments = [], allColors = [], sizes = []) => {
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
      console.log('🏗️ بدء إضافة المنتج:', productData.name);
      
      // توليد باركود رئيسي للمنتج
      const mainBarcode = generateUniqueBarcode(productData.name, 'PRODUCT', 'MAIN', Date.now().toString());
      console.log('📋 باركود المنتج الرئيسي:', mainBarcode);

      // 1. Insert the main product data
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          name: productData.name,
          description: productData.description,
          base_price: productData.price,
          cost_price: productData.costPrice,
          profit_amount: productData.profitAmount || 0,
          barcode: mainBarcode,
          is_active: productData.isVisible,
          created_by: user?.user_id || user?.id
        })
        .select()
        .single();

      if (productError) {
        console.error('❌ خطأ في إدراج المنتج:', productError);
        throw productError;
      }
      
      console.log('✅ تم إنشاء المنتج بنجاح:', newProduct);

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

          // الحصول على أسماء القسم واللون والقياس لتوليد باركود ذكي
          const departmentName = productData.selectedDepartments?.length > 0 ? 
            departments.find(d => d.id === productData.selectedDepartments[0])?.name || '' : '';
          const colorName = allColors.find(c => c.id === variant.colorId)?.name || 'DEFAULT';
          const sizeName = sizes.find(s => s.id === variant.sizeId)?.name || 'DEFAULT';
          
          // توليد باركود ذكي حسب نوع المنتج
          const uniqueBarcode = generateUniqueBarcode(
            productData.name,
            colorName,
            sizeName,
            newProduct.id,
            departmentName
          );
          
          console.log('🏷️ توليد باركود ذكي للمتغير:', {
            productName: productData.name,
            department: departmentName,
            color: colorName,
            size: sizeName,
            barcode: uniqueBarcode,
            colorId: variant.colorId,
            sizeId: variant.sizeId
          });

          finalVariants.push({
            product_id: newProduct.id,
            color_id: variant.colorId,
            size_id: variant.sizeId,
            price: parseFloat(variant.price) || 0,
            cost_price: parseFloat(variant.costPrice) || 0,
            profit_amount: parseFloat(variant.profitAmount) || productData.profitAmount || 0,
            hint: variant.hint || '',
            barcode: uniqueBarcode, // استخدام الباركود الفريد المولد
            images: imageUrl ? [imageUrl] : []
          });
      }

      console.log("🔢 المتغيرات النهائية قبل الإدراج:", finalVariants);

      if (finalVariants.length > 0) {
        const { data: insertedVariants, error: variantsError } = await supabase
          .from('product_variants')
          .insert(finalVariants)
          .select();
        if (variantsError) {
          console.error('❌ خطأ في إدراج المتغيرات:', variantsError);
          throw variantsError;
        }
        
        console.log('✅ تم إدراج المتغيرات بنجاح:', insertedVariants);

        // إنشاء سجلات inventory للمتغيرات الجديدة
        const inventoryRecords = insertedVariants.map((variant, index) => {
          const variantData = productData.variants[index];
          console.log(`📦 إنشاء مخزون للمتغير ${variant.id}: الكمية=${variantData.quantity}`);
          return {
            product_id: newProduct.id,
            variant_id: variant.id,
            quantity: parseInt(variantData.quantity) || 0,
            min_stock: parseInt(variantData.minStock) || 5,
            last_updated_by: user?.user_id || user?.id
          };
        });

        console.log('📊 سجلات المخزون التي سيتم إدراجها:', inventoryRecords);

        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory')
          .insert(inventoryRecords)
          .select();
        
        if (inventoryError) {
          console.error('❌ خطأ في إدراج المخزون:', inventoryError);
          throw inventoryError;
        }
        
        console.log('✅ تم إدراج المخزون بنجاح:', inventoryData);
      }
      
      if(totalImagesToUpload === 0) setUploadProgress(100);
      
      const { data: finalProduct, error: finalProductError } = await supabase
        .from('products')
        .select('*, variants:product_variants(*)')
        .eq('id', newProduct.id)
        .single();

      if (finalProductError) throw finalProductError;

      // جلب المنتج الكامل مع كافة بياناته
      const { data: completeProduct, error: completeError } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(
            *,
            color:colors(id, name, hex_color),
            size:sizes(id, name),
            inventory(quantity, min_stock, reserved_stock)
          ),
          categories:product_categories(category_id, categories(name)),
          product_types:product_product_types(product_type_id, product_types(name)),
          seasons_occasions:product_seasons_occasions(season_occasion_id, seasons_occasions(name, type)),
          departments:product_departments(department_id, departments(name))
        `)
        .eq('id', newProduct.id)
        .single();

      if (completeError) {
        console.error('❌ خطأ في جلب المنتج الكامل:', completeError);
        throw completeError;
      }

      // تحديث قائمة المنتجات المحلية فوراً بالمنتج الكامل مع كافة البيانات
      setProducts(prev => [completeProduct, ...prev]);
      console.log('✅ تم تحديث القائمة المحلية بالمنتج الكامل:', completeProduct);
      
      // إضافة إشعار النجاح
      if (addNotification) {
        addNotification({
          title: '✅ تم إضافة المنتج بنجاح',
          message: `تم إضافة المنتج "${finalProduct.name}" بنجاح مع ${finalProduct.variants?.length || 0} متغير`,
          type: 'success'
        });
      }
      
      console.log('✅ تم إضافة المنتج وتحديث القائمة بنجاح:', finalProduct.name, 'المتغيرات:', finalProduct.variants?.length);
      
      return { success: true, data: finalProduct };
    } catch (error) {
      console.error("Error adding product:", error);
      return { success: false, error: error.message };
    }
  }, [settings, user]);

  const updateProduct = useCallback(async (productId, productData, imageFiles, setUploadProgress) => {
    try {
        console.log('🔄 بدء تحديث المنتج:', productId, productData);
        
        // 1. Update product basic info
        const { error: productUpdateError } = await supabase
            .from('products')
            .update({
                name: productData.name,
                description: productData.description,
                base_price: parseFloat(productData.price) || 0,
                cost_price: parseFloat(productData.costPrice) || 0,
                profit_amount: parseFloat(productData.profitAmount) || 0,
                is_active: productData.isVisible !== false,
            })
            .eq('id', productId);

        if (productUpdateError) {
            console.error('❌ خطأ في تحديث المنتج:', productUpdateError);
            throw productUpdateError;
        }
        
        console.log('✅ تم تحديث المنتج الأساسي بنجاح');

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
        
        // 4. Handle variants - إصلاح شامل لحفظ المتغيرات والكميات
        console.log('🎨 بدء تحديث المتغيرات:', productData.variants?.length || 0);
        
        if (productData.variants && productData.variants.length > 0) {
            const { data: existingVariants } = await supabase
              .from('product_variants')
              .select('id, barcode, color_id, size_id, images')
              .eq('product_id', productId);
            
            console.log('🔍 المتغيرات الموجودة:', existingVariants?.length || 0);
            
            const existingVariantsMap = new Map();
            existingVariants?.forEach(v => {
              const key = `${v.color_id}-${v.size_id}`;
              existingVariantsMap.set(key, v);
            });
            
            const variantsToUpdate = [];
            const variantsToInsert = [];
            const variantIdsToKeep = new Set();
            
            // معالجة كل متغير من البيانات الجديدة
            for (const v of productData.variants) {
              const colorId = v.color_id || v.colorId;
              const sizeId = v.size_id || v.sizeId;
              const key = `${colorId}-${sizeId}`;
              const existing = existingVariantsMap.get(key);
              
              console.log(`🔧 معالجة متغير: ${key}, الكمية: ${v.quantity}, موجود: ${!!existing}`);
              
              let imageUrl = uploadedColorUrls[colorId] || 
                           existingColorImageUrls[colorId] || 
                           v.image || null;
              
              if (existing) {
                // تحديث المتغير الموجود
                const variantUpdate = {
                  id: existing.id,
                  price: parseFloat(v.price) || parseFloat(productData.price) || 0,
                  cost_price: parseFloat(v.cost_price || v.costPrice) || parseFloat(productData.costPrice) || 0,
                  profit_amount: parseFloat(v.profit_amount || v.profitAmount || productData.profitAmount) || 0,
                  hint: v.hint || '',
                  images: imageUrl ? [imageUrl] : (existing.images || [])
                };
                
                variantsToUpdate.push({
                  ...variantUpdate,
                  quantity: parseInt(v.quantity) || 0 // إضافة الكمية للتحديث
                });
                variantIdsToKeep.add(existing.id);
              } else {
                // إنشاء متغير جديد
                let barcode = v.barcode;
                if (!barcode || barcode.trim() === '') {
                  barcode = generateUniqueBarcode(
                    productData.name,
                    v.color || 'DEFAULT',
                    v.size || 'DEFAULT',
                    productId
                  );
                }
                
                variantsToInsert.push({
                  product_id: productId,
                  color_id: colorId,
                  size_id: sizeId,
                  price: parseFloat(v.price) || parseFloat(productData.price) || 0,
                  cost_price: parseFloat(v.cost_price || v.costPrice) || parseFloat(productData.costPrice) || 0,
                  profit_amount: parseFloat(v.profit_amount || v.profitAmount || productData.profitAmount) || 0,
                  hint: v.hint || '',
                  barcode: barcode,
                  images: imageUrl ? [imageUrl] : [],
                  quantity: parseInt(v.quantity) || 0 // إضافة الكمية للإدراج
                });
              }
            }
            
            console.log(`📊 التحديثات: ${variantsToUpdate.length}, الإدراجات: ${variantsToInsert.length}`);
            
            // تحديث المتغيرات الموجودة مع المخزون
            for (const variant of variantsToUpdate) {
              // تحديث بيانات المتغير
              const { error: variantUpdateError } = await supabase
                .from('product_variants')
                .update({
                  price: variant.price,
                  cost_price: variant.cost_price,
                  profit_amount: variant.profit_amount,
                  hint: variant.hint || '',
                  images: variant.images
                })
                .eq('id', variant.id);
                
              if (variantUpdateError) {
                console.error('❌ خطأ في تحديث المتغير:', variantUpdateError);
                throw variantUpdateError;
              }
              
              // تحديث المخزون - إزالة upsert واستخدام update/insert منفصلين
              const { data: existingInventory } = await supabase
                .from('inventory')
                .select('id')
                .eq('variant_id', variant.id)
                .eq('product_id', productId)
                .single();
                
              if (existingInventory) {
                // تحديث المخزون الموجود
                const { error: updateInventoryError } = await supabase
                  .from('inventory')
                  .update({
                    quantity: variant.quantity,
                    min_stock: 5,
                    last_updated_by: user?.user_id || user?.id
                  })
                  .eq('id', existingInventory.id);
                  
                if (updateInventoryError) {
                  console.error('❌ خطأ في تحديث المخزون:', updateInventoryError);
                }
              } else {
                // إدراج مخزون جديد
                const { error: insertInventoryError } = await supabase
                  .from('inventory')
                  .insert({
                    variant_id: variant.id,
                    product_id: productId,
                    quantity: variant.quantity,
                    min_stock: 5,
                    last_updated_by: user?.user_id || user?.id
                  });
                  
                if (insertInventoryError) {
                  console.error('❌ خطأ في إدراج المخزون:', insertInventoryError);
                }
              }
              
              console.log(`✅ تم تحديث المتغير ${variant.id} بكمية ${variant.quantity}`);
            }
            
            // إدراج المتغيرات الجديدة مع المخزون
            if (variantsToInsert.length > 0) {
              const { data: newVariants, error: insertError } = await supabase
                .from('product_variants')
                .insert(variantsToInsert.map(v => ({
                  product_id: v.product_id,
                  color_id: v.color_id,
                  size_id: v.size_id,
                  price: v.price,
                  cost_price: v.cost_price,
                  profit_amount: v.profit_amount,
                  hint: v.hint || '', // إضافة التلميح الذكي
                  barcode: v.barcode,
                  images: v.images
                })))
                .select();
                
              if (insertError) {
                console.error('❌ خطأ في إدراج المتغيرات الجديدة:', insertError);
                throw insertError;
              }
              
              // إنشاء سجلات المخزون للمتغيرات الجديدة
              if (newVariants && newVariants.length > 0) {
                const inventoryRecords = newVariants.map((variant, index) => ({
                  product_id: productId,
                  variant_id: variant.id,
                  quantity: variantsToInsert[index].quantity,
                  min_stock: 5,
                  last_updated_by: user?.user_id || user?.id
                }));

                const { error: inventoryInsertError } = await supabase
                  .from('inventory')
                  .insert(inventoryRecords);
                  
                if (inventoryInsertError) {
                  console.error('❌ خطأ في إدراج المخزون:', inventoryInsertError);
                  throw inventoryInsertError;
                }
                
                console.log(`✅ تم إدراج ${newVariants.length} متغير جديد مع المخزون`);
              }
            }
            
            // حذف المتغيرات والمخزون للمتغيرات التي لم تعد موجودة
            const variantsToDelete = existingVariants?.filter(v => !variantIdsToKeep.has(v.id));
            if (variantsToDelete?.length > 0) {
              // فحص إذا كانت المتغيرات مرتبطة بطلبات
              const { data: orderItems } = await supabase
                .from('order_items')
                .select('variant_id')
                .in('variant_id', variantsToDelete.map(v => v.id));
              
              const safeToDelete = variantsToDelete.filter(v => 
                !orderItems?.some(oi => oi.variant_id === v.id)
              );
              
              if (safeToDelete.length > 0) {
                // حذف المخزون أولاً
                await supabase
                  .from('inventory')
                  .delete()
                  .in('variant_id', safeToDelete.map(v => v.id));
                  
                // ثم حذف المتغيرات
                await supabase
                  .from('product_variants')
                  .delete()
                  .in('id', safeToDelete.map(v => v.id));
                  
                console.log(`🗑️ تم حذف ${safeToDelete.length} متغير مع مخزونه`);
              }
            }
            
            console.log('✅ تم تحديث جميع المتغيرات والمخزون بنجاح');
        }

        // تحديث قائمة المنتجات المحلية فوراً مع بيانات شاملة
        const { data: updatedProduct } = await supabase
          .from('products')
          .select(`
            *,
            variants:product_variants!inner(
              *,
              colors(id, name, hex_code),
              sizes(id, name, display_order),
              inventory(quantity, min_stock, reserved_quantity)
            ),
            categories:product_categories(
              category:categories(id, name)
            ),
            departments:product_departments(
              department:departments(id, name)
            ),
            product_types:product_product_types(
              product_type:product_types(id, name)
            ),
            seasons_occasions:product_seasons_occasions(
              season_occasion:seasons_occasions(id, name)
            )
          `)
          .eq('id', productId)
          .single();
          
        if (updatedProduct) {
          // تحديث قائمة المنتجات المحلية
          setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
          console.log('✅ تم تحديث القائمة المحلية بنجاح');
        }

        // إضافة إشعار النجاح
        if (addNotification) {
            addNotification({
              title: '✅ تم تحديث المنتج بنجاح',
              message: `تم تحديث المنتج "${productData.name}" مع جميع متغيراته وكمياته`,
              type: 'success'
            });
        }
        
        if(totalImagesToUpload === 0) setUploadProgress(100);

        console.log('🎉 تم تحديث المنتج بالكامل بنجاح!');
        return { success: true };
    } catch (error) {
        console.error("❌ خطأ في تحديث المنتج:", error);
        if (addNotification) {
          addNotification({
            title: '❌ فشل في تحديث المنتج',
            message: error.message,
            type: 'error'
          });
        }
        return { success: false, error: error.message };
    }
  }, [addNotification, user]);

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

  const getLowStockProducts = useCallback((limit, filteredProducts = null) => {
    // استخدام المنتجات المفلترة إذا تم تمريرها، وإلا استخدم جميع المنتجات
    const productsToCheck = filteredProducts || products;
    
    if (!productsToCheck || !settings) return [];
    
    const lowStockVariants = [];
    productsToCheck.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach(variant => {
          const currentStock = variant.quantity || 0;
          const minStock = variant.min_stock || settings.lowStockThreshold || 5;
          const reservedStock = variant.reserved || 0;
          const availableStock = currentStock - reservedStock;
          
          if (availableStock <= minStock) {
            lowStockVariants.push({
              id: variant.id,
              product_id: product.id,
              productName: product.name,
              productImage: product.images?.[0] || variant.images?.[0],
              color: variant.color,
              size: variant.size,
              quantity: availableStock,
              minStock: minStock,
              reserved: reservedStock,
              total: currentStock
            });
          }
        });
      }
    });
    
    return lowStockVariants.sort((a, b) => a.quantity - b.quantity).slice(0, limit);
  }, [products, settings]);
  const refreshProducts = useCallback(async () => {
    try {
      console.log('🔄 إعادة تحديث قائمة المنتجات...');
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(*),
          inventory(*),
          product_categories(category_id, categories(name)),
          product_departments(department_id, departments(name, color, icon)),
          product_product_types(product_type_id, product_types(name)),
          product_seasons_occasions(season_occasion_id, seasons_occasions(name, type))
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ خطأ في تحديث المنتجات:', error);
        return;
      }

      console.log('✅ تم تحديث المنتجات بنجاح:', data?.length || 0);
      setProducts(data || []);
    } catch (error) {
      console.error('❌ خطأ في refreshProducts:', error);
    }
  }, []);

  return {
    products,
    setProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    deleteProducts,
    updateVariantStock,
    getLowStockProducts,
    refreshProducts
  };
};
