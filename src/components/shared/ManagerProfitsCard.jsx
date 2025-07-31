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
  profits = []
}) => {
  const { user } = useAuth();
  const { orders: contextOrders, calculateProfit: contextCalculateProfit } = useInventory();
  const { profits: contextProfits } = useProfits();
  const [isManagerProfitsDialogOpen, setIsManagerProfitsDialogOpen] = useState(false);

  // استخدام البيانات من المعاملات أو من الـ context
  const finalOrders = orders.length > 0 ? orders : contextOrders || [];
  const finalProfits = profits.length > 0 ? profits : contextProfits || [];
  const finalCalculateProfit = calculateProfit || contextCalculateProfit;

  // حساب أرباح المدير من الموظفين - نفس منطق متابعة الموظفين
  const managerProfitFromEmployees = useMemo(() => {
    if (!finalOrders || !Array.isArray(finalOrders) || !allUsers || !Array.isArray(allUsers)) {
      return 0;
    }

    // معرف المدير الرئيسي لاستبعاد طلباته
    const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';

    // فلترة طلبات الموظفين فقط (استبعاد المدير الرئيسي)
    const employeeOrders = finalOrders.filter(order => {
      if (!order || !order.created_by) return false;
      if (order.created_by === ADMIN_ID) return false;
      
      // فقط الطلبات المكتملة أو المُوصلة
      if (!['completed', 'delivered'].includes(order.status)) return false;
      
      // التأكد من أن منشئ الطلب موظف
      const orderCreator = allUsers.find(u => u.user_id === order.created_by || u.id === order.created_by);
      return orderCreator && orderCreator.status === 'active';
    });

    console.log('🔍 ManagerProfitsCard: حساب أرباح المدير من الموظفين:', {
      totalOrders: finalOrders.length,
      employeeOrders: employeeOrders.length,
      excludedAdminId: ADMIN_ID
    });

    // حساب أرباح المدير من كل طلب موظف
    const totalManagerProfit = employeeOrders.reduce((total, order) => {
      // البحث عن سجل الأرباح في قاعدة البيانات
      const profitRecord = finalProfits.find(p => p.order_id === order.id);
      
      let managerProfitFromOrder = 0;
      
      if (profitRecord) {
        // إذا كان هناك سجل في قاعدة البيانات، استخدم ربح النظام
        const totalProfit = profitRecord.profit_amount || 0;
        const employeeProfit = profitRecord.employee_profit || 0;
        managerProfitFromOrder = totalProfit - employeeProfit;
      } else if (finalCalculateProfit) {
        // إذا لم يكن هناك سجل، احسب باستخدام الدالة التقليدية
        const orderItems = order.order_items || order.items || [];
        managerProfitFromOrder = orderItems.reduce((sum, item) => {
          const itemProfit = finalCalculateProfit(item, order.created_by);
          // ربح المدير = الربح الإجمالي - ربح الموظف
          // نفترض أن دالة calculateProfit تُرجع ربح الموظف، فربح المدير هو الباقي
          const sellPrice = item.unit_price || item.price || 0;
          const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
          const totalItemProfit = (sellPrice - costPrice) * (item.quantity || 0);
          return sum + (totalItemProfit - itemProfit);
        }, 0);
      }

      return total + managerProfitFromOrder;
    }, 0);

    console.log('✅ ManagerProfitsCard: النتيجة النهائية:', {
      managerProfitFromEmployees: totalManagerProfit,
      employeeOrdersCount: employeeOrders.length
    });

    return totalManagerProfit;
  }, [finalOrders, allUsers, finalProfits, finalCalculateProfit]);

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
      />
    </>
  );
};

export default ManagerProfitsCard;