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
          console.log(`🔍 [DeliveryAccountWarning] فحص الحساب: ${partner} - ${account}`);
          
          let query = supabase
            .from('delivery_partner_tokens')
            .select('id, expires_at, is_active, account_username, user_id')
            .eq('partner_name', partner)
            .eq('is_active', true)
            .eq('user_id', user.id) // ✅ فحص توكنات المستخدم الحالي فقط
            .gt('expires_at', new Date().toISOString());

          if (account !== 'افتراضي') {
            const normalizedAccount = account
              .trim()
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w-]/g, ''); // إزالة أي أحرف خاصة
            console.log(`   - البحث عن: "${normalizedAccount}"`);
            query = query.ilike('account_username', normalizedAccount);
          }

          query = query
            .order('last_used_at', { ascending: false, nullsFirst: false })
            .limit(1);

          const { data, error } = await query.maybeSingle();

          console.log(`   - النتيجة:`, { 
            found: !!data, 
            error: error?.message,
            account_username: data?.account_username,
            expires_at: data?.expires_at
          });

          if (error || !data) {
            // ✅ إذا لم يُعثر على توكن للحساب المحدد، ابحث عن أي توكن صالح للشركة
            if (account !== 'افتراضي') {
              console.log(`   - 🔄 محاولة البحث عن توكن افتراضي للشركة ${partner}...`);
              
            const { data: defaultToken } = await supabase
              .from('delivery_partner_tokens')
              .select('id, expires_at, is_active, account_username')
              .eq('partner_name', partner)
              .eq('is_active', true)
              .eq('user_id', user.id)
              .gt('expires_at', new Date().toISOString())
              .order('last_used_at', { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle();
              
              if (defaultToken) {
                console.log(`   - ✅ تم العثور على توكن افتراضي: ${defaultToken.account_username}`);
                continue; // لا تعتبره مفقوداً
              }
            }
            
            console.log(`   - ❌ لم يتم العثور على توكن صالح للحساب أو الشركة`);
            missing.push({ partner, account });
            continue;
          }
          
          console.log(`   - ✅ توكن صالح موجود:`, {
            account_username: data.account_username,
            expires_at: data.expires_at
          });
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
            يوجد طلبات من حسابات لم يتم تسجيل الدخول إليها أو منتهية الصلاحية:
          </p>
          <ul className="list-disc list-inside space-y-1">
            {Object.entries(missingByPartner).map(([partnerName, accounts]) => (
              <li key={partnerName} className="text-sm">
                <strong>{partnerName}:</strong>{' '}
                {accounts.map(({ account }) => (
                  <span key={account} className="mx-1 font-mono bg-muted px-2 py-1 rounded">
                    {account}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="text-sm mt-3 text-muted-foreground">
            💡 <strong>ملاحظة:</strong> إذا كانت هذه الحسابات تابعة لموظفين، يجب عليهم تسجيل الدخول بأنفسهم.
            <br />
            إذا كانت حساباتك أنت، يرجى تسجيل الدخول من صفحة <strong>تسجيل الدخول لشركة التوصيل</strong>.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default DeliveryAccountWarning;
