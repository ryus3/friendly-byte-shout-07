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
    console.log('🚀 بدء إنشاء طلب موحد:', { customerInfo, cart, discount, activePartner });
    
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
        console.log(`🔗 إنشاء طلب خارجي مع ${activePartner}...`);
        
        // ✅ جلب المعرفات الخارجية من الـ mappings
        const unifiedCityId = customerInfo.city_id || customerInfo.customer_city_id;
        const unifiedRegionId = customerInfo.region_id || customerInfo.customer_region_id;
        
        // ترجمة المعرفات الموحدة إلى معرفات خارجية
        const { data: cityMapping } = await supabase
          .from('city_delivery_mappings')
          .select('external_id, external_name')
          .eq('city_id', unifiedCityId)
          .eq('delivery_partner', activePartner)
          .maybeSingle();
        
        const { data: regionMapping } = await supabase
          .from('region_delivery_mappings')
          .select('external_id, external_name')
          .eq('region_id', unifiedRegionId)
          .eq('delivery_partner', activePartner)
          .maybeSingle();
        
        if (!cityMapping || !regionMapping) {
          throw new Error(`لم يتم العثور على تطابق المدينة/المنطقة لشريك ${activePartner}`);
        }
        
        const finalCityId = cityMapping.external_id;
        const finalRegionId = regionMapping.external_id;

        console.log(`🔍 [UnifiedOrderCreator] معرفات ${activePartner}:`, {
          unifiedCityId,
          unifiedRegionId,
          finalCityId,
          finalRegionId,
          cityName: cityMapping.external_name,
          regionName: regionMapping.external_name
        });

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

          console.log(`📦 [UnifiedOrderCreator] إرسال ل${activePartner}:`, {
            ...partnerPayload,
            city_id: finalCityId,
            region_id: finalRegionId
          });
          
          // استخدام توكن الحساب المحدد إذا تم تمريره
          const useToken = aiOrderData?.accountData?.token || waseetToken;
          console.log('🔍 التوكن المستخدم:', { 
            hasAccountToken: !!aiOrderData?.accountData?.token, 
            hasContextToken: !!waseetToken,
            selectedAccount: aiOrderData?.selectedAccount 
          });
          
          // ✅ استدعاء API المناسب حسب الشريك
          let partnerResult;
          if (activePartner === 'modon') {
            partnerResult = await ModonAPI.createModonOrder(partnerPayload, useToken);
          } else {
            partnerResult = await createAlWaseetOrder(partnerPayload, useToken);
          }
          
          const alWaseetResult = partnerResult; // للتوافق مع الكود الحالي
          
          if (alWaseetResult?.id) {
            console.log(`✅ تم إنشاء طلب ${activePartner}:`, alWaseetResult);
            
            // Focus on qr_id as primary identifier - this is what customers track
            const qrId = String(alWaseetResult.qr_id || '').trim();
            const waseetInternalId = String(alWaseetResult.id || '');
            
            // Validate qr_id exists
            if (!qrId) {
              console.warn('⚠️ No qr_id received from Al-Waseet, will set tracking_number to null');
            }
            
            // ✅ الإصلاح الجذري: استخدام نفس القيم المرسلة للشريك
            console.log('🔍 [UnifiedOrderCreator] customerInfo قبل إنشاء الطلب المحلي:', {
              customerInfo_alwaseet_city_id: customerInfo.alwaseet_city_id,
              customerInfo_alwaseet_region_id: customerInfo.alwaseet_region_id,
              customerInfo_customer_city_id: customerInfo.customer_city_id,
              customerInfo_customer_region_id: customerInfo.customer_region_id,
              finalCityId,
              finalRegionId
            });

            console.log('🔍 [AlWaseetUnifiedOrderCreator] customerInfo قبل استدعاء createOrder:', {
              customer_name: customerInfo.customer_name,
              customer_phone: customerInfo.customer_phone,
              customer_phone2: customerInfo.customer_phone2,
              hasPhone2: !!customerInfo.customer_phone2
            });

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
              console.error('❌ فشل في إنشاء الطلب المحلي بعد إنشاء طلب الوسيط');
              throw new Error(localResult.error || 'فشل في إنشاء الطلب المحلي');
            }
            
            console.log('🔄 تم إنشاء الطلب المحلي مع الأرقام الموحدة:', localResult);
            
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
          console.error(`⚠️ فشل إنشاء طلب ${partnerName}:`, partnerError);
          
          // في حالة فشل الشريك، إنشاء طلب محلي عادي
          console.log('🏠 التراجع لإنشاء طلب محلي...');
          const localFallbackResult = await createOrder(customerInfo, cart, null, discount, null, finalAmount);
          
          if (!localFallbackResult.success) {
            throw new Error(localFallbackResult.error || 'فشل في إنشاء الطلب المحلي');
          }

          toast({
            title: 'تم إنشاء الطلب محلياً فقط',
            description: `رقم الطلب: ${localFallbackResult.trackingNumber}. فشل الربط مع ${partnerName}: ${partnerError.message}`,
            variant: 'warning',
            duration: 6000
          });

          return {
            success: true,
            orderId: localFallbackResult.orderId,
            trackingNumber: localFallbackResult.trackingNumber,
            finalAmount,
            linked: false,
            linkError: partnerError.message
          };
        }
      } else {
        // طلب محلي فقط مع رقم موحد محلي
        console.log('🏠 إنشاء طلب محلي بدون ربط...');
        
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
      console.error('❌ خطأ في إنشاء الطلب الموحد:', error);
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