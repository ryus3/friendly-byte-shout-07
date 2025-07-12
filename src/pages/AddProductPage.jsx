
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Building2, Globe, Sparkles, Image as ImageIcon, Package } from 'lucide-react';
import Loader from '@/components/ui/loader';
import { supabase } from '@/lib/customSupabaseClient';

import EnhancedProductForm from '@/components/add-product/EnhancedProductForm';

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
    main_category: selectedDepartment?.name || '', 
    product_type: '', 
    season_occasion: ''
  });
  const [selectedColors, setSelectedColors] = useState([]);
  const [variants, setVariants] = useState([]);
  const [colorImages, setColorImages] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [productStats, setProductStats] = useState({ total: 0, active: 0, categories: 0 });
  
  const isUploading = useMemo(() => uploadProgress > 0 && uploadProgress < 100, [uploadProgress]);

  // Get product statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: products } = await supabase
          .from('products')
          .select('id, is_active, category_id')
          .order('created_at', { ascending: false });
        
        const { data: categories } = await supabase
          .from('categories')
          .select('id')
          .eq('type', 'main_category');
        
        setProductStats({
          total: products?.length || 0,
          active: products?.filter(p => p.is_active)?.length || 0,
          categories: categories?.length || 0
        });
      } catch (error) {
        console.error('خطأ في جلب الإحصائيات:', error);
      }
    };
    
    fetchStats();
  }, []);

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

  // Generate variants based on selected colors and available sizes
  useEffect(() => {
    const generateVariants = () => {
      if (selectedColors.length === 0) {
        setVariants([]);
        return;
      }
  
      const newVariants = [];
      selectedColors.forEach(color => {
        // Get all available sizes (excluding free size)
        const availableSizes = sizes.filter(s => 
          s.name !== 'فري سايز' && 
          s.name !== 'Free Size'
        );
        
        availableSizes.forEach(size => {
          const sku = `${settings?.sku_prefix || 'PROD'}-${color.name.slice(0,3)}-${size.name}-${Math.random().toString(36).substr(2, 4)}`.toUpperCase().replace(/\s+/g, '-');
          newVariants.push({
            colorId: color.id,
            sizeId: size.id,
            color: color.name,
            color_hex: color.hex_code,
            size: size.name,
            sizeType: size.type,
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
  }, [selectedColors, sizes, productInfo.price, productInfo.costPrice, settings]);

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
  
  const handleCancel = () => {
    if (fromPurchases) {
      navigate(fromPurchases);
    } else {
      navigate('/manage-products');
    }
  };
  
  const loading = inventoryLoading || variantsLoading;
  if (loading && !isSubmitting) return <div className="h-full w-full flex items-center justify-center"><Loader /></div>;

  return (
    <>
      <Helmet><title>إضافة منتج جديد - RYUS</title></Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6 space-y-8">
          
          {/* World-Class Header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 blur-3xl" />
            <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-start gap-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate(fromPurchases || '/add-product')}
                    className="shrink-0"
                  >
                    <ArrowRight className="h-4 w-4 ml-2" />
                    رجوع
                  </Button>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl">
                        <Package className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                          إضافة منتج جديد
                        </h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          نظام إضافة المنتجات المتطور والعالمي
                        </p>
                      </div>
                    </div>
                    
                    {selectedDepartment && (
                      <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl border border-primary/20">
                        <Building2 className="h-5 w-5 text-primary" />
                        <span className="text-sm">
                          القسم المحدد: <span className="font-semibold text-primary">{selectedDepartment.name}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 w-full lg:w-auto">
                  <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{productStats.total}</div>
                    <div className="text-sm text-emerald-600 dark:text-emerald-400">إجمالي المنتجات</div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{productStats.active}</div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">منتجات نشطة</div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{productStats.categories}</div>
                    <div className="text-sm text-purple-600 dark:text-purple-400">التصنيفات</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Product Form */}
          <EnhancedProductForm
            productInfo={productInfo}
            setProductInfo={setProductInfo}
            generalImages={generalImages}
            setGeneralImages={setGeneralImages}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            selectedColors={selectedColors}
            setSelectedColors={setSelectedColors}
            variants={variants}
            setVariants={setVariants}
            colorImages={colorImages}
            setColorImages={setColorImages}
            isSubmitting={isSubmitting}
            uploadProgress={uploadProgress}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            editMode={false}
          />
          
        </div>
      </div>
    </>
  );
};

export default AddProductPage;
