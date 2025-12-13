/**
 * هوك موحد لجلب الموظفين تحت إشراف مدير القسم
 * يُستخدم في جميع الصفحات التي تحتاج فلترة البيانات حسب الإشراف
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';

export const useSupervisedEmployees = () => {
  const { user } = useAuth();
  const { isAdmin, isDepartmentManager } = usePermissions();
  const [supervisedEmployeeIds, setSupervisedEmployeeIds] = useState([]);
  const [supervisedEmployees, setSupervisedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  // جلب الموظفين تحت الإشراف
  useEffect(() => {
    const fetchSupervisedEmployees = async () => {
      if (!isDepartmentManager || isAdmin || !user?.id) {
        setSupervisedEmployeeIds([]);
        setSupervisedEmployees([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('employee_supervisors')
          .select(`
            employee_id,
            employee:profiles!employee_id (
              user_id,
              full_name,
              email,
              employee_code
            )
          `)
          .eq('supervisor_id', user.id)
          .eq('is_active', true);

        if (error) {
          console.error('خطأ في جلب الموظفين تحت الإشراف:', error);
          return;
        }

        const ids = data?.map(d => d.employee_id) || [];
        const employees = data?.map(d => d.employee) || [];
        
        setSupervisedEmployeeIds(ids);
        setSupervisedEmployees(employees);
      } catch (err) {
        console.error('خطأ غير متوقع:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSupervisedEmployees();
  }, [isDepartmentManager, isAdmin, user?.id]);

  // دالة للتحقق إذا كان المستخدم يستطيع رؤية بيانات موظف معين
  const canViewEmployeeData = useCallback((employeeId) => {
    if (isAdmin) return true;
    if (isDepartmentManager) {
      return employeeId === user?.id || supervisedEmployeeIds.includes(employeeId);
    }
    return employeeId === user?.id;
  }, [isAdmin, isDepartmentManager, user?.id, supervisedEmployeeIds]);

  // دالة لفلترة البيانات حسب created_by
  const filterByCreator = useCallback((data, createdByField = 'created_by') => {
    if (!data || !Array.isArray(data)) return [];
    
    if (isAdmin) return data;
    
    if (isDepartmentManager) {
      return data.filter(item => {
        const creatorId = item[createdByField];
        return creatorId === user?.id || supervisedEmployeeIds.includes(creatorId);
      });
    }
    
    return data.filter(item => item[createdByField] === user?.id);
  }, [isAdmin, isDepartmentManager, user?.id, supervisedEmployeeIds]);

  // دالة لفلترة الإشعارات
  const filterNotifications = useCallback((notifications) => {
    if (!notifications || !Array.isArray(notifications)) return [];
    
    if (isAdmin) return notifications;
    
    if (isDepartmentManager) {
      return notifications.filter(n => {
        // إشعاراته الشخصية
        if (n.user_id === user?.id) return true;
        // إشعارات موظفيه
        if (supervisedEmployeeIds.includes(n.user_id)) return true;
        // الإشعارات العامة (user_id = null)
        if (!n.user_id) return true;
        return false;
      });
    }
    
    // الموظف العادي: إشعاراته فقط + العامة
    return notifications.filter(n => n.user_id === user?.id || !n.user_id);
  }, [isAdmin, isDepartmentManager, user?.id, supervisedEmployeeIds]);

  // جميع المعرفات المسموح بها (الشخص نفسه + الموظفين تحت إشرافه)
  const allowedUserIds = useMemo(() => {
    if (isAdmin) return null; // null يعني الكل
    if (isDepartmentManager) {
      return [user?.id, ...supervisedEmployeeIds].filter(Boolean);
    }
    return [user?.id].filter(Boolean);
  }, [isAdmin, isDepartmentManager, user?.id, supervisedEmployeeIds]);

  return {
    supervisedEmployeeIds,
    supervisedEmployees,
    loading,
    canViewEmployeeData,
    filterByCreator,
    filterNotifications,
    allowedUserIds,
    isAdmin,
    isDepartmentManager
  };
};

export default useSupervisedEmployees;
