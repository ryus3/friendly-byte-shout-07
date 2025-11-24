import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import { Trash2, ShoppingBag, ArrowLeft, Lock, Shield, Award } from 'lucide-react';
import GradientText from '@/components/storefront/ui/GradientText';
import GradientButton from '@/components/storefront/ui/GradientButton';
import QuantitySelector from '@/components/storefront/ui/QuantitySelector';

const TrustBadgeMini = ({ icon, text }) => (
  <div className="flex items-center gap-2 text-sm">
    <div className="text-emerald-600">
      {React.cloneElement(icon, { className: 'w-4 h-4' })}
    </div>
    <span className="text-gray-600 dark:text-gray-400">{text}</span>
  </div>
);

const ShoppingCartPage = () => {
  const navigate = useNavigate();
  const { settings, cart, cartTotal, updateQuantity, removeFromCart, clearCart } = useStorefront();

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="mb-8 relative">
            <div className="w-32 h-32 mx-auto bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-full flex items-center justify-center">
              <ShoppingBag className="h-16 w-16 text-purple-600" />
            </div>
            <div className="absolute -top-2 -right-2 w-full h-full">
              <div className="w-32 h-32 mx-auto border-4 border-purple-200 dark:border-purple-800 rounded-full animate-ping opacity-20" />
            </div>
          </div>
          
          <GradientText gradient="from-blue-600 via-purple-600 to-pink-600" size="4xl" className="mb-4">
            السلة فارغة
          </GradientText>
          <p className="text-muted-foreground mb-8 text-lg">ابدأ التسوق الآن واستمتع بعروضنا المميزة</p>
          
          <GradientButton
            gradient="from-blue-600 via-purple-600 to-pink-600"
            hoverGradient="from-blue-700 via-purple-700 to-pink-700"
            shadowColor="purple-500"
            shimmer={true}
            onClick={() => navigate(`/storefront/${settings.storefront_slug}/products`)}
          >
            <ShoppingBag className="ml-2 h-5 w-5" />
            تصفح المنتجات
          </GradientButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-900 dark:to-purple-900/20 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items - 2 Columns */}
          <div className="lg:col-span-2 space-y-4">
            <GradientText gradient="from-blue-600 to-purple-600" size="4xl" className="mb-8">
              سلة التسوق ({cart.length})
            </GradientText>
            
            {cart.map((item, index) => (
              <div
                key={index}
                className="group p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-lg hover:shadow-2xl transition-all border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-700"
              >
                <div className="flex gap-6">
                  {/* Image */}
                  <div className="relative w-32 h-32 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                    <img 
                      src={item.image || '/placeholder.png'} 
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 space-y-3">
                    <h3 className="text-xl font-bold group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all">
                      {item.name}
                    </h3>
                    
                    <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>اللون: <span className="font-semibold text-foreground">{item.color}</span></span>
                      <span>المقاس: <span className="font-semibold text-foreground">{item.size}</span></span>
                    </div>
                    
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <QuantitySelector 
                        value={item.quantity} 
                        onChange={(q) => updateQuantity(index, q)} 
                      />
                      
                      <div className="text-right">
                        <GradientText 
                          gradient="from-blue-600 to-purple-600" 
                          size="2xl"
                          className="font-black"
                        >
                          {(item.price * item.quantity).toLocaleString('ar-IQ')} IQD
                        </GradientText>
                        <div className="text-sm text-gray-500">
                          {item.price.toLocaleString('ar-IQ')} × {item.quantity}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Remove Button */}
                  <button 
                    onClick={() => removeFromCart(index)}
                    className="p-3 h-fit rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-all hover:scale-110"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={clearCart}
              className="w-full p-4 border-2 border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              <Trash2 className="inline w-5 h-5 ml-2" />
              إفراغ السلة
            </button>
          </div>
          
          {/* Summary - 1 Column */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 p-8 bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-purple-900/20 rounded-3xl shadow-2xl border-2 border-purple-200 dark:border-purple-800">
              <GradientText gradient="from-purple-600 to-pink-600" size="2xl" className="mb-6 font-black">
                ملخص الطلب
              </GradientText>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600 dark:text-gray-400">المجموع الفرعي:</span>
                  <span className="font-bold">{cartTotal.toLocaleString('ar-IQ')} IQD</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600 dark:text-gray-400">الشحن:</span>
                  <span className="font-bold text-emerald-600">مجاني ✓</span>
                </div>
                
                <div className="h-px bg-gradient-to-r from-transparent via-purple-300 dark:via-purple-700 to-transparent" />
                
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-black">الإجمالي:</span>
                  <GradientText gradient="from-blue-600 to-purple-600" size="3xl" className="font-black">
                    {cartTotal.toLocaleString('ar-IQ')} IQD
                  </GradientText>
                </div>
              </div>
              
              {/* Checkout Button */}
              <GradientButton
                gradient="from-blue-600 via-purple-600 to-pink-600"
                hoverGradient="from-blue-700 via-purple-700 to-pink-700"
                shadowColor="purple-500"
                shimmer={true}
                onClick={() => navigate(`/storefront/${settings.storefront_slug}/checkout`)}
                className="w-full py-5 text-xl mb-4"
              >
                إتمام الطلب
                <ArrowLeft className="mr-2 h-6 w-6" />
              </GradientButton>

              <button
                onClick={() => navigate(`/storefront/${settings.storefront_slug}/products`)}
                className="w-full p-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-600 dark:text-purple-400 rounded-xl font-bold hover:from-purple-200 hover:to-pink-200 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50 transition-all"
              >
                مواصلة التسوق
              </button>
              
              {/* Trust Badges */}
              <div className="mt-6 space-y-3">
                <TrustBadgeMini icon={<Lock />} text="دفع آمن 100%" />
                <TrustBadgeMini icon={<Shield />} text="حماية بيانات العميل" />
                <TrustBadgeMini icon={<Award />} text="ضمان استرجاع الأموال" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StorefrontCartPageWrapper = () => {
  const { slug } = useParams();

  return (
    <StorefrontProvider slug={slug}>
      <StorefrontLayout>
        <ShoppingCartPage />
      </StorefrontLayout>
    </StorefrontProvider>
  );
};

export default StorefrontCartPageWrapper;
