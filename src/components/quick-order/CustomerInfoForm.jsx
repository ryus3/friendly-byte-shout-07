import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import { toast } from '@/components/ui/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';

const CustomerInfoForm = ({ formData, handleChange, handleSelectChange, errors, partnerSpecificFields, isSubmittingState, isDeliveryPartnerSelected, customerData, loyaltyDiscount }) => {
  
  // اختيار بغداد تلقائياً إذا لم تكن المدينة محددة
  useEffect(() => {
    if (formData.address && formData.address.length > 3 && (!formData.city || formData.city === '')) {
      // اختيار بغداد كمدينة افتراضية
      handleSelectChange('city', 'بغداد');
    }
  }, [formData.address, handleSelectChange]);

  // كشف الزبون المتكرر حسب رقم الهاتف (موحد لجميع الصيغ)
  const { orders } = useInventory();
  const [customerInsight, setCustomerInsight] = useState(null);
  const lastNotifiedPhoneRef = useRef(null);

  useEffect(() => {
    const normalized = normalizePhone(formData.phone);
    if (!normalized || !orders?.length) { setCustomerInsight(null); return; }
    const matched = orders.filter(o => {
      const p = normalizePhone(extractOrderPhone(o));
      return p && p === normalized;
    });
    if (matched.length) {
      const lastDate = matched
        .map(o => new Date(o.created_at))
        .filter(d => !isNaN(d))
        .sort((a,b)=>b-a)[0];
      setCustomerInsight({
        count: matched.length,
        lastDate: lastDate ? lastDate.toISOString() : null,
        phone: normalized
      });
      if (lastNotifiedPhoneRef.current !== normalized) {
        try {
          toast({
            title: 'تنبيه رقم متكرر',
            description: lastDate ? `آخر طلب: ${new Date(lastDate).toLocaleString('ar-IQ')}` : 'رقم معروف',
            variant: 'success'
          });
        } catch (e) {}
        lastNotifiedPhoneRef.current = normalized;
      }
    } else {
      setCustomerInsight(null);
    }
  }, [formData.phone, orders]);


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
          {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
          {customerInsight && (
            <div className="mt-2 p-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="text-sm font-medium">تنبيه: رقم زبون معروف</div>
              <div className="text-xs text-muted-foreground">
                إجمالي الطلبات: {customerInsight.count} • آخر طلب: {customerInsight.lastDate ? new Date(customerInsight.lastDate).toLocaleString('ar-IQ') : 'غير متاح'}
              </div>
            </div>
          )}

          
          {/* عرض معلومات العميل والنقاط */}
          {customerData && (
            <div className="mt-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600 dark:text-green-400 font-medium">✅ عميل مسجل</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">({customerData.customer_loyalty?.loyalty_tiers?.name || 'عادي'})</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">النقاط:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 ml-1">
                    {customerData.customer_loyalty?.total_points?.toLocaleString('ar') || 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">إجمالي الشراء:</span>
                  <span className="font-bold text-green-600 dark:text-green-400 ml-1">
                    {customerData.customer_loyalty?.total_spent?.toLocaleString('ar') || 0} د.ع
                  </span>
                </div>
              </div>
              
              {loyaltyDiscount > 0 && (
                <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900/30 rounded border border-orange-200 dark:border-orange-800">
                  <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                    🎁 خصم الولاء: {loyaltyDiscount.toLocaleString('ar')} د.ع
                  </span>
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