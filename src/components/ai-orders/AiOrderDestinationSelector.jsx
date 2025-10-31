import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Truck, Server, CheckCircle } from 'lucide-react';

const AiOrderDestinationSelector = ({ value, onChange, className, hideLocal = false }) => {
  const { 
    deliveryPartners, 
    activePartner, 
    isLoggedIn, 
    getUserDeliveryAccounts,
    hasValidToken
  } = useAlWaseet();
  const { user } = useAuth();
  
  const [userAccounts, setUserAccounts] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState('local');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [partnerConnectedMap, setPartnerConnectedMap] = useState({});

  // Sync with external value prop
  useEffect(() => {
    if (value) {
      if (typeof value === 'string') {
        setSelectedDestination(value);
      } else if (typeof value === 'object' && value.destination) {
        setSelectedDestination(value.destination);
        setSelectedAccount(value.account || '');
      }
    }
  }, [value]);

  // إذا كان 'local' مخفي والوجهة الحالية 'local'، اختر أول شريك توصيل
  useEffect(() => {
    if (hideLocal && selectedDestination === 'local') {
      const firstDeliveryPartner = Object.keys(deliveryPartners).find(key => key !== 'local');
      if (firstDeliveryPartner) {
        handleDestinationChange(firstDeliveryPartner);
      }
    }
  }, [hideLocal, selectedDestination, deliveryPartners]);

  // تحميل حسابات المستخدم والتفضيلات
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.user_id) return;

      try {
        // جلب التفضيلات من الملف الشخصي
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_ai_order_destination, selected_delivery_account, selected_delivery_partner')
          .eq('user_id', user.user_id)
          .single();

        if (profile) {
          const destination = profile.default_ai_order_destination || 'local';
          const account = profile.selected_delivery_account || '';
          
          setSelectedDestination(destination);
          setSelectedAccount(account);
          
          // Fire onChange immediately with loaded preferences if no external value
          if (!value) {
            onChange?.({
              destination,
              account,
              partnerName: destination
            });
          }
        }

        // جلب حسابات شركات التوصيل للوجهة المختارة
        if (selectedDestination && selectedDestination !== 'local') {
          const accounts = await getUserDeliveryAccounts(user.user_id, selectedDestination);
          setUserAccounts(accounts);
          
          // إذا لم يكن هناك حساب محدد، استخدم الافتراضي
          if (!profile?.selected_delivery_account && accounts.length > 0) {
            const defaultAccount = accounts.find(acc => acc.is_default) || accounts[0];
            setSelectedAccount(defaultAccount.account_username);
          }
        } else {
          setUserAccounts([]);
          setSelectedAccount('');
        }
      } catch (error) {
        console.error('خطأ في تحميل بيانات المستخدم:', error);
      }
    };

    loadUserData();
  }, [user?.user_id, selectedDestination, getUserDeliveryAccounts]);

  // حساب حالة الاتصال لكل شريك (مرة واحدة لكل تحميل/تغير المستخدم)
  useEffect(() => {
    if (!user?.user_id) return;
    const computeConnections = async () => {
      const entries = await Promise.all(
        Object.keys(deliveryPartners).filter(k => k !== 'local').map(async (key) => {
          try {
            const ok = await hasValidToken(key);
            return [key, !!ok];
          } catch {
            return [key, false];
          }
        })
      );
      setPartnerConnectedMap(Object.fromEntries(entries));
    };
    computeConnections();
  }, [user?.user_id, deliveryPartners, hasValidToken]);
  // حفظ التفضيلات في قاعدة البيانات
  const savePreferences = async (destination, account = selectedAccount) => {
    if (!user?.user_id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          default_ai_order_destination: destination,
          selected_delivery_account: account,
          selected_delivery_partner: destination
        })
        .eq('user_id', user.user_id);

      if (error) throw error;
      
      // إشعار التحديث للنظام فورا قبل الحفظ
      onChange?.({
        destination,
        account,
        partnerName: destination
      });
    } catch (error) {
      console.error('خطأ في حفظ التفضيلات:', error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ التفضيلات",
        variant: "destructive"
      });
    }
  };

  const handleDestinationChange = async (newDestination) => {
    setSelectedDestination(newDestination);
    
    // إعادة تعيين الحساب المختار عند تغيير الوجهة
    setSelectedAccount('');
    setUserAccounts([]);
    
    // جلب حسابات الوجهة الجديدة
    if (newDestination !== 'local') {
      const accounts = await getUserDeliveryAccounts(user.user_id, newDestination);
      setUserAccounts(accounts);
      
      // اختيار الحساب الافتراضي تلقائياً
      if (accounts.length > 0) {
        const defaultAccount = accounts.find(acc => acc.is_default) || accounts[0];
        setSelectedAccount(defaultAccount.account_username);
        await savePreferences(newDestination, defaultAccount.account_username);
      } else {
        await savePreferences(newDestination, '');
      }
    } else {
      await savePreferences(newDestination, '');
    }
  };

  const handleAccountChange = async (newAccount) => {
    setSelectedAccount(newAccount);
    await savePreferences(selectedDestination, newAccount);
  };

  const renderDestinationOption = (key, partner) => {
    if (key === 'local') {
      return (
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-500" />
          <span>{partner.name}</span>
        </div>
      );
    }

  // تحسين منطق تحديد حالة الاتصال - استخدام خريطة الاتصال المحسوبة
  const isConnected = !!partnerConnectedMap[key];
  return (
    <div className="flex items-center gap-2">
      <Truck className={`w-4 h-4 ${isConnected ? 'text-green-500' : 'text-gray-400'}`} />
      <span>{partner.name}</span>
      {isConnected && <CheckCircle className="w-3 h-3 text-green-500" />}
    </div>
  );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-2">
        <Label className="text-sm font-medium">وجهة إنشاء الطلب</Label>
        <Select value={selectedDestination} onValueChange={handleDestinationChange}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-800 shadow-lg border border-border z-[2000]">
            {Object.entries(deliveryPartners)
              .filter(([key]) => !hideLocal || key !== 'local')
              .map(([key, partner]) => (
                <SelectItem key={key} value={key}>
                  {renderDestinationOption(key, partner)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* منسدلة الحسابات - تظهر فقط لشركات التوصيل */}
      {selectedDestination !== 'local' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">الحساب المستخدم</Label>
            {userAccounts.length === 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  // فتح نافذة إدارة شركات التوصيل (يمكن تمريرها كخاصية)
                  toast({
                    title: "لا توجد حسابات محفوظة",
                    description: "يرجى إضافة حساب في إدارة شركات التوصيل أولاً",
                    variant: "destructive"
                  });
                }}
                className="h-7 px-3 text-xs"
              >
                إدارة الحسابات
              </Button>
            )}
          </div>
          {userAccounts.length > 0 ? (
            <Select value={selectedAccount} onValueChange={handleAccountChange}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="اختر حساب..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 shadow-lg border border-border z-[2000]">
                {userAccounts.map((account) => (
                  <SelectItem key={account.account_username} value={account.account_username}>
                    <div className="flex items-center gap-2">
                      <span>{account.account_label || account.partner_data?.username || account.account_username}</span>
                      {account.is_default && (
                        <span className="text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded">
                          افتراضي
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-3 text-center">
              لا توجد حسابات محفوظة لـ {deliveryPartners[selectedDestination]?.name}
              <br />
              يرجى إضافة حساب في إدارة شركات التوصيل أولاً
            </div>
          )}
        </div>
      )}

      {/* معلومات الحالة */}
      <div className="text-xs text-muted-foreground">
        {selectedDestination === 'local' ? (
          <span>سيتم إنشاء الطلبات محلياً في النظام</span>
        ) : selectedAccount ? (
          <span>
            سيتم إنشاء الطلبات عبر {deliveryPartners[selectedDestination]?.name}
            {selectedAccount && ` - الحساب: ${
              userAccounts.find(acc => acc.account_username === selectedAccount)?.account_label ||
              userAccounts.find(acc => acc.account_username === selectedAccount)?.partner_data?.username ||
              selectedAccount
            }`}
          </span>
        ) : (
          <span className="text-orange-600">
            تم اختيار {deliveryPartners[selectedDestination]?.name} ولكن لا يوجد حساب محدد
          </span>
        )}
      </div>
    </div>
  );
};

export default AiOrderDestinationSelector;