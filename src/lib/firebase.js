// ملف Firebase معطل للوضع المحلي
// تم إزالة الاتصال الخارجي لتجنب الأخطاء

// عملاء وهميين للوضع المحلي
export const app = null;
export const auth = {
  currentUser: null,
  signInWithEmailAndPassword: () => Promise.reject(new Error('Firebase غير متصل')),
  signOut: () => Promise.resolve(),
  onAuthStateChanged: () => () => {}
};

export const db = {
  collection: () => ({
    doc: () => ({
      get: () => Promise.resolve({ exists: false }),
      set: () => Promise.reject(new Error('Firebase غير متصل')),
      update: () => Promise.reject(new Error('Firebase غير متصل'))
    }),
    add: () => Promise.reject(new Error('Firebase غير متصل')),
    where: () => ({
      get: () => Promise.resolve({ empty: true, docs: [] })
    })
  })
};

export const storage = {
  ref: () => ({
    putString: () => Promise.reject(new Error('Firebase غير متصل')),
    getDownloadURL: () => Promise.reject(new Error('Firebase غير متصل'))
  })
};

console.warn('Firebase في الوضع المحلي. لتفعيل الميزات، يرجى إعداد Firebase أو استخدام Supabase.');