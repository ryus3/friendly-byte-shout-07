import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/contexts/InventoryContext';
import { useVariants } from '@/contexts/VariantsContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Save, Plus } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Progress } from "@/components/ui/progress";

import ProductPrimaryInfo from '@/components/add-product/ProductPrimaryInfo';
import NewProductCategorization from '@/components/add-product/NewProductCategorization';
import ProductVariantSelection from '@/components/add-product/ProductVariantSelection';
import ColorVariantCard from '@/components/add-product/ColorVariantCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const SortableColorCard = (props) => {
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
};

const EditProductDialog = ({ product, open, onOpenChange, onSuccess }) => {
  const { updateProduct } = useInventory();
  const { sizes, colors: allColors, addColor } = useVariants();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [productInfo, setProductInfo] = useState({});
  const [generalImages, setGeneralImages] = useState(Array(4).fill(null));
  const [selectedCategories, setSelectedCategories] = useState({});
  const [selectedColors, setSelectedColors] = useState([]);
  const [sizeType, setSizeType] = useState('letter');
  const [variants, setVariants] = useState([]);
  const [colorImages, setColorImages] = useState({});
  const [variantPrice, setVariantPrice] = useState(0);
  const [variantCostPrice, setVariantCostPrice] = useState(0);

  const isUploading = useMemo(() => uploadProgress > 0 && uploadProgress < 100, [uploadProgress]);

  const resetState = useCallback(() => {
    if (product && open) {
      setProductInfo({
        name: product.name || '',
        price: product.price || '',
        costPrice: product.costPrice || '',
        discountPrice: product.discountPrice || '',
        discountEndDate: product.discountEndDate || '',
        isFeatured: product.isFeatured || false,
      });

      const initialGeneralImages = Array(4).fill(null);
      if (product.images) {
        product.images.forEach((img, index) => {
          if (index < 4) initialGeneralImages[index] = img;
        });
      }
      setGeneralImages(initialGeneralImages);

      setSelectedCategories(product.categories || { main_category: '', product_type: '', season_occasion: '' });
      
      const uniqueColorIds = [...new Set(product.variants.map(v => v.colorId))];
      const productColors = uniqueColorIds.map(id => allColors.find(c => c.id === id)).filter(Boolean);
      setSelectedColors(productColors);

      const firstVariant = product.variants[0];
      if (firstVariant) {
        const size = sizes.find(s => s.id === firstVariant.sizeId);
        if (size) setSizeType(size.type);
      }
      
      setVariants(product.variants || []);

      const initialColorImages = {};
      product.variants.forEach(v => {
        if (v.image && !initialColorImages[v.colorId]) {
          initialColorImages[v.colorId] = v.image;
        }
      });
      setColorImages(initialColorImages);
    }
  }, [product, open, allColors, sizes]);

  useEffect(() => {
    resetState();
  }, [resetState]);

  const allSizesForType = useMemo(() => sizes.filter(s => s.type === sizeType), [sizes, sizeType]);

  const handleColorImageSelect = useCallback((colorId, file) => {
    setColorImages(prev => ({...prev, [colorId]: file}));
  }, []);
  
  const handleColorImageRemove = useCallback((colorId) => {
    setColorImages(prev => {
        const newImages = {...prev};
        delete newImages[colorId];
        return newImages;
    });
  }, []);
  
  const handleGeneralImageSelect = useCallback((index, file) => {
    const newImages = [...generalImages];
    newImages[index] = file;
    setGeneralImages(newImages);
  }, [generalImages]);
  
  const removeGeneralImage = useCallback((index) => {
    const newImages = [...generalImages];
    newImages[index] = null;
    setGeneralImages(newImages);
  }, [generalImages]);

  const handleSave = async () => {
    if (!product) return;
    setIsSubmitting(true);
    setUploadProgress(0);

    const dataToUpdate = {
      ...productInfo,
      price: parseFloat(productInfo.price) || 0,
      costPrice: productInfo.costPrice ? parseFloat(productInfo.costPrice) : 0,
      discountPrice: productInfo.discountPrice ? parseFloat(productInfo.discountPrice) : 0,
      categories: selectedCategories,
      variants,
    };
    
    const imageFiles = {
      general: generalImages,
      colorImages: colorImages,
    };
    
    const result = await updateProduct(product.id, dataToUpdate, imageFiles, setUploadProgress);

    if (result.success) {
      toast({ title: 'نجاح', description: 'تم تحديث المنتج بنجاح!' });
      if(onSuccess) onSuccess();
      onOpenChange(false);
    } else {
      toast({ title: 'خطأ', description: result.error || 'فشل تحديث المنتج.', variant: 'destructive' });
    }
    setIsSubmitting(false);
    setUploadProgress(0);
  };

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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>تعديل المنتج: {product.name}</DialogTitle>
          <DialogDescription>قم بتحديث تفاصيل المنتج والمتغيرات والمخزون من هنا.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-6">
          <ProductPrimaryInfo 
            productInfo={productInfo} 
            setProductInfo={setProductInfo}
            generalImages={generalImages}
            onImageSelect={handleGeneralImageSelect}
            onImageRemove={removeGeneralImage}
          />
          <NewProductCategorization 
            selectedCategories={selectedCategories} 
            setSelectedCategories={setSelectedCategories} 
          />
          <ProductVariantSelection 
            selectedColors={selectedColors}
            setSelectedColors={setSelectedColors}
            sizeType={sizeType}
            setSizeType={setSizeType}
          />
          {selectedColors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>إدارة المتغيرات النهائية</CardTitle>
                <CardDescription>هنا يمكنك التحكم في كل متغير من متغيرات المنتج، بما في ذلك السعر والمخزون.</CardDescription>
              </CardHeader>
              <CardContent>
                <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={selectedColors.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {selectedColors.map((color) => {
                        const initialImage = colorImages[color.id];
                        let preview = null;
                        if (initialImage) {
                          preview = typeof initialImage === 'string' ? initialImage : URL.createObjectURL(initialImage);
                        }
                        return (
                          <SortableColorCard
                            key={color.id}
                            color={color}
                            allSizesForType={allSizesForType}
                            variants={variants}
                            setVariants={setVariants}
                            price={variantPrice}
                            costPrice={variantCostPrice}
                            handleImageSelect={(file) => handleColorImageSelect(color.id, file)}
                            handleImageRemove={() => handleColorImageRemove(color.id)}
                            initialImage={preview}
                          />
                        )
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          )}
        </div>
        <DialogFooter className="sm:justify-between items-center">
            {isUploading && (
              <div className='flex items-center gap-2'>
                <Progress value={uploadProgress} className="w-32" />
                <span className='text-sm text-muted-foreground'>{Math.round(uploadProgress)}%</span>
              </div>
            )}
            {!isUploading && <div></div>}
            <div className="flex gap-2">
                <DialogClose asChild>
                    <Button variant="outline">إلغاء</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={isSubmitting || isUploading}>
                    {isSubmitting || isUploading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
                    {isSubmitting || isUploading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;