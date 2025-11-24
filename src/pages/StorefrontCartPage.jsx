import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Minus } from 'lucide-react';

const ShoppingCartPage = () => {
  const navigate = useNavigate();
  const { settings, cart, cartTotal, updateQuantity, removeFromCart, clearCart } = useStorefront();

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-md mx-auto space-y-6">
          <div className="text-6xl">🛒</div>
          <h2 className="text-2xl font-bold text-foreground">السلة فارغة</h2>
          <p className="text-muted-foreground">
            لم تقم بإضافة أي منتجات بعد
          </p>
          <Link to={`/storefront/${settings.storefront_slug}/products`}>
            <Button size="lg">تسوق الآن</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">سلة التسوق</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* العناصر */}
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item, index) => (
            <div key={index} className="flex gap-4 p-4 border border-border rounded-lg bg-card">
              <img
                src={item.image || '/placeholder.png'}
                alt={item.name}
                className="w-24 h-24 object-cover rounded-lg"
              />
              
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">{item.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {item.color} - {item.size}
                </p>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-border rounded-lg">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(index, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="px-4 text-sm font-semibold">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(index, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeFromCart(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-left">
                <p className="font-bold text-primary">
                  {(item.price * item.quantity).toLocaleString('ar-IQ')} IQD
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.price.toLocaleString('ar-IQ')} IQD للقطعة
                </p>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={clearCart}
          >
            تفريغ السلة
          </Button>
        </div>

        {/* ملخص الطلب */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 border border-border rounded-lg p-6 bg-card space-y-4">
            <h3 className="text-xl font-bold">ملخص الطلب</h3>
            
            <div className="space-y-2 py-4 border-y border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المجموع الفرعي</span>
                <span className="font-semibold">{cartTotal.toLocaleString('ar-IQ')} IQD</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">التوصيل</span>
                <span className="font-semibold">يحسب عند الدفع</span>
              </div>
            </div>

            <div className="flex justify-between text-lg font-bold">
              <span>المجموع</span>
              <span className="text-primary">{cartTotal.toLocaleString('ar-IQ')} IQD</span>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate(`/storefront/${settings.storefront_slug}/checkout`)}
            >
              إتمام الطلب
            </Button>

            <Link to={`/storefront/${settings.storefront_slug}/products`}>
              <Button variant="outline" className="w-full">
                متابعة التسوق
              </Button>
            </Link>
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
