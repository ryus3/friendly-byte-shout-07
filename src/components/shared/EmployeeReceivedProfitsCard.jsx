import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import StatCard from '@/components/dashboard/StatCard';
import { Receipt } from 'lucide-react';
import EmployeeReceivedProfitsDialog from './EmployeeReceivedProfitsDialog';
import { supabase } from '@/lib/customSupabaseClient';
import { useEmployeeReceivedPeriod } from '@/hooks/useEmployeeReceivedPeriod';
import { parseISO, isValid } from 'date-fns';

/**
 * كارت أرباحي المستلمة للموظفين - موحد مع النافذة ويستخدم نفس فلترة الفترة
 */
const EmployeeReceivedProfitsCard = ({ 
  className = '',
  allUsers = []
}) => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { period, dateRange, periodLabels } = useEmployeeReceivedPeriod();
  const [invoices, setInvoices] = useState([]);

  // جلب فواتير التسوية المكتملة بالمعرف الصغير للموظف
  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user?.employee_code) return setInvoices([]);
      const { data, error } = await supabase
        .from('settlement_invoices')
        .select('*')
        .eq('employee_code', user.employee_code)
        .eq('status', 'completed')
        .order('settlement_date', { ascending: false });
      if (error) {
        console.error('❌ خطأ في جلب فواتير أرباحي المستلمة:', error);
        setInvoices([]);
      } else {
        setInvoices(data || []);
      }
    };
    fetchInvoices();
  }, [user?.employee_code]);

  // فلترة الفواتير حسب الفترة
  const { totalReceived, filteredCount } = useMemo(() => {
    if (!invoices?.length || !dateRange?.from || !dateRange?.to) return { totalReceived: 0, filteredCount: 0 };
    const filtered = invoices.filter(inv => {
      const d = parseISO(inv.settlement_date);
      return isValid(d) && d >= dateRange.from && d <= dateRange.to;
    });
    const total = filtered.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    return { totalReceived: total, filteredCount: filtered.length };
  }, [invoices, dateRange]);

  return (
    <>
      <StatCard 
        title="أرباحي المستلمة" 
        value={totalReceived} 
        icon={Receipt} 
        colors={['blue-500', 'cyan-500']} 
        format="currency" 
        onClick={() => setIsDialogOpen(true)}
        className={className}
        currentPeriod={period}
        periods={periodLabels}
        subtitle={
          filteredCount > 0 
            ? `${filteredCount} معاملة مكتملة`
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