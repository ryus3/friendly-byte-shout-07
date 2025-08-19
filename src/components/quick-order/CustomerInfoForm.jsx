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

const CustomerInfoForm = ({ formData, handleChange, handleSelectChange, errors, partnerSpecificFields, isSubmittingState, isDeliveryPartnerSelected, customerData, loyaltyDiscount }) => {
  
  // اختيار بغداد تلقائياً إذا لم تكن المدينة محددة
  useEffect(() => {
    if (formData.address && formData.address.length > 3 && (!formData.city || formData.city === '')) {
      // اختيار بغداد كمدينة افتراضية
      handleSelectChange('city', 'بغداد');
    }
  }, [formData.address, handleSelectChange]);

  // استخدام خطاف تنبيه العميل المحسن
  const { insight: customerInsight } = useDuplicateCustomerAlert(formData.phone);


  return (
    <Card>
      <CardHeader>
        <CardTitle>معلومات الزبون والشحن</CardTitle>
        <CardDescription>الرجاء التأكد من صحة معلومات الزبون لضمان وصول الشحنة.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">اسم الزبون</Label>
          <Input 
            id="name" 
            name="name" 
            value={formData.name} 
            onChange={handleChange} 
            placeholder={formData.defaultCustomerName ? `الاسم الافتراضي: ${formData.defaultCustomerName}` : "ادخل اسم الزبون"}
            required 
            disabled={isSubmittingState} 
          />
          {formData.defaultCustomerName && !formData.name && (
            <p className="text-xs text-green-600">سيتم استخدام الاسم الافتراضي: {formData.defaultCustomerName}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">رقم الهاتف الاساسي</Label>
          <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} required className={errors.phone ? 'border-red-500' : ''} disabled={isSubmittingState} />
          
          {/* عرض تنبيه العميل المعروف */}
          {customerInsight && customerInsight.count > 0 && (
            <div className={`p-2 rounded-md text-xs font-medium flex items-center gap-2 ${
              customerInsight.alertType === 'vip' 
                ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                : customerInsight.alertType === 'recent_duplicate'
                ? 'bg-orange-50 text-orange-800 border border-orange-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              <span className="text-sm">
                {customerInsight.alertType === 'vip' ? '👑' : 
                 customerInsight.alertType === 'recent_duplicate' ? '⚠️' : '👤'}
              </span>
              <span>
                {customerInsight.alertType === 'vip' ? 'عميل VIP' : 
                 customerInsight.alertType === 'recent_duplicate' ? 'احتمال تكرار' :
                 'عميل معروف'} • {customerInsight.count} طلب • {customerInsight.points} نقطة
              </span>
            </div>
          )}
          {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
          {/* تنبيه العميل المحسن - سيظهر تلقائياً من الخطاف */}

          
          {/* عرض معلومات العميل والنقاط الحقيقية */}
          {customerData && (
            <div className="mt-3 p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-600/50 shadow-2xl shadow-slate-900/50 relative overflow-hidden">
              {/* خلفية ثابتة */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-emerald-500/5 to-blue-600/5"></div>
              
              {/* رقم الهاتف في الأعلى */}
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="text-lg font-bold text-white tracking-wide">
                  {formData.phone}
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 shadow-lg">
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                  <span className="text-white text-xs font-bold">مؤكد</span>
                </div>
              </div>
              
              {/* شبكة البيانات الحقيقية - حساب النقاط الموحد */}
              <div className="relative z-10 grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400/30">
                  <div className="text-2xl font-bold text-blue-300 mb-1">
                    {customerData.total_points?.toLocaleString('ar') || '0'}
                  </div>
                  <div className="text-xs text-blue-200/80">نقاط حالية</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-400/30">
                  <div className="text-lg font-bold text-purple-300 mb-1">
                    {((customerData.total_points || 0) + 250).toLocaleString('ar')}
                  </div>
                  <div className="text-xs text-purple-200/80">نقاط بعد الطلب</div>
                </div>
              </div>
              
              {/* بيانات إضافية */}
              <div className="relative z-10 grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-400/30">
                  <div className="text-lg font-bold text-emerald-300 mb-1">
                    {customerData.total_spent?.toLocaleString('ar') || '0'}
                  </div>
                  <div className="text-xs text-emerald-200/80">د.ع إجمالي الشراء</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-400/30">
                  <div className="text-lg font-bold text-amber-300 mb-1">
                    {customerData.total_orders?.toLocaleString('ar') || '0'}
                  </div>
                  <div className="text-xs text-amber-200/80">طلب سابق</div>
                </div>
              </div>
              
              {/* المستوى */}
              <div className="relative z-10 flex items-center justify-center mb-3">
                <div className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30">
                  <span className="text-purple-200 text-sm font-medium">
                    {customerData.currentTier?.name_ar || 'عادي'}
                  </span>
                </div>
              </div>
              
              {/* خصم الولاء */}
              {loyaltyDiscount > 0 && (
                <div className="relative z-10 p-3 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-xl border border-orange-400/30">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">🎁</span>
                    <span className="text-orange-200 font-bold">
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
          <Label htmlFor="address">اقرب نقطة دالة</Label>
          <Input id="address" name="address" value={formData.address} onChange={handleChange} disabled={isSubmittingState} />
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerInfoForm;