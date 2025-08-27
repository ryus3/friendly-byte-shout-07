import { useEffect, useMemo, useRef } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * useDuplicateCustomerAlert
 * يعرض تنبيه عندما يتم إدخال/تحديد رقم هاتف يطابق طلبات سابقة
 * - يقوم بتطبيع الرقم
 * - يحسب عدد الطلبات السابقة وآخر تاريخ طلب (للمستخدم الحالي فقط)
 * - يمنع تكرار التنبيهات لنفس الرقم
 * - يحسب إجمالي الشراء بدون أجور التوصيل
 */
export const useDuplicateCustomerAlert = (phone, { trigger = true } = {}) => {
  const { orders } = useInventory();
  const { user } = useAuth();
  const lastNotifiedRef = useRef('');

  const insight = useMemo(() => {
    const p = normalizePhone(phone);
    if (!p || !orders || !Array.isArray(orders) || !user?.id) return null;

    let count = 0;
    let lastDate = null;
    let recentOrderCount = 0;
    let totalSpentNoDelivery = 0;
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last48Hours = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // فلترة الطلبات للمستخدم الحالي فقط
    const userOrders = orders.filter(order => order.created_by === user.id);

    for (const order of userOrders) {
      const op = normalizePhone(extractOrderPhone(order));
      if (!op || op !== p) continue;
      
      // فقط الطلبات المكتملة التي تم استلام الإيصال
      const isCompleted = order.status === 'completed' || order.status === 'delivered';
      const isReceiptReceived = order.receipt_received === true;
      
      if (isCompleted && isReceiptReceived) {
        count++;
        
        // حساب إجمالي الشراء بدون أجور التوصيل
        const totalAmount = order.total_amount || 0;
        const deliveryFee = order.delivery_fee || 0;
        totalSpentNoDelivery += (totalAmount - deliveryFee);
      }
      
      const orderDate = order.created_at ? new Date(order.created_at) : null;
      if (orderDate) {
        if (!lastDate || orderDate > lastDate) lastDate = orderDate;
        // التحقق من الطلبات خلال 24-48 ساعة
        if (orderDate >= last48Hours && orderDate <= last24Hours) {
          recentOrderCount++;
        }
      }
    }

    if (count === 0 && recentOrderCount === 0) return null;
    
    // تحديد نوع التنبيه
    let alertType = 'known';
    
    if (recentOrderCount > 0) {
      alertType = 'recent_duplicate';
    } else if (totalSpentNoDelivery >= 100000) { // VIP: أكثر من 100,000 د.ع بدون توصيل
      alertType = 'vip';
    }
    
    const timeSinceLastOrderHours = lastDate 
      ? Math.floor((new Date() - lastDate) / (1000 * 60 * 60))
      : null;
    
    return {
      phone: p,
      count,
      totalSpentNoDelivery,
      lastOrderDate: lastDate ? lastDate.toISOString() : null,
      timeSinceLastOrderHours,
      alertType,
      recentOrderCount,
    };
  }, [phone, orders, user?.id]);

  useEffect(() => {
    if (!trigger || !insight) return;
    if (lastNotifiedRef.current === insight.phone) return;

    lastNotifiedRef.current = insight.phone;
    
    const formatLastOrderDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffHours < 24) {
        return `${diffHours}س`;
      } else if (diffHours < 48) {
        return `${Math.floor(diffHours / 24)} يوم`;
      } else {
        return date.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' });
      }
    };
    
    const getAlertConfig = () => {
      const lastOrderText = formatLastOrderDate(insight.lastOrderDate);
      
      switch (insight.alertType) {
        case 'recent_duplicate':
          return {
            title: '⚠️ طلب مكرر محتمل',
            description: `آخر طلب: ${lastOrderText} • إجمالي: ${insight.count} طلب`,
            className: 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-300 dark:from-orange-900/30 dark:to-red-900/30 dark:border-orange-700',
            duration: 6000
          };
        case 'vip':
          return {
            title: '👑 عميل VIP',
            description: `${insight.count} طلب • ${insight.totalSpentNoDelivery.toLocaleString('ar')} د.ع • آخر طلب: ${lastOrderText}`,
            className: 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300 dark:from-purple-900/30 dark:to-pink-900/30 dark:border-purple-700',
            duration: 4000
          };
        default:
          return {
            title: '✨ عميل معروف',
            description: `${insight.count} طلب • ${insight.totalSpentNoDelivery.toLocaleString('ar')} د.ع • آخر طلب: ${lastOrderText}`,
            className: 'bg-gradient-to-r from-blue-50 to-green-50 border-blue-200 dark:from-blue-900/20 dark:to-green-900/20 dark:border-blue-600',
            duration: 3000
          };
      }
    };

    // إزالة Toast للعملاء VIP - يظهر فقط في الكارت أسفل رقم الهاتف
    if (insight.alertType === 'vip') {
      return; // لا نعرض toast للعملاء VIP
    }

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
