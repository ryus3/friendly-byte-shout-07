import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Lock, Shield, Award, CreditCard, MapPin, User } from 'lucide-react';
import GradientText from '@/components/storefront/ui/GradientText';
import GradientButton from '@/components/storefront/ui/GradientButton';

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

      const { data: order, error: orderError } = await supabase
        .from('storefront_orders')
        .insert({
          employee_id: settings.employee_id,
          storefront_slug: settings.slug,
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

      await trackOrder(cartTotal);
      clearCart();

      toast({
        title: 'تم إرسال الطلب بنجاح! 🎉',
        description: 'سيتم مراجعة طلبك والتواصل معك قريباً'
      });

      navigate(`/storefront/${settings.slug}/order-success/${order.id}`);
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
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-6xl mb-4">🛒</div>
          <GradientText gradient="from-blue-600 via-purple-600 to-pink-600" size="4xl" className="mb-4">
            السلة فارغة
          </GradientText>
          <p className="text-muted-foreground mb-8">يرجى إضافة منتجات للمتابعة</p>
          <GradientButton
            gradient="from-blue-600 via-purple-600 to-pink-600"
            onClick={() => navigate(`/storefront/${settings.slug}/products`)}
          >
            العودة للتسوق
          </GradientButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-900 dark:to-purple-900/20 py-8">
      <div className="container mx-auto px-4">
        <GradientText gradient="from-blue-600 via-purple-600 to-pink-600" size="4xl" className="mb-8 text-center">
          إتمام الطلب
        </GradientText>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form - 2 Columns */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            {/* Personal Info */}
            <div className="p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border-2 border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
                  <User className="w-6 h-6 text-white" />
                </div>
                <GradientText gradient="from-blue-600 to-purple-600" size="2xl" className="font-black">
                  معلومات التواصل
                </GradientText>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="customer_name" className="text-lg font-semibold mb-2 block">
                    الاسم الكامل *
                  </Label>
                  <Input
                    id="customer_name"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleChange}
                    required
                    className="h-12 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-purple-500"
                  />
                </div>

                <div>
                  <Label htmlFor="customer_phone" className="text-lg font-semibold mb-2 block">
                    رقم الهاتف *
                  </Label>
                  <Input
                    id="customer_phone"
                    name="customer_phone"
                    value={formData.customer_phone}
                    onChange={handleChange}
                    required
                    dir="ltr"
                    className="h-12 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="customer_phone2" className="text-lg font-semibold mb-2 block">
                    رقم هاتف إضافي
                  </Label>
                  <Input
                    id="customer_phone2"
                    name="customer_phone2"
                    value={formData.customer_phone2}
                    onChange={handleChange}
                    dir="ltr"
                    className="h-12 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Address Info */}
            <div className="p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border-2 border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <GradientText gradient="from-emerald-600 to-teal-600" size="2xl" className="font-black">
                  عنوان التوصيل
                </GradientText>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="customer_province" className="text-lg font-semibold mb-2 block">
                    المحافظة *
                  </Label>
                  <Input
                    id="customer_province"
                    name="customer_province"
                    value={formData.customer_province}
                    onChange={handleChange}
                    required
                    className="h-12 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-purple-500"
                  />
                </div>

                <div>
                  <Label htmlFor="customer_city" className="text-lg font-semibold mb-2 block">
                    المدينة *
                  </Label>
                  <Input
                    id="customer_city"
                    name="customer_city"
                    value={formData.customer_city}
                    onChange={handleChange}
                    required
                    className="h-12 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="customer_address" className="text-lg font-semibold mb-2 block">
                    العنوان التفصيلي *
                  </Label>
                  <Textarea
                    id="customer_address"
                    name="customer_address"
                    value={formData.customer_address}
                    onChange={handleChange}
                    required
                    rows={3}
                    className="rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="notes" className="text-lg font-semibold mb-2 block">
                    ملاحظات إضافية
                  </Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={2}
                    className="rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <GradientButton
              type="submit"
              gradient="from-blue-600 via-purple-600 to-pink-600"
              hoverGradient="from-blue-700 via-purple-700 to-pink-700"
              shadowColor="purple-500"
              shimmer={true}
              disabled={loading}
              className="w-full py-6 text-xl"
            >
              {loading && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
              {loading ? 'جاري المعالجة...' : 'تأكيد الطلب 🎉'}
            </GradientButton>
          </form>

          {/* Summary - 1 Column */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 p-8 bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-purple-900/20 rounded-3xl shadow-2xl border-2 border-purple-200 dark:border-purple-800">
              <GradientText gradient="from-purple-600 to-pink-600" size="2xl" className="mb-6 font-black">
                ملخص الطلب
              </GradientText>

              <div className="space-y-3 max-h-96 overflow-y-auto mb-6 pr-2">
                {cart.map((item, index) => (
                  <div key={index} className="flex gap-3 p-3 bg-white dark:bg-gray-900 rounded-xl">
                    <img
                      src={item.image || '/placeholder.png'}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <p className="font-semibold line-clamp-1 mb-1">{item.name}</p>
                      <p className="text-xs text-muted-foreground mb-1">
                        {item.color} - {item.size} × {item.quantity}
                      </p>
                      <GradientText gradient="from-blue-600 to-purple-600" size="lg" className="font-black">
                        {(item.price * item.quantity).toLocaleString('ar-IQ')} IQD
                      </GradientText>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 mb-6 pt-6 border-t-2 border-purple-200 dark:border-purple-800">
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600 dark:text-gray-400">المجموع:</span>
                  <span className="font-bold">{cartTotal.toLocaleString('ar-IQ')} IQD</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600 dark:text-gray-400">التوصيل:</span>
                  <span className="font-bold text-emerald-600">يحسب لاحقاً</span>
                </div>
              </div>

              <div className="flex justify-between items-baseline mb-6 pt-6 border-t-2 border-purple-200 dark:border-purple-800">
                <span className="text-xl font-black">المجموع الكلي:</span>
                <GradientText gradient="from-blue-600 to-purple-600" size="3xl" className="font-black">
                  {cartTotal.toLocaleString('ar-IQ')} IQD
                </GradientText>
              </div>

              {/* Trust Badges */}
              <div className="space-y-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span className="text-gray-700 dark:text-gray-300">دفع آمن 100%</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="text-gray-700 dark:text-gray-300">حماية بيانات العميل</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span className="text-gray-700 dark:text-gray-300">ضمان الجودة</span>
                </div>
              </div>
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
