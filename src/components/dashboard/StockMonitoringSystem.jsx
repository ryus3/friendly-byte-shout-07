import React, { useEffect, useCallback } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { AlertTriangle, Package, TrendingDown } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const StockMonitoringSystem = () => {
  const { products, settings } = useInventory();
  const { addNotification } = useNotifications();

  // فحص المخزون المنخفض وإرسال إشعارات
  const checkLowStockAndNotify = useCallback(() => {
    if (!products || !settings) return;

    const lowStockThreshold = settings.lowStockThreshold || 5;
    const criticalStockThreshold = Math.max(1, Math.floor(lowStockThreshold / 2));
    
    products.forEach(product => {
      if (product.is_visible && product.variants) {
        product.variants.forEach(variant => {
          const currentStock = variant.quantity || 0;
          const productThreshold = product.minStock || lowStockThreshold;
          
          // إشعار المخزون المنخفض
          if (currentStock > 0 && currentStock <= productThreshold) {
            const severity = currentStock <= criticalStockThreshold ? 'critical' : 'warning';
            
            addNotification({
              type: 'low_stock',
              title: severity === 'critical' ? 'تنبيه حرج: نفاد المخزون' : 'تنبيه: مخزون منخفض',
              message: `المنتج "${product.name}" (${variant.color} - ${variant.size}) متبقي ${currentStock} قطعة فقط`,
              icon: 'AlertTriangle',
              color: severity === 'critical' ? 'red' : 'orange',
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

            // إشعار toast فوري للحالات الحرجة
            if (severity === 'critical') {
              toast({
                title: "🚨 تنبيه حرج: نفاد المخزون",
                description: `${product.name} (${variant.color} - ${variant.size}) متبقي ${currentStock} قطعة فقط!`,
                variant: "destructive",
                duration: 8000,
                action: {
                  altText: "عرض المخزون",
                  onClick: () => window.location.href = `/inventory?highlight=${variant.sku}`
                }
              });
            }
          }

          // إشعار نفاد المخزون
          if (currentStock === 0) {
            addNotification({
              type: 'out_of_stock',
              title: '🔴 نفاد المخزون',
              message: `المنتج "${product.name}" (${variant.color} - ${variant.size}) نفد من المخزون`,
              icon: 'Package',
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
          }
        });
      }
    });
  }, [products, settings, addNotification]);

  // مراقبة تغيرات المخزون وإنشاء إشعارات فورية
  useEffect(() => {
    if (products && products.length > 0) {
      // فحص أولي
      checkLowStockAndNotify();

      // إعداد مراقبة دورية للمخزون (كل 5 دقائق)
      const monitoringInterval = setInterval(() => {
        checkLowStockAndNotify();
      }, 5 * 60 * 1000);

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
      title: '✅ تم حل مشكلة المخزون المنخفض',
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