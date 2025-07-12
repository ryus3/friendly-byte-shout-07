
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const VariantsContext = createContext();

export const useVariants = () => useContext(VariantsContext);

export const VariantsProvider = ({ children }) => {
  const [categories, setCategories] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (table, setter) => {
    const orderBy = table === 'sizes' ? 'display_order' : 'name';
    const { data, error } = await supabase.from(table).select('*').order(orderBy);
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      toast({ title: `فشل تحميل ${table}`, description: error.message, variant: 'destructive' });
    } else {
      setter(data || []);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchData('categories', setCategories),
      fetchData('colors', setColors),
      fetchData('sizes', setSizes),
    ]);
    setLoading(false);
  }, [fetchData]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addVariant = async (table, data) => {
    const { data: result, error } = await supabase.from(table).insert(data).select().single();
    if (error) {
      toast({ title: "فشل الإضافة", description: error.message, variant: 'destructive' });
      return { success: false };
    }
    await refreshData();
    return { success: true, data: result };
  };

  const updateVariant = async (table, id, data) => {
    const { error } = await supabase.from(table).update(data).eq('id', id);
    if (error) {
      toast({ title: "فشل التحديث", description: error.message, variant: 'destructive' });
      return { success: false };
    }
    await refreshData();
    return { success: true };
  };

  const deleteVariant = async (table, id) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      toast({ title: "فشل الحذف", description: error.message, variant: 'destructive' });
      return { success: false };
    }
    await refreshData();
    return { success: true };
  };

  const updateVariantOrder = async (table, orderedItems) => {
    const updates = orderedItems.map((item, index) => 
      supabase.from(table).update({ display_order: index }).eq('id', item.id)
    );
    const results = await Promise.all(updates);
    const hasError = results.some(res => res.error);
    if (hasError) {
      toast({ title: "فشل تحديث الترتيب", variant: 'destructive' });
    }
    await refreshData();
  };

  const value = {
    categories,
    colors,
    sizes,
    loading,
    refreshData,
    addCategory: (data) => addVariant('categories', data),
    updateCategory: (id, data) => updateVariant('categories', id, data),
    deleteCategory: (id) => deleteVariant('categories', id),
    updateCategoryOrder: (items) => updateVariantOrder('categories', items),
    
    addColor: (data) => addVariant('colors', data),
    updateColor: (id, data) => updateVariant('colors', id, data),
    deleteColor: (id) => deleteVariant('colors', id),
    updateColorOrder: (items) => updateVariantOrder('colors', items),

    addSize: (data) => addVariant('sizes', data),
    updateSize: (id, data) => updateVariant('sizes', id, data),
    deleteSize: (id) => deleteVariant('sizes', id),
    updateSizeOrder: (items) => updateVariantOrder('sizes', items),
  };

  return <VariantsContext.Provider value={value}>{children}</VariantsContext.Provider>;
};
