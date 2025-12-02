import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useProductRecommendations } from '@/hooks/storefront/useProductRecommendations';
import { ShoppingCart, Heart, Share2, Shield, Truck, Award, Check } from 'lucide-react';
import ImageGallery from '@/components/storefront/ui/ImageGallery';
import QuantitySelector from '@/components/storefront/ui/QuantitySelector';
import TrustBadge from '@/components/storefront/ui/TrustBadge';
import StarRating from '@/components/storefront/ui/StarRating';
import GradientButton from '@/components/storefront/ui/GradientButton';
import GradientText from '@/components/storefront/ui/GradientText';
import AnimatedBadge from '@/components/storefront/ui/AnimatedBadge';
import ProductGrid from '@/components/storefront/ProductGrid';
import { Label } from '@/components/ui/label';

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

        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(id, name),
            department:departments(id, name),
            variants:product_variants(
              id,
              price,
              images,
              color:colors(id, name, hex_code),
              size:sizes(id, name),
              inventory(quantity, reserved_quantity)
            )
          `)
          .eq('id', id)
          .single();

        if (productError) throw productError;

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

        if (productData.variants && productData.variants.length > 0) {
          const availableVariant = productData.variants.find(v => {
            const qty = v.inventory?.quantity ?? v.quantity ?? 0;
            const reserved = v.inventory?.reserved_quantity ?? v.reserved_quantity ?? 0;
            return (qty - reserved) > 0;
          });
          
          if (availableVariant) {
            const colorVal = typeof availableVariant.color === 'object' 
              ? availableVariant.color?.name 
              : availableVariant.color;
            const sizeVal = typeof availableVariant.size === 'object'
              ? availableVariant.size?.name
              : availableVariant.size;
            setSelectedColor(colorVal);
            setSelectedSize(sizeVal);
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

  useEffect(() => {
    const updatePrice = async () => {
      const variant = selectedVariant;
      if (!variant || !settings?.employee_id) return;

      const discounted = await calculateDiscountedPrice(id, variant.price);
      setFinalPrice(discounted);
    };

    updatePrice();
  }, [selectedColor, selectedSize, id, settings?.employee_id, calculateDiscountedPrice]);

  const selectedVariant = product?.variants?.find(v => {
    const colorVal = typeof v.color === 'object' ? v.color?.name : v.color;
    const sizeVal = typeof v.size === 'object' ? v.size?.name : v.size;
    return colorVal === selectedColor && sizeVal === selectedSize;
  });

  const availableStock = selectedVariant
    ? (selectedVariant.inventory?.quantity ?? selectedVariant.quantity ?? 0) - 
      (selectedVariant.inventory?.reserved_quantity ?? selectedVariant.reserved_quantity ?? 0)
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
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <GradientText gradient="from-blue-600 via-purple-600 to-pink-600" size="xl">
            جاري التحميل...
          </GradientText>
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className="container mx-auto px-4 py-8">المنتج غير موجود</div>;
  }

  const availableColors = [...new Set(product.variants
    .filter(v => {
      const qty = v.inventory?.quantity ?? v.quantity ?? 0;
      const reserved = v.inventory?.reserved_quantity ?? v.reserved_quantity ?? 0;
      return (qty - reserved) > 0;
    })
    .map(v => typeof v.color === 'object' ? v.color?.name : v.color)
  )].filter(Boolean);

  const availableSizes = product.variants
    .filter(v => {
      const colorVal = typeof v.color === 'object' ? v.color?.name : v.color;
      const qty = v.inventory?.quantity ?? v.quantity ?? 0;
      const reserved = v.inventory?.reserved_quantity ?? v.reserved_quantity ?? 0;
      return colorVal === selectedColor && (qty - reserved) > 0;
    })
    .map(v => typeof v.size === 'object' ? v.size?.name : v.size)
    .filter(Boolean);

  const discount = finalPrice && selectedVariant?.price ? 
    Math.round(((selectedVariant.price - finalPrice) / selectedVariant.price) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Image Gallery */}
          <div className="lg:sticky lg:top-8 h-fit">
            <ImageGallery images={currentImages} productName={product.name} />
          </div>

          {/* Product Info */}
          <div className="space-y-8">
            {/* Title & Reviews */}
            <div>
              <GradientText 
                gradient="from-blue-600 via-purple-600 to-pink-600" 
                size="4xl"
                className="mb-4 leading-tight"
              >
                {product.name}
              </GradientText>
              {product.brand && (
                <p className="text-lg text-muted-foreground font-semibold">{product.brand}</p>
              )}
              <div className="mt-4 flex items-center gap-4">
                <StarRating rating={4.8} size="large" />
                <span className="text-gray-600">(2,847 تقييم)</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500 font-bold">
                  ✓ مباع 15,234 قطعة
                </span>
              </div>
            </div>

            {/* Price Section */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-800 shadow-xl">
              <div className="flex items-baseline gap-4 mb-4 flex-wrap">
                <GradientText 
                  gradient="from-blue-600 to-purple-600" 
                  size="5xl"
                  className="font-black"
                >
                  {(finalPrice || selectedVariant?.price)?.toLocaleString('ar-IQ')}
                </GradientText>
                <span className="text-2xl text-gray-900 dark:text-white">IQD</span>
                {finalPrice && finalPrice < selectedVariant?.price && (
                  <>
                    <span className="text-2xl text-gray-400 line-through">
                      {selectedVariant.price.toLocaleString('ar-IQ')} IQD
                    </span>
                    <AnimatedBadge gradient="from-red-500 to-pink-500" pulse={true}>
                      وفّر {discount}%
                    </AnimatedBadge>
                  </>
                )}
              </div>
              
              <div className="flex gap-4 text-sm flex-wrap">
                <span className="text-emerald-600 font-semibold">✓ شحن مجاني</span>
                <span className="text-blue-600 font-semibold">✓ إرجاع مجاني خلال 30 يوم</span>
              </div>
            </div>

            {/* Description */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-foreground leading-relaxed text-lg">
                {customDescription?.custom_description || product.description || 'لا يوجد وصف'}
              </p>
            </div>

            {/* Color Selector */}
            {availableColors.length > 0 && (
              <div>
                <Label className="text-lg font-bold mb-4 block">اختر اللون:</Label>
                <div className="flex gap-3 flex-wrap">
                  {availableColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`group relative px-6 py-3 rounded-2xl border-4 transition-all font-semibold ${
                        selectedColor === color
                          ? 'border-purple-600 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 scale-110 shadow-xl shadow-purple-500/50'
                          : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:scale-105 hover:shadow-lg'
                      }`}
                    >
                      {color}
                      {selectedColor === color && (
                        <Check className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full p-1" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {availableSizes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-lg font-bold">اختر المقاس:</Label>
                  <button className="text-sm text-purple-600 hover:underline font-semibold">
                    📏 دليل المقاسات
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {availableSizes.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`p-4 rounded-xl border-2 font-bold transition-all ${
                        selectedSize === size
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-600 shadow-lg shadow-purple-500/50 scale-105'
                          : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity + Stock */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">الكمية:</span>
                <QuantitySelector 
                  value={quantity}
                  onChange={setQuantity}
                  max={availableStock}
                  gradient="from-blue-500 to-purple-500"
                />
              </div>
              
              {availableStock <= 10 && availableStock > 0 && (
                <AnimatedBadge gradient="from-orange-500 to-red-500" pulse={true}>
                  🔥 بقي {availableStock} قطع فقط!
                </AnimatedBadge>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <GradientButton
                gradient="from-blue-600 via-purple-600 to-pink-600"
                hoverGradient="from-blue-700 via-purple-700 to-pink-700"
                shadowColor="purple-500"
                shimmer={true}
                onClick={handleAddToCart}
                disabled={!selectedVariant || availableStock === 0}
                className="flex-1 py-6 text-xl"
              >
                <ShoppingCart className="ml-2 h-6 w-6" />
                أضف للسلة
              </GradientButton>
              
              <button className="p-6 border-2 border-purple-300 dark:border-purple-700 rounded-2xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all hover:scale-105">
                <Heart className="w-6 h-6 text-purple-600" />
              </button>
              
              <button className="p-6 border-2 border-purple-300 dark:border-purple-700 rounded-2xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all hover:scale-105">
                <Share2 className="w-6 h-6 text-purple-600" />
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TrustBadge icon={<Shield />} text="دفع آمن 100%" gradient="from-emerald-500 to-teal-500" />
              <TrustBadge icon={<Truck />} text="شحن سريع" gradient="from-blue-500 to-cyan-500" />
              <TrustBadge icon={<Award />} text="ضمان الجودة" gradient="from-purple-500 to-pink-500" />
            </div>
          </div>
        </div>

        {/* Related Products */}
        {recommendations.length > 0 && (
          <div className="mt-16">
            <GradientText gradient="from-blue-600 via-purple-600 to-pink-600" size="3xl" className="mb-8">
              منتجات مشابهة
            </GradientText>
            <ProductGrid products={recommendations.slice(0, 4)} />
          </div>
        )}
      </div>
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
