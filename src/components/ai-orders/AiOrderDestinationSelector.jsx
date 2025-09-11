import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Truck, Server, CheckCircle } from 'lucide-react';

const AiOrderDestinationSelector = ({ value, onChange, className }) => {
  const { 
    deliveryPartners, 
    activePartner, 
    isLoggedIn, 
    getUserDeliveryAccounts 
  } = useAlWaseet();
  const { user } = useAuth();
  
  const [userAccounts, setUserAccounts] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(value || 'local');
  const [selectedAccount, setSelectedAccount] = useState('');

  // تحميل حسابات المستخدم والتفضيلات
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.user_id) return;

      try {
        // جلب التفضيلات من الملف الشخصي
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_ai_order_destination, selected_delivery_account')
          .eq('user_id', user.user_id)
          .single();

        if (profile) {
          setSelectedDestination(profile.default_ai_order_destination || 'local');
          setSelectedAccount(profile.selected_delivery_account || '');
        }

        // جلب حسابات شركات التوصيل
        if (activePartner && activePartner !== 'local') {
          const accounts = await getUserDeliveryAccounts(user.user_id, activePartner);
          setUserAccounts(accounts);
          
          // إذا لم يكن هناك حساب محدد، استخدم الافتراضي
          if (!profile?.selected_delivery_account && accounts.length > 0) {
            const defaultAccount = accounts.find(acc => acc.is_default) || accounts[0];
            setSelectedAccount(defaultAccount.account_username);
          }
        }
      } catch (error) {
        console.error('خطأ في تحميل بيانات المستخدم:', error);
      }
    };

    loadUserData();
  }, [user?.user_id, activePartner, getUserDeliveryAccounts]);

  // حفظ التفضيلات في قاعدة البيانات
  const savePreferences = async (destination, account = selectedAccount) => {
    if (!user?.user_id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          default_ai_order_destination: destination,
          selected_delivery_account: account
        })
        .eq('user_id', user.user_id);

      if (error) throw error;
      
      // إشعار التحديث للنظام
      onChange?.({
        destination,
        account,
        partnerName: destination === 'local' ? 'local' : activePartner
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
    await savePreferences(newDestination, selectedAccount);
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

    const isConnected = activePartner === key && isLoggedIn;
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
          <SelectContent>
            {Object.entries(deliveryPartners).map(([key, partner]) => (
              <SelectItem key={key} value={key}>
                {renderDestinationOption(key, partner)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* منسدلة الحسابات - تظهر فقط لشركات التوصيل */}
      {selectedDestination !== 'local' && userAccounts.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">الحساب المستخدم</Label>
          <Select value={selectedAccount} onValueChange={handleAccountChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="اختر حساب..." />
            </SelectTrigger>
            <SelectContent>
              {userAccounts.map((account) => (
                <SelectItem key={account.account_username} value={account.account_username}>
                  <div className="flex items-center gap-2">
                    <span>{account.partner_data?.username || account.account_username}</span>
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
        </div>
      )}

      {/* معلومات الحالة */}
      <div className="text-xs text-muted-foreground">
        {selectedDestination === 'local' ? (
          <span>سيتم إنشاء الطلبات محلياً في النظام</span>
        ) : (
          <span>
            سيتم إنشاء الطلبات عبر {deliveryPartners[selectedDestination]?.name}
            {selectedAccount && ` - الحساب: ${selectedAccount}`}
          </span>
        )}
      </div>
    </div>
  );
};

export default AiOrderDestinationSelector;