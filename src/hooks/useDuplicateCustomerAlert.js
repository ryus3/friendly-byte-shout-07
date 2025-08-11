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

    for (const order of orders) {
      const op = normalizePhone(extractOrderPhone(order));
      if (!op) continue;
      if (op === p) {
        count++;
        const d = order.created_at ? new Date(order.created_at) : null;
        if (d && (!lastDate || d > lastDate)) lastDate = d;
      }
    }

    if (count === 0) return null;
    return {
      phone: p,
      count,
      lastOrderDate: lastDate ? lastDate.toISOString() : null,
    };
  }, [phone, orders]);

  useEffect(() => {
    if (!trigger) return;
    if (!insight) return;
    if (lastNotifiedRef.current === insight.phone) return;

    lastNotifiedRef.current = insight.phone;
    const dateStr = insight.lastOrderDate
      ? new Date(insight.lastOrderDate).toLocaleDateString('en-CA')
      : 'غير محدد';

    toast({
      title: 'تنبيه عميل متكرر',
      description: `هذا الرقم لديه ${insight.count} طلب سابق. آخر طلب بتاريخ ${dateStr}.`,
      variant: 'default',
    });
  }, [insight, trigger]);

  return { insight };
};

export default useDuplicateCustomerAlert;
