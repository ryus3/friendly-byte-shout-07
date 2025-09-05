import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook موحد لإدارة حسابات التوصيل المنفصلة للموظفين
 * يسمح بفصل كامل لحسابات الوسيط وضمان عدم تداخل البيانات
 */
export const useEmployeeDeliveryAccounts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserAccount, setCurrentUserAccount] = useState(null);

  // جلب جميع حسابات التوصيل (للمدير) أو حساب المستخدم الحالي فقط
  const fetchDeliveryAccounts = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('employee_delivery_accounts')
        .select('*');
      
      // إذا لم يكن مدير، احضر حسابه فقط
      if (user.email !== 'ryusbrand@gmail.com' && user.id !== '91484496-b887-44f7-9e5d-be9db5567604') {
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('خطأ جلب حسابات التوصيل:', error);
        toast({
          title: "خطأ",
          description: "فشل جلب حسابات التوصيل",
          variant: "destructive"
        });
        return;
      }
      
      setAccounts(data || []);
      
      // تحديد حساب المستخدم الحالي
      const userAccount = data?.find(acc => acc.user_id === user.id && acc.is_active);
      setCurrentUserAccount(userAccount || null);
      
    } catch (error) {
      console.error('خطأ غير متوقع:', error);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // الحصول على توكن موظف محدد
  const getEmployeeToken = useCallback((userId) => {
    if (!userId) return null;
    
    const account = accounts.find(acc => 
      acc.user_id === userId && 
      acc.is_active && 
      acc.delivery_partner === 'alwaseet'
    );
    
    return account?.partner_data?.token || null;
  }, [accounts]);

  // الحصول على توكن المستخدم الحالي
  const getCurrentUserToken = useCallback(() => {
    return getEmployeeToken(user?.id);
  }, [getEmployeeToken, user?.id]);

  // حفظ/تحديث حساب التوصيل للمستخدم الحالي
  const saveDeliveryAccount = useCallback(async (accountData) => {
    if (!user?.id) return { success: false, error: 'المستخدم غير مسجل الدخول' };
    
    try {
      const dataToSave = {
        user_id: user.id,
        delivery_partner: 'alwaseet',
        account_code: accountData.account_code,
        account_name: accountData.account_name || accountData.account_code,
        partner_data: {
          token: accountData.token,
          username: accountData.username || accountData.account_code,
          last_verified: new Date().toISOString()
        },
        is_active: true
      };

      const { data, error } = await supabase
        .from('employee_delivery_accounts')
        .upsert(dataToSave, {
          onConflict: 'user_id,delivery_partner,account_code'
        })
        .select()
        .single();

      if (error) throw error;

      // تحديث الحالة المحلية
      await fetchDeliveryAccounts();
      
      toast({
        title: "نجح الحفظ",
        description: "تم حفظ حساب التوصيل بنجاح"
      });

      return { success: true, data };
    } catch (error) {
      console.error('خطأ حفظ حساب التوصيل:', error);
      toast({
        title: "خطأ",
        description: `فشل حفظ حساب التوصيل: ${error.message}`,
        variant: "destructive"
      });
      return { success: false, error: error.message };
    }
  }, [user, fetchDeliveryAccounts, toast]);

  // تحديد ما إذا كان المستخدم لديه حساب توصيل نشط
  const hasActiveAccount = useCallback(() => {
    return !!currentUserAccount;
  }, [currentUserAccount]);

  // تحديد ما إذا كان المستخدم لديه صلاحية الوصول لحساب معين
  const canAccessAccount = useCallback((accountUserId) => {
    // المدير يصل لجميع الحسابات
    if (user?.email === 'ryusbrand@gmail.com' || user?.id === '91484496-b887-44f7-9e5d-be9db5567604') {
      return true;
    }
    // المستخدم يصل لحسابه فقط
    return accountUserId === user?.id;
  }, [user]);

  // جلب إحصائيات الحسابات
  const getAccountsStats = useCallback(() => {
    return {
      total: accounts.length,
      active: accounts.filter(acc => acc.is_active).length,
      hasCurrentUserAccount: hasActiveAccount(),
      currentUserAccountCode: currentUserAccount?.account_code || null
    };
  }, [accounts, hasActiveAccount, currentUserAccount]);

  useEffect(() => {
    fetchDeliveryAccounts();
  }, [fetchDeliveryAccounts]);

  return {
    // البيانات
    accounts,
    currentUserAccount,
    loading,
    
    // الدوال الأساسية
    getEmployeeToken,
    getCurrentUserToken,
    saveDeliveryAccount,
    fetchDeliveryAccounts,
    
    // دوال التحقق
    hasActiveAccount,
    canAccessAccount,
    getAccountsStats,
    
    // البيانات المحسوبة
    isCurrentUserConnected: hasActiveAccount(),
    currentUserToken: getCurrentUserToken()
  };
};

export default useEmployeeDeliveryAccounts;