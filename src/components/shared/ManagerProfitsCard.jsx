import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useProfits } from '@/contexts/ProfitsContext';
import StatCard from '@/components/dashboard/StatCard';
import ManagerProfitsDialog from '@/components/profits/ManagerProfitsDialog';
import { Users } from 'lucide-react';
import devLog from '@/lib/devLogger';

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

  // حساب إجمالي أرباح النظام من الموظفين - من جدول الأرباح (استبعاد المدير الرئيسي)
  const systemPendingProfits = useMemo(() => {
    if (!finalProfits || !Array.isArray(finalProfits)) {
      return 0;
    }

    devLog.log('🔍 ManagerProfitsCard: حساب إجمالي أرباح النظام من الموظفين:', {
      totalProfits: finalProfits.length,
      totalOrders: finalOrders.length,
      timePeriod
    });

    // فلتر الأرباح حسب الفترة الزمنية واستبعاد المدير الرئيسي
    const relevantProfits = finalProfits.filter(profit => {
      if (!profit) return false;

      // البحث عن الطلب المرتبط بهذا الربح
      const relatedOrder = finalOrders.find(order => order.id === profit.order_id);
      if (!relatedOrder) return false;

      // استبعاد طلبات المدير الرئيسي
      const MAIN_MANAGER_ID = '91484496-b887-44f7-9e5d-be9db5567604';
      if (relatedOrder.created_by === MAIN_MANAGER_ID) return false;

      // فلتر الفترة الزمنية بناءً على created_at للربح
      if (timePeriod && timePeriod !== 'all') {
        const profitDate = new Date(profit.created_at);
        const now = new Date();
        
        switch (timePeriod) {
          case 'today':
            if (profitDate.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (profitDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (profitDate < monthAgo) return false;
            break;
          case '3months':
            const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            if (profitDate < threeMonthsAgo) return false;
            break;
        }
      }

      return true;
    });

    // حساب إجمالي أرباح النظام من الموظفين = إجمالي الربح - ربح الموظف
    const totalSystemProfits = relevantProfits.reduce((sum, profit) => {
      const systemProfit = (profit.profit_amount || 0) - (profit.employee_profit || 0);
      return sum + Math.max(0, systemProfit);
    }, 0);

    devLog.log('✅ ManagerProfitsCard: النتيجة النهائية (إجمالي أرباح النظام من الموظفين):', {
      relevantProfitsCount: relevantProfits.length,
      totalSystemProfits: totalSystemProfits,
      timePeriod
    });

    return totalSystemProfits;
  }, [finalProfits, timePeriod]);

  return (
    <>
      <StatCard 
        title="أرباحي من الموظفين" 
        value={systemPendingProfits}
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
        stats={{ totalManagerProfits: systemPendingProfits }}
        timePeriod={timePeriod}
      />
    </>
  );
};

export default ManagerProfitsCard;