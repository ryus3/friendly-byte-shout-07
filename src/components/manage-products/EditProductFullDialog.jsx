import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Save, X } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Progress } from "@/components/ui/progress";
import { generateUniqueBarcode } from '@/lib/barcode-utils';

import ProductPrimaryInfo from '@/components/add-product/ProductPrimaryInfo';
import MultiSelectCategorization from '@/components/add-product/MultiSelectCategorization';
import ProductVariantSelection from '@/components/add-product/ProductVariantSelection';
import ColorVariantCard from '@/components/add-product/ColorVariantCard';
import { useInventory } from '@/contexts/InventoryContext';
import { useVariants } from '@/contexts/VariantsContext';

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

const EditProductFullDialog = ({ product, open, onOpenChange, onSuccess, refetchProducts }) => {
  const { updateProduct, settings } = useInventory();
  const { sizes, colors: allColors, addColor } = useVariants();
  
  const [productInfo, setProductInfo] = useState({
    name: '', price: '', costPrice: '', description: '', profitAmount: '', profitPercentage: '',
  });
  const [generalImages, setGeneralImages] = useState(Array(4).fill(null));
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedProductTypes, setSelectedProductTypes] = useState([]);
  const [selectedSeasonsOccasions, setSelectedSeasonsOccasions] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [colorImages, setColorImages] = useState({});
  const [variants, setVariants] = useState([]);
  const [sizeType, setSizeType] = useState('letter');
  const [colorSizeTypes, setColorSizeTypes] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // إعادة تعيين البيانات عند فتح النافذة
  useEffect(() => {
    if (open && product) {
      resetState();
    }
  }, [open, product]);

  const resetState = useCallback(() => {
    if (!product) return;

    console.log('🔄 Reset state for product:', product);

    // حساب نسبة الربح المئوية
    const calculateProfitPercentage = (price, costPrice) => {
      if (!price || !costPrice || costPrice === 0) return '';
      const profitPercentage = ((parseFloat(price) - parseFloat(costPrice)) / parseFloat(costPrice)) * 100;
      return profitPercentage.toFixed(2);
    };

    const basePrice = product.base_price || product.price || 0;
    const costPrice = product.cost_price || 0;
    const profitPercentage = calculateProfitPercentage(basePrice, costPrice);

    // تعيين المعلومات الأساسية مع نسبة الربح
    setProductInfo({
      name: product.name || '',
      description: product.description || '',
      price: basePrice.toString(),
      costPrice: costPrice.toString(),
      profitAmount: (product.profit_amount || 0).toString(),
      profitPercentage: profitPercentage,
    });

    // تعيين الصور العامة
    const initialGeneralImages = Array(4).fill(null);
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img, index) => {
        if (index < 4) initialGeneralImages[index] = img;
      });
    }
    setGeneralImages(initialGeneralImages);

    // تعيين التصنيفات والأقسام
    setSelectedCategories(product.product_categories?.map(pc => pc.category_id) || []);
    setSelectedProductTypes(product.product_product_types?.map(ppt => ppt.product_type_id) || []);
    setSelectedSeasonsOccasions(product.product_seasons_occasions?.map(pso => pso.season_occasion_id) || []);
    setSelectedDepartments(product.product_departments?.map(pd => pd.department_id) || []);
    
    // تعيين الألوان والأحجام
    const productVariants = product.product_variants || product.variants || [];
    const productInventory = product.inventory || [];
    
    const uniqueColorIds = [...new Set(productVariants.map(v => v.color_id))];
    const productColors = uniqueColorIds.map(id => allColors.find(c => c.id === id)).filter(Boolean);
    setSelectedColors(productColors);

    // تحديد نوع الحجم
    const firstVariant = productVariants[0];
    if (firstVariant) {
      const size = sizes.find(s => s.id === firstVariant.size_id);
      if (size) setSizeType(size.type);
    }
    
    // تعيين المتغيرات مع ربط بيانات المخزون
    const updatedVariants = productVariants.map(variant => {
      const inventoryItem = productInventory.find(inv => inv.variant_id === variant.id);
      return {
        ...variant,
        colorId: variant.color_id,
        sizeId: variant.size_id,
        color: variant.colors?.name || allColors.find(c => c.id === variant.color_id)?.name || 'غير محدد',
        size: variant.sizes?.name || sizes.find(s => s.id === variant.size_id)?.name || 'غير محدد',
        quantity: inventoryItem?.quantity || variant.quantity || 0,
        costPrice: variant.cost_price || 0,
        price: variant.price || 0,
        profitAmount: variant.profit_amount || product.profit_amount || 0,
        barcode: variant.barcode,
        images: variant.images || [],
        inventory: inventoryItem
      };
    });
    
    console.log('🔍 Updated variants:', updatedVariants);
    setVariants(updatedVariants);

    // تعيين صور الألوان
    const colorImagesObj = {};
    productVariants.forEach(variant => {
      if (variant.images && variant.images.length > 0) {
        colorImagesObj[variant.color_id] = variant.images[0];
      }
    });
    setColorImages(colorImagesObj);

    setUploadProgress(0);
  }, [product, allColors, sizes]);

  // معاينة الصور
  const getInitialImagePreview = useCallback((image) => {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (image instanceof File) return URL.createObjectURL(image);
    return null;
  }, []);

  // اختيار صورة اللون
  const handleColorImageSelect = useCallback((colorId, file) => {
    setColorImages(prev => ({ ...prev, [colorId]: file }));
  }, []);

  // إزالة صورة اللون
  const handleColorImageRemove = useCallback((colorId) => {
    setColorImages(prev => {
      const newImages = { ...prev };
      delete newImages[colorId];
      return newImages;
    });
  }, []);

  // اختيار الصور العامة
  const handleGeneralImageSelect = useCallback((index, file) => {
    const newImages = [...generalImages];
    newImages[index] = file;
    setGeneralImages(newImages);
  }, [generalImages]);

  // إزالة الصور العامة
  const removeGeneralImage = useCallback((index) => {
    const newImages = [...generalImages];
    newImages[index] = null;
    setGeneralImages(newImages);
  }, [generalImages]);

  // الأحجام المفلترة حسب النوع
  const sizesForType = useMemo(() => {
    return sizes.filter(size => size.type === sizeType).sort((a, b) => a.display_order - b.display_order);
  }, [sizes, sizeType]);

  // حفظ التغييرات
  const handleSave = async () => {
    if (!product) return;
    
    // التحقق من البيانات المطلوبة
    if (!productInfo.name || !productInfo.price || !productInfo.costPrice) {
      toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة.', variant: 'destructive' });
      return;
    }

    if (selectedColors.length === 0 || variants.length === 0) {
      toast({ title: 'خطأ', description: 'يرجى إضافة لون واحد على الأقل مع المتغيرات.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const dataToUpdate = {
        ...productInfo,
        price: parseFloat(productInfo.price) || 0,
        costPrice: productInfo.costPrice ? parseFloat(productInfo.costPrice) : 0,
        profitAmount: productInfo.profitAmount ? parseFloat(productInfo.profitAmount) : 0,
        profitPercentage: productInfo.profitPercentage ? parseFloat(productInfo.profitPercentage) : 0,
        selectedCategories,
        selectedProductTypes,
        selectedSeasonsOccasions,
        selectedDepartments,
        variants,
      };
      
      const imageFiles = {
        general: generalImages,
        colorImages: colorImages,
      };
      
      const result = await updateProduct(product.id, dataToUpdate, imageFiles, setUploadProgress);

      if (result.success) {
        toast({ title: 'نجاح', description: 'تم تحديث المنتج بنجاح!' });
        
        // إعادة تحميل المنتجات
        if (refetchProducts) {
          await refetchProducts();
        }
        
        if (onSuccess) onSuccess();
        onOpenChange(false);
      } else {
        toast({ title: 'خطأ', description: result.error || 'فشل تحديث المنتج.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ غير متوقع', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // إعادة ترتيب الألوان
  const onDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedColors((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" style={{ zIndex: 50 }}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Save className="w-5 h-5 text-primary" />
            تعديل المنتج: {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 p-1">
          {/* المعلومات الأساسية */}
          <ProductPrimaryInfo
            productInfo={productInfo}
            setProductInfo={setProductInfo}
            generalImages={generalImages}
            onImageSelect={handleGeneralImageSelect}
            onImageRemove={removeGeneralImage}
          />

          {/* التصنيفات */}
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

          {/* اختيار المتغيرات */}
          <ProductVariantSelection
            selectedColors={selectedColors}
            setSelectedColors={setSelectedColors}
            sizeType={sizeType}
            setSizeType={setSizeType}
            colorSizeTypes={colorSizeTypes}
            setColorSizeTypes={setColorSizeTypes}
          />

          {/* كروت الألوان والمتغيرات */}
          {selectedColors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">إدارة متغيرات المنتج</CardTitle>
              </CardHeader>
              <CardContent>
                <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={selectedColors.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {selectedColors.map((color) => (
                        <SortableColorCard
                          key={color.id}
                          color={color}
                          allSizesForType={sizesForType}
                          variants={variants}
                          setVariants={setVariants}
                          price={productInfo.price}
                          costPrice={productInfo.costPrice}
                          handleImageSelect={handleColorImageSelect}
                          handleImageRemove={handleColorImageRemove}
                          initialImage={colorImages[color.id]}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          )}

          {/* شريط التقدم */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>رفع الصور...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}
        </div>

        {/* أزرار الحفظ والإلغاء */}
        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">
            <X className="w-4 h-4 mr-2" />
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting} className="flex-1">
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductFullDialog;