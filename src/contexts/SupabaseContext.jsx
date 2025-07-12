import React, { createContext, useContext } from 'react';
import { supabase } from '@/lib/customSupabaseClient.js';

const SupabaseContext = createContext(null);

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};

export const SupabaseProvider = ({ children }) => {
  // Database operations
  const db = {
    // Categories
    categories: {
      async getAll() {
        const { data, error } = await supabase.from('categories').select('*').order('name');
        if (error) throw error;
        return data;
      },
      async create(category) {
        const { data, error } = await supabase.from('categories').insert(category).select().single();
        if (error) throw error;
        return data;
      },
      async update(id, updates) {
        const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
      },
      async delete(id) {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
        return true;
      }
    },

    // Colors
    colors: {
      async getAll() {
        const { data, error } = await supabase.from('colors').select('*').order('name');
        if (error) throw error;
        return data;
      },
      async create(color) {
        const { data, error } = await supabase.from('colors').insert(color).select().single();
        if (error) throw error;
        return data;
      },
      async update(id, updates) {
        const { data, error } = await supabase.from('colors').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
      },
      async delete(id) {
        const { error } = await supabase.from('colors').delete().eq('id', id);
        if (error) throw error;
        return true;
      }
    },

    // Sizes
    sizes: {
      async getAll() {
        const { data, error } = await supabase.from('sizes').select('*').order('name');
        if (error) throw error;
        return data;
      },
      async create(size) {
        const { data, error } = await supabase.from('sizes').insert(size).select().single();
        if (error) throw error;
        return data;
      },
      async update(id, updates) {
        const { data, error } = await supabase.from('sizes').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
      },
      async delete(id) {
        const { error } = await supabase.from('sizes').delete().eq('id', id);
        if (error) throw error;
        return true;
      }
    },

    // Products
    products: {
      async getAll() {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(name),
            variants:product_variants(
              *,
              color:colors(name, hex_code),
              size:sizes(name)
            ),
            inventory(quantity, reserved_quantity, min_stock)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      },
      async getById(id) {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(name),
            variants:product_variants(
              *,
              color:colors(name, hex_code),
              size:sizes(name)
            ),
            inventory(quantity, reserved_quantity, min_stock)
          `)
          .eq('id', id)
          .single();
        if (error) throw error;
        return data;
      },
      async create(product) {
        const { data, error } = await supabase.from('products').insert(product).select().single();
        if (error) throw error;
        return data;
      },
      async update(id, updates) {
        const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
      },
      async delete(id) {
        const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
        if (error) throw error;
        return true;
      }
    },

    // Product Variants
    variants: {
      async create(variant) {
        const { data, error } = await supabase.from('product_variants').insert(variant).select().single();
        if (error) throw error;
        return data;
      },
      async update(id, updates) {
        const { data, error } = await supabase.from('product_variants').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
      },
      async delete(id) {
        const { error } = await supabase.from('product_variants').update({ is_active: false }).eq('id', id);
        if (error) throw error;
        return true;
      }
    },

    // Inventory
    inventory: {
      async getAll() {
        const { data, error } = await supabase
          .from('inventory')
          .select(`
            *,
            product:products(name, barcode),
            variant:product_variants(
              *,
              color:colors(name),
              size:sizes(name)
            )
          `)
          .order('updated_at', { ascending: false });
        if (error) throw error;
        return data;
      },
      async updateStock(productId, variantId, quantity) {
        const { data, error } = await supabase
          .from('inventory')
          .upsert({ 
            product_id: productId, 
            variant_id: variantId, 
            quantity,
            last_updated_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },

    // Customers
    customers: {
      async getAll() {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      },
      async create(customer) {
        const { data, error } = await supabase.from('customers').insert({
          ...customer,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }).select().single();
        if (error) throw error;
        return data;
      },
      async update(id, updates) {
        const { data, error } = await supabase.from('customers').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
    },

    // Orders
    orders: {
      async getAll() {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            customer:customers(name, phone),
            items:order_items(
              *,
              product:products(name),
              variant:product_variants(
                *,
                color:colors(name),
                size:sizes(name)
              )
            ),
            creator:profiles!orders_created_by_fkey(full_name),
            assigned:profiles!orders_assigned_to_fkey(full_name)
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      },
      async create(order) {
        // Generate order number
        const { data: orderNumber } = await supabase.rpc('generate_order_number');
        
        const { data, error } = await supabase.from('orders').insert({
          ...order,
          order_number: orderNumber,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }).select().single();
        if (error) throw error;
        return data;
      },
      async update(id, updates) {
        const { data, error } = await supabase.from('orders').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
      },
      async addItems(orderId, items) {
        const { data, error } = await supabase.from('order_items').insert(
          items.map(item => ({ ...item, order_id: orderId }))
        ).select();
        if (error) throw error;
        return data;
      }
    },

    // Purchases
    purchases: {
      async getAll() {
        const { data, error } = await supabase
          .from('purchases')
          .select(`
            *,
            items:purchase_items(
              *,
              product:products(name),
              variant:product_variants(
                *,
                color:colors(name),
                size:sizes(name)
              )
            ),
            creator:profiles!purchases_created_by_fkey(full_name)
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      },
      async create(purchase) {
        // Generate purchase number
        const { data: purchaseNumber } = await supabase.rpc('generate_purchase_number');
        
        const { data, error } = await supabase.from('purchases').insert({
          ...purchase,
          purchase_number: purchaseNumber,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }).select().single();
        if (error) throw error;
        return data;
      },
      async addItems(purchaseId, items) {
        const { data, error } = await supabase.from('purchase_items').insert(
          items.map(item => ({ ...item, purchase_id: purchaseId }))
        ).select();
        if (error) throw error;
        return data;
      }
    },

    // Profits
    profits: {
      async getByEmployee(employeeId) {
        const { data, error } = await supabase
          .from('profits')
          .select(`
            *,
            order:orders(order_number, customer_name, final_amount),
            employee:profiles!profits_employee_id_fkey(full_name)
          `)
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      },
      async calculateForOrder(orderId) {
        const { error } = await supabase.rpc('calculate_order_profit', { order_id_input: orderId });
        if (error) throw error;
        return true;
      }
    },

    // Notifications
    notifications: {
      async getForUser(userId) {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .or(`user_id.eq.${userId},user_id.is.null`)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      },
      async create(notification) {
        const { data, error } = await supabase.from('notifications').insert(notification).select().single();
        if (error) throw error;
        return data;
      },
      async markAsRead(id) {
        const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
    }
  };

  // Storage operations
  const storage = {
    async uploadProductImage(file, productId) {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(`${productId}/${fileName}`, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path);
      
      return publicUrl;
    },
    
    async uploadAvatar(file, userId) {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(`${userId}/${fileName}`, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);
      
      return publicUrl;
    },

    async deleteFile(bucket, path) {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw error;
      return true;
    }
  };

  const value = {
    supabase,
    db,
    storage
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
};