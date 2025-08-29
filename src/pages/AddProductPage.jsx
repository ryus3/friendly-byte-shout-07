import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useInventory } from '@/contexts/InventoryContext';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, PackagePlus, ArrowRight, Sparkles, Building2, QrCode, Save, AlertTriangle } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Loader from '@/components/ui/loader';
import { Progress } from "@/components/ui/progress";
import { supabase } from '@/lib/customSupabaseClient';
import { generateUniqueBarcode } from '@/lib/barcode-utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

import ProductPrimaryInfo from '@/components/add-product/ProductPrimaryInfo';
import MultiSelectCategorization from '@/components/add-product/MultiSelectCategorization';
import ProductVariantSelection from '@/components/add-product/ProductVariantSelection';
import ColorVariantCard from '@/components/add-product/ColorVariantCard';

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
  const editProductData = location.state?.editProduct;
  const isEditMode = !!editProductData;

  const { addProduct, updateProduct, settings, loading: inventoryLoading, refetchProducts } = useInventory();
  const { sizes, colors: allColors, loading: variantsLoading } = useVariants();
  
  // استخدام localStorage للحفظ المؤقت
  const [tempProductData, setTempProductData] = useLocalStorage('temp_product_data', null);
  const [showTempDataAlert, setShowTempDataAlert] = useState(false);
  
  const [productInfo, setProductInfo] = useState({
    name: '', price: '', costPrice: '', description: '', profitAmount: '', profitPercentage: '',
  });
  const [generalImages, setGeneralImages] = useState(Array(4).fill(null));
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedProductTypes, setSelectedProductTypes] = useState([]);
  const [selectedSeasonsOccasions, setSelectedSeasonsOccasions] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState(selectedDepartment ? [selectedDepartment] : []);
  const [selectedColors, setSelectedColors] = useState([]);
  const [sizeType, setSizeType] = useState('letter');
  const [colorSizeTypes, setColorSizeTypes] = useState({});
  const [variants, setVariants] = useState([]);
  const [colorImages, setColorImages] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [departments, setDepartments] = useState([]);
  const isUploading = useMemo(() => uploadProgress > 0 && uploadProgress < 100, [uploadProgress]);

  const allSizesForType = useMemo(() => {
    const typeToFilter = sizeType || 'letter';
    return sizes.filter(s => s.type === typeToFilter);
  }, [sizes, sizeType]);

  // التحقق من وجود بيانات مؤقتة عند فتح الصفحة
  useEffect(() => {
    if (!isEditMode && tempProductData && Object.keys(tempProductData).length > 0) {
      // التحقق من أن البيانات حديثة (أقل من 24 ساعة)
      const savedTime = tempProductData.savedAt;
      const now = Date.now();
      const timeDiff = now - savedTime;
      const hoursOld = timeDiff / (1000 * 60 * 60);
      
      if (hoursOld < 24) {
        setShowTempDataAlert(true);
      } else {
        // مسح البيانات القديمة
        setTempProductData(null);
      }
    }
  }, [isEditMode, tempProductData, setTempProductData]);

  // استعادة البيانات المؤقتة
  const restoreTempData = useCallback(() => {
    if (tempProductData) {
      setProductInfo(tempProductData.productInfo || {});
      setSelectedCategories(tempProductData.selectedCategories || []);
      setSelectedProductTypes(tempProductData.selectedProductTypes || []);
      setSelectedSeasonsOccasions(tempProductData.selectedSeasonsOccasions || []);
      setSelectedDepartments(tempProductData.selectedDepartments || []);
      setSelectedColors(tempProductData.selectedColors || []);
      setSizeType(tempProductData.sizeType || 'letter');
      setColorSizeTypes(tempProductData.colorSizeTypes || {});
      setVariants(tempProductData.variants || []);
      setColorImages(tempProductData.colorImages || {});
      // ملاحظة: لا نستعيد الصور العامة للحفاظ على الأداء
      setShowTempDataAlert(false);
      toast({
        title: '✅ تم استعادة البيانات',
        description: 'تم استعادة البيانات المحفوظة مؤقتاً بنجاح',
      });
    }
  }, [tempProductData]);

  // مسح البيانات المؤقتة
  const clearTempData = useCallback(() => {
    setTempProductData(null);
    setShowTempDataAlert(false);
    toast({
      title: 'تم مسح البيانات المؤقتة',
      description: 'يمكنك البدء بإدخال بيانات جديدة',
    });
  }, [setTempProductData]);

  // حفظ تلقائي للبيانات المؤقتة عند التغيير
  useEffect(() => {
    if (!isEditMode && !isSubmitting) {
      // فقط في حالة وجود بيانات مفيدة
      const hasData = productInfo.name || selectedColors.length > 0 || variants.length > 0;
      
      if (hasData) {
        const dataToSave = {
          productInfo,
          selectedCategories,
          selectedProductTypes,
          selectedSeasonsOccasions,
          selectedDepartments,
          selectedColors,
          sizeType,
          colorSizeTypes,
          variants,
          colorImages,
          savedAt: Date.now()
        };
        
        // تأخير الحفظ للتقليل من عدد العمليات
        const timeoutId = setTimeout(() => {
          setTempProductData(dataToSave);
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [
    productInfo, selectedCategories, selectedProductTypes, selectedSeasonsOccasions,
    selectedDepartments, selectedColors, sizeType, colorSizeTypes, variants, 
    colorImages, isEditMode, isSubmitting, setTempProductData
  ]);

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
      console.log('📝 تحميل بيانات المنتج للتعديل:', editProductData);
      
      try {
        // تحميل البيانات الأساسية
        setProductInfo({
          name: editProductData.name || '',
          price: editProductData.base_price || editProductData.price || '',
          costPrice: editProductData.cost_price || '',
          description: editProductData.description || '',
          profitAmount: editProductData.profit_amount || '',
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

        // تحميل التصنيفات
        if (editProductData.product_categories) {
          setSelectedCategories(editProductData.product_categories.map(pc => pc.category_id));
        }
        if (editProductData.product_product_types) {
          setSelectedProductTypes(editProductData.product_product_types.map(pt => pt.product_type_id));
        }
        if (editProductData.product_seasons_occasions) {
          setSelectedSeasonsOccasions(editProductData.product_seasons_occasions.map(so => so.season_occasion_id));
        }
        if (editProductData.product_departments) {
          setSelectedDepartments(editProductData.product_departments.map(pd => pd.department_id));
        }

        // تحميل الألوان والمتغيرات
        if (editProductData.variants && editProductData.variants.length > 0) {
          // استخراج الألوان الفريدة
          const uniqueColors = [];
          const colorImages = {};
          
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
            }
          });
          
          setSelectedColors(uniqueColors);
          setColorImages(colorImages);
          
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
          
          console.log('📊 المتغيرات المحولة:', formattedVariants);
          setVariants(formattedVariants);
        }
        
        console.log('✅ تم تحميل بيانات المنتج بنجاح للتعديل');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productInfo.name || !productInfo.price) {
        toast({ title: "خطأ", description: "يرجى إدخال اسم المنتج وسعره الأساسي.", variant: "destructive"});
        return;
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

    console.log('📊 بيانات المتغيرات قبل الحفظ:', variants);

    setIsSubmitting(true);
    setUploadProgress(0);
    
    const productData = {
      ...productInfo,
      price: parseFloat(productInfo.price),
      costPrice: productInfo.costPrice ? parseFloat(productInfo.costPrice) : null,
      profitAmount: productInfo.profitAmount ? parseFloat(productInfo.profitAmount) : 0,
      profitPercentage: productInfo.profitPercentage ? parseFloat(productInfo.profitPercentage) : null,
      selectedCategories,
      selectedProductTypes,
      selectedSeasonsOccasions,
      selectedDepartments,
      variants: variants.map(v => ({
        ...v,
        quantity: parseInt(v.quantity) || 0,
        price: parseFloat(v.price) || parseFloat(productInfo.price) || 0,
        costPrice: parseFloat(v.costPrice) || parseFloat(productInfo.costPrice) || 0
      })),
      isVisible: true,
    };
    
    console.log('📦 بيانات المنتج النهائية للحفظ:', productData);
    
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
      // مسح البيانات المؤقتة بعد النجاح
      if (!isEditMode) {
        setTempProductData(null);
      }
      
      toast({ 
        title: 'نجاح', 
        description: isEditMode ? 'تم تحديث المنتج بنجاح!' : 'تمت إضافة المنتج بنجاح!' 
      });
      if (fromPurchases) {
        navigate(fromPurchases, { state: { productJustAdded: true } });
      } else {
        navigate('/manage-products');
      }
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
          
          {/* تنبيه البيانات المؤقتة */}
          {showTempDataAlert && (
            <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <Save className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <div className="flex items-center justify-between">
                  <span>يوجد بيانات محفوظة مؤقتاً لمنتج لم يتم حفظه. هل تريد استعادتها؟</span>
                  <div className="flex gap-2 ml-4">
                    <Button onClick={restoreTempData} size="sm" variant="outline" className="text-xs">
                      استعادة
                    </Button>
                    <Button onClick={clearTempData} size="sm" variant="ghost" className="text-xs">
                      مسح
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
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
                </div>
                
                <div className="flex gap-4">
                   <Button 
                     onClick={handleSubmit}
                     disabled={isSubmitting || isUploading || !settings}
                     className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                   >
                      {isSubmitting || isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin ml-2" />
                          جاري الحفظ...
                        </>
                      ) : (
                        <>
                          <PackagePlus className="w-4 h-4 ml-2" />
                          {isEditMode ? "حفظ التحديثات" : "حفظ المنتج"}
                        </>
                      )}
                   </Button>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                    <PackagePlus className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground">
                      {isEditMode ? `تعديل المنتج: ${editProductData?.name}` : 'إضافة منتج جديد'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {isEditMode ? 'تحديث بيانات المنتج ومتغيراته' : 'إضافة منتج جديد مع تحديد الألوان والقياسات والكميات'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* شريط التقدم - للهاتف فقط */}
          {(isSubmitting || isUploading) && (
            <Card className="md:hidden">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>تقدم الرفع</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* نموذج إضافة المنتج */}
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-6">
            
            {/* القسم الأول: البيانات الأساسية */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  البيانات الأساسية للمنتج
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProductPrimaryInfo
                  productInfo={productInfo}
                  setProductInfo={setProductInfo}
                  generalImages={generalImages}
                  onImageSelect={handleGeneralImageSelect}
                  onImageRemove={handleGeneralImageRemove}
                />
              </CardContent>
            </Card>

            {/* القسم الثاني: التصنيفات */}
            <Card>
              <CardContent className="p-4 md:p-6">
                <MultiSelectCategorization
                  selectedCategories={selectedCategories}
                  setSelectedCategories={setSelectedCategories}
                  selectedProductTypes={selectedProductTypes}
                  setSelectedProductTypes={setSelectedProductTypes}
                  selectedSeasonsOccasions={selectedSeasonsOccasions}
                  setSelectedSeasonsOccasions={setSelectedSeasonsOccasions}
                  selectedDepartments={selectedDepartments}
                  setSelectedDepartments={setSelectedDepartments}
                />
              </CardContent>
            </Card>

            {/* القسم الثالث: اختيار المتغيرات */}
            <Card>
              <CardContent className="p-4 md:p-6">
                <ProductVariantSelection
                  selectedColors={selectedColors}
                  setSelectedColors={setSelectedColors}
                  sizeType={sizeType}
                  setSizeType={setSizeType}
                  colorSizeTypes={colorSizeTypes}
                  setColorSizeTypes={setColorSizeTypes}
                  allSizesForType={allSizesForType}
                />
              </CardContent>
            </Card>

            {/* قسم إدارة متغيرات الألوان */}
            {selectedColors.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">إدارة متغيرات الألوان</CardTitle>
                </CardHeader>
                <CardContent>
                  <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={selectedColors.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-4">
                        {selectedColors.map((color) => (
                          <SortableColorCard
                            key={color.id}
                            color={color}
                            allSizesForType={allSizesForType}
                            variants={variants}
                            setVariants={setVariants}
                            productInfo={productInfo}
                            colorImage={colorImages[color.id]}
                            onColorImageSelect={handleColorImageSelect}
                            onColorImageRemove={handleColorImageRemove}
                            sizeType={sizeType}
                            colorSizeTypes={colorSizeTypes}
                            sizes={sizes}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </CardContent>
              </Card>
            )}

            {/* شريط التقدم للشاشات الكبيرة */}
            {(isSubmitting || isUploading) && (
              <Card className="hidden md:block">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-muted-foreground">
                      <span>تقدم رفع الصور والبيانات</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-3" />
                    <p className="text-sm text-muted-foreground text-center">
                      يرجى عدم مغادرة الصفحة أثناء الرفع...
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

          </form>
        </div>
      </div>
    </>
  );
};

export default AddProductPage;