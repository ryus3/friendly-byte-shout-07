import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/contexts/InventoryContext';
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
  onToggleLoyaltyDelivery
}) => {
  const { cart, removeFromCart } = useInventory();
  const { hasPermission } = useAuth();
  
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

  // إضافة useEffect لضمان تعيين القيمة الافتراضية لحجم الطلب
  useEffect(() => {
    if (activePartner === 'local' && !formData.size) {
      handleSelectChange('size', 'normal');
    } else if (activePartner === 'alwaseet' && packageSizes.length > 0 && !formData.size) {
      // البحث عن الحجم "عادي" أو أول خيار متاح
      const normalSize = packageSizes.find(size => 
        size.size?.includes('عادي') || size.size?.includes('normal')
      );
      const defaultSizeId = normalSize?.id || packageSizes[0]?.id;
      if (defaultSizeId) {
        handleSelectChange('size', String(defaultSizeId));
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
        <CardTitle>تفاصيل الطلب</CardTitle>
        <CardDescription>إدارة المنتجات في السلة وتفاصيل الطلب النهائية.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 md:col-span-2">
          <Label>المنتجات</Label>
          <Button type="button" variant="outline" className="w-full" onClick={() => setProductSelectOpen(true)} disabled={!isDeliveryPartnerSelected || isSubmittingState}>
            <PlusCircle className="w-4 h-4 ml-2" />
            اختر المنتجات ({cart.length})
          </Button>
          <div className="space-y-2 pt-4">
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between p-2 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <img src={item.image} alt={item.productName} className="w-12 h-12 object-cover rounded-md" />
                  <div>
                    <p className="font-semibold">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{`${item.size}, ${item.color}${item.quantity > 1 ? ` - عدد ${item.quantity}` : ''}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p>{item.total.toLocaleString()} د.ع</p>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(item.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {cart.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">السلة فارغة</p>}
          
          {/* ملخص السعر مع خانة الخصم */}
          {cart.length > 0 && (
            <div className="mt-4 p-4 bg-secondary/50 rounded-lg border space-y-2">
              <div className="flex justify-between text-sm">
                <span>مجموع المنتجات:</span>
                <span>{subtotal.toLocaleString()} د.ع</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span>رسوم التوصيل:</span>
                <span>{deliveryFee.toLocaleString()} د.ع</span>
              </div>
              
              <div className="flex justify-between text-sm font-medium border-t pt-2">
                <span>المجموع الكلي:</span>
                <span>{(subtotal + deliveryFee).toLocaleString()} د.ع</span>
              </div>
              
              {/* مزايا الولاء */}
              {customerData?.currentTier?.discount_percentage > 0 && (
                <div className="flex justify-between items-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">👑</span>
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      خصم الولاء ({customerData.currentTier.discount_percentage}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-purple-700 dark:text-purple-300">
                      {loyaltyDiscount.toLocaleString('ar')} د.ع
                    </span>
                    <input
                      type="checkbox"
                      checked={applyLoyaltyDiscount}
                      onChange={onToggleLoyaltyDiscount}
                      className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}
              
              {customerData?.currentTier?.free_delivery && activePartner === 'local' && (
                <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🚚</span>
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      توصيل مجاني (مستوى ذهبي)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-700 dark:text-green-300">
                      {baseDeliveryFee.toLocaleString('ar')} د.ع
                    </span>
                    <input
                      type="checkbox"
                      checked={applyLoyaltyDelivery}
                      onChange={onToggleLoyaltyDelivery}
                      className="rounded border-green-300 text-green-600 focus:ring-green-500"
                    />
                  </div>
                </div>
              )}

              {/* خانة الخصم العادي */}
              {hasPermission('apply_order_discounts') && (
                <div className="flex justify-between items-center">
                  <Label htmlFor="manual_discount" className="text-sm flex items-center gap-1">
                    <Tag className="w-4 h-4" /> خصم إضافي
                  </Label>
                  <Input
                    id="manual_discount"
                    type="number"
                    min="0"
                    max={subtotal}
                    value={applyLoyaltyDiscount ? Math.max(0, discount - loyaltyDiscount) : discount} 
                    onChange={(e) => {
                      const manualDiscount = Math.max(0, Math.min(subtotal, Number(e.target.value)));
                      const totalDiscount = applyLoyaltyDiscount ? loyaltyDiscount + manualDiscount : manualDiscount;
                      setDiscount(totalDiscount);
                    }} 
                    className="w-24 text-right"
                    placeholder="0"
                  />
                </div>
              )}
              
              {discount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>الخصم:</span>
                  <span>-{discount.toLocaleString()} د.ع</span>
                </div>
              )}
              
              <div className="flex justify-between text-base font-semibold border-t pt-2">
                <span>المجموع النهائي:</span>
                <span className="text-primary">{finalTotal.toLocaleString()} د.ع</span>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="details">نوع البضاعة</Label>
          <Input id="details" name="details" value={formData.details} onChange={handleChange} disabled={isSubmittingState} required placeholder="يتم ملؤه تلقائياً من المنتجات المختارة" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">عدد القطع</Label>
          <Input type="number" id="quantity" name="quantity" value={formData.quantity} readOnly disabled={isSubmittingState} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">السعر مع التوصيل</Label>
          <Input type="number" id="price" name="price" value={formData.price} onChange={handleChange} required disabled={isSubmittingState} placeholder="يتم حساب السعر تلقائياً" />
        </div>
        <div className="space-y-2">
          <Label>حجم الطلب</Label>
          <Select name="size" onValueChange={(v) => handleSelectChange('size', v)} value={formData.size} disabled={isSubmittingState || (activePartner === 'alwaseet' && loadingPackageSizes)}>
            <SelectTrigger>
                <SelectValue placeholder={loadingPackageSizes ? "تحميل..." : "اختر حجم الطلب"} />
            </SelectTrigger>
            <SelectContent className="z-[100]" modal={true}>
              {activePartner === 'local' ? (
                <>
                  <SelectItem value="normal">عادي</SelectItem>
                  <SelectItem value="big">كبير</SelectItem>
                </>
              ) : (
                packageSizes.map(size => (
                  <SelectItem key={size.id} value={String(size.id)}>{size.size}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>نوع الطلب</Label>
          <Select name="type" onValueChange={(v) => handleSelectChange('type', v)} value={formData.type} disabled={isSubmittingState}>
            <SelectTrigger><SelectValue placeholder="اختر نوع الطلب" /></SelectTrigger>
            <SelectContent className="z-[100]" modal={true}>
              <SelectItem value="new">طلب جديد</SelectItem>
              <SelectItem value="exchange">استبدال</SelectItem>
              <SelectItem value="return">ارجاع</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="promocode">البروموكود</Label>
          <Input id="promocode" name="promocode" value={formData.promocode} onChange={handleChange} disabled={isSubmittingState} />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="notes">الملاحظات</Label>
          <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} disabled={isSubmittingState} />
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderDetailsForm;