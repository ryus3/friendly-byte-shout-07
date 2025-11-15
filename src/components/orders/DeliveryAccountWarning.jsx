import React, { useMemo, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * مكون UI Warning لعرض تحذير عند وجود طلبات من حسابات غير متصلة
 * @param {Array} orders - قائمة الطلبات المعروضة
 * @param {string} activePartner - الشركة النشطة ('alwaseet' أو 'modon')
 */
const DeliveryAccountWarning = ({ orders, activePartner }) => {
  const { user } = useAuth();
  const [missingAccounts, setMissingAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // استخراج الحسابات الفريدة من الطلبات المعروضة
  const ordersAccounts = useMemo(() => {
    const accounts = new Set();
    
    orders.forEach(order => {
      if (order.delivery_partner && order.delivery_partner !== 'local') {
        const account = order.delivery_account_used || 'افتراضي';
        const partner = order.delivery_partner;
        accounts.add(`${partner}|||${account}`);
      }
    });
    
    return Array.from(accounts).map(str => {
      const [partner, account] = str.split('|||');
      return { partner, account };
    });
  }, [orders]);

  // فحص وجود توكن صالح لكل حساب
  useEffect(() => {
    const checkAccounts = async () => {
      if (!user?.id || ordersAccounts.length === 0) {
        setMissingAccounts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const missing = [];

      for (const { partner, account } of ordersAccounts) {
        try {
          let query = supabase
            .from('delivery_partner_tokens')
            .select('id, expires_at, is_active, account_username')
            .eq('partner_name', partner)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString());

          if (account !== 'افتراضي') {
            const normalizedAccount = account.trim().toLowerCase().replace(/\s+/g, '-');
            query = query.ilike('account_username', normalizedAccount);
          }

          query = query
            .order('last_used_at', { ascending: false, nullsFirst: false })
            .limit(1);

          const { data, error } = await query.maybeSingle();

          if (error || !data) {
            missing.push({ partner, account });
            continue;
          }
        } catch (err) {
          console.error('خطأ في فحص الحساب:', partner, account, err);
          missing.push({ partner, account });
        }
      }

      setMissingAccounts(missing);
      setLoading(false);
    };

    checkAccounts();
  }, [ordersAccounts, user]);

  // عدم عرض أي شيء إذا لم يكن هناك حسابات مفقودة
  if (loading || missingAccounts.length === 0) {
    return null;
  }

  // تجميع الحسابات المفقودة حسب الشركة
  const missingByPartner = missingAccounts.reduce((acc, { partner, account, expired }) => {
    const partnerName = partner === 'modon' ? 'مدن' : 'الوسيط';
    if (!acc[partnerName]) {
      acc[partnerName] = [];
    }
    acc[partnerName].push({ account, expired });
    return acc;
  }, {});

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>⚠️ تحذير: حسابات غير متصلة</AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-2">
          <p className="font-medium">
            يوجد طلبات من حسابات لم يتم تسجيل الدخول إليها أو منتهية الصلاحية. لن تتم مزامنة هذه الطلبات:
          </p>
          <ul className="list-disc list-inside space-y-1">
            {Object.entries(missingByPartner).map(([partnerName, accounts]) => (
              <li key={partnerName} className="text-sm">
                <strong>{partnerName}:</strong>{' '}
                {accounts.map(({ account, expired }) => (
                  <span key={account} className="mx-1">
                    {account}
                    {expired && <span className="text-destructive font-bold"> (منتهي - يجب تجديده)</span>}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="text-sm mt-3 text-muted-foreground">
            يرجى تسجيل الدخول {missingAccounts.some(a => a.expired) ? 'مجدداً ' : ''}إلى هذه الحسابات من صفحة <strong>تسجيل الدخول لشركة التوصيل</strong>.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default DeliveryAccountWarning;
