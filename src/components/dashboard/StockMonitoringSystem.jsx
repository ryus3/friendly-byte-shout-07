import React, { useEffect, useCallback } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { AlertTriangle, Package, TrendingDown } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const StockMonitoringSystem = () => {
  const { products, settings } = useInventory();
  const { addNotification } = useNotifications();

  // فحص المخزون المنخفض وإرسال إشعارات (مرة واحدة كل ساعة لكل منتج)
  const checkLowStockAndNotify = useCallback(() => {
    if (!products || !settings) return;

    const lowStockThreshold = settings.lowStockThreshold || 5;
    const criticalStockThreshold = Math.max(1, Math.floor(lowStockThreshold / 2));
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // ساعة واحدة بالميلي ثانية
    
    products.forEach(product => {
      if (product.is_visible && product.variants) {
        product.variants.forEach(variant => {
          const currentStock = variant.quantity || 0;
          const productThreshold = product.minStock || lowStockThreshold;
          const notificationKey = `low_stock_${variant.id}`;
          const lastNotified = localStorage.getItem(notificationKey);
          
          // تجنب إرسال إشعارات متكررة - مرة واحدة كل ساعة
          if (lastNotified && (now - parseInt(lastNotified)) < oneHour) {
            return;
          }
          
          // إشعار المخزون المنخفض
          if (currentStock > 0 && currentStock <= productThreshold) {
            const severity = currentStock <= criticalStockThreshold ? 'critical' : 'warning';
            
            addNotification({
              type: 'low_stock',
              title: severity === 'critical' ? 'تنبيه حرج: نفاد المخزون قريباً' : 'تنبيه: مخزون منخفض',
              message: `المنتج "${product.name}" (${variant.color} - ${variant.size}) متبقي ${currentStock} قطعة فقط`,
              icon: severity === 'critical' ? 'ShieldAlert' : 'AlertCircle',
              color: severity === 'critical' ? 'red' : 'amber',
              link: `/inventory?stockFilter=low&highlight=${variant.sku}`,
              data: {
                productId: product.id,
                variantId: variant.id,
                productName: product.name,
                variantDetails: `${variant.color} - ${variant.size}`,
                currentStock: currentStock,
                threshold: productThreshold,
                severity: severity,
                sku: variant.sku
              },
              autoDelete: false,
              priority: severity === 'critical' ? 'high' : 'medium'
            });

            // إشعار toast فوري للحالات الحرجة فقط
            if (severity === 'critical') {
              toast({
                title: "تنبيه حرج: نفاد المخزون",
                description: `${product.name} (${variant.color} - ${variant.size}) متبقي ${currentStock} قطعة فقط!`,
                variant: "destructive",
                duration: 10000
              });
            }
            
            // حفظ وقت آخر إشعار
            localStorage.setItem(notificationKey, now.toString());
          }

          // إشعار نفاد المخزون (مرة واحدة فقط)
          if (currentStock === 0) {
            const outOfStockKey = `out_of_stock_${variant.id}`;
            const lastOutOfStockNotified = localStorage.getItem(outOfStockKey);
            
            if (!lastOutOfStockNotified || (now - parseInt(lastOutOfStockNotified)) > oneHour) {
              addNotification({
                type: 'out_of_stock',
                title: 'نفاد المخزون',
                message: `المنتج "${product.name}" (${variant.color} - ${variant.size}) نفد من المخزون`,
                icon: 'ShieldAlert',
                color: 'red',
                link: `/inventory?stockFilter=out&highlight=${variant.sku}`,
                data: {
                  productId: product.id,
                  variantId: variant.id,
                  productName: product.name,
                  variantDetails: `${variant.color} - ${variant.size}`,
                  sku: variant.sku
                },
                autoDelete: false,
                priority: 'high'
              });
              
              localStorage.setItem(outOfStockKey, now.toString());
            }
          }
        });
      }
    });
  }, [products, settings, addNotification]);

  // مراقبة تغيرات المخزون وإنشاء إشعارات ذكية
  useEffect(() => {
    if (products && products.length > 0) {
      // فحص أولي
      checkLowStockAndNotify();

      // إعداد مراقبة دورية للمخزون (كل 30 دقيقة للتوفير في الموارد)
      const monitoringInterval = setInterval(() => {
        checkLowStockAndNotify();
      }, 30 * 60 * 1000);

      return () => clearInterval(monitoringInterval);
    }
  }, [checkLowStockAndNotify, products]);

  // إشعارات إضافية للعمليات المختلفة
  const notifyStockUpdate = useCallback((productName, variantDetails, oldStock, newStock) => {
    const difference = newStock - oldStock;
    const action = difference > 0 ? 'إضافة' : 'تخفيض';
    const icon = difference > 0 ? 'TrendingUp' : 'TrendingDown';
    const color = difference > 0 ? 'green' : 'blue';

    addNotification({
      type: 'stock_update',
      title: `${action} مخزون`,
      message: `تم ${action} ${Math.abs(difference)} قطعة من ${productName} (${variantDetails})`,
      icon: icon,
      color: color,
      autoDelete: true,
      priority: 'low'
    });
  }, [addNotification]);

  const notifyLowStockResolved = useCallback((productName, variantDetails, currentStock) => {
    addNotification({
      type: 'stock_resolved',
      title: 'تم حل مشكلة المخزون المنخفض',
      message: `المنتج ${productName} (${variantDetails}) أصبح متوفراً بكمية ${currentStock} قطعة`,
      icon: 'Package',
      color: 'green',
      autoDelete: true,
      priority: 'low'
    });
  }, [addNotification]);

  // مكون غير مرئي - يعمل في الخلفية فقط
  return null;
};

export default StockMonitoringSystem;