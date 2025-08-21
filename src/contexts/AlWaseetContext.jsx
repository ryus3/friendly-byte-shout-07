
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './UnifiedAuthContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';

const AlWaseetContext = createContext();

export const useAlWaseet = () => useContext(AlWaseetContext);

export const AlWaseetProvider = ({ children }) => {
  const { user } = useAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [waseetUser, setWaseetUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePartner, setActivePartner] = useLocalStorage('active_delivery_partner', 'alwaseet');
  const [syncInterval, setSyncInterval] = useLocalStorage('sync_interval', 3600000); // Default to 1 hour

  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [packageSizes, setPackageSizes] = useState([]);

  const deliveryPartners = {
    local: { name: "توصيل محلي", api: null },
    alwaseet: { name: "الوسيط", api: "https://api.alwaseet-iq.net/v1/merchant" },
  };

  const fetchToken = useCallback(async () => {
    if (user) {
      const { data, error } = await supabase
        .from('delivery_partner_tokens')
        .select('token, expires_at, partner_data')
        .eq('user_id', user.id)
        .eq('partner_name', 'alwaseet')
        .maybeSingle();

      if (error) {
        console.error('Error fetching Al-Waseet token:', error.message);
        setToken(null);
        setWaseetUser(null);
        setIsLoggedIn(false);
        return;
      }

      if (data && new Date(data.expires_at) > new Date()) {
        setToken(data.token);
        setWaseetUser(data.partner_data);
        setIsLoggedIn(true);
      } else {
        if (data) {
            await supabase.from('delivery_partner_tokens').delete().match({ user_id: user.id, partner_name: 'alwaseet' });
            toast({ 
              title: "انتهت صلاحية التوكن", 
              description: "يجب تسجيل الدخول مرة أخرى لشركة التوصيل.", 
              variant: "destructive" 
            });
        }
        setToken(null);
        setWaseetUser(null);
        setIsLoggedIn(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const login = useCallback(async (username, password, partner = 'alwaseet') => {
    if (partner === 'local') {
        setActivePartner('local');
        setIsLoggedIn(false);
        setToken(null);
        setWaseetUser(null);
        toast({ title: "تم التفعيل", description: "تم تفعيل وضع التوصيل المحلي." });
        return { success: true };
    }

    setLoading(true);
    try {
      const { data, error: proxyError } = await supabase.functions.invoke('alwaseet-proxy', {
        body: {
          endpoint: 'login',
          method: 'POST',
          payload: { username, password }
        }
      });

      if (proxyError) {
        const errorBody = await proxyError.context.json();
        throw new Error(errorBody.msg || 'فشل الاتصال بالخادم الوكيل.');
      }
      
      if (data.errNum !== "S000" || !data.status) {
        throw new Error(data.msg || 'فشل تسجيل الدخول. تحقق من اسم المستخدم وكلمة المرور.');
      }

      const tokenData = data.data;
      const expires_at = new Date();
      // Token validity: 7 days (604800 seconds) as requested
      expires_at.setSeconds(expires_at.getSeconds() + 604800);

      const partnerData = { username };

      // حفظ التوكن في قاعدة البيانات مع معالجة تضارب المفاتيح
      let dbError = null;
      
      try {
        const { error } = await supabase
          .from('delivery_partner_tokens')
          .upsert({
            user_id: user.id,
            partner_name: partner,
            token: tokenData.token,
            expires_at: expires_at.toISOString(),
            partner_data: partnerData,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id, partner_name' });
        dbError = error;
      } catch (error) {
        dbError = error;
      }

      // في حالة وجود خطأ تضارب، احذف السجل القديم وأدرج الجديد
      if (dbError && dbError.code === '23505') {
        await supabase
          .from('delivery_partner_tokens')
          .delete()
          .eq('user_id', user.id)
          .eq('partner_name', partner);
          
        const { error: insertError } = await supabase
          .from('delivery_partner_tokens')
          .insert({
            user_id: user.id,
            partner_name: partner,
            token: tokenData.token,
            expires_at: expires_at.toISOString(),
            partner_data: partnerData,
            is_active: true
          });
          
        if (insertError) {
          console.error('خطأ في إدراج التوكن الجديد:', insertError);
          throw new Error('فشل في حفظ بيانات تسجيل الدخول');
        }
      } else if (dbError) {
        console.error('خطأ في حفظ التوكن:', dbError);
        throw new Error('فشل في حفظ بيانات تسجيل الدخول: ' + dbError.message);
      }

      setToken(tokenData.token);
      setWaseetUser(partnerData);
      setIsLoggedIn(true);
      setActivePartner(partner);
      toast({ title: "نجاح", description: `تم تسجيل الدخول بنجاح في ${deliveryPartners[partner].name}.` });
      return { success: true };
    } catch (error) {
      toast({ title: "خطأ في تسجيل الدخول", description: error.message, variant: "destructive" });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [setActivePartner, user, deliveryPartners]);

  const logout = useCallback(async () => {
    const partnerName = deliveryPartners[activePartner]?.name || 'شركة التوصيل';
    
    if (user && activePartner !== 'local') {
      await supabase
        .from('delivery_partner_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('partner_name', activePartner);
    }

    setIsLoggedIn(false);
    setToken(null);
    setWaseetUser(null);
    setCities([]);
    setRegions([]);
    setPackageSizes([]);
    setActivePartner('alwaseet');
    toast({ title: "تم تسجيل الخروج", description: `تم تسجيل الخروج من ${partnerName}.` });
  }, [activePartner, deliveryPartners, user, setActivePartner]);
  
  const syncOrders = async () => {
    if (activePartner === 'local' || !isLoggedIn || !token) {
        toast({ title: "غير متاح", description: "مزامنة الطلبات متاحة فقط عند تسجيل الدخول لشركة توصيل." });
        return [];
    }
    
    try {
      setLoading(true);
      const orders = await AlWaseetAPI.getMerchantOrders(token);
      toast({ 
        title: "مزامنة الطلبات", 
        description: `تم جلب ${orders.length} طلب من شركة التوصيل`,
        variant: "success"
      });
      return orders;
    } catch (error) {
      toast({ 
        title: "خطأ في المزامنة", 
        description: error.message, 
        variant: "destructive" 
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getMerchantOrders = useCallback(async () => {
    if (token) {
      try {
        const orders = await AlWaseetAPI.getMerchantOrders(token);
        return { success: true, data: orders };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
    return { success: false, message: "لم يتم تسجيل الدخول لشركة التوصيل." };
  }, [token]);

  const getOrderStatuses = useCallback(async () => {
    if (token) {
      try {
        const statuses = await AlWaseetAPI.getOrderStatuses(token);
        return { success: true, data: statuses };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
    return { success: false, message: "لم يتم تسجيل الدخول لشركة التوصيل." };
  }, [token]);

  const fetchCities = useCallback(async () => {
    if (token) {
      try {
        const data = await AlWaseetAPI.getCities(token);
        if (Array.isArray(data)) {
          setCities(data);
        } else if (typeof data === 'object' && data !== null) {
          setCities(Object.values(data));
        } else {
          setCities([]);
        }
      } catch (error) {
        toast({ title: "خطأ", description: `فشل جلب المدن: ${error.message}`, variant: "destructive" });
        setCities([]);
      }
    }
  }, [token]);

  const fetchRegions = useCallback(async (cityId) => {
    if (token && cityId) {
      try {
        const data = await AlWaseetAPI.getRegionsByCity(token, cityId);
        if (Array.isArray(data)) {
          setRegions(data);
        } else if (typeof data === 'object' && data !== null) {
          setRegions(Object.values(data));
        } else {
          setRegions([]);
        }
      } catch (error) {
        toast({ title: "خطأ", description: `فشل جلب المناطق: ${error.message}`, variant: "destructive" });
        setRegions([]);
      }
    }
  }, [token]);

  const fetchPackageSizes = useCallback(async () => {
    if (token) {
      try {
        const data = await AlWaseetAPI.getPackageSizes(token);
        if (Array.isArray(data)) {
          setPackageSizes(data);
        } else if (typeof data === 'object' && data !== null) {
          setPackageSizes(Object.values(data));
        } else {
          setPackageSizes([]);
        }
      } catch (error) {
        toast({ title: "خطأ", description: `فشل جلب أحجام الطرود: ${error.message}`, variant: "destructive" });
        setPackageSizes([]);
      }
    }
  }, [token]);

  const createOrder = useCallback(async (orderData) => {
    if (token) {
      try {
        const result = await AlWaseetAPI.createAlWaseetOrder(orderData, token);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
    return { success: false, message: "لم يتم تسجيل الدخول لشركة التوصيل." };
  }, [token]);

  const editOrder = useCallback(async (orderData) => {
    if (token) {
      try {
        const result = await AlWaseetAPI.editAlWaseetOrder(orderData, token);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
    return { success: false, message: "لم يتم تسجيل الدخول لشركة التوصيل." };
  }, [token]);

  useEffect(() => {
    if (isLoggedIn && activePartner === 'alwaseet') {
      fetchCities();
      fetchPackageSizes();
    }
  }, [isLoggedIn, activePartner, fetchCities, fetchPackageSizes]);

  // Auto-fetch cities when token is available (even if not fully logged in)
  useEffect(() => {
    if (token && cities.length === 0) {
      fetchCities();
    }
    if (token && packageSizes.length === 0) {
      fetchPackageSizes();
    }
  }, [token, cities.length, packageSizes.length, fetchCities, fetchPackageSizes]);

  useEffect(() => {
    let intervalId;
    if (syncInterval > 0 && isLoggedIn && activePartner !== 'local') {
      intervalId = setInterval(() => {
        console.log('Automatic order sync triggered.');
        syncOrders();
      }, syncInterval);
    }
    return () => clearInterval(intervalId);
  }, [syncInterval, isLoggedIn, activePartner]);

  const value = {
    isLoggedIn,
    token,
    waseetToken: token, // Alias for compatibility
    waseetUser,
    loading,
    login,
    logout,
    activePartner,
    setActivePartner,
    deliveryPartners,
    syncOrders,
    syncInterval,
    setSyncInterval,
    fetchToken,
    cities,
    regions,
    packageSizes,
    fetchCities,
    fetchRegions,
    fetchPackageSizes,
    createAlWaseetOrder: createOrder,
    editAlWaseetOrder: editOrder,
    getMerchantOrders,
    getOrderStatuses,
  };

  return (
    <AlWaseetContext.Provider value={value}>
      {children}
    </AlWaseetContext.Provider>
  );
};
