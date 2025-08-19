import { useEffect, useMemo, useRef } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';
import { toast } from '@/components/ui/use-toast';

/**
 * useDuplicateCustomerAlert
 * يعرض تنبيه عندما يتم إدخال/تحديد رقم هاتف يطابق طلبات سابقة
 * - يقوم بتطبيع الرقم
 * - يحسب عدد الطلبات السابقة وآخر تاريخ طلب
 * - يمنع تكرار التنبيهات لنفس الرقم
 */
export const useDuplicateCustomerAlert = (phone, { trigger = true } = {}) => {
  const { orders } = useInventory();
  const lastNotifiedRef = useRef('');

  const insight = useMemo(() => {
    const p = normalizePhone(phone);
    if (!p || !orders || !Array.isArray(orders)) return null;

    let count = 0;
    let lastDate = null;
    let recentOrderCount = 0;
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last46Hours = new Date(now.getTime() - 46 * 60 * 60 * 1000);

    for (const order of orders) {
      const op = normalizePhone(extractOrderPhone(order));
      if (!op || op !== p) continue;
      
      count++;
      const orderDate = order.created_at ? new Date(order.created_at) : null;
      if (orderDate) {
        if (!lastDate || orderDate > lastDate) lastDate = orderDate;
        // التحقق من الطلبات خلال 24-46 ساعة
        if (orderDate >= last46Hours && orderDate <= last24Hours) {
          recentOrderCount++;
        }
      }
    }

    if (count === 0) return null;
    
    // تحديد نوع التنبيه
    let alertType = 'known';
    let points = count * 250; // حساب النقاط (250 لكل طلب)
    
    if (recentOrderCount > 0) {
      alertType = 'recent_duplicate';
    } else if (points >= 1000) {
      alertType = 'vip';
    }
    
    return {
      phone: p,
      count,
      points,
      lastOrderDate: lastDate ? lastDate.toISOString() : null,
      alertType,
      recentOrderCount,
    };
  }, [phone, orders]);

  useEffect(() => {
    if (!trigger || !insight) return;
    if (lastNotifiedRef.current === insight.phone) return;

    lastNotifiedRef.current = insight.phone;
    
    const timeSinceLastOrder = insight.lastOrderDate 
      ? Math.floor((new Date() - new Date(insight.lastOrderDate)) / (1000 * 60 * 60))
      : null;
    
    const getAlertConfig = () => {
      switch (insight.alertType) {
        case 'recent_duplicate':
          return {
            title: '⚠️ طلب مكرر محتمل',
            description: `طلب خلال ${timeSinceLastOrder}س • إجمالي: ${insight.count} طلب`,
            className: 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-300 dark:from-orange-900/30 dark:to-red-900/30 dark:border-orange-700',
            duration: 6000
          };
        case 'vip':
          return {
            title: '👑 عميل VIP',
            description: `${insight.points} نقطة • ${insight.count} طلب • آخر طلب: ${timeSinceLastOrder}س`,
            className: 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300 dark:from-purple-900/30 dark:to-pink-900/30 dark:border-purple-700',
            duration: 4000
          };
        default:
          return {
            title: '✨ عميل معروف',
            description: `${insight.count} طلب • ${insight.points} نقطة • آخر طلب: ${timeSinceLastOrder}س`,
            className: 'bg-gradient-to-r from-blue-50 to-green-50 border-blue-200 dark:from-blue-900/20 dark:to-green-900/20 dark:border-blue-600',
            duration: 3000
          };
      }
    };

    const config = getAlertConfig();
    toast({
      title: config.title,
      description: config.description,
      variant: 'default',
      className: `${config.className} h-16 text-sm shadow-lg`,
      duration: config.duration,
    });
  }, [insight, trigger]);

  return { insight };
};

export default useDuplicateCustomerAlert;
