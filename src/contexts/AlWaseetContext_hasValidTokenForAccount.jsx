// ✅ دالة مساعدة للتحقق من وجود توكن صالح لحساب محدد
// يتم استيرادها في AlWaseetContext.jsx واستخدامها في UI Warning

import { supabase } from '@/integrations/supabase/client';

/**
 * التحقق من وجود توكن صالح (غير منتهي) لحساب محدد
 * @param {string} accountUsername - اسم الحساب (مثل: "seller1", "seller2")
 * @param {string} partnerName - اسم الشركة ("alwaseet" أو "modon")
 * @param {string} userId - معرف المستخدم (اختياري)
 * @returns {Promise<boolean>} - true إذا وجد توكن صالح، false خلاف ذلك
 */
export const hasValidTokenForAccount = async (accountUsername, partnerName, userId = null) => {
  if (!accountUsername || !partnerName) return false;
  
  try {
    const normalizedAccount = accountUsername.trim().toLowerCase().replace(/\s+/g, '-');
    
    let query = supabase
      .from('delivery_partner_tokens')
      .select('id, expires_at, is_active')
      .eq('partner_name', partnerName)
      .ilike('account_username', normalizedAccount)
      .eq('is_active', true);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error || !data) return false;
    
    // التحقق من انتهاء الصلاحية
    if (data.expires_at) {
      const expiryDate = new Date(data.expires_at);
      if (expiryDate < new Date()) {
        return false; // منتهي الصلاحية
      }
    }
    
    return true;
  } catch (error) {
    console.error('خطأ في hasValidTokenForAccount:', error);
    return false;
  }
};
