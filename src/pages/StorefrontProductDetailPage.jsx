import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import ProductGrid from '@/components/storefront/ProductGrid';
import { useProductRecommendations } from '@/hooks/storefront/useProductRecommendations';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    settings, 
    addToCart, 
    calculateDiscountedPrice, 
    trackProductView,
    trackCartAddition 
  } = useStorefront();
  
  const [product, setProduct] = useState(null);
  const [customDescription, setCustomDescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [finalPrice, setFinalPrice] = useState(null);

  const { recommendations } = useProductRecommendations(
    id,
    product?.category_id,
    product?.department_id
  );

  useEffect(() => {
    trackProductView(id);
  }, [id, trackProductView]);

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);

        // جلب بيانات المنتج
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(`
            *,
            variants:product_variants(
              id,
              color,
              size,
              price,
              quantity,
              reserved_quantity,
              images
            )
          `)
          .eq('id', id)
          .single();

        if (productError) throw productError;

        // جلب الوصف المخصص من الموظف (إن وجد)
        if (settings?.employee_id) {
          const { data: customData } = await supabase
            .from('employee_product_descriptions')
            .select('*')
            .eq('employee_id', settings.employee_id)
            .eq('product_id', id)
            .single();

          setCustomDescription(customData);
        }

        setProduct(productData);

        // تحديد اللون والحجم الافتراضي
        if (productData.variants && productData.variants.length > 0) {
          const availableVariant = productData.variants.find(v =>
            (v.quantity - (v.reserved_quantity || 0)) > 0
          );
          
          if (availableVariant) {
            setSelectedColor(availableVariant.color);
            setSelectedSize(availableVariant.size);
          }
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        toast({
          title: 'خطأ',
          description: 'فشل تحميل بيانات المنتج',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, settings?.employee_id]);

  // حساب السعر بعد الخصم
  useEffect(() => {
    const updatePrice = async () => {
      const variant = selectedVariant;
      if (!variant || !settings?.employee_id) return;

      const discounted = await calculateDiscountedPrice(id, variant.price);
      setFinalPrice(discounted);
    };

    updatePrice();
  }, [selectedColor, selectedSize, id, settings?.employee_id, calculateDiscountedPrice]);

  const selectedVariant = product?.variants?.find(
    v => v.color === selectedColor && v.size === selectedSize
  );

  const availableStock = selectedVariant
    ? selectedVariant.quantity - (selectedVariant.reserved_quantity || 0)
    : 0;

  const currentImages = customDescription?.custom_images?.length > 0
    ? customDescription.custom_images
    : selectedVariant?.images || [product?.image];

  const handleAddToCart = () => {
    if (!selectedVariant) {
      toast({
        title: 'تنبيه',
        description: 'يرجى اختيار اللون والحجم',
        variant: 'destructive'
      });
      return;
    }

    if (quantity > availableStock) {
      toast({
        title: 'تنبيه',
        description: 'الكمية المطلوبة غير متوفرة',
        variant: 'destructive'
      });
      return;
    }

    addToCart({
      id: selectedVariant.id,
      product_id: product.id,
      name: product.name,
      color: selectedColor,
      size: selectedSize,
      price: finalPrice || selectedVariant.price,
      image: currentImages[0]
    }, quantity);

    trackCartAddition();

    toast({
      title: 'تمت الإضافة',
      description: 'تم إضافة المنتج إلى السلة بنجاح'
    });
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8">جاري التحميل...</div>;
  }

  if (!product) {
    return <div className="container mx-auto px-4 py-8">المنتج غير موجود</div>;
  }

  // الألوان المتاحة
  const availableColors = [...new Set(product.variants
    .filter(v => (v.quantity - (v.reserved_quantity || 0)) > 0)
    .map(v => v.color))];

  // الأحجام المتاحة للون المحدد
  const availableSizes = product.variants
    .filter(v => v.color === selectedColor && (v.quantity - (v.reserved_quantity || 0)) > 0)
    .map(v => v.size);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
        {/* صور المنتج */}
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            <img
              src={currentImages[currentImageIndex] || '/placeholder.png'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            
            {currentImages.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex(prev => (prev - 1 + currentImages.length) % currentImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setCurrentImageIndex(prev => (prev + 1) % currentImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* صور مصغرة */}
          {currentImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {currentImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`aspect-square rounded-lg border-2 overflow-hidden ${
                    idx === currentImageIndex ? 'border-primary' : 'border-border'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* معلومات المنتج */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{product.name}</h1>
            {product.brand && (
              <p className="text-muted-foreground">{product.brand}</p>
            )}
          </div>

          <div className="flex items-baseline gap-4">
            <span className="text-3xl font-bold text-primary">
              {(finalPrice || selectedVariant?.price)?.toLocaleString('ar-IQ')} IQD
            </span>
            {finalPrice && finalPrice < selectedVariant?.price && (
              <span className="text-lg line-through text-muted-foreground">
                {selectedVariant.price.toLocaleString('ar-IQ')} IQD
              </span>
            )}
          </div>

          {/* الوصف */}
          <div className="prose prose-sm">
            <p className="text-foreground">
              {customDescription?.custom_description || product.description || 'لا يوجد وصف'}
            </p>
          </div>

          {/* اختيار اللون */}
          {availableColors.length > 0 && (
            <div>
              <Label className="mb-3 block">اللون</Label>
              <RadioGroup value={selectedColor} onValueChange={setSelectedColor}>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map(color => (
                    <div key={color} className="flex items-center">
                      <RadioGroupItem value={color} id={`color-${color}`} className="sr-only" />
                      <Label
                        htmlFor={`color-${color}`}
                        className={`px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedColor === color
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {color}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {/* اختيار الحجم */}
          {availableSizes.length > 0 && (
            <div>
              <Label className="mb-3 block">الحجم</Label>
              <RadioGroup value={selectedSize} onValueChange={setSelectedSize}>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map(size => (
                    <div key={size} className="flex items-center">
                      <RadioGroupItem value={size} id={`size-${size}`} className="sr-only" />
                      <Label
                        htmlFor={`size-${size}`}
                        className={`px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedSize === size
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {size}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {/* الكمية */}
          <div>
            <Label className="mb-3 block">الكمية</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-border rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="px-6 py-2 font-semibold">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                  disabled={quantity >= availableStock}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Badge variant={availableStock > 0 ? 'default' : 'destructive'}>
                {availableStock > 0 ? `متوفر: ${availableStock}` : 'غير متوفر'}
              </Badge>
            </div>
          </div>

          {/* زر الإضافة للسلة */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleAddToCart}
            disabled={!selectedVariant || availableStock === 0}
          >
            <ShoppingCart className="ml-2 h-5 w-5" />
            إضافة إلى السلة
          </Button>
        </div>
      </div>

      {/* منتجات مشابهة */}
      {recommendations.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-6">منتجات مشابهة</h2>
          <ProductGrid products={recommendations.slice(0, 4)} />
        </div>
      )}
    </div>
  );
};

const StorefrontProductDetailPageWrapper = () => {
  const { slug } = useParams();

  return (
    <StorefrontProvider slug={slug}>
      <StorefrontLayout>
        <ProductDetail />
      </StorefrontLayout>
    </StorefrontProvider>
  );
};

export default StorefrontProductDetailPageWrapper;
