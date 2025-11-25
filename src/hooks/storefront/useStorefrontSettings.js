import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Custom hook لجلب إعدادات المتجر الخاص بالموظف
 */
export const useStorefrontSettings = (slug) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError(null);

        // جلب إعدادات المتجر مع بيانات الموظف من profiles
        const { data, error: fetchError } = await supabase
          .from('employee_storefront_settings')
          .select(`
            *,
            profile:profiles!employee_storefront_settings_employee_id_fkey (
              user_id,
              full_name,
              business_page_name,
              social_media,
              business_links
            )
          `)
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (fetchError) throw fetchError;
        
        setSettings(data);
      } catch (err) {
        console.error('Error fetching storefront settings:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`storefront-settings-${slug}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_storefront_settings',
          filter: `storefront_slug=eq.${slug}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setSettings(payload.new);
          } else if (payload.eventType === 'DELETE') {
            setSettings(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

  return { settings, loading, error };
};
