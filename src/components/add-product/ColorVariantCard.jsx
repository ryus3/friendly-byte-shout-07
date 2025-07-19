import React from 'react';
import Barcode from 'react-barcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2, Barcode as BarcodeIcon } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ImageUploader from '@/components/manage-products/ImageUploader';

const ColorVariantCard = ({ color, allSizesForType, variants, setVariants, price, costPrice, profitAmount, handleImageSelect, handleImageRemove, initialImage, dragHandleProps, isEditMode = false, showInventoryData = false, productName = '' }) => {
  
  const handleVariantChange = (colorId, sizeId, field, value) => {
    console.log(`🔧 تحديث المتغير: ${colorId}-${sizeId}, ${field} = ${value}`);
    setVariants(prev => prev.map(v => {
      // التحقق من جميع التطابقات الممكنة
      const isMatching = (
        (v.colorId === colorId || v.color_id === colorId) && 
        (v.sizeId === sizeId || v.size_id === sizeId)
      );
      
      if (isMatching) {
        const updated = { ...v, [field]: value };
        console.log(`✅ تم تحديث المتغير:`, updated);
        return updated;
      }
      return v;
    }));
  };

  const handleRemoveSizeFromColor = (sizeId) => {
    setVariants(prev => prev.filter(v => !(v.colorId === color.id && v.sizeId === sizeId)));
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
               <div className="grid grid-cols-7 gap-2 p-3 bg-muted/20 rounded-lg border text-sm font-medium text-muted-foreground">
                 <div className="text-center">القياس</div>
                 <div className="text-center">الكمية</div>
                 <div className="text-center">التكلفة</div>
                 <div className="text-center">سعر البيع</div>
                 <div className="text-center">ربح الموظف</div>
                 <div className="text-center">ملاحظة</div>
                 <div className="text-center">إجراءات</div>
               </div>

              {/* صفوف المتغيرات */}
              {(() => {
                // في وضع التعديل، نستخدم المتغيرات الموجودة فعلياً المفلترة حسب اللون
                if (isEditMode && showInventoryData) {
                  const colorVariants = variants.filter(v => 
                    v.color_id === color.id || v.colorId === color.id
                  );
                  
                  console.log(`🎨 عرض متغيرات اللون ${color.name}:`, colorVariants);
                  
                  return colorVariants.map((variant, index) => {
                    const sizeName = variant.sizes?.name || variant.size || 'غير محدد';
                    const currentQuantity = variant.inventory?.quantity || variant.quantity || 0;
                    
                    return (
                      <div key={variant.id || index} 
                           className="grid grid-cols-7 items-center gap-2 p-3 border border-border/50 rounded-lg bg-card/50 hover:bg-muted/30 transition-colors">
                        
                         {/* القياس */}
                         <div className="text-center">
                           <div className="font-medium text-primary bg-primary/10 px-2 py-1 rounded-md text-sm">
                             {sizeName}
                           </div>
                         </div>
                         
                         {/* الكمية */}
                         <div className="space-y-1">
                           <Input 
                             type="number" 
                             placeholder="0" 
                             className="text-center font-medium"
                             value={currentQuantity || ''} 
                             onChange={e => {
                               const newQuantity = parseInt(e.target.value) || 0;
                               handleVariantChange(color.id, variant.size_id || variant.sizeId, 'quantity', newQuantity);
                             }} 
                             min="0"
                           />
                           {currentQuantity < 5 && currentQuantity > 0 && (
                             <p className="text-xs text-orange-600 text-center">⚠️ مخزون منخفض</p>
                           )}
                           {currentQuantity === 0 && (
                             <p className="text-xs text-red-600 text-center">❌ نفذ المخزون</p>
                           )}
                         </div>
                         
                         {/* التكلفة */}
                         <div className="space-y-1">
                           <Input 
                             type="number" 
                             placeholder="0"
                             className="text-center"
                             value={variant.cost_price || variant.costPrice || costPrice || ''} 
                             onChange={e => {
                               const newCost = parseFloat(e.target.value) || 0;
                               handleVariantChange(color.id, variant.size_id || variant.sizeId, 'costPrice', newCost);
                               handleVariantChange(color.id, variant.size_id || variant.sizeId, 'cost_price', newCost);
                             }} 
                             min="0"
                             step="0.01"
                           />
                         </div>
                         
                         {/* سعر البيع */}
                         <div className="space-y-1">
                           <Input 
                             type="number" 
                             placeholder="0"
                             className="text-center font-medium"
                             value={variant.price || price || ''} 
                             onChange={e => {
                               const newPrice = parseFloat(e.target.value) || 0;
                               handleVariantChange(color.id, variant.size_id || variant.sizeId, 'price', newPrice);
                             }} 
                             min="0"
                             step="0.01"
                           />
                         </div>
                         
                         {/* ربح الموظف */}
                         <div className="space-y-1">
                           <Input 
                             type="number" 
                             placeholder="0"
                             className="text-center"
                             value={variant.profit_amount || variant.profitAmount || profitAmount || ''} 
                             onChange={e => {
                               const newProfitAmount = parseFloat(e.target.value) || 0;
                               handleVariantChange(color.id, variant.size_id || variant.sizeId, 'profitAmount', newProfitAmount);
                               handleVariantChange(color.id, variant.size_id || variant.sizeId, 'profit_amount', newProfitAmount);
                             }} 
                             min="0"
                             step="100"
                           />
                         </div>
                         
                         {/* التلميحات الذكية */}
                         <div className="space-y-1">
                           <Input 
                             type="text" 
                             placeholder="مثال: مناسب لوزن 50-60 كغ"
                             className="text-center text-xs"
                             value={variant.hint || ''} 
                             onChange={e => {
                               handleVariantChange(color.id, variant.size_id || variant.sizeId, 'hint', e.target.value);
                             }} 
                           />
                           <p className="text-xs text-muted-foreground text-center">
                             تلميح ذكي للزبائن
                           </p>
                         </div>
                         
                         {/* الإجراءات */}
                         <div className="text-center">
                           <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                             {variant.barcode || 'سيتم إنشاؤه تلقائياً'}
                           </div>
                         </div>
                      </div>
                    );
                  });
                }
                
                // الكود الأصلي للمنتجات الجديدة
                const itemsToRender = allSizesForType && allSizesForType.length > 0 ? allSizesForType : variants;
                
                return itemsToRender.map((variant, index) => {
                  if (!variant) return null;
                  
                  // التحقق من الفلترة حسب اللون في حالة وجود متغيرات فعلية
                  if (allSizesForType.length === 0 && variant.color_id !== color.id && variant.colorId !== color.id) return null;
                  
                  const isNewProduct = allSizesForType && allSizesForType.length > 0;
                  const variantData = isNewProduct ? variant : variant;
                  const sizeName = isNewProduct ? variantData.size : (variantData.sizes?.name || variantData.size || 'غير محدد');
                  const currentQuantity = isNewProduct ? (variantData.quantity || 0) : (variantData.inventory?.quantity || variantData.quantity || 0);
                  
                  return (
                    <div key={isNewProduct ? variant.sizeId : variant.id || index} 
                         className="grid grid-cols-7 items-center gap-2 p-3 border border-border/50 rounded-lg bg-card/50 hover:bg-muted/30 transition-colors">
                      
                      {/* القياس */}
                      <div className="text-center">
                        <div className="font-medium text-primary bg-primary/10 px-2 py-1 rounded-md text-sm">
                          {sizeName}
                        </div>
                      </div>
                      
                      {/* الكمية */}
                      <div className="space-y-1">
                         <Input 
                           type="number" 
                           placeholder="0" 
                           className="text-center font-medium"
                           value={currentQuantity || ''} 
                           onChange={e => {
                             const newQuantity = parseInt(e.target.value) || 0;
                             console.log(`🔢 تحديث الكمية للون ${color.name} قياس ${sizeName}:`, newQuantity);
                             handleVariantChange(color.id, isNewProduct ? variantData.sizeId : variantData.size_id, 'quantity', newQuantity);
                           }} 
                           min="0"
                           step="1"
                         />
                        {currentQuantity < 5 && currentQuantity > 0 && (
                          <p className="text-xs text-orange-600 text-center">⚠️ مخزون منخفض</p>
                        )}
                        {currentQuantity === 0 && (
                          <p className="text-xs text-red-600 text-center">❌ نفذ المخزون</p>
                        )}
                      </div>
                      
                      {/* التكلفة */}
                      <div className="space-y-1">
                         <Input 
                           type="number" 
                           placeholder="0"
                           className="text-center"
                           value={isNewProduct ? (variantData.costPrice || costPrice || '') : (variantData.cost_price || costPrice || '')} 
                           onChange={e => {
                             const newCost = parseFloat(e.target.value) || 0;
                             console.log(`💰 تحديث التكلفة للون ${color.name} قياس ${sizeName}:`, newCost);
                             handleVariantChange(color.id, isNewProduct ? variantData.sizeId : variantData.size_id, 'costPrice', newCost);
                           }} 
                           min="0"
                           step="0.01"
                         />
                        </div>
                        
                        {/* سعر البيع */}
                        <div className="space-y-1">
                           <Input 
                             type="number" 
                             placeholder="0"
                             className="text-center font-medium"
                             value={isNewProduct ? (variantData.price || price || '') : (variantData.price || price || '')} 
                             onChange={e => {
                               const newPrice = parseFloat(e.target.value) || 0;
                               console.log(`🏷️ تحديث السعر للون ${color.name} قياس ${sizeName}:`, newPrice);
                               handleVariantChange(color.id, isNewProduct ? variantData.sizeId : variantData.size_id, 'price', newPrice);
                             }} 
                             min="0"
                             step="0.01"
                           />
                        </div>
                        
                        {/* ربح الموظف */}
                        <div className="space-y-1">
                           <Input 
                             type="number" 
                             placeholder="0"
                             className="text-center"
                             value={isNewProduct ? (variantData.profitAmount || profitAmount || '') : (variantData.profit_amount || profitAmount || '')} 
                             onChange={e => {
                               const newProfitAmount = parseFloat(e.target.value) || 0;
                               handleVariantChange(color.id, isNewProduct ? variantData.sizeId : variantData.size_id, 'profitAmount', newProfitAmount);
                               handleVariantChange(color.id, isNewProduct ? variantData.sizeId : variantData.size_id, 'profit_amount', newProfitAmount);
                             }} 
                             min="0"
                             step="100"
                           />
                        </div>
                        
                        {/* الملاحظة */}
                        <div className="space-y-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                 <Input 
                                   type="text" 
                                   placeholder="مثال: مناسب لوزن 50-60 كغ" 
                                   className="text-center text-xs"
                                   value={isNewProduct ? (variantData.hint || '') : (variantData.hint || '')} 
                                   onChange={e => handleVariantChange(color.id, isNewProduct ? variantData.sizeId : variantData.size_id, 'hint', e.target.value)} 
                                 />
                              </TooltipTrigger>
                              <TooltipContent><p>تلميح ذكي للزبائن عن هذا القياس</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        
                        {/* الإجراءات */}
                        <div className="flex justify-center gap-1">
                          {/* زر الباركود */}
                          <Dialog>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10">
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
                          
                          {/* زر الحذف */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10" 
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
                         <p className="text-xs">قم بإضافة قياسات من القسم أعلاه</p>
                       </div>
                     );
                   }
                   return null;
                 })()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ColorVariantCard;