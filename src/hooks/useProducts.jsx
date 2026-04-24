
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { generateUniqueBarcode } from '@/lib/barcode-utils';
import devLog from '@/lib/devLogger';

export const useProducts = (initialProducts = [], settings = null, addNotification = null, user = null, departments = [], allColors = [], sizes = []) => {
  const [products, setProducts] = useState(initialProducts || []);

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

  const addProduct = useCallback(async (productData, imageFiles = { general: [], colorImages: {} }, setUploadProgress = () => {}) => {
    try {
      devLog.log('🏗️ بدء إضافة المنتج:', productData.name);
      
      // فحص تكرار اسم المنتج وإضافة رقم تسلسلي إذا لزم الأمر
      let finalProductName = productData.name.trim();
      const { data: duplicates, error: checkError } = await supabase
        .from('products')
        .select('name')
        .ilike('name', `${finalProductName}%`)
        .order('name');
      
      if (!checkError && duplicates && duplicates.length > 0) {
        // البحث عن أعلى رقم تسلسلي
        let maxNumber = 0;
        duplicates.forEach(prod => {
          const match = prod.name.match(new RegExp(`^${finalProductName}\\s*\\((\\d+)\\)$`, 'i'));
          if (match) {
            maxNumber = Math.max(maxNumber, parseInt(match[1]));
          } else if (prod.name.toLowerCase() === finalProductName.toLowerCase()) {
            maxNumber = Math.max(maxNumber, 1);
          }
        });
        
        if (maxNumber > 0) {
          finalProductName = `${finalProductName} (${maxNumber + 1})`;
          devLog.log('⚠️ تم اكتشاف منتج مكرر. الاسم الجديد:', finalProductName);
        }
      }
      
      // توليد باركود رئيسي للمنتج
      const mainBarcode = generateUniqueBarcode(finalProductName, 'PRODUCT', 'MAIN', Date.now().toString());
      devLog.log('📋 باركود المنتج الرئيسي:', mainBarcode);

      // 1. Insert the main product data
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          name: finalProductName,
          description: productData.description,
          base_price: parseFloat(productData.price) || 0,
          cost_price: parseFloat(productData.costPrice) || 0,
          profit_amount: parseFloat(productData.profitAmount) || 0,
          barcode: mainBarcode,
          is_active: productData.isVisible,
          created_by: user?.user_id || user?.id || '91484496-b887-44f7-9e5d-be9db5567604',
          owner_user_id: productData.owner_user_id || null
        })
        .select()
        .single();

      if (productError) {
        console.error('❌ خطأ في إدراج المنتج:', productError);
        throw productError;
      }
      
      devLog.log('✅ تم إنشاء المنتج بنجاح:', newProduct);

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
      devLog.log("productData.variants:", productData.variants);
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
          
          devLog.log('🏷️ توليد باركود ذكي للمتغير:', {
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

      devLog.log("🔢 المتغيرات النهائية قبل الإدراج:", finalVariants);

      if (finalVariants.length > 0) {
        const { data: insertedVariants, error: variantsError } = await supabase
          .from('product_variants')
          .insert(finalVariants)
          .select();
        if (variantsError) {
          console.error('❌ خطأ في إدراج المتغيرات:', variantsError);
          throw variantsError;
        }
        
        devLog.log('✅ تم إدراج المتغيرات بنجاح:', insertedVariants);

        // إنشاء سجلات inventory للمتغيرات الجديدة
        const inventoryRecords = insertedVariants.map((variant, index) => {
          const variantData = productData.variants[index];
          devLog.log(`📦 إنشاء مخزون للمتغير ${variant.id}: الكمية=${variantData.quantity}`);
          return {
            product_id: newProduct.id,
            variant_id: variant.id,
            quantity: parseInt(variantData.quantity) || 0,
            min_stock: parseInt(variantData.minStock) || 5,
            last_updated_by: user?.user_id || user?.id || '91484496-b887-44f7-9e5d-be9db5567604'
          };
        });

        devLog.log('📊 سجلات المخزون التي سيتم إدراجها:', inventoryRecords);

        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory')
          .insert(inventoryRecords)
          .select();
        
        if (inventoryError) {
          console.error('❌ خطأ في إدراج المخزون:', inventoryError);
          throw inventoryError;
        }
        
        devLog.log('✅ تم إدراج المخزون بنجاح:', inventoryData);
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
            color:colors(id, name, hex_code),
            size:sizes(id, name),
            inventory(quantity, min_stock, reserved_quantity)
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
      devLog.log('✅ تم تحديث القائمة المحلية بالمنتج الكامل:', completeProduct);
      
      // إضافة إشعار النجاح
      if (addNotification) {
        addNotification({
          title: '✅ تم إضافة المنتج بنجاح',
          message: `تم إضافة المنتج "${finalProduct.name}" بنجاح مع ${finalProduct.variants?.length || 0} متغير`,
          type: 'success'
        });
      }
      
      devLog.log('✅ تم إضافة المنتج وتحديث القائمة بنجاح:', finalProduct.name, 'المتغيرات:', finalProduct.variants?.length);
      
      // تحديث فوري للكاش بعد إضافة المنتج
      try {
        devLog.log('🔄 تحديث كاش المنتجات...');
        await supabase.functions.invoke('refresh-product-cache');
        devLog.log('✅ تم تحديث الكاش بنجاح');
      } catch (cacheError) {
        devLog.warn('⚠️ فشل تحديث الكاش (لن يؤثر على عملية الإضافة):', cacheError);
      }
      
      return { success: true, data: finalProduct };
    } catch (error) {
      console.error("Error adding product:", error);
      return { success: false, error: error.message };
    }
  }, [settings, user, addNotification]);

  const updateProduct = useCallback(async (productId, productData, imageFiles = { general: [], colorImages: {} }, setUploadProgress = () => {}) => {
    try {
        const currentUserId = user?.user_id || user?.id || '91484496-b887-44f7-9e5d-be9db5567604';
        
        devLog.log('🔄 بدء تحديث المنتج:', productId, productData);
        
        // Upload new images first
        let uploadedImagePaths = [];
        if (imageFiles.general?.length > 0) {
          for (let i = 0; i < imageFiles.general.length; i++) {
            const file = imageFiles.general[i];
            if (file && typeof file !== 'string') {
              const uploadPath = await uploadImage(file, 'product-images', `products/${Date.now()}_${file.name}`);
              if (uploadPath) {
                uploadedImagePaths.push(uploadPath);
              }
            }
            if (setUploadProgress) {
              setUploadProgress(Math.round(((i + 1) / imageFiles.general.length) * 30));
            }
          }
        }
        
        // 1. Update product basic info
        const updateData = {
            name: productData.name,
            description: productData.description,
            base_price: parseFloat(productData.price) || 0,
            cost_price: parseFloat(productData.costPrice) || 0,
            profit_amount: parseFloat(productData.profitAmount) || 0,
            is_active: productData.isVisible !== false,
            updated_at: new Date().toISOString(),
            last_updated_by: currentUserId
        };

        // Add images if uploaded
        if (uploadedImagePaths.length > 0) {
          updateData.images = uploadedImagePaths;
        }

        const { error: productUpdateError } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', productId);

        if (productUpdateError) {
            console.error('❌ خطأ في تحديث المنتج:', productUpdateError);
            throw productUpdateError;
        }
        
        devLog.log('✅ تم تحديث المنتج الأساسي بنجاح');

        // 2. Update categorization relationships (متوازي)
        // نتحقق من أن هذا تعديل فعلي وليس مجرد تحميل بيانات فارغة
        const shouldUpdateCategories = productData.categoriesChanged === true && Array.isArray(productData.selectedCategories);
        const shouldUpdateProductTypes = productData.categoriesChanged === true && Array.isArray(productData.selectedProductTypes);
        const shouldUpdateSeasonsOccasions = productData.categoriesChanged === true && Array.isArray(productData.selectedSeasonsOccasions);
        const shouldUpdateDepartments = productData.categoriesChanged === true && Array.isArray(productData.selectedDepartments);

        devLog.log('🏷️ تحديث التصنيفات:', {
          shouldUpdateCategories,
          shouldUpdateProductTypes,
          shouldUpdateSeasonsOccasions,
          shouldUpdateDepartments,
          categoriesChanged: productData.categoriesChanged,
          categoriesCount: productData.selectedCategories?.length || 0,
          typesCount: productData.selectedProductTypes?.length || 0,
          seasonsCount: productData.selectedSeasonsOccasions?.length || 0,
          departmentsCount: productData.selectedDepartments?.length || 0
        });

        // تنفيذ تحديثات التصنيفات بشكل متوازي
        const categorizationPromises = [];

        // حماية من حذف التصنيفات إذا لم تتغير
        if (shouldUpdateCategories && productData.categoriesChanged !== false) {
          const categoryPromise = async () => {
            await supabase.from('product_categories').delete().eq('product_id', productId);
            if (productData.selectedCategories?.length > 0) {
              const categoryRelations = productData.selectedCategories.map(categoryId => ({
                product_id: productId,
                category_id: categoryId
              }));
              await supabase.from('product_categories').insert(categoryRelations);
            }
          };
          categorizationPromises.push(categoryPromise());
        }

        if (shouldUpdateProductTypes) {
          const productTypePromise = async () => {
            await supabase.from('product_product_types').delete().eq('product_id', productId);
            if (productData.selectedProductTypes?.length > 0) {
              const productTypeRelations = productData.selectedProductTypes.map(typeId => ({
                product_id: productId,
                product_type_id: typeId
              }));
              await supabase.from('product_product_types').insert(productTypeRelations);
            }
          };
          categorizationPromises.push(productTypePromise());
        }

        if (shouldUpdateSeasonsOccasions) {
          const seasonPromise = async () => {
            await supabase.from('product_seasons_occasions').delete().eq('product_id', productId);
            if (productData.selectedSeasonsOccasions?.length > 0) {
              const seasonRelations = productData.selectedSeasonsOccasions.map(seasonId => ({
                product_id: productId,
                season_occasion_id: seasonId
              }));
              await supabase.from('product_seasons_occasions').insert(seasonRelations);
            }
          };
          categorizationPromises.push(seasonPromise());
        }

        if (shouldUpdateDepartments) {
          const departmentPromise = async () => {
            await supabase.from('product_departments').delete().eq('product_id', productId);
            if (productData.selectedDepartments?.length > 0) {
              const departmentRelations = productData.selectedDepartments.map(deptId => ({
                product_id: productId,
                department_id: deptId
              }));
              await supabase.from('product_departments').insert(departmentRelations);
            }
          };
          categorizationPromises.push(departmentPromise());
        }

        // تنفيذ جميع تحديثات التصنيفات بشكل متوازي
        if (categorizationPromises.length > 0) {
          await Promise.all(categorizationPromises);
          devLog.log('✅ تم تحديث جميع التصنيفات بنجاح');
        }

        // 3. Handle images upload (متوازي)
        const imagePromises = [];
        
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
                setUploadProgress(50 + (uploadedCount / totalImagesToUpload) * 30);
            }
        };

        // رفع الصور العامة بشكل متوازي
        if(generalImageFiles.length > 0) {
            const generalUploadPromise = Promise.all(
                generalImageFiles.map(file => {
                    const path = `public/${productId}/general_${Date.now()}_${Math.random()}`;
                    const promise = uploadImage(file, 'product-images', path);
                    promise.then(progressCallback);
                    return promise;
                })
            ).then(uploadedUrls => {
                const validUrls = uploadedUrls.filter(Boolean);
                const finalGeneralImages = [...existingImageUrls, ...validUrls];
                return supabase
                    .from('products')
                    .update({ images: finalGeneralImages })
                    .eq('id', productId);
            });
            imagePromises.push(generalUploadPromise);
        }

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
        devLog.log('🎨 بدء تحديث المتغيرات:', productData.variants?.length || 0);
        
        if (productData.variants && productData.variants.length > 0) {
            const { data: existingVariants } = await supabase
              .from('product_variants')
              .select('id, barcode, color_id, size_id, images')
              .eq('product_id', productId);
            
            devLog.log('🔍 المتغيرات الموجودة:', existingVariants?.length || 0);
            
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
              
              devLog.log(`🔧 معالجة متغير: ${key}, الكمية: ${v.quantity}, موجود: ${!!existing}`);
              
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
            
            devLog.log(`📊 التحديثات: ${variantsToUpdate.length}, الإدراجات: ${variantsToInsert.length}`);
            
            // تحديث المتغيرات الموجودة مع المخزون - تحسين الأداء بالمعالجة المتوازية
            const variantUpdatePromises = variantsToUpdate.map(async (variant) => {
              try {
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
                
                // تحديث المخزون
                const { data: existingInventory } = await supabase
                  .from('inventory')
                  .select('id')
                  .eq('variant_id', variant.id)
                  .eq('product_id', productId)
                  .maybeSingle();
                  
                if (existingInventory) {
                  // تحديث المخزون الموجود
                  const { error: updateInventoryError } = await supabase
                    .from('inventory')
                    .update({
                      quantity: variant.quantity,
                      min_stock: 5,
                      last_updated_by: user?.user_id || user?.id || '91484496-b887-44f7-9e5d-be9db5567604'
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
                      last_updated_by: user?.user_id || user?.id || '91484496-b887-44f7-9e5d-be9db5567604'
                    });
                    
                  if (insertInventoryError) {
                    console.error('❌ خطأ في إدراج المخزون:', insertInventoryError);
                  }
                }
                
                devLog.log(`✅ تم تحديث المتغير ${variant.id} بكمية ${variant.quantity}`);
                return { success: true, id: variant.id };
              } catch (error) {
                console.error(`❌ فشل في تحديث المتغير ${variant.id}:`, error);
                return { success: false, id: variant.id, error };
              }
            });
            
            // تنفيذ جميع تحديثات المتغيرات بشكل متوازي
            const variantUpdateResults = await Promise.all(variantUpdatePromises);
            const failedUpdates = variantUpdateResults.filter(r => !r.success);
            
            if (failedUpdates.length > 0) {
              devLog.warn(`⚠️ فشل في تحديث ${failedUpdates.length} متغير(ات)`);
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
                  last_updated_by: user?.user_id || user?.id || '91484496-b887-44f7-9e5d-be9db5567604'
                }));

                const { error: inventoryInsertError } = await supabase
                  .from('inventory')
                  .insert(inventoryRecords);
                  
                if (inventoryInsertError) {
                  console.error('❌ خطأ في إدراج المخزون:', inventoryInsertError);
                  throw inventoryInsertError;
                }
                
                devLog.log(`✅ تم إدراج ${newVariants.length} متغير جديد مع المخزون`);
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
                  
                devLog.log(`🗑️ تم حذف ${safeToDelete.length} متغير مع مخزونه`);
              }
            }
            
            devLog.log('✅ تم تحديث جميع المتغيرات والمخزون بنجاح');
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
          devLog.log('✅ تم تحديث القائمة المحلية بنجاح');
        }

        // إضافة توست النجاح الفوري
        toast({
          title: "تم التحديث بنجاح",
          description: `تم تحديث المنتج "${productData.name}" وحفظ جميع التغييرات`,
          variant: "default"
        });

        // إضافة إشعار النجاح للنظام
        if (addNotification) {
            addNotification({
              title: '✅ تم تحديث المنتج بنجاح',
              message: `تم تحديث المنتج "${productData.name}" مع جميع متغيراته وكمياته`,
              type: 'success'
            });
        }
        
        // تحديث فوري للكاش بعد تعديل المنتج
        try {
          devLog.log('🔄 تحديث كاش المنتجات...');
          await supabase.functions.invoke('refresh-product-cache');
          devLog.log('✅ تم تحديث الكاش بنجاح');
        } catch (cacheError) {
          devLog.warn('⚠️ فشل تحديث الكاش (لن يؤثر على عملية التحديث):', cacheError);
        }
        
        if(totalImagesToUpload === 0) setUploadProgress(100);

        devLog.log('🎉 تم تحديث المنتج بالكامل بنجاح!');
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
  }, [addNotification, user, settings]);

  const deleteProduct = useCallback(async (productId) => {
    toast({ title: 'تنبيه', description: 'حذف المنتج لم يتم تنفيذه بعد.' });
    return { success: true };
  }, []);

  const deleteProducts = useCallback(async (productIds) => {
    if (!productIds?.length) return { success: false, error: 'لا توجد منتجات لحذفها' };
    
    devLog.log("🗑️ بدء حذف المنتجات:", productIds);
    
    try {
        const failedDeletions = [];
        const successfulDeletions = [];

        for (const productId of productIds) {
            try {
                devLog.log(`🗑️ حذف المنتج: ${productId}`);
                
                // جلب بيانات المنتج والعلاقات المرتبطة به
                const { data: productData, error: productError } = await supabase
                    .from('products')
                    .select('*, variants:product_variants(*), inventory(*)')
                    .eq('id', productId)
                    .single();

                if (productError && productError.code !== 'PGRST116') {
                    devLog.warn(`لا يمكن جلب المنتج ${productId}:`, productError);
                }

                // حذف جميع البيانات المرتبطة أولاً
                if (productData) {
                    devLog.log(`🧹 تنظيف البيانات المرتبطة للمنتج ${productId}`);
                    
                    // حذف المخزون
                    await supabase.from('inventory').delete().eq('product_id', productId);
                    
                    // حذف المتغيرات
                    await supabase.from('product_variants').delete().eq('product_id', productId);
                    
                    // حذف العلاقات
                    await Promise.all([
                        supabase.from('product_categories').delete().eq('product_id', productId),
                        supabase.from('product_departments').delete().eq('product_id', productId),
                        supabase.from('product_product_types').delete().eq('product_id', productId),
                        supabase.from('product_seasons_occasions').delete().eq('product_id', productId),
                        supabase.from('qr_codes').delete().eq('product_id', productId)
                    ]);
                    
                    // حذف الصور من التخزين
                    if (productData.images && Array.isArray(productData.images)) {
                        for (const imageUrl of productData.images) {
                            try {
                                const pathSegments = imageUrl.split('/');
                                const fileName = pathSegments[pathSegments.length - 1];
                                const bucketPath = `products/${fileName}`;
                                
                                await supabase.storage
                                    .from('product-images')
                                    .remove([bucketPath]);
                                    
                                devLog.log(`🖼️ تم حذف الصورة: ${bucketPath}`);
                            } catch (imgError) {
                                devLog.warn(`خطأ في حذف الصورة ${imageUrl}:`, imgError);
                            }
                        }
                    }
                }

                // أخيراً حذف المنتج نفسه
                const { error: deleteError } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', productId);

                if (deleteError) {
                    console.error(`فشل حذف المنتج ${productId}:`, deleteError);
                    failedDeletions.push(productId);
                } else {
                    devLog.log(`✅ تم حذف المنتج بالكامل: ${productId}`);
                    successfulDeletions.push(productId);
                }
            } catch (error) {
                console.error(`خطأ في حذف المنتج ${productId}:`, error);
                failedDeletions.push(productId);
            }
        }

        // تحديث الحالة المحلية فوراً - هذا الأهم للحذف الفوري
        if (successfulDeletions.length > 0) {
            // إزالة فورية من الحالة المحلية
            setProducts(prev => {
                const newProducts = prev.filter(p => !successfulDeletions.includes(p.id));
                devLog.log(`🔄 تم تحديث الحالة المحلية: حذف ${successfulDeletions.length} منتج(ات)`);
                return newProducts;
            });
            
            // تحديث إضافي للmemory cache إذا وجد
            if (typeof window !== 'undefined' && window.productsCache) {
                window.productsCache = window.productsCache.filter(p => !successfulDeletions.includes(p.id));
            }
        }

        if (failedDeletions.length > 0 && successfulDeletions.length === 0) {
            return { success: false, error: `فشل حذف جميع المنتجات المحددة` };
        } else if (failedDeletions.length > 0) {
            return { 
                success: true, 
                warning: `تم حذف ${successfulDeletions.length} منتج، فشل حذف ${failedDeletions.length} منتج` 
            };
        }

        return { success: true, deleted: successfulDeletions.length };
    } catch (error) {
        console.error('خطأ في حذف المنتجات:', error);
        toast({ 
            title: 'خطأ', 
            description: `فشل حذف المنتجات: ${error.message}`, 
            variant: 'destructive' 
        });
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
      devLog.log('🔄 إعادة تحديث قائمة المنتجات...');
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

      devLog.log('✅ تم تحديث المنتجات بنجاح:', data?.length || 0);
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
