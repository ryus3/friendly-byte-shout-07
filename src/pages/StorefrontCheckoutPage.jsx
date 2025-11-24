import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { settings, cart, cartTotal, clearCart, trackOrder } = useStorefront();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_phone2: '',
    customer_city: '',
    customer_province: '',
    customer_address: '',
    notes: ''
  });

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (cart.length === 0) {
      toast({
        title: 'خطأ',
        description: 'السلة فارغة',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.customer_name || !formData.customer_phone || !formData.customer_address) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول المطلوبة',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      // إنشاء الطلب
      const { data: order, error: orderError } = await supabase
        .from('storefront_orders')
        .insert({
          employee_id: settings.employee_id,
          storefront_slug: settings.storefront_slug,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_phone2: formData.customer_phone2 || null,
          customer_city: formData.customer_city,
          customer_province: formData.customer_province,
          customer_address: formData.customer_address,
          notes: formData.notes || null,
          items: cart,
          subtotal: cartTotal,
          total_amount: cartTotal,
          status: 'pending_approval',
          source: 'storefront'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // تتبع الطلب في Analytics
      await trackOrder(cartTotal);

      // تفريغ السلة
      clearCart();

      toast({
        title: 'تم إرسال الطلب',
        description: 'سيتم مراجعة طلبك والتواصل معك قريباً'
      });

      // الانتقال لصفحة التأكيد
      navigate(`/storefront/${settings.storefront_slug}/order-success/${order.id}`);
    } catch (err) {
      console.error('Error creating order:', err);
      toast({
        title: 'خطأ',
        description: 'فشل إنشاء الطلب، يرجى المحاولة مرة أخرى',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">السلة فارغة</p>
        <Button onClick={() => navigate(`/storefront/${settings.storefront_slug}/products`)}>
          العودة للتسوق
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">إتمام الطلب</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* نموذج الطلب */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <h2 className="text-xl font-semibold mb-4">معلومات التواصل</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customer_name">الاسم الكامل *</Label>
                <Input
                  id="customer_name"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="customer_phone">رقم الهاتف *</Label>
                <Input
                  id="customer_phone"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleChange}
                  required
                  dir="ltr"
                />
              </div>

              <div>
                <Label htmlFor="customer_phone2">رقم هاتف إضافي</Label>
                <Input
                  id="customer_phone2"
                  name="customer_phone2"
                  value={formData.customer_phone2}
                  onChange={handleChange}
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <h2 className="text-xl font-semibold mb-4">عنوان التوصيل</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customer_province">المحافظة *</Label>
                <Input
                  id="customer_province"
                  name="customer_province"
                  value={formData.customer_province}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="customer_city">المدينة *</Label>
                <Input
                  id="customer_city"
                  name="customer_city"
                  value={formData.customer_city}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="customer_address">العنوان التفصيلي *</Label>
              <Textarea
                id="customer_address"
                name="customer_address"
                value={formData.customer_address}
                onChange={handleChange}
                required
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="notes">ملاحظات إضافية</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            تأكيد الطلب
          </Button>
        </form>

        {/* ملخص الطلب */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 border border-border rounded-lg p-6 bg-card space-y-4">
            <h3 className="text-xl font-bold">ملخص الطلب</h3>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {cart.map((item, index) => (
                <div key={index} className="flex gap-3 text-sm">
                  <img
                    src={item.image || '/placeholder.png'}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium line-clamp-1">{item.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.color} - {item.size} × {item.quantity}
                    </p>
                    <p className="font-semibold text-primary">
                      {(item.price * item.quantity).toLocaleString('ar-IQ')} IQD
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المجموع</span>
                <span className="font-semibold">{cartTotal.toLocaleString('ar-IQ')} IQD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">التوصيل</span>
                <span className="font-semibold">يحسب لاحقاً</span>
              </div>
            </div>

            <div className="flex justify-between text-lg font-bold pt-4 border-t border-border">
              <span>المجموع الكلي</span>
              <span className="text-primary">{cartTotal.toLocaleString('ar-IQ')} IQD</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StorefrontCheckoutPageWrapper = () => {
  const { slug } = useParams();

  return (
    <StorefrontProvider slug={slug}>
      <StorefrontLayout>
        <CheckoutPage />
      </StorefrontLayout>
    </StorefrontProvider>
  );
};

export default StorefrontCheckoutPageWrapper;
