
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useInventory } from '@/contexts/InventoryContext';
import { useVariants } from '@/contexts/VariantsContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, PackagePlus, ArrowRight, Sparkles, Building2, QrCode } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Loader from '@/components/ui/loader';
import { Progress } from "@/components/ui/progress";
import { supabase } from '@/lib/customSupabaseClient';
import { generateUniqueBarcode } from '@/lib/barcode-utils';

import ProductPrimaryInfo from '@/components/add-product/ProductPrimaryInfo';
import MultiSelectCategorization from '@/components/add-product/MultiSelectCategorization';
import ProductVariantSelection from '@/components/add-product/ProductVariantSelection';
import ColorVariantCard from '@/components/add-product/ColorVariantCard';
import devLog from '@/lib/devLogger';

const SortableColorCard = React.memo((props) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.color.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ColorVariantCard {...props} dragHandleProps={listeners} />
    </div>
  );
});

const AddProductPage = () => {
  useScrollToTop(); // فتح الصفحة من الأعلى
  const navigate = useNavigate();
  const location = useLocation();
  const fromPurchases = location.state?.from;
  const selectedDepartment = location.state?.selectedDepartment;
  const editProductData = location.state?.editProduct; // للتحديد إذا كنا في وضع التعديل
  const isEditMode = !!editProductData;

  const { addProduct, updateProduct, settings, loading: inventoryLoading, refetchProducts } = useInventory();
  const { sizes, colors: allColors, loading: variantsLoading } = useVariants();
  
  // حفظ البيانات المؤقت
  const [tempProductData, setTempProductData] = useLocalStorage('temp_product_data', null);
  
  const [productInfo, setProductInfo] = useState(() => {
    if (tempProductData && !isEditMode) {
      return tempProductData.productInfo || {
        name: '', price: '', costPrice: '', description: '', profitAmount: '', profitPercentage: '',
      };
    }
    return {
      name: '', price: '', costPrice: '', description: '', profitAmount: '', profitPercentage: '',
    };
  });
  const [generalImages, setGeneralImages] = useState(() => {
    if (tempProductData && !isEditMode) {
      return tempProductData.generalImages || Array(4).fill(null);
    }
    return Array(4).fill(null);
  });
  const [selectedCategories, setSelectedCategories] = useState(() => {
    if (tempProductData && !isEditMode) {
      return tempProductData.selectedCategories || [];
    }
    return [];
  });
  const [selectedProductTypes, setSelectedProductTypes] = useState(() => {
    if (tempProductData && !isEditMode) {
      return tempProductData.selectedProductTypes || [];
    }
    return [];
  });
  const [selectedSeasonsOccasions, setSelectedSeasonsOccasions] = useState(() => {
    if (tempProductData && !isEditMode) {
      return tempProductData.selectedSeasonsOccasions || [];
    }
    return [];
  });
  const [selectedDepartments, setSelectedDepartments] = useState(() => {
    if (tempProductData && !isEditMode && tempProductData.selectedDepartments) {
      return tempProductData.selectedDepartments;
    }
    return selectedDepartment ? [selectedDepartment] : [];
  });
  const [selectedColors, setSelectedColors] = useState(() => {
    if (tempProductData && !isEditMode) {
      return tempProductData.selectedColors || [];
    }
    return [];
  });
  const [sizeType, setSizeType] = useState(() => {
    if (tempProductData && !isEditMode) {
      return tempProductData.sizeType || 'letter';
    }
    return 'letter';
  });
  const [colorSizeTypes, setColorSizeTypes] = useState(() => {
    if (tempProductData && !isEditMode) {
      return tempProductData.colorSizeTypes || {};
    }
    return {};
  });
  const [variants, setVariants] = useState(() => {
    if (tempProductData && !isEditMode) {
      return tempProductData.variants || [];
    }
    return [];
  });
  const [colorImages, setColorImages] = useState(() => {
    if (tempProductData && !isEditMode) {
      return tempProductData.colorImages || {};
    }
    return {};
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [departments, setDepartments] = useState([]);
  
  // البيانات المحملة مسبقاً مع الأسماء
  const [preloadedCategoriesData, setPreloadedCategoriesData] = useState(null);
  const [preloadedProductTypesData, setPreloadedProductTypesData] = useState(null);
  const [preloadedSeasonsOccasionsData, setPreloadedSeasonsOccasionsData] = useState(null);
  const [preloadedDepartmentsData, setPreloadedDepartmentsData] = useState(null);
  
  // حماية ضد توليد المتغيرات قبل اكتمال تحميل بيانات التعديل
  const isInitialEditLoadComplete = useRef(false);
  
  const isUploading = useMemo(() => uploadProgress > 0 && uploadProgress < 100, [uploadProgress]);

  const allSizesForType = useMemo(() => {
    // في وضع التعديل، نعرض المتغيرات الفعلية بدلاً من القياسات المتاحة
    if (isEditMode) {
      return [];
    }
    const typeToFilter = sizeType || 'letter';
    return sizes.filter(s => s.type === typeToFilter);
  }, [sizes, sizeType, isEditMode]);

  // جلب الأقسام
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const { data } = await supabase
          .from('departments')
          .select('*')
          .eq('is_active', true)
          .order('display_order');
        setDepartments(data || []);
      } catch (error) {
        console.error('خطأ في جلب الأقسام:', error);
      }
    };
    fetchDepartments();
  }, []);

  // تحميل بيانات المنتج في وضع التعديل
  useEffect(() => {
    if (isEditMode && editProductData) {
      devLog.log('📝 تحميل بيانات المنتج للتعديل:', editProductData);
      
      try {
        // تحميل البيانات الأساسية
        setProductInfo({
          name: editProductData.name || '',
          price: String(editProductData.base_price || editProductData.price || ''),
          costPrice: String(editProductData.cost_price || ''),
          description: editProductData.description || '',
          profitAmount: String(editProductData.profit_amount || ''),
          profitPercentage: ''
        });

        // تحميل الصور العامة
        if (editProductData.images && editProductData.images.length > 0) {
          const images = Array(4).fill(null);
          editProductData.images.forEach((img, index) => {
            if (index < 4 && img) images[index] = img;
          });
          setGeneralImages(images);
        }

        // تحميل التصنيفات - استخراج البيانات مع الأسماء
        if (editProductData.product_categories) {
          setSelectedCategories(editProductData.product_categories.map(pc => pc.category_id));
          // حفظ بيانات التصنيفات مع الأسماء
          setPreloadedCategoriesData(editProductData.product_categories.map(pc => ({
            id: pc.category_id,
            name: pc.categories?.name || `تصنيف ${pc.category_id}`
          })));
        }
        if (editProductData.product_product_types) {
          setSelectedProductTypes(editProductData.product_product_types.map(pt => pt.product_type_id));
          setPreloadedProductTypesData(editProductData.product_product_types.map(pt => ({
            id: pt.product_type_id,
            name: pt.product_types?.name || `نوع ${pt.product_type_id}`
          })));
        }
        if (editProductData.product_seasons_occasions) {
          setSelectedSeasonsOccasions(editProductData.product_seasons_occasions.map(so => so.season_occasion_id));
          setPreloadedSeasonsOccasionsData(editProductData.product_seasons_occasions.map(so => ({
            id: so.season_occasion_id,
            name: so.seasons_occasions?.name || `موسم ${so.season_occasion_id}`,
            type: so.seasons_occasions?.type || 'season'
          })));
        }
        if (editProductData.product_departments) {
          setSelectedDepartments(editProductData.product_departments.map(pd => pd.department_id));
          setPreloadedDepartmentsData(editProductData.product_departments.map(pd => ({
            id: pd.department_id,
            name: pd.departments?.name || `قسم ${pd.department_id}`
          })));
        }

        // تحميل الألوان والمتغيرات
        if (editProductData.variants && editProductData.variants.length > 0) {
          // استخراج الألوان الفريدة
          const uniqueColors = [];
          const colorImages = {};
          const extractedColorSizeTypes = {};
          
          editProductData.variants.forEach(variant => {
            if (variant.colors) {
              const colorExists = uniqueColors.find(c => c.id === variant.colors.id);
              if (!colorExists) {
                uniqueColors.push({
                  id: variant.colors.id,
                  name: variant.colors.name,
                  hex_code: variant.colors.hex_code
                });
              }
              
              // تحميل صور الألوان إذا وجدت
              if (variant.images && variant.images.length > 0) {
                colorImages[variant.colors.id] = variant.images[0];
              }

              // استخراج أنواع القياسات لكل لون من البيانات الحقيقية
              if (variant.sizes) {
                const colorId = variant.colors.id;
                const sizeType = variant.sizes.type || 'letter';
                
                if (!extractedColorSizeTypes[colorId]) {
                  extractedColorSizeTypes[colorId] = [];
                }
                
                if (!extractedColorSizeTypes[colorId].includes(sizeType)) {
                  extractedColorSizeTypes[colorId].push(sizeType);
                }
              }
            }
          });
          
          setSelectedColors(uniqueColors);
          setColorImages(colorImages);
          
          // ⚠️ مهم جداً: تحديد نوع القياس أولاً قبل أي شيء آخر
          const firstVariantSizeType = editProductData.variants[0]?.sizes?.type || 'letter';
          devLog.log('🔧 نوع القياس المستخرج من البيانات:', firstVariantSizeType);
          setSizeType(firstVariantSizeType);
          
          // تعيين أنواع القياسات المستخرجة لكل لون
          setColorSizeTypes(extractedColorSizeTypes);
          devLog.log('🎨 أنواع القياسات المستخرجة لكل لون:', extractedColorSizeTypes);
          
          // تحويل المتغيرات للتنسيق المطلوب مع تحميل الكمية من المخزون
          const formattedVariants = editProductData.variants.map(variant => {
            // العثور على كمية المخزون للمتغير
            let inventoryQuantity = 0;
            if (editProductData.inventory) {
              const variantInventory = editProductData.inventory.find(inv => inv.variant_id === variant.id);
              inventoryQuantity = variantInventory?.quantity || 0;
            } else if (variant.inventory) {
              // fallback من البيانات الموحدة حيث تكون بيانات المخزون داخل كل متغير
              const inv = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory;
              inventoryQuantity = inv?.quantity || 0;
            }
            
            return {
              ...variant,
              colorId: variant.color_id,
              sizeId: variant.size_id,
              color: variant.colors?.name || 'لون غير محدد',
              color_hex: variant.colors?.hex_code || '#000000',
              size: variant.sizes?.name || 'قياس غير محدد',
              quantity: inventoryQuantity, // استخدام الكمية من المخزون
              costPrice: variant.cost_price || editProductData.cost_price || 0,
              profitAmount: variant.profit_amount || editProductData.profit_amount || 0,
              hint: variant.hint || ''
            };
          });
          
          devLog.log('📊 المتغيرات المحولة:', formattedVariants);
          setVariants(formattedVariants);
        }
        
        // ✅ تأخير تفعيل الحماية للتأكد من اكتمال جميع setState
        setTimeout(() => {
          isInitialEditLoadComplete.current = true;
          devLog.log('✅ تم تحميل بيانات المنتج بنجاح للتعديل - الحماية مفعلة');
        }, 100);
      } catch (error) {
        console.error('❌ خطأ في تحميل بيانات المنتج للتعديل:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ في تحميل بيانات المنتج. يرجى المحاولة مرة أخرى.',
          variant: 'destructive'
        });
        navigate('/manage-products');
      }
    }
  }, [isEditMode, editProductData, navigate]);

  useEffect(() => {
    // لا نولد متغيرات جديدة في وضع التعديل
    if (isEditMode) return;
    
    const generateVariants = () => {
      if (selectedColors.length === 0) {
        setVariants([]);
        return;
      }
  
      const newVariants = [];
      selectedColors.forEach(color => {
        // للألوان التي لها أنواع قياسات محددة
        const colorSizes = colorSizeTypes[color.id] || [sizeType];
        
        colorSizes.forEach(sizeTypeForColor => {
          const sizesForThisType = sizes.filter(s => s.type === sizeTypeForColor);
          
          if (sizesForThisType.length > 0) {
            sizesForThisType.forEach(size => {
              // توليد باركود فريد للمتغير
              const barcode = generateUniqueBarcode(
                productInfo.name || 'منتج',
                color.name,
                size.name
              );
              newVariants.push({
                colorId: color.id,
                sizeId: size.id,
                color: color.name,
                color_hex: color.hex_code,
                size: size.name,
                sizeType: sizeTypeForColor,
                quantity: 0,
                price: parseFloat(productInfo.price) || 0,
                costPrice: parseFloat(productInfo.costPrice) || 0,
                barcode: barcode,
                hint: ''
              });
            });
          }
        });
      });
      setVariants(newVariants);
    };
    
    if (settings && sizes.length > 0) {
        generateVariants();
    }
  }, [selectedColors, sizeType, colorSizeTypes, sizes, productInfo.price, productInfo.costPrice, settings, isEditMode]);

  // إضافة effect منفصل لتوليد المتغيرات عند إضافة لون جديد في وضع التعديل
  useEffect(() => {
    if (!isEditMode) return;
    
    // ⚠️ لا نولّد متغيرات جديدة حتى يكتمل التحميل الأولي
    if (!isInitialEditLoadComplete.current) {
      devLog.log('⏳ انتظار اكتمال التحميل الأولي قبل توليد متغيرات جديدة...');
      return;
    }
    
    const generateVariantsForNewColors = () => {
      setVariants(currentVariants => {
        // العثور على الألوان الجديدة التي لا توجد لها متغيرات
        const existingColorIds = [...new Set(currentVariants.map(v => v.colorId || v.color_id))];
        const newColors = selectedColors.filter(color => !existingColorIds.includes(color.id));
        
        if (newColors.length === 0) return currentVariants;
        
        devLog.log('🆕 توليد متغيرات للألوان الجديدة:', newColors);
        
        const newVariants = [];
        newColors.forEach(color => {
          // استخدام نوع القياس المحدد للون أو الافتراضي
          const colorSizes = colorSizeTypes[color.id] || [sizeType];
          
          colorSizes.forEach(sizeTypeForColor => {
            const sizesForThisType = sizes.filter(s => s.type === sizeTypeForColor);
            
            sizesForThisType.forEach(size => {
              const barcode = generateUniqueBarcode(
                productInfo.name || 'منتج',
                color.name,
                size.name
              );
              
              newVariants.push({
                colorId: color.id,
                sizeId: size.id,
                color: color.name,
                color_hex: color.hex_code,
                size: size.name,
                sizeType: sizeTypeForColor,
                quantity: 0,
                price: parseFloat(productInfo.price) || 0,
                costPrice: parseFloat(productInfo.costPrice) || 0,
                barcode: barcode,
                hint: ''
              });
            });
          });
        });
        
        if (newVariants.length > 0) {
          devLog.log('✅ تم إضافة متغيرات للألوان الجديدة:', newVariants);
          return [...currentVariants, ...newVariants];
        }
        
        return currentVariants;
      });
    };
    
    if (sizes.length > 0 && selectedColors.length > 0) {
      generateVariantsForNewColors();
    }
  }, [selectedColors, sizes, colorSizeTypes, sizeType, isEditMode, productInfo.name, productInfo.price, productInfo.costPrice]);

  // ref لتتبع القيم السابقة لـ colorSizeTypes
  const prevColorSizeTypesRef = useRef({});

  // Effect لإعادة توليد المتغيرات عند تغيير نوع القياس في وضع التعديل
  useEffect(() => {
    if (!isEditMode) return;
    if (!isInitialEditLoadComplete.current) return;
    if (sizes.length === 0) return;
    
    // التحقق من وجود تغيير حقيقي في colorSizeTypes
    const hasRealChange = Object.keys(colorSizeTypes).some(colorId => {
      const prev = prevColorSizeTypesRef.current[colorId] || [];
      const current = colorSizeTypes[colorId] || [];
      return JSON.stringify([...prev].sort()) !== JSON.stringify([...current].sort());
    });
    
    // تحديث القيم السابقة
    const shouldUpdate = Object.keys(prevColorSizeTypesRef.current).length > 0;
    prevColorSizeTypesRef.current = { ...colorSizeTypes };
    
    if (!hasRealChange || !shouldUpdate) return;
    
    devLog.log('🔄 تم اكتشاف تغيير في نوع القياس، إعادة توليد المتغيرات...');
    
    setVariants(currentVariants => {
      const newVariants = [];
      
      selectedColors.forEach(color => {
        // الحصول على نوع القياس الجديد لهذا اللون
        const newSizeTypes = colorSizeTypes[color.id] || [sizeType];
        
        // الحصول على المتغيرات الحالية لهذا اللون
        const existingColorVariants = currentVariants.filter(v => 
          (v.colorId === color.id || v.color_id === color.id)
        );
        
        // التحقق من أن أنواع القياسات الحالية تتطابق مع الأنواع الجديدة
        const existingTypes = [...new Set(existingColorVariants.map(v => 
          v.sizeType || v.sizes?.type || 'letter'
        ))];
        
        const needsRegeneration = !newSizeTypes.every(t => existingTypes.includes(t)) ||
                                   !existingTypes.every(t => newSizeTypes.includes(t));
        
        if (needsRegeneration) {
          devLog.log(`🔧 إعادة توليد متغيرات اللون ${color.name} من ${existingTypes} إلى ${newSizeTypes}`);
          
          // إعادة توليد المتغيرات بنوع القياس الجديد
          newSizeTypes.forEach(sizeTypeForColor => {
            const sizesForThisType = sizes.filter(s => s.type === sizeTypeForColor);
            
            sizesForThisType.forEach(size => {
              // البحث عن متغير موجود بنفس القياس للحفاظ على الكمية
              const existingVariant = existingColorVariants.find(v => 
                (v.sizeId === size.id || v.size_id === size.id)
              );
              
              const barcode = generateUniqueBarcode(
                productInfo.name || 'منتج',
                color.name,
                size.name
              );
              
              newVariants.push({
                colorId: color.id,
                sizeId: size.id,
                color: color.name,
                color_hex: color.hex_code,
                size: size.name,
                sizeType: sizeTypeForColor,
                quantity: existingVariant?.quantity || 0,
                price: parseFloat(productInfo.price) || 0,
                costPrice: parseFloat(productInfo.costPrice) || 0,
                barcode: barcode,
                hint: existingVariant?.hint || ''
              });
            });
          });
        } else {
          // الإبقاء على المتغيرات الحالية
          newVariants.push(...existingColorVariants);
        }
      });
      
      devLog.log('✅ تم إعادة توليد المتغيرات:', newVariants.length);
      return newVariants;
    });
  }, [colorSizeTypes, isEditMode, selectedColors, sizes, sizeType, productInfo.name, productInfo.price, productInfo.costPrice]);

  // حفظ البيانات تلقائياً كلما تغيرت مع debouncing محسن
  useEffect(() => {
    if (!isEditMode && (productInfo.name?.trim() || selectedColors.length > 0)) {
      const timeoutId = setTimeout(() => {
        const dataToSave = {
          productInfo,
          generalImages: generalImages.map(img => img?.name || img), // حفظ أسماء الملفات فقط
          selectedCategories,
          selectedProductTypes,
          selectedSeasonsOccasions,
          selectedDepartments,
          selectedColors,
          sizeType,
          colorSizeTypes,
          variants,
          colorImages: Object.keys(colorImages), // حفظ معرفات الألوان فقط
          lastSaved: Date.now(),
          savedAt: new Date().toISOString()
        };
        setTempProductData(dataToSave);
        
        // عرض مؤشر الحفظ
        devLog.log('💾 تم حفظ البيانات مؤقتاً:', new Date().toLocaleTimeString('ar-EG'));
      }, 2000); // حفظ بعد ثانيتين من عدم النشاط

      return () => clearTimeout(timeoutId);
    }
  }, [
    productInfo, generalImages, selectedCategories, selectedProductTypes,
    selectedSeasonsOccasions, selectedDepartments, selectedColors, sizeType,
    colorSizeTypes, variants, colorImages, isEditMode, setTempProductData
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productInfo.name || !productInfo.price) {
        toast({ title: "خطأ", description: "يرجى إدخال اسم المنتج وسعره الأساسي.", variant: "destructive"});
        return;
    }
    
    // فحص تكرار اسم المنتج (في حالة الإضافة فقط)
    if (!isEditMode) {
      const { data: existingProducts, error: checkError } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', productInfo.name.trim())
        .limit(1);
      
      if (!checkError && existingProducts && existingProducts.length > 0) {
        const confirmed = window.confirm(
          `⚠️ يوجد منتج بنفس الاسم "${existingProducts[0].name}".\n\nهل تريد الاستمرار بإضافة المنتج رغم ذلك؟`
        );
        
        if (!confirmed) {
          return; // إلغاء الإضافة
        }
      }
    }
    if (selectedColors.length === 0) {
      toast({ title: "خطأ", description: "يرجى اختيار لون واحد على الأقل.", variant: "destructive"});
      return;
    }

    // التحقق من أن جميع المتغيرات لها كميات محددة
    const variantsWithoutQuantity = variants.filter(v => !v.quantity || v.quantity === 0);
    if (variantsWithoutQuantity.length > 0) {
      toast({ 
        title: "تحذير", 
        description: `يوجد ${variantsWithoutQuantity.length} متغير بدون كمية محددة. تأكد من إدخال الكميات للجميع.`,
        variant: "destructive"
      });
    }

    devLog.log('📊 بيانات المتغيرات قبل الحفظ:', variants);

    setIsSubmitting(true);
    setUploadProgress(0);
    
    const productData = {
      ...productInfo,
      price: parseFloat(productInfo.price || 0),
      costPrice: parseFloat(productInfo.costPrice || 0),
      profitAmount: parseFloat(productInfo.profitAmount || 0),
      profitPercentage: productInfo.profitPercentage ? parseFloat(productInfo.profitPercentage) : null,
      variants: variants.map(v => ({
        ...v,
        quantity: parseInt(v.quantity) || 0,
        price: parseFloat(v.price || productInfo.price || 0),
        costPrice: parseFloat(v.costPrice || productInfo.costPrice || 0)
      })),
      isVisible: true,
    };

    // إرسال التصنيفات الحالية دائماً في وضع التعديل - إصلاح مشكلة حذف التصنيفات
    if (isEditMode) {
      // في وضع التعديل، نرسل التصنيفات الحالية دائماً لحفظها
      productData.selectedCategories = selectedCategories || [];
      productData.selectedProductTypes = selectedProductTypes || [];
      productData.selectedSeasonsOccasions = selectedSeasonsOccasions || [];
      productData.selectedDepartments = selectedDepartments || [];
      // تحديد ما إذا كانت التصنيفات تغيرت فعلياً
      const originalCategories = editProductData?.product_categories?.map(pc => pc.category_id).sort() || [];
      const currentCategories = [...selectedCategories].sort();
      productData.categoriesChanged = JSON.stringify(originalCategories) !== JSON.stringify(currentCategories);
      
      devLog.log('🏷️ تصنيفات التعديل:', {
        categories: selectedCategories?.length || 0,
        types: selectedProductTypes?.length || 0,
        seasons: selectedSeasonsOccasions?.length || 0,
        departments: selectedDepartments?.length || 0
      });
    } else {
      // للمنتجات الجديدة، أرسل التصنيفات مع قيمها
      productData.selectedCategories = selectedCategories || [];
      productData.selectedProductTypes = selectedProductTypes || [];
      productData.selectedSeasonsOccasions = selectedSeasonsOccasions || [];
      productData.selectedDepartments = selectedDepartments || [];
    }
    
    devLog.log('📦 إرسال التصنيفات:', {
      categoriesCount: productData.selectedCategories?.length || 0,
      typesCount: productData.selectedProductTypes?.length || 0,
      seasonsCount: productData.selectedSeasonsOccasions?.length || 0,
      departmentsCount: productData.selectedDepartments?.length || 0,
      isEditMode,
      categoriesChanged: productData.categoriesChanged
    });
    
    devLog.log('📦 بيانات المنتج النهائية للحفظ:', productData);
    
    const imageFiles = {
      general: generalImages.filter(Boolean),
      colorImages: colorImages,
    };
    
    let result;
    if (isEditMode) {
      result = await updateProduct(editProductData.id, productData, imageFiles, setUploadProgress);
    } else {
      result = await addProduct(productData, imageFiles, setUploadProgress);
    }

    if (result.success) {
      // حذف البيانات المؤقتة عند النجاح
      setTempProductData(null);
      
      toast({ 
        title: 'نجاح', 
        description: isEditMode ? `تم تحديث المنتج "${productInfo.name}" بنجاح!` : `تمت إضافة المنتج "${productInfo.name}" بنجاح!`,
        variant: 'default'
      });
      
      if (!isEditMode) {
        // تفريغ النموذج للمنتج الجديد
        setProductInfo({
          name: '',
          price: '',
          costPrice: '',
          profitAmount: '',
          profitPercentage: '',
          description: '',
          note: ''
        });
        setGeneralImages([]);
        setSelectedCategories([]);
        setSelectedProductTypes([]);
        setSelectedSeasonsOccasions([]);
        setSelectedDepartments([]);
        setSelectedColors([]);
        setSizeType('');
        setColorSizeTypes({});
        setVariants([]);
        setColorImages({});
        setUploadProgress(0);
      }
      
      if (fromPurchases) {
        navigate(fromPurchases, { state: { productJustAdded: true } });
      } else if (isEditMode) {
        navigate('/manage-products');
      }
      // في حالة إضافة منتج جديد، نبقى في الصفحة مع النموذج المفرغ
    } else {
      toast({ title: 'خطأ', description: result.error, variant: 'destructive' });
    }
    setIsSubmitting(false);
    setUploadProgress(0);
  };
  
  const onDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedColors((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleColorImageSelect = useCallback((colorId, file) => {
    setColorImages(prev => ({...prev, [colorId]: file }));
  }, []);

  const handleColorImageRemove = useCallback((colorId) => {
    setColorImages(prev => {
        const newImages = {...prev};
        delete newImages[colorId];
        return newImages;
    });
  }, []);
  
  const handleGeneralImageSelect = useCallback((index, file) => {
    setGeneralImages(prev => {
      const newImages = [...prev];
      newImages[index] = file;
      return newImages;
    });
  }, []);

  const handleGeneralImageRemove = useCallback((index) => {
    setGeneralImages(prev => {
      const newImages = [...prev];
      newImages[index] = null;
      return newImages;
    });
  }, []);
  
  const loading = inventoryLoading || variantsLoading;
  if (loading && !isSubmitting) return <div className="h-full w-full flex items-center justify-center"><Loader /></div>;

  return (
    <>
      <Helmet><title>{isEditMode ? 'تعديل المنتج' : 'إضافة منتج جديد'} - RYUS</title></Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-2 md:p-6 space-y-3 md:space-y-6">
          
          {/* Header محسن للهاتف */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl border shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-blue-600/10" />
            <div className="relative p-3 md:p-6">
              {/* سطر علوي للهاتف */}
              <div className="flex justify-between items-center mb-3 md:mb-0">
                <Button type="button" variant="outline" size="sm" onClick={() => navigate(fromPurchases || '/add-product')}>
                  <ArrowRight className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">رجوع</span>
                </Button>
                 <Button 
                   onClick={handleSubmit}
                   disabled={isSubmitting || isUploading || !settings}
                   className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-medium"
                   size="sm"
                 >
                    {isSubmitting || isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                        <span className="text-sm">جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <PackagePlus className="w-4 h-4 ml-2" />
                        <span className="text-sm sm:text-base">
                          {isEditMode ? "حفظ التحديثات" : "حفظ المنتج"}
                        </span>
                      </>
                    )}
                 </Button>
              </div>
              
              {/* العنوان والأزرار للشاشات الكبيرة */}
              <div className="hidden md:flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="flex gap-2">
                     <Button type="button" variant="outline" onClick={() => navigate('/manage-variants')}>
                        <Building2 className="h-4 w-4 ml-2" />
                        إدارة المتغيرات
                     </Button>
                     <Button type="button" variant="outline" onClick={() => navigate('/qr-labels')}>
                        <QrCode className="h-4 w-4 ml-2" />
                        طباعة ملصقات QR
                     </Button>
                   </div>
                   <div>
                      <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                          {isEditMode ? 'تعديل المنتج' : 'إضافة منتج جديد'}
                        </h1>
                        {tempProductData?.savedAt && !isEditMode && (
                          <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                            محفوظ: {new Date(tempProductData.savedAt).toLocaleTimeString('ar-EG')}
                          </div>
                        )}
                      </div>
                     {selectedDepartment && (
                       <div className="flex items-center gap-2 mt-2">
                         <Building2 className="h-4 w-4 text-muted-foreground" />
                         <span className="text-sm text-muted-foreground">
                           القسم المحدد: <span className="font-semibold text-primary">{selectedDepartment.name}</span>
                         </span>
                       </div>
                     )}
                   </div>
                </div>
                <div className="flex items-center gap-4">
                   {isUploading && <Progress value={uploadProgress} className="w-32" />}
                </div>
              </div>
              
              {/* العنوان للهاتف */}
              <div className="md:hidden text-center">
                 <div className="flex items-center justify-center gap-2">
                   <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                     {isEditMode ? 'تعديل المنتج' : 'إضافة منتج جديد'}
                   </h1>
                   {tempProductData?.savedAt && !isEditMode && (
                     <div className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-center">
                       محفوظ
                     </div>
                   )}
                 </div>
                {selectedDepartment && (
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      القسم: <span className="font-semibold text-primary">{selectedDepartment.name}</span>
                    </span>
                  </div>
                )}
                {isUploading && (
                  <div className="mt-2">
                    <Progress value={uploadProgress} className="w-full h-2" />
                  </div>
                )}
              </div>
              
              {/* أزرار إضافية للهاتف */}
              <div className="md:hidden flex justify-center gap-2 mt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => navigate('/manage-variants')}>
                   <Building2 className="h-4 w-4" />
                   <span className="text-xs mr-1">المتغيرات</span>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => navigate('/qr-labels')}>
                   <QrCode className="h-4 w-4" />
                   <span className="text-xs mr-1">طباعة QR</span>
                </Button>
              </div>
            </div>
          </div>

          {/* نموذج الإضافة محسن للهاتف */}
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-6 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
              <div className="lg:col-span-2 space-y-3 md:space-y-6">
                <ProductPrimaryInfo 
                  productInfo={productInfo} 
                  setProductInfo={setProductInfo}
                  generalImages={generalImages}
                  onImageSelect={handleGeneralImageSelect}
                  onImageRemove={handleGeneralImageRemove}
                />
                <MultiSelectCategorization
                  selectedCategories={selectedCategories}
                  setSelectedCategories={setSelectedCategories}
                  selectedProductTypes={selectedProductTypes}
                  setSelectedProductTypes={setSelectedProductTypes}
                  selectedSeasonsOccasions={selectedSeasonsOccasions}
                  setSelectedSeasonsOccasions={setSelectedSeasonsOccasions}
                  selectedDepartments={selectedDepartments}
                  setSelectedDepartments={setSelectedDepartments}
                  preloadedCategoriesData={preloadedCategoriesData}
                  preloadedProductTypesData={preloadedProductTypesData}
                  preloadedSeasonsOccasionsData={preloadedSeasonsOccasionsData}
                  preloadedDepartmentsData={preloadedDepartmentsData}
                />
                <ProductVariantSelection 
                  selectedColors={selectedColors}
                  setSelectedColors={setSelectedColors}
                  sizeType={sizeType}
                  setSizeType={setSizeType}
                  colorSizeTypes={colorSizeTypes}
                  setColorSizeTypes={setColorSizeTypes}
                />
              </div>
              
              {/* معلومات إضافية في الشريط الجانبي */}
              <div className="space-y-3 md:space-y-6 order-first lg:order-last">
                {selectedDepartment && (
                  <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-primary text-sm md:text-base">
                        <Sparkles className="h-4 w-4 md:h-5 md:w-5" />
                        القسم المحدد
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 md:space-y-3">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className={`p-1.5 md:p-2 rounded-lg bg-gradient-to-r ${selectedDepartment.color}`}>
                            <Building2 className="h-3 w-3 md:h-4 md:w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm md:text-base">{selectedDepartment.name}</p>
                            <p className="text-xs md:text-sm text-muted-foreground">{selectedDepartment.description}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* نصائح سريعة - مخفية على الهاتف */}
                <Card className="hidden lg:block">
                  <CardHeader>
                    <CardTitle className="text-sm">نصائح سريعة</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>• تأكد من إدخال سعر التكلفة لحساب الأرباح</p>
                    <p>• اختر ألوان متعددة لزيادة خيارات العملاء</p>
                    <p>• أضف صور عالية الجودة للمنتج</p>
                    <p>• اختر التصنيفات المناسبة لتسهيل البحث</p>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            {variants.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg md:text-xl">إدارة المتغيرات النهائية</CardTitle></CardHeader>
                <CardContent className="p-3 md:p-6">
                  <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={selectedColors.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3 md:space-y-4">
                         {selectedColors.map((color) => (
                             <SortableColorCard
                              key={color.id}
                              id={color.id}
                              color={color}
                              allSizesForType={variants.filter(v => (v.colorId === color.id || v.color_id === color.id))}
                              variants={variants}
                              setVariants={setVariants}
                              price={productInfo.price}
                              costPrice={productInfo.costPrice}
                              profitAmount={productInfo.profitAmount}
                              handleImageSelect={(file) => handleColorImageSelect(color.id, file)}
                              handleImageRemove={() => handleColorImageRemove(color.id)}
                              initialImage={colorImages[color.id] || null}
                              colorSizeTypes={colorSizeTypes[color.id] || [sizeType]}
                              isEditMode={isEditMode}
                              showInventoryData={isEditMode}
                              productName={productInfo.name}
                            />
                         ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </CardContent>
              </Card>
            )}
            
            {/* زر حفظ وإلغاء ثابتة في الأسفل */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-3 md:p-4 shadow-2xl z-50">
              <div className="container mx-auto max-w-7xl">
                <div className="flex gap-3">
                  {/* زر الإلغاء */}
                  <Button
                    type="button"
                    onClick={() => navigate('/products')}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    <ArrowRight className="w-5 h-5 ml-2" />
                    <span>إلغاء</span>
                  </Button>
                  
                  {/* زر الحفظ */}
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || isUploading || !productInfo.name || !settings}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-semibold shadow-lg transform transition-all hover:scale-[1.02] disabled:hover:scale-100"
                    size="lg"
                  >
                    {isSubmitting || isUploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin ml-2" />
                        <span>جاري الحفظ... {uploadProgress > 0 && `(${Math.round(uploadProgress)}%)`}</span>
                      </>
                    ) : (
                      <>
                        <PackagePlus className="w-5 h-5 ml-2" />
                        <span>{isEditMode ? 'حفظ التحديثات' : 'حفظ المنتج'}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
          
        </div>
      </div>
    </>
  );
};

export default AddProductPage;
