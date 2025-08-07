import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext'; // النظام الموحد
import StatCard from '@/components/dashboard/StatCard';
import { Receipt } from 'lucide-react';
import EmployeeReceivedProfitsDialog from './EmployeeReceivedProfitsDialog';

/**
 * كارت أرباحي المستلمة للموظفين - تم الإصلاح لاستخدام النظام الموحد
 */
const EmployeeReceivedProfitsCard = ({ 
  className = '',
  allUsers = []
}) => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { profits } = useInventory(); // استخدام النظام الموحد

  
  // تصفية فواتير التسوية من البيانات الموحدة
  const employeeReceivedProfits = useMemo(() => {
    if (!user?.employee_code && !user?.user_id) return { total: 0, invoices: [] };
    
    const userUUID = user.user_id || user.id;
    const userEmployeeCode = user.employee_code;
    
    // البحث في الأرباح عن التسويات المكتملة للمستخدم
    const userCompletedProfits = profits.filter(profit => {
      return (profit.employee_id === userUUID || profit.employee_id === userEmployeeCode) &&
             (profit.status === 'completed' || profit.status === 'settled');
    });
    
    // حساب إجمالي المبلغ المستلم
    const totalReceived = userCompletedProfits.reduce((sum, profit) => 
      sum + (profit.employee_profit || profit.total_profit || 0), 0
    );
    
    console.log('📊 EmployeeReceivedProfitsCard: البيانات من النظام الموحد:', {
      totalProfits: profits?.length || 0,
      userCompletedProfits: userCompletedProfits?.length || 0,
      totalReceived,
      userEmployeeCode: user?.employee_code,
      userUUID: userUUID
    });
    
    return {
      total: totalReceived,
      invoices: userCompletedProfits
    };
  }, [profits, user]);

  return (
    <>
      <StatCard 
        title="أرباحي المستلمة" 
        value={employeeReceivedProfits.total} 
        icon={Receipt} 
        colors={['blue-500', 'cyan-500']} 
        format="currency" 
        onClick={() => setIsDialogOpen(true)}
        className={className}
        subtitle={
          employeeReceivedProfits.invoices.length > 0 
            ? `${employeeReceivedProfits.invoices.length} معاملة مكتملة`
            : 'لا توجد أرباح مستلمة بعد'
        }
      />
      
      <EmployeeReceivedProfitsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        allUsers={allUsers}
      />
    </>
  );
};

export default EmployeeReceivedProfitsCard;