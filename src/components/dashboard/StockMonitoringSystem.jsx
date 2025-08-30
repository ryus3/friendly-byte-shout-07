import React, { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useUnifiedNotifications } from '@/contexts/UnifiedNotificationsContext';
import { usePermissions } from '@/hooks/usePermissions';

const StockMonitoringSystem = () => {
  const { createNotification } = useUnifiedNotifications();
  const { user, hasPermission } = usePermissions();
  const notificationHistory = useRef(new Set());
  const lastCheckTime = useRef(Date.now());

  // تنظيف التاريخ كل 24 ساعة
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      notificationHistory.current.clear();
      lastCheckTime.current = Date.now();
    }, 24 * 60 * 60 * 1000); // 24 ساعة

    return () => clearInterval(cleanupInterval);
  }, []);

  useEffect(() => {
    if (!user?.user_id || !hasPermission) return;
    
    // التحقق من الصلاحية
    const checkPermission = hasPermission('view_all_data');
    if (!checkPermission) return;

    const stockChannel = supabase
      .channel('stock-monitoring-system')
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'inventory',
          filter: 'updated_at=gt.' + new Date(lastCheckTime.current).toISOString()
        },
        async (payload) => {
          const { old: oldData, new: newData } = payload;
          
          // التحقق من الوظيفة المنطقية للإشعارات أولاً
          const shouldSend = await supabase
            .rpc('should_send_stock_notification', {
              p_product_id: newData.product_id,
              p_variant_id: newData.variant_id,
              p_notification_type: newData.quantity === 0 ? 'out_of_stock' : 'low_stock',
              p_stock_level: newData.quantity
            });
          
          if (!shouldSend.data) {
            return; // لا ترسل إشعار متكرر
          }

          // جلب تفاصيل المنتج والمتغير
          const { data: inventoryDetails } = await supabase
            .from('inventory')
            .select(`
              *,
              products:product_id (
                id,
                name,
                images
              ),
              product_variants:variant_id (
                id,
                barcode,
                colors:color_id (name),
                sizes:size_id (name)
              )
            `)
            .eq('id', newData.id)
            .single();

          if (!inventoryDetails) return;

          const product = inventoryDetails.products;
          const variant = inventoryDetails.product_variants;
          const productName = product?.name || 'منتج غير محدد';
          const variantDetails = variant ? 
            `${variant.colors?.name || ''} - ${variant.sizes?.name || ''}`.replace(/^- |- $/, '') : 
            '';

          // تحديد نوع الإشعار
          if (newData.quantity === 0 && oldData.quantity > 0) {
            // نفاد المخزون
            createNotification({
              type: 'out_of_stock',
              title: 'نفاد المخزون',
              message: `المنتج "${productName}" ${variantDetails ? `(${variantDetails})` : ''} نفد من المخزون`,
              priority: 'medium',
              data: {
                productId: product.id,
                productName,
                variantId: variant?.id,
                variantDetails,
                sku: variant?.barcode
              },
              user_id: null // للمدراء فقط
            });
          } else if (newData.quantity <= newData.min_stock && oldData.quantity > newData.min_stock && newData.quantity > 0) {
            // مخزون منخفض
            const severity = newData.quantity <= 2 ? 'critical' : 'warning';
            createNotification({
              type: 'low_stock',
              title: severity === 'critical' ? 'تنبيه حرج: نفاد المخزون قريباً' : 'تنبيه: مخزون منخفض',
              message: `المنتج "${productName}" ${variantDetails ? `(${variantDetails})` : ''} متبقي ${newData.quantity} قطعة فقط`,
              priority: 'medium',
              data: {
                productId: product.id,
                productName,
                variantId: variant?.id,
                variantDetails,
                sku: variant?.barcode,
                currentStock: newData.quantity,
                threshold: newData.min_stock,
                severity
              },
              user_id: null // للمدراء فقط
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (stockChannel) {
        supabase.removeChannel(stockChannel);
      }
    };
  }, [user?.user_id, hasPermission, createNotification]);

  return null;
};

export default StockMonitoringSystem;