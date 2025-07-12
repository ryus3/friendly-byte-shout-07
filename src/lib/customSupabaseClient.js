import { createClient } from '@supabase/supabase-js';

// تعديل للوضع المحلي - عدم الاتصال بقاعدة بيانات خارجية
const supabaseUrl = '';
const supabaseAnonKey = '';

// إنشاء عميل محلي وهمي لتجنب الأخطاء
export const supabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'الرجاء ربط Supabase أولاً' } }),
    signUp: () => Promise.resolve({ data: null, error: { message: 'الرجاء ربط Supabase أولاً' } }),
    signOut: () => Promise.resolve({ error: null }),
    resetPasswordForEmail: () => Promise.resolve({ error: { message: 'الرجاء ربط Supabase أولاً' } }),
    updateUser: () => Promise.resolve({ error: { message: 'الرجاء ربط Supabase أولاً' } })
  },
  from: () => ({
    select: () => ({
      eq: () => ({ data: [], error: null }),
      order: () => ({ data: [], error: null }),
      single: () => ({ data: null, error: null })
    }),
    insert: () => ({ data: null, error: { message: 'الرجاء ربط Supabase أولاً' } }),
    update: () => ({ data: null, error: { message: 'الرجاء ربط Supabase أولاً' } }),
    delete: () => ({ data: null, error: { message: 'الرجاء ربط Supabase أولاً' } }),
    upsert: () => ({ data: null, error: { message: 'الرجاء ربط Supabase أولاً' } })
  }),
  rpc: () => Promise.resolve({ data: null, error: { message: 'الرجاء ربط Supabase أولاً' } }),
  functions: {
    invoke: () => Promise.resolve({ data: null, error: { message: 'الرجاء ربط Supabase أولاً' } })
  },
  channel: () => ({
    on: () => ({}),
    subscribe: () => ({}),
    unsubscribe: () => ({})
  }),
  removeChannel: () => {}
};

console.warn('تم تعديل العميل للوضع المحلي. لتفعيل الميزات الكاملة، يرجى ربط مشروع Supabase.');