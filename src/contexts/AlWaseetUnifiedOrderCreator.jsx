import React, { createContext, useContext, useCallback } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useInventory } from '@/contexts/InventoryContext';
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
  const { createOrder, updateOrder, settings } = useInventory();

  // دالة موحدة لإنشاء الطلبات مع ضمان الربط الصحيح
  const createUnifiedOrder = useCallback(async (customerInfo, cart, discount = 0, aiOrderData = null) => {
    console.log('🚀 بدء إنشاء طلب موحد:', { customerInfo, cart, discount, activePartner });
    
    try {
      // حساب المبلغ الإجمالي
      const subtotal = cart.reduce((sum, item) => sum + (item.total || 0), 0);
      const finalAmount = Math.max(0, subtotal - discount);

      // إنشاء الطلب المحلي أولاً
      console.log('🏠 إنشاء طلب محلي أولاً...');
      const localResult = await createOrder(customerInfo, cart, null, discount, null, finalAmount);

      if (!localResult.success) {
        throw new Error(localResult.error || 'فشل في إنشاء الطلب المحلي');
      }

      console.log('✅ تم إنشاء الطلب المحلي:', localResult);

      // إذا كان الوسيط نشطاً ومتصل، ربط الطلب
      if (activePartner === 'alwaseet' && isWaseetLoggedIn && waseetToken) {
        console.log('🔗 ربط الطلب مع الوسيط...');
        
        try {
          const alWaseetPayload = {
            name: customerInfo.name,
            phone: customerInfo.phone,
            second_phone: customerInfo.second_phone || '',
            address: customerInfo.address,
            notes: customerInfo.notes || '',
            details: cart.map(item => `${item.productName} (${item.color}, ${item.size}) ×${item.quantity}`).join(' | '),
            quantity: cart.reduce((sum, item) => sum + item.quantity, 0),
            price: finalAmount + (settings?.delivery_fee || 50000), // إضافة رسوم التوصيل
            size: 'عادي',
            type: 'new',
            promocode: customerInfo.promo_code || ''
          };

          console.log('📦 إرسال للوسيط:', alWaseetPayload);
          const alWaseetResult = await createAlWaseetOrder(alWaseetPayload, waseetToken);
          
          if (alWaseetResult?.id) {
            console.log('✅ تم إنشاء طلب الوسيط:', alWaseetResult);
            
            // تحديث الطلب المحلي بمعرف الوسيط
            const updateResult = await updateOrder(localResult.orderId, {
              delivery_partner_order_id: String(alWaseetResult.id),
              tracking_number: alWaseetResult.qr_id || alWaseetResult.tracking_id,
              delivery_partner: 'alwaseet'
            });
            
            console.log('🔄 تحديث الطلب المحلي:', updateResult);
            
            toast({
              title: (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  تم إنشاء الطلب وربطه مع الوسيط بنجاح
                </div>
              ),
              description: (
                <div className="space-y-1">
                  <p><strong>رقم الطلب:</strong> {localResult.trackingNumber}</p>
                  <p><strong>رقم الوسيط:</strong> {alWaseetResult.qr_id || alWaseetResult.id}</p>
                  <p><strong>العميل:</strong> {customerInfo.name}</p>
                  <p><strong>المبلغ:</strong> {finalAmount.toLocaleString()} د.ع</p>
                </div>
              ),
              variant: "success",
              duration: 6000
            });

            return {
              success: true,
              orderId: localResult.orderId,
              trackingNumber: localResult.trackingNumber,
              alWaseetId: alWaseetResult.id,
              alWaseetQrId: alWaseetResult.qr_id,
              finalAmount,
              linked: true
            };
          } else {
            throw new Error('لم يتم إرجاع معرف من الوسيط');
          }
        } catch (alWaseetError) {
          console.error('⚠️ فشل ربط الوسيط (الطلب المحلي موجود):', alWaseetError);
          
          toast({
            title: 'تم إنشاء الطلب محلياً فقط',
            description: `رقم الطلب: ${localResult.trackingNumber}. فشل الربط مع الوسيط: ${alWaseetError.message}`,
            variant: 'warning',
            duration: 6000
          });

          return {
            success: true,
            orderId: localResult.orderId,
            trackingNumber: localResult.trackingNumber,
            finalAmount,
            linked: false,
            linkError: alWaseetError.message
          };
        }
      } else {
        // طلب محلي فقط
        console.log('✅ تم إنشاء الطلب المحلي بنجاح (بدون ربط)');
        
        toast({
          title: (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              تم إنشاء الطلب بنجاح
            </div>
          ),
          description: (
            <div className="space-y-1">
              <p><strong>رقم الطلب:</strong> {localResult.trackingNumber}</p>
              <p><strong>العميل:</strong> {customerInfo.name}</p>
              <p><strong>المبلغ:</strong> {finalAmount.toLocaleString()} د.ع</p>
            </div>
          ),
          variant: "success",
          duration: 5000
        });

        return {
          success: true,
          orderId: localResult.orderId,
          trackingNumber: localResult.trackingNumber,
          finalAmount,
          linked: false
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