
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, PackagePlus, ArrowRight, Sparkles, Building2 } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Loader from '@/components/ui/loader';
import { Progress } from "@/components/ui/progress";
import { supabase } from '@/lib/customSupabaseClient';

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
  const selectedDepartment = location.state?.selectedDepartment;

  const { addProduct, settings, loading: inventoryLoading, refetchProducts } = useInventory();
  const { sizes, colors: allColors, loading: variantsLoading } = useVariants();
  
  const [productInfo, setProductInfo] = useState({
    name: '', price: '', costPrice: '', description: '',
  });
  const [generalImages, setGeneralImages] = useState(Array(4).fill(null));
  const [selectedCategories, setSelectedCategories] = useState({
    department: selectedDepartment?.name || '',
    main_category: '', 
    product_type: '', 
    season_occasion: ''
  });
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

  useEffect(() => {
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
              const sku = `${settings?.sku_prefix || 'PROD'}-${color.name.slice(0,3)}-${size.name}-${Math.random().toString(36).substr(2, 4)}`.toUpperCase().replace(/\s+/g, '-');
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
                sku: sku,
                barcode: sku,
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
  }, [selectedColors, sizeType, colorSizeTypes, sizes, productInfo.price, productInfo.costPrice, settings]);

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
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6 space-y-6">
          
          {/* Header قسم محسن */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-blue-600/10" />
            <div className="relative p-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <Button type="button" variant="outline" onClick={() => navigate(fromPurchases || '/add-product')}>
                      <ArrowRight className="h-4 w-4 ml-2" />
                      رجوع
                   </Button>
                   <div>
                     <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                       إضافة منتج جديد
                     </h1>
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
                   <Button 
                     onClick={handleSubmit}
                     disabled={isSubmitting || isUploading || !settings}
                     className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700"
                   >
                      {isSubmitting || isUploading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <PackagePlus className="w-4 h-4 ml-2" />}
                      {isSubmitting || isUploading ? "جاري الحفظ..." : "حفظ المنتج"}
                   </Button>
                </div>
              </div>
            </div>
          </div>

          {/* نموذج الإضافة */}
          <form onSubmit={handleSubmit} className="space-y-6 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ProductPrimaryInfo 
                  productInfo={productInfo} 
                  setProductInfo={setProductInfo}
                  generalImages={generalImages}
                  onImageSelect={handleGeneralImageSelect}
                  onImageRemove={handleGeneralImageRemove}
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
                  colorSizeTypes={colorSizeTypes}
                  setColorSizeTypes={setColorSizeTypes}
                />
              </div>
              
              {/* معلومات إضافية في الشريط الجانبي */}
              <div className="space-y-6">
                {selectedDepartment && (
                  <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-primary">
                        <Sparkles className="h-5 w-5" />
                        القسم المحدد
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-gradient-to-r ${selectedDepartment.color}`}>
                            <Building2 className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold">{selectedDepartment.name}</p>
                            <p className="text-sm text-muted-foreground">{selectedDepartment.description}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* نصائح سريعة */}
                <Card>
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
                            allSizesForType={variants.filter(v => v.colorId === color.id)}
                            variants={variants}
                            setVariants={setVariants}
                            price={productInfo.price}
                            costPrice={productInfo.costPrice}
                            handleImageSelect={(file) => handleColorImageSelect(color.id, file)}
                            handleImageRemove={() => handleColorImageRemove(color.id)}
                            initialImage={colorImages[color.id] || null}
                            colorSizeTypes={colorSizeTypes[color.id] || [sizeType]}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
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
