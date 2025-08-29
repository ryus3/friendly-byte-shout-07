import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const OrderDetailsForm = ({ 
  formData, 
  handleChange, 
  handleSelectChange, 
  setProductSelectOpen, 
  isSubmittingState, 
  isDeliveryPartnerSelected, 
  packageSizes, 
  loadingPackageSizes, 
  activePartner, 
  dataFetchError, 
  settings,
  discount,
  setDiscount,
  subtotal,
  total,
  customerData,
  loyaltyDiscount,
  applyLoyaltyDiscount = true,
  onToggleLoyaltyDiscount,
  applyLoyaltyDelivery = false,
  onToggleLoyaltyDelivery,
  cart = [], // استقبال السلة كـ prop مع قيمة افتراضية
  removeFromCart // استقبال دالة الحذف كـ prop
}) => {
  const { hasPermission } = useAuth();
  
  // إضافة تشخيص للـ props
  console.log('🔍 OrderDetailsForm Props:', { 
    cartLength: cart?.length, 
    hasRemoveFromCart: typeof removeFromCart === 'function',
    removeFromCartType: typeof removeFromCart 
  });
  
  // حساب رسوم التوصيل مع إعفاء الولاء
  const baseDeliveryFee = settings?.deliveryFee || 0;
  const deliveryFee = (applyLoyaltyDelivery && customerData?.currentTier?.free_delivery) ? 0 : baseDeliveryFee;
  
  // إضافة logging للتشخيص
  console.log('📊 OrderDetailsForm - معلومات التوصيل:', {
    settings: settings,
    deliveryFee: deliveryFee,
    activePartner: activePartner,
    settingsDeliveryFee: settings?.deliveryFee
  });
  
  const finalTotal = total + deliveryFee;

  // ضمان تعيين القيمة الافتراضية لحجم الطلب
  useEffect(() => {
    console.log('🔄 Setting default size - activePartner:', activePartner, 'current size:', formData.size);
    
    // للتوصيل المحلي: ضمان "عادي" دائماً
    if (activePartner === 'local' || !activePartner) {
      if (formData.size !== 'عادي') {
        console.log('📦 Setting default size to "عادي" for local delivery');
        handleSelectChange('size', 'عادي');
      }
    }
    // لشركة الوسيط: استخدام أول حجم متاح فقط
    else if (activePartner === 'alwaseet' && packageSizes && packageSizes.length > 0) {
      const firstPackageId = String(packageSizes[0]?.id || '');
      if (formData.size !== firstPackageId) {
        console.log('📦 Setting default size to:', firstPackageId, 'for alwaseet');
        handleSelectChange('size', firstPackageId);
      }
    }
  }, [activePartner, packageSizes, formData.size, handleSelectChange]);

  // تحديث السعر النهائي في الحقل تلقائياً
  useEffect(() => {
    if (finalTotal !== formData.price) {
      handleChange({ target: { name: 'price', value: finalTotal } });
    }
  }, [finalTotal, formData.price, handleChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="w-5 h-5" />
          تفاصيل الطلب
        </CardTitle>
        <CardDescription>أضف المنتجات وحدد تفاصيل الطلب</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* زر إضافة المنتجات */}
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">المنتجات المختارة</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setProductSelectOpen(true)}>
            <PlusCircle className="w-4 h-4 mr-2" />
            إضافة منتجات
          </Button>
        </div>

        {/* قائمة المنتجات في السلة */}
        <div className="space-y-2">
          {(cart || []).map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <img src={item.image} alt={item.productName} className="w-12 h-12 object-cover rounded-md" />
                <div>
                  <p className="font-semibold">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{`${item.size}, ${item.color}${item.quantity > 1 ? ` - عدد ${item.quantity}` : ''}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p>{item.total.toLocaleString()} د.ع</p>
                {removeFromCart && typeof removeFromCart === 'function' ? (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => {
                      console.log('🗑️ Removing item:', item.id);
                      removeFromCart(item.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                ) : (
                  <div className="w-7 h-7"></div>
                )}
              </div>
            </div>
          ))}
        </div>
        {(!cart || cart.length === 0) && <p className="text-sm text-muted-foreground text-center py-4">السلة فارغة</p>}
        
        {/* ملخص السعر مع خانة الخصم */}
        <div className="bg-muted/30 p-4 rounded-lg space-y-3">
          <div className="flex justify-between text-sm">
            <span>المجموع الفرعي:</span>
            <span>{subtotal.toLocaleString()} د.ع</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span>رسوم التوصيل:</span>
            <span>{deliveryFee.toLocaleString()} د.ع</span>
          </div>
          
          {/* خصم العضوية المميزة */}
          {customerData?.currentTier && hasPermission('manage_loyalty_discounts') && (
            <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">خصم العضوية المميزة ({customerData.currentTier.name}):</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-700">{loyaltyDiscount.toLocaleString()} د.ع</span>
                  <input
                    type="checkbox"
                    checked={applyLoyaltyDiscount}
                    onChange={onToggleLoyaltyDiscount}
                    className="rounded"
                  />
                </div>
              </div>
              
              {/* إعفاء رسوم التوصيل */}
              {customerData.currentTier?.free_delivery && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-800">إعفاء رسوم التوصيل:</span>
                  <input
                    type="checkbox"
                    checked={applyLoyaltyDelivery}
                    onChange={onToggleLoyaltyDelivery}
                    className="rounded"
                  />
                </div>
              )}
            </div>
          )}
          
          {/* خصم إضافي */}
          {hasPermission('manage_order_discounts') && (
            <div className="flex justify-between items-center">
              <Label htmlFor="discount" className="text-sm">خصم إضافي:</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-24 text-right"
                  placeholder="0"
                />
                <span className="text-sm">د.ع</span>
              </div>
            </div>
          )}
          
          <div className="flex justify-between font-semibold text-lg border-t pt-2">
            <span>المجموع النهائي:</span>
            <span>{finalTotal.toLocaleString()} د.ع</span>
          </div>
        </div>

        {/* حقول تفاصيل الطلب */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="quantity">الكمية</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={handleChange}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="price">السعر</Label>
            <Input
              id="price"
              name="price"
              type="number"
              min="0"
              value={formData.price}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* حجم الطلب */}
        <div>
          <Label htmlFor="size">حجم الطلب</Label>
          {activePartner === 'alwaseet' ? (
            <SearchableSelectFixed
              value={formData.size}
              onValueChange={(value) => handleSelectChange('size', value)}
              options={packageSizes}
              loading={loadingPackageSizes}
              placeholder="اختر حجم الطلب"
              valueKey="id"
              labelKey="name"
              searchKey="name"
              disabled={!isDeliveryPartnerSelected || loadingPackageSizes || dataFetchError}
              className="w-full"
            />
          ) : (
            <Input
              id="size"
              name="size"
              value="عادي"
              readOnly
              className="bg-muted"
            />
          )}
        </div>

        {/* نوع الطلب */}
        <div>
          <Label htmlFor="type">نوع الطلب</Label>
          <Input
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            placeholder="مثال: طلب عادي، طلب سريع"
          />
        </div>

        {/* كود الخصم */}
        <div>
          <Label htmlFor="promo_code">كود الخصم</Label>
          <Input
            id="promo_code"
            name="promo_code"
            value={formData.promo_code}
            onChange={handleChange}
            placeholder="أدخل كود الخصم (اختياري)"
          />
        </div>

        {/* ملاحظات */}
        <div>
          <Label htmlFor="notes">ملاحظات</Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="ملاحظات إضافية للطلب (اختياري)"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderDetailsForm;