import React, { createContext, useContext, useCallback } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useSuper } from '@/contexts/SuperProvider';
import { createAlWaseetOrder } from '@/lib/alwaseet-api';
import { toast } from '@/components/ui/use-toast';
import { CheckCircle } from 'lucide-react';

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
  const { createOrder, updateOrder, settings } = useSuper();

  // دالة موحدة لإنشاء الطلبات مع ضمان الربط الصحيح والتوحيد الكامل للأرقام
  const createUnifiedOrder = useCallback(async (customerInfo, cart, discount = 0, aiOrderData = null) => {
    console.log('🚀 بدء إنشاء طلب موحد:', { customerInfo, cart, discount, activePartner });
    
    try {
      // حساب المبلغ الإجمالي
      const subtotal = cart.reduce((sum, item) => sum + (item.total || 0), 0);
      const finalAmount = Math.max(0, subtotal - discount);

      // إذا كان الوسيط نشطاً ومتصل، إنشاء طلب خارجي مع التوحيد الكامل
      if (activePartner === 'alwaseet' && isWaseetLoggedIn && waseetToken) {
        console.log('🔗 إنشاء طلب خارجي مع التوحيد الكامل...');
        
        try {
          const alWaseetPayload = {
            name: customerInfo.name,
            phone: customerInfo.phone,
            second_phone: customerInfo.second_phone || '',
            address: customerInfo.address,
            notes: customerInfo.notes || '',
            details: (cart || []).filter(item => item != null).map(item => `${item?.productName} (${item?.color}, ${item?.size}) ×${item?.quantity || 1}`).join(' | '),
            quantity: (cart || []).filter(item => item != null).reduce((sum, item) => sum + (item?.quantity || 1), 0),
            price: finalAmount + (settings?.delivery_fee || 50000), // إضافة رسوم التوصيل
            size: 'عادي',
            type: 'new',
            promocode: customerInfo.promo_code || ''
          };

          console.log('📦 إرسال للوسيط:', alWaseetPayload);
          const alWaseetResult = await createAlWaseetOrder(alWaseetPayload, waseetToken);
          
          if (alWaseetResult?.id) {
            console.log('✅ تم إنشاء طلب الوسيط:', alWaseetResult);
            
            // Focus on qr_id as primary identifier - this is what customers track
            const qrId = String(alWaseetResult.qr_id || '').trim();
            const waseetInternalId = String(alWaseetResult.id || '');
            
            // Validate qr_id exists
            if (!qrId) {
              console.warn('⚠️ No qr_id received from Al-Waseet, will set tracking_number to null');
            }
            
            // Create local order with qr_id as tracking_number (primary identifier)
            // delivery_partner_order_id can be null initially - we can look it up later if needed
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
                delivery_partner: 'alwaseet'
              }
            );

            if (!localResult.success) {
              console.error('❌ فشل في إنشاء الطلب المحلي بعد إنشاء طلب الوسيط');
              throw new Error(localResult.error || 'فشل في إنشاء الطلب المحلي');
            }
            
            console.log('🔄 تم إنشاء الطلب المحلي مع الأرقام الموحدة:', localResult);
            
            toast({
              title: (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  تم إنشاء الطلب وربطه مع الوسيط بنجاح
                </div>
              ),
              description: (
                <div className="space-y-1">
                  <p><strong>رقم التتبع:</strong> {qrId || '—'}</p>
                  <p><strong>العميل:</strong> {customerInfo.name}</p>
                  <p><strong>المبلغ:</strong> {finalAmount.toLocaleString()} د.ع</p>
                  <p><strong>نوع الطلب:</strong> خارجي (مربوط مع الوسيط)</p>
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
        } catch (alWaseetError) {
          console.error('⚠️ فشل إنشاء طلب الوسيط:', alWaseetError);
          
          // في حالة فشل الوسيط، إنشاء طلب محلي عادي
          console.log('🏠 التراجع لإنشاء طلب محلي...');
          const localFallbackResult = await createOrder(customerInfo, cart, null, discount, null, finalAmount);
          
          if (!localFallbackResult.success) {
            throw new Error(localFallbackResult.error || 'فشل في إنشاء الطلب المحلي');
          }

          toast({
            title: 'تم إنشاء الطلب محلياً فقط',
            description: `رقم الطلب: ${localFallbackResult.trackingNumber}. فشل الربط مع الوسيط: ${alWaseetError.message}`,
            variant: 'warning',
            duration: 6000
          });

          return {
            success: true,
            orderId: localFallbackResult.orderId,
            trackingNumber: localFallbackResult.trackingNumber,
            finalAmount,
            linked: false,
            linkError: alWaseetError.message
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
    isWaseetAvailable: activePartner === 'alwaseet' && isWaseetLoggedIn,
    activePartner
  };

  return (
    <UnifiedOrderCreatorContext.Provider value={value}>
      {children}
    </UnifiedOrderCreatorContext.Provider>
  );
};