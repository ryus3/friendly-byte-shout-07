import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import { toast } from '@/components/ui/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';
import { useDuplicateCustomerAlert } from '@/hooks/useDuplicateCustomerAlert';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CustomerInfoForm = ({ formData, handleChange, handleSelectChange, errors, partnerSpecificFields, isSubmittingState, isDeliveryPartnerSelected, customerData, loyaltyDiscount, selectedCityId, selectedRegionId, cities, regions }) => {
  const [wasCleared, setWasCleared] = useState(false);
  const nameInputRef = useRef(null);
  

  // استخدام خطاف تنبيه العميل المحسن
  const { insight: customerInsight } = useDuplicateCustomerAlert(formData.phone);

  // دالة مسح اسم العميل
  const clearCustomerName = () => {
    handleChange({ target: { name: 'name', value: '' } });
    setWasCleared(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  // تحديد القيمة المعروضة في حقل الاسم
  const customerNameValue = formData.name || (!wasCleared && formData.defaultCustomerName ? formData.defaultCustomerName : '');
  const isUsingDefault = !formData.name && !wasCleared && formData.defaultCustomerName;
  });


  return (
    <div dir="rtl">
      <Card dir="rtl">
        <CardHeader>
          <CardTitle className="text-right">معلومات الزبون والشحن</CardTitle>
          <CardDescription className="text-right">الرجاء التأكد من صحة معلومات الزبون لضمان وصول الشحنة.</CardDescription>
        </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
        <div className="space-y-2">
          <Label htmlFor="name">اسم الزبون</Label>
          <div className="relative">
            <Input 
              id="name" 
              name="name" 
              ref={nameInputRef}
              value={customerNameValue}
              onChange={(e) => {
                if (e.target.name === 'name') {
                  const val = e.target.value;
                  setWasCleared(val === '');
                }
                handleChange(e);
              }}
              placeholder="ادخل اسم الزبون"
              required 
              disabled={isSubmittingState}
              className={isUsingDefault ? 'bg-muted/50 text-muted-foreground' : ''}
            />
            {customerNameValue && !isSubmittingState && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-destructive/10"
                onClick={clearCustomerName}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {isUsingDefault && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
              يتم استخدام الاسم الافتراضي - يمكنك حذفه وكتابة اسم آخر
            </p>
          )}
          {formData.name && formData.defaultCustomerName && formData.name !== formData.defaultCustomerName && (
            <p className="text-xs text-blue-600">تم تخصيص اسم للطلب الحالي</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">رقم الهاتف الاساسي</Label>
          <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} required className={errors.phone ? 'border-red-500' : ''} disabled={isSubmittingState} />
          
          {/* بطاقة تنبيه العميل المحسنة - مصغر الحجم */}
          {customerInsight && (customerInsight.count > 0 || customerInsight.recentOrderCount > 0) && (
            <div className={`mt-2 p-2 rounded-lg border shadow-sm ${
              customerInsight.alertType === 'vip' 
                ? 'bg-gradient-to-r from-purple-50 to-amber-50 border-purple-200 dark:from-purple-900/20 dark:to-amber-900/20 dark:border-purple-600' 
                : customerInsight.alertType === 'recent_duplicate'
                ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 dark:from-orange-900/20 dark:to-red-900/20 dark:border-orange-600'
                : 'bg-gradient-to-r from-blue-50 to-green-50 border-blue-200 dark:from-blue-900/20 dark:to-green-900/20 dark:border-blue-600'
            }`}>
              <div className="flex items-center gap-2">
                <div className="text-sm">
                  {customerInsight.alertType === 'vip' ? '👑' : 
                   customerInsight.alertType === 'recent_duplicate' ? '⚠️' : '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-xs mb-1 ${
                    customerInsight.alertType === 'vip' ? 'text-purple-800 dark:text-purple-200' :
                    customerInsight.alertType === 'recent_duplicate' ? 'text-orange-800 dark:text-orange-200' :
                    'text-blue-800 dark:text-blue-200'
                  }`}>
                    {customerInsight.alertType === 'vip' ? 'عميل VIP' : 
                     customerInsight.alertType === 'recent_duplicate' ? 'تحذير: طلب مكرر محتمل' :
                     'عميل معروف'}
                  </div>
                  <div className={`text-xs flex items-center gap-3 ${
                    customerInsight.alertType === 'vip' ? 'text-purple-700 dark:text-purple-300' :
                    customerInsight.alertType === 'recent_duplicate' ? 'text-orange-700 dark:text-orange-300' :
                    'text-blue-700 dark:text-blue-300'
                  }`}>
                     {customerInsight.count > 0 && customerInsight.lastOrderDate && (
                       <div className="flex items-center gap-3">
                         <div className="flex items-center gap-1">
                           <span className="text-xs font-medium">إجمالي الطلبات:</span>
                           <span className="font-bold">{customerInsight.count}</span>
                         </div>
                         <div className="flex items-center gap-1">
                           <span className="text-xs font-medium">آخر طلب:</span>
                           <span className="font-bold">{(() => {
                             const date = new Date(customerInsight.lastOrderDate);
                             const diffHours = customerInsight.timeSinceLastOrderHours;
                             if (diffHours < 24) {
                               return `${diffHours}س`;
                             } else if (diffHours < 48) {
                               return `${Math.floor(diffHours / 24)} يوم`;
                             } else {
                               return date.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' });
                             }
                           })()}</span>
                         </div>
                       </div>
                     )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
          {/* تنبيه العميل المحسن - سيظهر تلقائياً من الخطاف */}

          
          {/* عرض معلومات العميل والنقاط الحقيقية - تصميم محسن ومصغر */}
          {customerData && (
            <div className="mt-3 p-3 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl border border-slate-600/50 shadow-lg relative overflow-hidden">
              {/* خلفية ثابتة */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-emerald-500/5 to-blue-600/5"></div>
              
              {/* رقم الهاتف في الأعلى */}
              <div className="relative z-10 flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-white tracking-wide">
                  {formData.phone}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500 shadow-md border border-white/20">
                  <span className="text-white text-xs">👑</span>
                  <span className="text-white text-xs font-medium tracking-wide">نظام الولاء وإدارة العملاء</span>
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
              
              {/* شبكة البيانات الحقيقية - حساب النقاط الموحد */}
              <div className="relative z-10 grid grid-cols-2 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400/30">
                  <div className="text-lg font-bold text-blue-300 mb-0.5">
                    {customerData.total_points?.toLocaleString('ar') || '0'}
                  </div>
                  <div className="text-xs text-blue-200/80">نقاط حالية</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-400/30">
                  <div className="text-lg font-bold text-purple-300 mb-0.5">
                    {((customerData.total_points || 0) + 250).toLocaleString('ar')}
                  </div>
                  <div className="text-xs text-purple-200/80">نقاط بعد التسليم</div>
                </div>
              </div>
              
              {/* بيانات إضافية */}
              <div className="relative z-10 grid grid-cols-2 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-400/30">
                  <div className="text-sm font-bold text-emerald-300 mb-0.5">
                    {customerData.total_spent_excl_delivery?.toLocaleString('ar') || '0'}
                  </div>
                  <div className="text-xs text-emerald-200/80">د.ع إجمالي الشراء</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-400/30">
                  <div className="text-sm font-bold text-amber-300 mb-0.5">
                    {customerData.total_orders?.toLocaleString('ar') || '0'}
                  </div>
                  <div className="text-xs text-amber-200/80">طلب مكتمل</div>
                </div>
              </div>
              
              {/* المستوى */}
              <div className="relative z-10 flex items-center justify-center gap-2 mb-2">
                <div className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30">
                  <span className="text-purple-200 text-xs font-medium">
                    المستوى الحالي: {customerData.currentTier?.name_ar || 'عادي'}
                  </span>
                </div>
                {customerData.nextTierAfterOrder && (
                  <div className="px-2 py-1 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30">
                    <span className="text-green-200 text-xs font-medium">
                      سيصبح: {customerData.nextTierAfterOrder.name_ar}
                    </span>
                  </div>
                )}
              </div>
              
              {/* خصم الولاء */}
              {loyaltyDiscount > 0 && (
                <div className="relative z-10 p-2 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-lg border border-orange-400/30">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg">🎁</span>
                    <span className="text-orange-200 font-bold text-sm">
                      خصم الولاء: {loyaltyDiscount.toLocaleString('ar')} د.ع
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="second_phone">رقم الهاتف الثانوي</Label>
          <Input id="second_phone" name="second_phone" value={formData.second_phone} onChange={handleChange} disabled={isSubmittingState} />
        </div>
        <fieldset disabled={!isDeliveryPartnerSelected || isSubmittingState} className="contents">
          {partnerSpecificFields()}
        </fieldset>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address" className="text-right">اقرب نقطة دالة</Label>
          <Input 
            id="address" 
            name="address" 
            value={formData.address} 
            onChange={handleChange} 
            disabled={isSubmittingState}
            className="text-right"
            dir="rtl"
          />
        </div>
      </CardContent>
      </Card>
    </div>
  );
};

export default CustomerInfoForm;