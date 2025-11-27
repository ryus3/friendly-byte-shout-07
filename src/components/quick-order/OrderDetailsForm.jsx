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
  cart,
  removeFromCart,
  showProductSelection = true, // ✅ prop جديد لإخفاء قسم المنتجات
  isEditMode = false // ✅ prop جديد لوضع التعديل
}) => {
  const { hasPermission } = useAuth();
  
  // حساب رسوم التوصيل مع إعفاء الولاء
  const baseDeliveryFee = settings?.deliveryFee || 0;
  const deliveryFee = (applyLoyaltyDelivery && customerData?.currentTier?.free_delivery) ? 0 : baseDeliveryFee;
  const finalTotal = total + deliveryFee;

  // ضمان تعيين القيمة الافتراضية لحجم الطلب
  useEffect(() => {
    // للتوصيل المحلي: ضمان "عادي" دائماً
    if (activePartner === 'local' || !activePartner) {
      if (formData.size !== 'عادي') {
        handleSelectChange('size', 'عادي');
      }
    }
    // لشركة الوسيط: استخدام أول حجم متاح فقط
    else if (activePartner === 'alwaseet' && packageSizes && packageSizes.length > 0) {
      const firstPackageId = String(packageSizes[0]?.id || '');
      if (formData.size !== firstPackageId) {
        handleSelectChange('size', firstPackageId);
      }
    }
  }, [activePartner, packageSizes, formData.size, handleSelectChange]);

  // ✅ تحديث السعر فقط عند تغيير السلة (إلا في وضع التعديل)
  useEffect(() => {
    // ✅ في وضع التعديل: لا تُعيد السعر تلقائياً للسماح بالتعديل اليدوي
    if (isEditMode) return;
    
    // فقط عند إضافة منتجات للسلة أو تغييرها
    if (cart.length > 0) {
      handleChange({ target: { name: 'price', value: finalTotal } });
    }
  }, [cart, finalTotal, handleChange, isEditMode]);

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="text-right">تفاصيل الطلب</CardTitle>
        <CardDescription className="text-right">إدارة المنتجات في السلة وتفاصيل الطلب النهائية.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
        {/* ✅ قسم المنتجات يظهر فقط عندما showProductSelection = true */}
        {showProductSelection && (
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
        )}
        <div className="space-y-2">
          <Label htmlFor="details">نوع البضاعة</Label>
          <Input id="details" name="details" value={formData.details} onChange={handleChange} disabled={isSubmittingState} required placeholder="يتم ملؤه تلقائياً من المنتجات المختارة" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">عدد القطع</Label>
          <Input type="number" id="quantity" name="quantity" value={formData.quantity} readOnly disabled={isSubmittingState} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">السعر مع التوصيل {isEditMode && "(شامل التوصيل - قابل للتعديل)"}</Label>
          
          {/* Toggle Buttons للموجب/السالب */}
          <div className="flex gap-2 mb-2">
            <Button
              type="button"
              variant={formData.priceType === 'positive' ? 'default' : 'outline'}
              className={`flex-1 ${formData.priceType === 'positive' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
              onClick={() => handleSelectChange('priceType', 'positive')}
              disabled={isSubmittingState}
            >
              ✅ موجب (+)
            </Button>
            <Button
              type="button"
              variant={formData.priceType === 'negative' ? 'destructive' : 'outline'}
              onClick={() => handleSelectChange('priceType', 'negative')}
              disabled={isSubmittingState}
              className="flex-1"
            >
              ❌ سالب (-)
            </Button>
          </div>
          
          {/* حقل السعر - أكبر حجماً */}
              <Input 
                type="number" 
                id="price" 
                name="price" 
                value={Math.abs(formData.price || 0)} 
                onChange={(e) => {
                  const absoluteValue = Math.max(0, Number(e.target.value));
                  const finalValue = (formData.priceType === 'negative') ? -absoluteValue : absoluteValue;
                  handleChange({ target: { name: 'price', value: finalValue } });
                }} 
                required 
                disabled={isSubmittingState} 
                placeholder="أدخل المبلغ" 
                className="text-lg font-semibold h-12 text-right"
              />
          
          {/* التحذير عند السعر السالب */}
          {formData.priceType === 'negative' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <span className="text-amber-600 dark:text-amber-400 text-xl">⚠️</span>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>سعر سالب:</strong> سيتم دفع المبلغ للزبون أو خصمه من فاتورة الوسيط
              </p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>حجم الطلب</Label>
          <SearchableSelectFixed
            value={formData.size}
            onValueChange={(v) => handleSelectChange('size', v)}
            options={activePartner === 'local' ? [
              { value: 'عادي', label: 'عادي' },
              { value: 'متوسط', label: 'متوسط' },
              { value: 'كبير', label: 'كبير' },
              { value: 'كبير جدا', label: 'كبير جدا' }
            ] : packageSizes.map(size => ({
              value: String(size.id),
              label: size.size
            }))}
            placeholder={loadingPackageSizes ? "تحميل..." : "اختر حجم الطلب"}
            searchPlaceholder="بحث عن حجم..."
            emptyText="لا توجد أحجام متاحة"
            disabled={isSubmittingState || (activePartner === 'alwaseet' && loadingPackageSizes)}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label>نوع الطلب</Label>
          <SearchableSelectFixed
            value={formData.type}
            onValueChange={(v) => handleSelectChange('type', v)}
            options={[
              { value: 'new', label: 'طلب جديد' },
              { value: 'exchange', label: 'استبدال' },
              { value: 'return', label: 'ارجاع' }
            ]}
            placeholder="اختر نوع الطلب"
            searchPlaceholder="بحث عن نوع..."
            emptyText="لا توجد أنواع متاحة"
            disabled={isSubmittingState}
            className="w-full"
          />
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