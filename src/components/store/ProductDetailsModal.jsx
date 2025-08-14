import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ShoppingCart, 
  Heart, 
  Star, 
  Minus, 
  Plus,
  Share2,
  MessageCircle,
  Shield,
  Truck,
  RotateCcw
} from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DefaultProductImage from '@/components/ui/default-product-image';

const ProductDetailsModal = ({ 
  product, 
  isOpen, 
  onClose, 
  onAddToCart, 
  colors = [], 
  sizes = [] 
}) => {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  if (!product) return null;

  const productImages = product.images && product.images.length > 0 
    ? product.images 
    : [null];

  const totalStock = product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || 0;
  const hasDiscount = product.discount_percentage > 0;
  const finalPrice = hasDiscount 
    ? product.price - (product.price * product.discount_percentage / 100)
    : product.price;

  // الحصول على الألوان والأحجام المتاحة
  const availableColors = [...new Set(product.variants?.map(v => v.color) || [])];
  const availableSizes = selectedVariant 
    ? [...new Set(product.variants?.filter(v => v.color === selectedVariant.color).map(v => v.size) || [])]
    : [...new Set(product.variants?.map(v => v.size) || [])];

  const handleColorSelect = (color) => {
    const variant = product.variants?.find(v => v.color === color);
    setSelectedVariant(variant);
  };

  const handleSizeSelect = (size) => {
    const variant = product.variants?.find(v => 
      (!selectedVariant?.color || v.color === selectedVariant.color) && v.size === size
    );
    setSelectedVariant(variant);
  };

  const handleAddToCart = () => {
    if (!selectedVariant) {
      // اختيار أول variant متاح
      const firstVariant = product.variants?.[0];
      if (firstVariant) {
        onAddToCart(product, firstVariant, quantity);
        onClose();
      }
    } else {
      onAddToCart(product, selectedVariant, quantity);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full h-[90vh] bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">تفاصيل المنتج</DialogTitle>
        
        {/* رأس النافذة */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="text-2xl font-bold text-foreground">تفاصيل المنتج</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFavorite(!isFavorite)}
              className={`w-10 h-10 rounded-full ${isFavorite ? 'text-red-500' : 'text-muted-foreground'}`}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full text-muted-foreground"
            >
              <Share2 className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="w-10 h-10 rounded-full text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="grid lg:grid-cols-2 h-full">
            
            {/* معرض الصور */}
            <div className="p-6 space-y-4">
              <div className="aspect-square bg-muted/50 rounded-2xl overflow-hidden relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedImageIndex}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full"
                  >
                    {productImages[selectedImageIndex] ? (
                      <img
                        src={productImages[selectedImageIndex]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <DefaultProductImage className="w-full h-full" alt={product.name} />
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* شارات المنتج */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  {hasDiscount && (
                    <Badge className="bg-red-500 text-white font-bold">
                      خصم {product.discount_percentage}%
                    </Badge>
                  )}
                  {totalStock < 10 && totalStock > 0 && (
                    <Badge variant="destructive">قطع محدودة</Badge>
                  )}
                </div>
              </div>

              {/* صور مصغرة */}
              {productImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {productImages.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                        selectedImageIndex === index 
                          ? 'border-primary' 
                          : 'border-transparent hover:border-border'
                      }`}
                    >
                      {image ? (
                        <img
                          src={image}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <DefaultProductImage className="w-full h-full" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* تفاصيل المنتج */}
            <div className="p-6 space-y-6 overflow-y-auto">
              
              {/* اسم المنتج والتقييم */}
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="text-sm font-medium mr-2">4.8</span>
                    <span className="text-sm text-muted-foreground">(124 تقييم)</span>
                  </div>
                  <Button variant="link" className="text-primary p-0 h-auto">
                    <MessageCircle className="w-4 h-4 ml-1" />
                    اقرأ التقييمات
                  </Button>
                </div>
              </div>

              {/* السعر */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-primary">
                    {finalPrice.toLocaleString()} د.ع
                  </span>
                  {hasDiscount && (
                    <span className="text-xl text-muted-foreground line-through">
                      {product.price.toLocaleString()} د.ع
                    </span>
                  )}
                </div>
                {hasDiscount && (
                  <p className="text-green-600 font-medium">
                    وفرت {(product.price - finalPrice).toLocaleString()} د.ع
                  </p>
                )}
              </div>

              <Separator />

              {/* الألوان */}
              {availableColors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">اختر اللون</h3>
                  <div className="flex flex-wrap gap-3">
                    {availableColors.map((color) => {
                      const colorData = colors.find(c => c.name === color);
                      const isSelected = selectedVariant?.color === color;
                      
                      return (
                        <motion.button
                          key={color}
                          onClick={() => handleColorSelect(color)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className={`w-12 h-12 rounded-full border-4 transition-all duration-300 ${
                            isSelected ? 'border-primary shadow-lg' : 'border-border hover:border-primary/50'
                          }`}
                          style={{ 
                            backgroundColor: colorData?.hex_code || '#gray',
                          }}
                          title={color}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* الأحجام */}
              {availableSizes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">اختر المقاس</h3>
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map((size) => {
                      const isSelected = selectedVariant?.size === size;
                      
                      return (
                        <Button
                          key={size}
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => handleSizeSelect(size)}
                          className={`min-w-12 h-12 rounded-lg ${
                            isSelected ? 'bg-primary text-white' : ''
                          }`}
                        >
                          {size}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* الكمية */}
              <div className="space-y-3">
                <h3 className="font-semibold">الكمية</h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-border rounded-lg">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    متوفر: {totalStock} قطعة
                  </span>
                </div>
              </div>

              {/* أزرار العمل */}
              <div className="space-y-3 pt-4">
                <Button
                  onClick={handleAddToCart}
                  disabled={totalStock === 0}
                  className="w-full bg-gradient-to-r from-primary to-purple-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                  size="lg"
                >
                  <ShoppingCart className="w-5 h-5 ml-2" />
                  أضف إلى السلة
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full py-3 rounded-xl border-2 border-primary/30 hover:border-primary/60"
                  size="lg"
                >
                  اشتري الآن
                </Button>
              </div>

              {/* مميزات الخدمة */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center space-y-2">
                  <Truck className="w-8 h-8 text-primary mx-auto" />
                  <p className="text-xs text-muted-foreground">توصيل مجاني</p>
                </div>
                <div className="text-center space-y-2">
                  <RotateCcw className="w-8 h-8 text-primary mx-auto" />
                  <p className="text-xs text-muted-foreground">إرجاع مجاني</p>
                </div>
                <div className="text-center space-y-2">
                  <Shield className="w-8 h-8 text-primary mx-auto" />
                  <p className="text-xs text-muted-foreground">ضمان الجودة</p>
                </div>
              </div>

              {/* تبويبات إضافية */}
              <Tabs defaultValue="description" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="description">الوصف</TabsTrigger>
                  <TabsTrigger value="specifications">المواصفات</TabsTrigger>
                  <TabsTrigger value="reviews">التقييمات</TabsTrigger>
                </TabsList>
                
                <TabsContent value="description" className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    {product.description || 'وصف شامل للمنتج وخصائصه المميزة وطريقة الاستخدام المناسبة له.'}
                  </p>
                </TabsContent>
                
                <TabsContent value="specifications" className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">المادة:</span>
                      <span className="text-muted-foreground">قطن عالي الجودة</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">بلد المنشأ:</span>
                      <span className="text-muted-foreground">تركيا</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">العناية:</span>
                      <span className="text-muted-foreground">غسيل عادي</span>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="reviews" className="space-y-4">
                  <div className="text-center text-muted-foreground">
                    <Star className="w-12 h-12 mx-auto mb-2 text-yellow-400" />
                    <p>سيتم عرض تقييمات العملاء هنا</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailsModal;