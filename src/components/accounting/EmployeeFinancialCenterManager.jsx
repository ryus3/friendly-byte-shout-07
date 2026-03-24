import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Wallet, UserCheck, UserX } from 'lucide-react';

const EmployeeFinancialCenterManager = ({ allUsers }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, has_financial_center')
        .eq('is_active', true)
        .order('full_name');
      
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('خطأ في جلب الموظفين:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFinancialCenter = async (employeeId, enable) => {
    setProcessing(employeeId);
    try {
      if (enable) {
        const { data, error } = await supabase.rpc('setup_employee_financial_center', {
          p_employee_id: employeeId,
          p_initial_balance: 0
        });
        if (error) throw error;
        toast({ title: "تم التفعيل", description: "تم تفعيل المركز المالي وإنشاء قاصة خاصة" });
      } else {
        const { data, error } = await supabase.rpc('disable_employee_financial_center', {
          p_employee_id: employeeId
        });
        if (error) throw error;
        toast({ title: "تم التعطيل", description: "تم تعطيل المركز المالي" });
      }
      await fetchEmployees();
    } catch (error) {
      console.error('خطأ:', error);
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-4">
        فعّل المركز المالي لموظف ليحصل على قاصة خاصة ومركز مالي مستقل.
        إيرادات طلباته ستدخل قاصته الخاصة بدل القاصة الرئيسية.
      </p>
      {employees.map((emp) => (
        <div key={emp.user_id} className="flex items-center justify-between py-3 px-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3">
            <Wallet className={`w-5 h-5 ${emp.has_financial_center ? 'text-indigo-500' : 'text-muted-foreground'}`} />
            <div>
              <p className="font-medium">{emp.full_name}</p>
              <p className="text-xs text-muted-foreground">@{emp.username}</p>
            </div>
            {emp.has_financial_center && (
              <Badge variant="default" className="bg-indigo-500 text-white">مفعّل</Badge>
            )}
          </div>
          <Button
            size="sm"
            variant={emp.has_financial_center ? "destructive" : "default"}
            disabled={processing === emp.user_id}
            onClick={() => toggleFinancialCenter(emp.user_id, !emp.has_financial_center)}
          >
            {processing === emp.user_id ? (
              <span className="animate-spin">⏳</span>
            ) : emp.has_financial_center ? (
              <><UserX className="w-4 h-4 ml-1" /> تعطيل</>
            ) : (
              <><UserCheck className="w-4 h-4 ml-1" /> تفعيل</>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
};

export default EmployeeFinancialCenterManager;
