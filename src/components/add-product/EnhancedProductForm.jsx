import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { 
  Save, 
  Package, 
  Palette, 
  ImageIcon, 
  CheckCircle, 
  AlertCircle,
  Sparkles,
  Trash2,
  Edit3
} from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import ProductPrimaryInfo from './ProductPrimaryInfo';
import NewProductCategorization from './NewProductCategorization';
import ProductVariantSelection from './ProductVariantSelection';
import MultiSizeTypeSelector from './MultiSizeTypeSelector';
import ColorVariantCard from './ColorVariantCard';

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

const EnhancedProductForm = ({
  productInfo,
  setProductInfo,
  generalImages,
  setGeneralImages,
  selectedCategories,
  setSelectedCategories,
  selectedColors,
  setSelectedColors,
  variants,
  setVariants,
  colorImages,
  setColorImages,
  isSubmitting,
  uploadProgress,
  onSubmit,
  onCancel,
  editMode = false
}) => {
  const [colorSizeTypes, setColorSizeTypes] = useState({});
  const [currentStep, setCurrentStep] = useState(1);
  
  const isUploading = useMemo(() => uploadProgress > 0 && uploadProgress < 100, [uploadProgress]);

  // Form validation
  const formValidation = useMemo(() => {
    const errors = [];
    const warnings = [];
    
    if (!productInfo.name?.trim()) errors.push('اسم المنتج مطلوب');
    if (!productInfo.price || parseFloat(productInfo.price) <= 0) errors.push('سعر المنتج مطلوب');
    if (selectedColors.length === 0) errors.push('يجب اختيار لون واحد على الأقل');
    
    if (!productInfo.costPrice) warnings.push('سعر التكلفة غير محدد - لن يتم حساب الأرباح');
    if (!selectedCategories.main_category) warnings.push('التصنيف الرئيسي غير محدد');
    if (generalImages.filter(Boolean).length === 0) warnings.push('لم يتم رفع أي صور للمنتج');
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness: Math.round(((4 - warnings.length) / 4) * 100)
    };
  }, [productInfo, selectedCategories, selectedColors, generalImages]);

  const steps = [
    { id: 1, title: 'المعلومات الأساسية', icon: Package },
    { id: 2, title: 'التصنيفات', icon: CheckCircle },
    { id: 3, title: 'الألوان والقياسات', icon: Palette },
    { id: 4, title: 'المتغيرات النهائية', icon: Sparkles }
  ];

  const handleColorImageSelect = useCallback((colorId, file) => {
    setColorImages(prev => ({...prev, [colorId]: file }));
  }, [setColorImages]);

  const handleColorImageRemove = useCallback((colorId) => {
    setColorImages(prev => {
      const newImages = {...prev};
      delete newImages[colorId];
      return newImages;
    });
  }, [setColorImages]);

  const handleGeneralImageSelect = useCallback((index, file) => {
    setGeneralImages(prev => {
      const newImages = [...prev];
      newImages[index] = file;
      return newImages;
    });
  }, [setGeneralImages]);

  const handleGeneralImageRemove = useCallback((index) => {
    setGeneralImages(prev => {
      const newImages = [...prev];
      newImages[index] = null;
      return newImages;
    });
  }, [setGeneralImages]);

  const onDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedColors((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, [setSelectedColors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValidation.isValid) {
      toast({
        title: "خطأ في النموذج",
        description: formValidation.errors.join('\n'),
        variant: "destructive"
      });
      return;
    }
    
    await onSubmit(e);
  };

  const StepIndicator = () => (
    <div className="flex justify-between items-center mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border">
      {steps.map((step, index) => {
        const StepIcon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
              isActive ? 'bg-primary text-primary-foreground' : 
              isCompleted ? 'bg-green-500 text-white' : 
              'bg-muted text-muted-foreground'
            }`}>
              <StepIcon className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:block">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 h-1 mx-2 rounded-full ${
                isCompleted ? 'bg-green-500' : 'bg-muted'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const FormStatusCard = () => (
    <Card className="mb-6 border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            حالة النموذج
          </CardTitle>
          <Badge variant={formValidation.isValid ? "default" : "destructive"}>
            {formValidation.isValid ? "جاهز للحفظ" : "يحتاج تعديل"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">اكتمال النموذج</span>
          <span className="text-sm text-muted-foreground">{formValidation.completeness}%</span>
        </div>
        <Progress value={formValidation.completeness} className="h-2" />
        
        {formValidation.errors.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">أخطاء يجب إصلاحها:</p>
            {formValidation.errors.map((error, index) => (
              <p key={index} className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            ))}
          </div>
        )}
        
        {formValidation.warnings.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-600">تحذيرات:</p>
            {formValidation.warnings.map((warning, index) => (
              <p key={index} className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {warning}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <StepIndicator />
      <FormStatusCard />
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Basic Information */}
        <div className={currentStep === 1 ? 'block' : 'hidden'}>
          <ProductPrimaryInfo
            productInfo={productInfo}
            setProductInfo={setProductInfo}
            generalImages={generalImages}
            onImageSelect={handleGeneralImageSelect}
            onImageRemove={handleGeneralImageRemove}
          />
          <div className="flex justify-end mt-4">
            <Button type="button" onClick={() => setCurrentStep(2)}>
              التالي
            </Button>
          </div>
        </div>

        {/* Step 2: Categorization */}
        <div className={currentStep === 2 ? 'block' : 'hidden'}>
          <NewProductCategorization
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
          />
          <div className="flex justify-between mt-4">
            <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
              السابق
            </Button>
            <Button type="button" onClick={() => setCurrentStep(3)}>
              التالي
            </Button>
          </div>
        </div>

        {/* Step 3: Colors and Sizes */}
        <div className={currentStep === 3 ? 'block' : 'hidden'}>
          <ProductVariantSelection
            selectedColors={selectedColors}
            setSelectedColors={setSelectedColors}
            sizeType="letter" // Default, will be overridden by multi-selector
            setSizeType={() => {}} // Not used in multi-selector mode
          />
          
          <div className="mt-6">
            <MultiSizeTypeSelector
              selectedColors={selectedColors}
              colorSizeTypes={colorSizeTypes}
              onColorSizeTypesChange={setColorSizeTypes}
            />
          </div>
          
          <div className="flex justify-between mt-4">
            <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
              السابق
            </Button>
            <Button type="button" onClick={() => setCurrentStep(4)}>
              التالي
            </Button>
          </div>
        </div>

        {/* Step 4: Final Variants */}
        <div className={currentStep === 4 ? 'block' : 'hidden'}>
          {variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  إدارة المتغيرات النهائية
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={selectedColors.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {selectedColors.map((color) => (
                        <SortableColorCard
                          key={color.id}
                          id={color.id}
                          color={color}
                          allSizesForType={[]} // Will be calculated based on colorSizeTypes
                          variants={variants}
                          setVariants={setVariants}
                          price={productInfo.price}
                          costPrice={productInfo.costPrice}
                          handleImageSelect={(file) => handleColorImageSelect(color.id, file)}
                          handleImageRemove={() => handleColorImageRemove(color.id)}
                          initialImage={colorImages[color.id] || null}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          )}
          
          <div className="flex justify-between mt-6">
            <Button type="button" variant="outline" onClick={() => setCurrentStep(3)}>
              السابق
            </Button>
            <div className="flex gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  <Trash2 className="h-4 w-4 ml-2" />
                  إلغاء
                </Button>
              )}
              <Button 
                type="submit"
                disabled={isSubmitting || isUploading || !formValidation.isValid}
                className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700"
              >
                {isSubmitting || isUploading ? (
                  <>
                    <Progress value={uploadProgress} className="w-16 h-1 ml-2" />
                    جاري {editMode ? 'التحديث' : 'الحفظ'}...
                  </>
                ) : (
                  <>
                    {editMode ? <Edit3 className="h-4 w-4 ml-2" /> : <Save className="h-4 w-4 ml-2" />}
                    {editMode ? 'تحديث المنتج' : 'حفظ المنتج'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
      
      {/* Upload Progress */}
      {isUploading && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  جاري رفع الصور والحفظ...
                </p>
                <Progress value={uploadProgress} className="mt-2" />
              </div>
              <Badge variant="outline" className="border-blue-300 text-blue-700">
                {uploadProgress}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnhancedProductForm;