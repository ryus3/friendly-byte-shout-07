import React, { useState } from 'react';
import Barcode from 'react-barcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2, Barcode as BarcodeIcon, Plus } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ImageUploader from '@/components/manage-products/ImageUploader';
import AddSizesToColorDialog from './AddSizesToColorDialog';

const ColorVariantCard = ({ color, allSizesForType, variants, setVariants, price, costPrice, profitAmount, handleImageSelect, handleImageRemove, initialImage, dragHandleProps, isEditMode = false, showInventoryData = false, productName = '' }) => {
  const [addSizesDialogOpen, setAddSizesDialogOpen] = useState(false);
  
  const handleVariantChange = (colorId, sizeId, field, value) => {
    setVariants(prev => prev.map(v => {
      // ✅ دعم كلا المعيارين: colorId/color_id و sizeId/size_id
      const vColorId = String(v.color_id || v.colorId || '');
      const vSizeId = String(v.size_id || v.sizeId || '');
      const targetColorId = String(colorId || '');
      const targetSizeId = String(sizeId || '');
      
      const isMatching = vColorId === targetColorId && vSizeId === targetSizeId;
      
      if (isMatching) {
        let updated = { ...v };
        
        // معالجة خاصة لحقل الكمية
        if (field === 'quantity') {
          updated.quantity = value;
          if (updated.inventory) {
            updated.inventory = { ...updated.inventory, quantity: value };
          } else {
            updated.inventory = { quantity: value };
          }
        } else {
          updated[field] = value;
        }
        
        return updated;
      }
      return v;
    }));
  };

  const handleRemoveSizeFromColor = (sizeId) => {
    setVariants(prev => prev.filter(v => {
      const vColorId = v.color_id || v.colorId;
      const vSizeId = v.size_id || v.sizeId;
      return !(vColorId === color.id && vSizeId === sizeId);
    }));
  };

  const handleAddSizes = (newSizes) => {
    
    setVariants(prev => [...prev, ...newSizes]);
  };

  const getInitialImagePreview = (image) => {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (image instanceof File) return URL.createObjectURL(image);
    return null;
  };

  return (
    <Card className="overflow-hidden border-2 hover:border-primary/30 transition-colors">
      <CardHeader className="flex flex-row items-center gap-4 bg-gradient-to-r from-muted/30 to-muted/10 p-4 border-b">
        <div {...dragHandleProps} className="cursor-grab p-1 hover:bg-muted rounded">
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </div>
        <div 
          className="w-10 h-10 rounded-full border-2 border-white shadow-sm" 
          style={{backgroundColor: color.hex_code}}
        ></div>
        <div className="flex-1">
          <CardTitle className="text-xl font-bold text-primary">{color.name}</CardTitle>
          <p className="text-sm text-muted-foreground">إدارة المتغيرات والمخزون</p>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* صورة اللون */}
          <div className="lg:col-span-1">
            <Label className="text-sm font-medium mb-2 block">صورة اللون</Label>
            <div className="aspect-square bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/25 overflow-hidden">
              <ImageUploader 
                onImageSelect={handleImageSelect}
                onImageRemove={handleImageRemove}
                initialImage={getInitialImagePreview(initialImage)}
              />
            </div>
          </div>

          {/* جدول المتغيرات */}
          <div className="lg:col-span-3">
            <Label className="text-sm font-medium mb-4 block flex items-center gap-2">
              📦 القياسات والمخزون والأسعار
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                {(allSizesForType && allSizesForType.length > 0 ? allSizesForType : variants).filter(v => 
                  allSizesForType.length > 0 ? true : v.colorId === color.id || v.color_id === color.id
                ).length} متغير
              </span>
            </Label>
            
            <div className="space-y-3">
              {/* رؤوس الأعمدة */}
               <div className="grid grid-cols-5 gap-2 p-3 bg-muted/20 rounded-lg border text-sm font-medium text-muted-foreground">
                 <div className="text-center">القياس</div>
                 <div className="text-center">الكمية</div>
                 <div className="text-center">ملاحظة</div>
                 <div className="text-center">QR كود</div>
                 <div className="text-center">حذف</div>
               </div>

              {/* صفوف المتغيرات */}
              {(() => {
                // في وضع التعديل، نستخدم المتغيرات الموجودة فعلياً المفلترة حسب اللون
                if (isEditMode && showInventoryData) {
                  // ترتيب القياسات بالشكل الصحيح: S, M, L, XL ثم الأرقام 
                  const sortVariants = (variants) => {
                    return variants.sort((a, b) => {
                      const aSizeName = a.sizes?.name || a.size || '';
                      const bSizeName = b.sizes?.name || b.size || '';
                      
                      // ترتيب الحروف أولاً
                      const letterOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
                      const aLetterIndex = letterOrder.indexOf(aSizeName.toUpperCase());
                      const bLetterIndex = letterOrder.indexOf(bSizeName.toUpperCase());
                      
                      // إذا كان كلاهما حروف
                      if (aLetterIndex !== -1 && bLetterIndex !== -1) {
                        return aLetterIndex - bLetterIndex;
                      }
                      
                      // إذا كان الأول حرف والثاني رقم
                      if (aLetterIndex !== -1 && bLetterIndex === -1) return -1;
                      if (aLetterIndex === -1 && bLetterIndex !== -1) return 1;
                      
                      // إذا كان كلاهما أرقام
                      const aNum = parseInt(aSizeName);
                      const bNum = parseInt(bSizeName);
                      if (!isNaN(aNum) && !isNaN(bNum)) {
                        return aNum - bNum;
                      }
                      
                      // ترتيب أبجدي للحالات الأخرى
                      return aSizeName.localeCompare(bSizeName);
                    });
                  };

                  const colorVariants = variants.filter(v => 
                    v.color_id === color.id || v.colorId === color.id
                  );
                  
                  const sortedVariants = sortVariants(colorVariants);
                  
                  return sortedVariants.map((variant, index) => {
                    const sizeName = variant.sizes?.name || variant.size || 'غير محدد';
                    const currentQuantity = variant.inventory?.quantity || variant.quantity || 0;
                    
                    return (
                      <div key={variant.id || index} 
                           className="grid grid-cols-5 items-center gap-2 p-3 border border-border/50 rounded-lg bg-card/50 hover:bg-muted/30 transition-colors">
                        
                         {/* القياس */}
                         <div className="text-center">
                           <div className="font-medium text-primary bg-primary/10 px-2 py-1 rounded-md text-sm">
                             {sizeName}
                           </div>
                         </div>
                         
                          {/* الكمية */}
                          <div className="text-center">
                            <Input 
                              type="number" 
                              placeholder="0" 
                              className="text-center font-medium w-full"
                              value={currentQuantity || ''} 
                              onChange={e => {
                                const newQuantity = parseInt(e.target.value) || 0;
                                handleVariantChange(color.id, variant.size_id || variant.sizeId, 'quantity', newQuantity);
                              }} 
                              min="0"
                            />
                            {currentQuantity < 5 && currentQuantity > 0 && (
                              <p className="text-xs text-orange-600 text-center mt-1">⚠️ مخزون منخفض</p>
                            )}
                          </div>
                         
                          {/* الملاحظة التوضيحية */}
                          <div className="text-center">
                            <Input 
                              type="text" 
                              placeholder="مثال: مناسب لوزن 50-60 كغ"
                              className="text-center text-xs w-full"
                              value={variant.hint || ''} 
                              onChange={e => {
                                handleVariantChange(color.id, variant.size_id || variant.sizeId, 'hint', e.target.value);
                              }} 
                            />
                          </div>
                         
                          {/* QR كود */}
                          <div className="text-center">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 mx-auto">
                                  <BarcodeIcon className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                             <DialogContent className="sm:max-w-md">
                               <DialogHeader>
                                 <DialogTitle>باركود المنتج</DialogTitle>
                               </DialogHeader>
                               <div className="flex flex-col items-center space-y-4">
                                 {variant.barcode && (
                                   <Barcode 
                                     value={variant.barcode} 
                                     format="CODE128"
                                     width={2}
                                     height={60}
                                     displayValue={true}
                                   />
                                 )}
                                 <div className="text-sm text-muted-foreground text-center">
                                   {productName} - {color.name} - {sizeName}
                                 </div>
                               </div>
                             </DialogContent>
                           </Dialog>
                         </div>
                         
                          {/* حذف */}
                          <div className="text-center">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleRemoveSizeFromColor(variant.size_id || variant.sizeId)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 mx-auto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                      </div>
                    );
                  });
                }
                
                // ترتيب القياسات بالشكل الصحيح: S, M, L, XL ثم الأرقام 
                const sortVariants = (variants) => {
                  return variants.sort((a, b) => {
                    const aSizeName = a.size || '';
                    const bSizeName = b.size || '';
                    
                    // ترتيب الحروف أولاً
                    const letterOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
                    const aLetterIndex = letterOrder.indexOf(aSizeName.toUpperCase());
                    const bLetterIndex = letterOrder.indexOf(bSizeName.toUpperCase());
                    
                    // إذا كان كلاهما حروف
                    if (aLetterIndex !== -1 && bLetterIndex !== -1) {
                      return aLetterIndex - bLetterIndex;
                    }
                    
                    // إذا كان الأول حرف والثاني رقم
                    if (aLetterIndex !== -1 && bLetterIndex === -1) return -1;
                    if (aLetterIndex === -1 && bLetterIndex !== -1) return 1;
                    
                    // إذا كان كلاهما أرقام
                    const aNum = parseInt(aSizeName);
                    const bNum = parseInt(bSizeName);
                    if (!isNaN(aNum) && !isNaN(bNum)) {
                      return aNum - bNum;
                    }
                    
                    // ترتيب أبجدي للحالات الأخرى
                    return aSizeName.localeCompare(bSizeName);
                  });
                };

                // الكود الأصلي للمنتجات الجديدة
                const itemsToRender = allSizesForType && allSizesForType.length > 0 ? allSizesForType : variants;
                
                // تطبيق الترتيب على القياسات
                const sortedItemsToRender = sortVariants(itemsToRender);
                
                return sortedItemsToRender.map((variant, index) => {
                  if (!variant) return null;
                  
                  // التحقق من الفلترة حسب اللون في حالة وجود متغيرات فعلية
                  if (allSizesForType.length === 0 && variant.color_id !== color.id && variant.colorId !== color.id) return null;
                  
                  const isNewProduct = allSizesForType && allSizesForType.length > 0;
                  const variantData = isNewProduct ? variant : variant;
                  const sizeName = isNewProduct ? variantData.size : (variantData.sizes?.name || variantData.size || 'غير محدد');
                  const currentQuantity = isNewProduct ? (variantData.quantity || 0) : (variantData.inventory?.quantity || variantData.quantity || 0);
                  
                  return (
                    <div key={isNewProduct ? variant.sizeId : variant.id || index} 
                         className="grid grid-cols-5 items-center gap-2 p-3 border border-border/50 rounded-lg bg-card/50 hover:bg-muted/30 transition-colors">
                      
                      {/* القياس */}
                      <div className="text-center">
                        <div className="font-medium text-primary bg-primary/10 px-2 py-1 rounded-md text-sm">
                          {sizeName}
                        </div>
                      </div>
                      
                       {/* الكمية */}
                       <div className="text-center">
                          <Input 
                            type="number" 
                            placeholder="0" 
                            className="text-center font-medium w-full"
                             value={currentQuantity || ''} 
                            onChange={e => {
                              const newQuantity = parseInt(e.target.value) || 0;
                              const targetSizeId = variantData.sizeId || variantData.size_id;
                              handleVariantChange(color.id, targetSizeId, 'quantity', newQuantity);
                            }}
                            min="0"
                            step="1"
                          />
                         {currentQuantity < 5 && currentQuantity > 0 && (
                           <p className="text-xs text-orange-600 text-center mt-1">⚠️ مخزون منخفض</p>
                         )}
                       </div>
                      
                       {/* الملاحظة التوضيحية */}
                       <div className="text-center">
                         <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                                <Input 
                                  type="text" 
                                  placeholder="مثال: مناسب لوزن 50-60 كغ" 
                                  className="text-center text-xs w-full"
                                   value={variantData.hint || ''} 
                                  onChange={e => {
                                    const targetSizeId = variantData.sizeId || variantData.size_id;
                                    handleVariantChange(color.id, targetSizeId, 'hint', e.target.value);
                                  }}
                                />
                             </TooltipTrigger>
                               <TooltipContent><p>تلميح ذكي للزبائن عن هذا القياس</p></TooltipContent>
                             </Tooltip>
                           </TooltipProvider>
                         </div>
                        
                         {/* QR كود */}
                         <div className="text-center">
                           <Dialog>
                             <TooltipProvider>
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <DialogTrigger asChild>
                                     <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-primary hover:bg-primary/10 mx-auto">
                                       <BarcodeIcon className="w-4 h-4" />
                                     </Button>
                                   </DialogTrigger>
                                 </TooltipTrigger>
                                 <TooltipContent><p>عرض الباركود</p></TooltipContent>
                               </Tooltip>
                             </TooltipProvider>
                             <DialogContent className="max-w-md">
                               <DialogHeader>
                                 <DialogTitle className="text-center">🏷️ باركود المتغير</DialogTitle>
                                 <p className="text-center text-muted-foreground text-sm">
                                   {color.name} • {sizeName}
                                 </p>
                               </DialogHeader>
                               <div className="flex flex-col items-center justify-center p-6 space-y-4">
                                 {(() => {
                                   const barcodeValue = isNewProduct ? variantData.barcode : variantData.barcode;
                                   
                                   if (barcodeValue && barcodeValue.trim() !== '') {
                                     return (
                                       <div className="text-center space-y-3">
                                         <div className="p-4 bg-white rounded-lg border">
                                           <Barcode 
                                             value={barcodeValue} 
                                             width={1.5}
                                             height={40}
                                             fontSize={10}
                                             displayValue={true}
                                             background="#ffffff"
                                             lineColor="#000000"
                                           />
                                         </div>
                                         <p className="font-mono text-sm bg-muted px-3 py-1 rounded">
                                           {barcodeValue}
                                         </p>
                                       </div>
                                     );
                                   } else {
                                     const previewBarcode = `PROD${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
                                     return (
                                       <div className="text-center space-y-3">
                                         <div className="p-4 bg-white rounded-lg border">
                                           <Barcode 
                                             value={previewBarcode} 
                                             width={1.5}
                                             height={40}
                                             fontSize={10}
                                             displayValue={true}
                                             background="#ffffff"
                                             lineColor="#000000"
                                           />
                                         </div>
                                         <p className="text-muted-foreground text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded">
                                           ⚠️ معاينة - سيتم توليد باركود حقيقي عند الحفظ
                                         </p>
                                       </div>
                                     );
                                   }
                                 })()}
                               </div>
                             </DialogContent>
                           </Dialog>
                         </div>
                          
                          {/* حذف */}
                          <div className="text-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 mx-auto" 
                                    onClick={() => handleRemoveSizeFromColor(isNewProduct ? variantData.sizeId : variantData.size_id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>حذف هذا القياس</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                      </div>
                    );
                  });
                 })()}
                 
                  {/* زر إضافة قياسات جديدة - يظهر فقط في وضع التعديل */}
                  {isEditMode && showInventoryData && (
                    <div className="text-center py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddSizesDialogOpen(true)}
                        className="gap-2 border-dashed border-primary/50 text-primary hover:bg-primary/10"
                      >
                        <Plus className="w-4 h-4" />
                        إضافة قياسات جديدة
                      </Button>
                    </div>
                  )}
                  
                  {/* رسالة عدم وجود متغيرات */}
                  {(() => {
                    const relevantVariants = isEditMode && showInventoryData
                      ? variants.filter(v => v.color_id === color.id || v.colorId === color.id)
                      : (allSizesForType && allSizesForType.length > 0 ? allSizesForType : variants).filter(v => 
                          allSizesForType.length > 0 ? true : v.colorId === color.id || v.color_id === color.id
                        );
                    
                    if (relevantVariants.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="text-sm">🔍 لا توجد متغيرات لهذا اللون</p>
                          <p className="text-xs">قم بإضافة قياسات جديدة بالنقر على الزر أعلاه</p>
                        </div>
                      );
                    }
                    return null;
                  })()}
            </div>
          </div>
        </div>
      </CardContent>

      {/* Dialog إضافة قياسات جديدة */}
      <AddSizesToColorDialog
        open={addSizesDialogOpen}
        onOpenChange={setAddSizesDialogOpen}
        color={color}
        existingVariants={variants}
        onAddSizes={handleAddSizes}
      />
    </Card>
  );
};

export default ColorVariantCard;