import React from 'react';
import { Outlet } from 'react-router-dom';
import StorefrontHeader from './StorefrontHeader';
import StorefrontFooter from './StorefrontFooter';
import { useStorefront } from '@/contexts/StorefrontContext';
import PremiumLoader from './ui/PremiumLoader';

const StorefrontLayout = ({ products = [] }) => {
  const { settings, settingsLoading, error } = useStorefront();

  if (settingsLoading) {
    return <PremiumLoader message="جاري تحميل المتجر..." />;
  }

  if (error || !settings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">المتجر غير متاح</h1>
          <p className="text-muted-foreground">
            {error || 'لم يتم العثور على المتجر المطلوب'}
          </p>
        </div>
      </div>
    );
  }

  // تطبيق الألوان المخصصة من إعدادات المتجر
  const customColors = {
    '--storefront-primary': settings.primary_color || 'hsl(221, 83%, 53%)',
    '--storefront-accent': settings.accent_color || 'hsl(271, 48%, 55%)',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20" style={customColors}>
      <StorefrontHeader products={products} />
      <main className="min-h-[calc(100vh-400px)]">
        <Outlet />
      </main>
      <StorefrontFooter />
    </div>
  );
};

export default StorefrontLayout;
