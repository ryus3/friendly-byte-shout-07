// Temporary mock Supabase client to get the app working
export const supabase = {
  from: (table) => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: null }),
    update: () => ({ data: null, error: null }),
    delete: () => ({ data: null, error: null }),
    upsert: () => ({ data: null, error: null }),
    eq: () => ({ data: [], error: null }),
    order: () => ({ data: [], error: null }),
    limit: () => ({ data: [], error: null }),
    range: () => ({ data: [], error: null }),
    filter: () => ({ data: [], error: null }),
    single: () => ({ data: null, error: null })
  }),
  auth: {
    signUp: () => Promise.resolve({ data: null, error: null }),
    signInWithPassword: () => Promise.resolve({ data: null, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: null } }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null })
  },
  rpc: () => Promise.resolve({ data: null, error: null }),
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: null }),
      download: () => Promise.resolve({ data: null, error: null }),
      remove: () => Promise.resolve({ data: null, error: null }),
      list: () => Promise.resolve({ data: [], error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } })
    })
  },
  channel: () => ({
    on: () => ({ subscribe: () => {} }),
    unsubscribe: () => {}
  }),
  removeChannel: () => {}
};

console.log('Mock Supabase client loaded - app should now work');