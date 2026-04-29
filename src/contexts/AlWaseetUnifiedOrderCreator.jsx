import React, { createContext, useContext, useCallback } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useInventory } from '@/contexts/InventoryContext';
import { createAlWaseetOrder } from '@/lib/alwaseet-api';
import * as ModonAPI from '@/lib/modon-api';
import { toast } from '@/components/ui/use-toast';
import { CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const UnifiedOrderCreatorContext = createContext();

export const useUnifiedOrderCreator = () => {
  const context = useContext(UnifiedOrderCreatorContext);
  if (!context) {
    throw new Error('useUnifiedOrderCreator must be used within UnifiedOrderCreatorProvider');
  }
  return context;
};

export const UnifiedOrderCreatorProvider = ({ children }) => {
  const { isLoggedIn: isWaseetLoggedIn, token: waseetToken, activePartner } = useAlWaseet();
  const { createOrder, updateOrder, settings } = useInventory();

  // دالة موحدة لإنشاء الطلبات مع ضمان الربط الصحيح والتوحيد الكامل للأرقام
  const createUnifiedOrder = useCallback(async (customerInfo, cart, discount = 0, aiOrderData = null) => {
    try {
      // ✅ validation: التحقق من وجود معرفات المدينة والمنطقة للوسيط
      if (activePartner === 'alwaseet' && (!customerInfo.alwaseet_city_id && !customerInfo.customer_city_id)) {
        throw new Error('معرف المدينة مطلوب لطلبات الوسيط');
      }
      if (activePartner === 'alwaseet' && (!customerInfo.alwaseet_region_id && !customerInfo.customer_region_id)) {
        throw new Error('معرف المنطقة مطلوب لطلبات الوسيط');
      }

      // حساب المبلغ الإجمالي
      const subtotal = cart.reduce((sum, item) => sum + (item.total || 0), 0);
      const finalAmount = Math.max(0, subtotal - discount);

      // إذا كان شريك التوصيل نشطاً ومتصل، إنشاء طلب خارجي
      if ((activePartner === 'alwaseet' || activePartner === 'modon') && isWaseetLoggedIn && waseetToken) {
        const partnerName = activePartner === 'modon' ? 'مدن' : 'الوسيط';
        
        // ✅ التحقق من صحة التوكن قبل المتابعة
        if (!waseetToken) {
          throw new Error(`يجب تسجيل الدخول إلى ${partnerName} أولاً`);
        }
        
        // 🆕 الترجمة الآمنة للمعرفات قبل الإرسال للوسيط/مدن:
        //   1) إذا كانت المعرفات قادمة بالفعل كمعرفات خارجية للشريك (alwaseet_city_id/region_id من البوت أو AI)،
        //      نستخدمها مباشرة. AlWaseet/MODON لا يفهم سوى external_id لديهم.
        //   2) إن لم تتوفر، نحاول الترجمة عبر mappings: نُجرّب كـ city_id/region_id داخلي،
        //      وإن فشل نُجرّبها كـ external_id (في حال جاءت من تخزين قديم).
        //   3) إن فشل كل ذلك، نمنع الإرسال برسالة دقيقة.
        let finalCityId = customerInfo.alwaseet_city_id || null;
        let finalRegionId = customerInfo.alwaseet_region_id || null;

        if (!finalCityId || !finalRegionId) {
          const unifiedCityId = customerInfo.city_id || customerInfo.customer_city_id;
          const unifiedRegionId = customerInfo.region_id || customerInfo.customer_region_id;

          if (unifiedCityId && !finalCityId) {
            // محاولة كـ city_id داخلي
            const { data: cityByInternal } = await supabase
              .from('city_delivery_mappings')
              .select('external_id')
              .eq('city_id', unifiedCityId)
              .eq('delivery_partner', activePartner)
              .maybeSingle();
            if (cityByInternal?.external_id) {
              finalCityId = cityByInternal.external_id;
            } else {
              // محاولة كـ external_id
              const { data: cityByExternal } = await supabase
                .from('city_delivery_mappings')
                .select('external_id')
                .eq('external_id', String(unifiedCityId))
                .eq('delivery_partner', activePartner)
                .maybeSingle();
              if (cityByExternal?.external_id) finalCityId = cityByExternal.external_id;
            }
          }

          if (unifiedRegionId && !finalRegionId) {
            const { data: regionByInternal } = await supabase
              .from('region_delivery_mappings')
              .select('external_id')
              .eq('region_id', unifiedRegionId)
              .eq('delivery_partner', activePartner)
              .maybeSingle();
            if (regionByInternal?.external_id) {
              finalRegionId = regionByInternal.external_id;
            } else {
              const { data: regionByExternal } = await supabase
                .from('region_delivery_mappings')
                .select('external_id')
                .eq('external_id', String(unifiedRegionId))
                .eq('delivery_partner', activePartner)
                .maybeSingle();
              if (regionByExternal?.external_id) finalRegionId = regionByExternal.external_id;
            }
          }
        }

        if (!finalCityId || !finalRegionId) {
          throw new Error(`لا يمكن التعرف على المحافظة/المنطقة لشريك ${activePartner}. يرجى اختيار المدينة والمنطقة من القائمة.`);
        }

        try {
          const partnerPayload = {
            name: customerInfo.customer_name || customerInfo.name,
            phone: customerInfo.customer_phone || customerInfo.phone,
            customer_phone2: customerInfo.customer_phone2 || customerInfo.second_phone || '',
            address: customerInfo.customer_address || customerInfo.address,
            customer_city: customerInfo.customer_city,
            customer_province: customerInfo.customer_province,
            notes: customerInfo.notes || '',
            details: (cart || []).filter(item => item != null).map(item => `${item?.productName} (${item?.color}, ${item?.size}) ×${item?.quantity || 1}`).join(' | '),
            quantity: (cart || []).filter(item => item != null).reduce((sum, item) => sum + (item?.quantity || 1), 0),
            price: finalAmount + (settings?.delivery_fee || 50000),
            size: 'عادي',
            type: 'new',
            promocode: customerInfo.promo_code || '',
            city_id: finalCityId,
            region_id: finalRegionId
          };

        // استخدام توكن الحساب المحدد إذا تم تمريره
        const useToken = aiOrderData?.accountData?.token || waseetToken;
        
        // ✅ التحقق من صحة التوكن قبل المتابعة
        if (!useToken) {
          const partnerName = activePartner === 'modon' ? 'مدن' : 'الوسيط';
          throw new Error(`يجب تسجيل الدخول إلى ${partnerName} أولاً`);
        }
        
        // ✅ استدعاء API المناسب حسب الشريك
        let partnerResult;
          if (activePartner === 'modon') {
            partnerResult = await ModonAPI.createModonOrder(partnerPayload, useToken);
          } else {
            partnerResult = await createAlWaseetOrder(partnerPayload, useToken);
          }
          
          const alWaseetResult = partnerResult; // للتوافق مع الكود الحالي
          
          if (alWaseetResult?.id) {
            
            // Focus on qr_id as primary identifier - this is what customers track
            const qrId = String(alWaseetResult.qr_id || '').trim();
            const waseetInternalId = String(alWaseetResult.id || '');
            

            // Create local order with qr_id as tracking_number (primary identifier)
            const localResult = await createOrder(
              customerInfo,
              cart,
              qrId || null,
              discount,
              null,
              finalAmount,
              {
                delivery_partner_order_id: waseetInternalId || null,
                tracking_number: qrId || null,
                delivery_partner: activePartner,
                alwaseet_city_id: finalCityId,
                alwaseet_region_id: finalRegionId
              }
            );

            if (!localResult.success) {
              throw new Error(localResult.error || 'فشل في إنشاء الطلب المحلي');
            }
            
            const partnerName = activePartner === 'modon' ? 'مدن' : 'الوسيط';
            
            toast({
              title: (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  تم إنشاء الطلب وربطه مع {partnerName} بنجاح
                </div>
              ),
              description: (
                <div className="space-y-1">
                  <p><strong>رقم التتبع:</strong> {qrId || '—'}</p>
                  <p><strong>العميل:</strong> {customerInfo.name}</p>
                  <p><strong>المبلغ:</strong> {finalAmount.toLocaleString()} د.ع</p>
                  <p><strong>نوع الطلب:</strong> خارجي (مربوط مع {partnerName})</p>
                </div>
              ),
              variant: "success",
              duration: 6000
            });

            return {
              success: true,
              orderId: localResult.orderId,
              trackingNumber: qrId || null,
              alWaseetId: alWaseetResult.id,
              finalAmount,
              linked: true,
              unified: true
            };
          } else {
            throw new Error('لم يتم إرجاع معرف من الوسيط');
          }
        } catch (partnerError) {
          const partnerName = activePartner === 'modon' ? 'مدن' : 'الوسيط';
          
          // تحليل نوع الخطأ وإعطاء رسالة واضحة
          let errorTitle = `❌ فشل إنشاء طلب ${partnerName}`;
          let errorDescription = partnerError.message;
          
          if (partnerError.message?.includes('صلاحية') || partnerError.message?.includes('Unauthorized')) {
            errorTitle = `🔒 مشكلة في صلاحية ${partnerName}`;
            errorDescription = `يرجى تسجيل الدخول مجدداً إلى ${partnerName}. التوكن قد يكون منتهي الصلاحية.`;
          } else if (partnerError.message?.includes('city_id') || partnerError.message?.includes('region_id')) {
            errorTitle = `📍 خطأ في بيانات المدينة/المنطقة`;
            errorDescription = `بيانات المدينة أو المنطقة غير صحيحة. تأكد من ربط المدن والمناطق في الإعدادات.`;
          } else if (partnerError.message?.includes('phone') || partnerError.message?.includes('mobile')) {
            errorTitle = `📱 خطأ في رقم الهاتف`;
            errorDescription = `رقم الهاتف غير صحيح. يجب أن يكون بصيغة +9647XXXXXXXXX`;
          }
          
          toast({
            title: errorTitle,
            description: errorDescription,
            variant: 'destructive',
            duration: 8000
          });
          
          console.error(`❌ ${partnerName} Order Creation Failed:`, {
            error: partnerError,
            customerInfo,
            cart,
            activePartner,
            hasToken: !!waseetToken,
            accountData: aiOrderData?.accountData
          });
          
          throw partnerError;
        }
      } else {
        // طلب محلي فقط مع رقم موحد محلي
        
        // إنشاء رقم محلي موحد
        const localUnifiedNumber = `RYUS-${Date.now().toString().slice(-6)}`;
        
        const localResult = await createOrder(customerInfo, cart, localUnifiedNumber, discount, null, finalAmount, {
          tracking_number: localUnifiedNumber,
          order_number: localUnifiedNumber,
          qr_id: localUnifiedNumber,
          delivery_partner: null
        });

        if (!localResult.success) {
          throw new Error(localResult.error || 'فشل في إنشاء الطلب المحلي');
        }
        
        toast({
          title: (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              تم إنشاء الطلب بنجاح
            </div>
          ),
          description: (
            <div className="space-y-1">
              <p><strong>رقم الطلب الموحد:</strong> {localUnifiedNumber}</p>
              <p><strong>العميل:</strong> {customerInfo.name}</p>
              <p><strong>المبلغ:</strong> {finalAmount.toLocaleString()} د.ع</p>
              <p><strong>نوع الطلب:</strong> محلي</p>
            </div>
          ),
          variant: "success",
          duration: 5000
        });

        return {
          success: true,
          orderId: localResult.orderId,
          trackingNumber: localUnifiedNumber,
          finalAmount,
          linked: false,
          unified: true
        };
      }
    } catch (error) {
      throw error;
    }
  }, [createOrder, updateOrder, activePartner, isWaseetLoggedIn, waseetToken, settings]);

  const value = {
    createUnifiedOrder,
    isWaseetAvailable: (activePartner === 'alwaseet' || activePartner === 'modon') && isWaseetLoggedIn,
    activePartner
  };

  return (
    <UnifiedOrderCreatorContext.Provider value={value}>
      {children}
    </UnifiedOrderCreatorContext.Provider>
  );
};