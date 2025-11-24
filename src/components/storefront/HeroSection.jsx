import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStorefront } from '@/contexts/StorefrontContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HeroSection = () => {
  const { settings } = useStorefront();
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!settings?.employee_id) return;

    const fetchBanners = async () => {
      const { data } = await supabase
        .from('employee_banners')
        .select('*')
        .eq('employee_id', settings.employee_id)
        .eq('banner_position', 'hero')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (data && data.length > 0) {
        setBanners(data);
      }
    };

    fetchBanners();
  }, [settings?.employee_id]);

  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length]);

  if (banners.length === 0) {
    // عرض banner افتراضي
    return (
      <div className="relative h-[400px] md:h-[500px] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground">
            {settings?.business_name || 'مرحباً بك'}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
            {settings?.meta_description || 'اكتشف مجموعتنا الحصرية من المنتجات'}
          </p>
        </div>
      </div>
    );
  }

  const currentBanner = banners[currentIndex];

  return (
    <div className="relative h-[400px] md:h-[500px] overflow-hidden group">
      {/* الصورة */}
      <img
        src={currentBanner.banner_image}
        alt={currentBanner.banner_title || ''}
        className="w-full h-full object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
        <div className="container mx-auto px-4 pb-12">
          {currentBanner.banner_title && (
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-2">
              {currentBanner.banner_title}
            </h2>
          )}
          {currentBanner.banner_subtitle && (
            <p className="text-lg md:text-xl text-white/90 mb-4">
              {currentBanner.banner_subtitle}
            </p>
          )}
          {currentBanner.banner_link && (
            <a href={currentBanner.banner_link}>
              <Button size="lg">اكتشف المزيد</Button>
            </a>
          )}
        </div>
      </div>

      {/* أزرار التنقل */}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % banners.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* المؤشرات */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default HeroSection;
