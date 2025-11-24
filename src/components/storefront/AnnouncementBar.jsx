import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStorefront } from '@/contexts/StorefrontContext';

const AnnouncementBar = () => {
  const { settings } = useStorefront();
  const [announcement, setAnnouncement] = useState(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!settings?.employee_id) return;

    const fetchAnnouncement = async () => {
      const { data } = await supabase
        .from('employee_banners')
        .select('*')
        .eq('employee_id', settings.employee_id)
        .eq('banner_position', 'announcement')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(1)
        .single();

      if (data) {
        setAnnouncement(data);
      }
    };

    fetchAnnouncement();
  }, [settings?.employee_id]);

  if (!announcement || !isVisible) return null;

  return (
    <div className="bg-primary text-primary-foreground py-2 px-4 text-center relative">
      <p className="text-sm font-medium">
        {announcement.banner_title || announcement.banner_subtitle}
      </p>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute left-4 top-1/2 -translate-y-1/2 hover:opacity-70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default AnnouncementBar;
