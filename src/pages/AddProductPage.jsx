
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, PackagePlus, ArrowRight } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Loader from '@/components/ui/loader';
import { Progress } from "@/components/ui/progress";

import ProductPrimaryInfo from '@/components/add-product/ProductPrimaryInfo';
import NewProductCategorization from '@/components/add-product/NewProductCategorization';
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
  const navigate = useNavigate();
  const location = useLocation();
  const fromPurchases = location.state?.from;

  const { addProduct, settings, loading: inventoryLoading, refetchProducts } = useInventory();
  const { sizes, colors: allColors, loading: variantsLoading } = useVariants();
  
  const [productInfo, setProductInfo] = useState({
    name: '', price: '', costPrice: '', description: '',
  });
  const [generalImages, setGeneralImages] = useState(Array(4).fill(null));
  const [selectedCategories, setSelectedCategories] = useState({
    main_category: '', product_type: '', season_occasion: ''
  });
  const [selectedColors, setSelectedColors] = useState([]);
  const [sizeType, setSizeType] = useState('letter');
  const [variants, setVariants] = useState([]);
  const [colorImages, setColorImages] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const isUploading = useMemo(() => uploadProgress > 0 && uploadProgress < 100, [uploadProgress]);

  const allSizesForType = useMemo(() => sizes.filter(s => s.type === sizeType), [sizes, sizeType]);

  useEffect(() => {
    const generateVariants = () => {
      if (selectedColors.length === 0 || allSizesForType.length === 0) {
        setVariants([]);
        return;
      }
  
      const newVariants = [];
      selectedColors.forEach(color => {
        allSizesForType.forEach(size => {
          const sku = `${settings?.sku_prefix || 'PROD'}-${color.name.slice(0,3)}-${size.value}-${Math.random().toString(36).substr(2, 4)}`.toUpperCase().replace(/\s+/g, '-');
          newVariants.push({
            colorId: color.id,
            sizeId: size.id,
            color: color.name,
            color_hex: color.hex_code,
            size: size.value,
            quantity: 0,
            price: parseFloat(productInfo.price) || 0,
            costPrice: parseFloat(productInfo.costPrice) || 0,
            sku: sku,
            barcode: sku,
            hint: ''
          });
        });
      });
      setVariants(newVariants);
    };
    if (settings) {
        generateVariants();
    }
  }, [selectedColors, allSizesForType, productInfo.price, productInfo.costPrice, settings]);


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

    setIsSubmitting(true);
    setUploadProgress(0);
    
    const productData = {
      ...productInfo,
      price: parseFloat(productInfo.price),
      costPrice: productInfo.costPrice ? parseFloat(productInfo.costPrice) : null,
      categories: selectedCategories,
      variants,
      isVisible: true,
    };
    
    const imageFiles = {
      general: generalImages.filter(Boolean),
      colorImages: colorImages,
    };
    
    const result = await addProduct(productData, imageFiles, setUploadProgress);

    if (result.success) {
      toast({ title: 'نجاح', description: 'تمت إضافة المنتج بنجاح!' });
      await refetchProducts();
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
      <Helmet><title>إضافة منتج جديد - RYUS</title></Helmet>
      <form onSubmit={handleSubmit} className="space-y-6 pb-20">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
             <Button type="button" variant="outline" onClick={() => navigate(fromPurchases || -1)}>
                <ArrowRight className="h-4 w-4 ml-2" />
                رجوع
             </Button>
             <h1 className="text-3xl font-bold tracking-tight">إضافة منتج جديد</h1>
          </div>
          <div className="flex items-center gap-4">
             {isUploading && <Progress value={uploadProgress} className="w-32" />}
             <Button type="submit" disabled={isSubmitting || isUploading || !settings}>
                {isSubmitting || isUploading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <PackagePlus className="w-4 h-4 ml-2" />}
                {isSubmitting || isUploading ? "جاري الحفظ..." : "حفظ المنتج"}
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ProductPrimaryInfo 
              productInfo={productInfo} 
              setProductInfo={setProductInfo}
              generalImages={generalImages}
              onImageSelect={handleGeneralImageSelect}
              onImageRemove={handleGeneralImageRemove}
            />
            <NewProductCategorization selectedCategories={selectedCategories} setSelectedCategories={setSelectedCategories} />
            <ProductVariantSelection 
              selectedColors={selectedColors}
              setSelectedColors={setSelectedColors}
              sizeType={sizeType}
              setSizeType={setSizeType}
            />
          </div>
        </div>
        
        {variants.length > 0 && (
          <Card>
            <CardHeader><CardTitle>إدارة المتغيرات النهائية</CardTitle></CardHeader>
            <CardContent>
              <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={selectedColors.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {selectedColors.map((color) => (
                      <SortableColorCard
                        key={color.id}
                        id={color.id}
                        color={color}
                        allSizesForType={allSizesForType}
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
      </form>
    </>
  );
};

export default AddProductPage;
