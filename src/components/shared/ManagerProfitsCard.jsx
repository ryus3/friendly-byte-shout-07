import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useProfits } from '@/contexts/ProfitsContext';
import StatCard from '@/components/dashboard/StatCard';
import ManagerProfitsDialog from '@/components/profits/ManagerProfitsDialog';
import { Users } from 'lucide-react';

/**
 * مكون مشترك لكارت "أرباحي من الموظفين" مع النافذة
 * يستخدم نفس المنطق والحسابات في كلا الصفحتين
 */
const ManagerProfitsCard = ({ 
  className = '',
  orders = [],
  allUsers = [],
  calculateProfit,
  profits = [],
  timePeriod = 'all'
}) => {
  const { user } = useAuth();
  const { orders: contextOrders, calculateProfit: contextCalculateProfit } = useInventory();
  const { profits: contextProfits } = useProfits();
  const [isManagerProfitsDialogOpen, setIsManagerProfitsDialogOpen] = useState(false);

  // استخدام البيانات من المعاملات أو من الـ context
  const finalOrders = orders.length > 0 ? orders : contextOrders || [];
  const finalProfits = profits.length > 0 ? profits : contextProfits || [];
  const finalCalculateProfit = calculateProfit || contextCalculateProfit;

  // فلتر الفترة الزمنية
  const filterByTimePeriod = (order) => {
    if (timePeriod === 'all') return true;
    
    const orderDate = new Date(order.created_at);
    const now = new Date();
    
    switch (timePeriod) {
      case 'today':
        return orderDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return orderDate >= monthAgo;
      case '3months':
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return orderDate >= threeMonthsAgo;
      default:
        return true;
    }
  };

  // حساب أرباح المدير من الموظفين - نفس منطق متابعة الموظفين بالضبط
  const managerProfitFromEmployees = useMemo(() => {
    if (!finalOrders || !Array.isArray(finalOrders)) {
      return 0;
    }

    // معرف المدير الرئيسي لاستبعاد طلباته
    const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';

    // الطلبات المسلمة أو المكتملة للإحصائيات مع تطبيق فلتر الفترة
    const deliveredOrders = finalOrders.filter(order => {
      if (!order) return false;
      // استبعاد طلبات المدير الرئيسي
      if (order.created_by === ADMIN_ID) return false;
      // فلتر الفترة الزمنية
      if (!filterByTimePeriod(order)) return false;
      // فقط الطلبات المسلمة أو المكتملة
      return order.status === 'delivered' || order.status === 'completed';
    });

    console.log('🔍 ManagerProfitsCard: حساب أرباح المدير من الموظفين:', {
      totalOrders: finalOrders.length,
      deliveredOrders: deliveredOrders.length,
      excludedAdminId: ADMIN_ID
    });

    // أرباح المدير من الموظفين - استخدام البيانات الحقيقية من جدول profits
    const totalManagerProfits = deliveredOrders.reduce((sum, order) => {
      // البحث عن سجل الربح الحقيقي
      const profitRecord = finalProfits?.find(p => p.order_id === order.id);
      if (profitRecord) {
        // ربح النظام = إجمالي الربح - ربح الموظف
        const systemProfit = (profitRecord.profit_amount || 0) - (profitRecord.employee_profit || 0);
        return sum + systemProfit;
      }
      return sum;
    }, 0);

    console.log('✅ ManagerProfitsCard: النتيجة النهائية:', {
      managerProfitFromEmployees: totalManagerProfits,
      deliveredOrdersCount: deliveredOrders.length
    });

    return totalManagerProfits;
  }, [finalOrders, finalProfits, timePeriod]);

  return (
    <>
      <StatCard 
        title="أرباحي من الموظفين" 
        value={managerProfitFromEmployees} 
        icon={Users} 
        colors={['green-500', 'emerald-500']} 
        format="currency" 
        onClick={() => setIsManagerProfitsDialogOpen(true)}
        className={className}
      />
      
      <ManagerProfitsDialog
        isOpen={isManagerProfitsDialogOpen}
        onClose={() => setIsManagerProfitsDialogOpen(false)}
        orders={finalOrders} 
        employees={allUsers || []}
        calculateProfit={finalCalculateProfit}
        profits={finalProfits}
        managerId={user?.id}
        stats={{ totalManagerProfits: managerProfitFromEmployees }}
        timePeriod={timePeriod}
      />
    </>
  );
};

export default ManagerProfitsCard;