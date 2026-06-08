import React, { useEffect } from 'react';
import StorefrontHeader from './StorefrontHeader';
import StorefrontFooter from './StorefrontFooter';
import { useStorefront } from '@/contexts/StorefrontContext';
import PremiumLoader from './ui/PremiumLoader';
import { applyThemeTokens } from '@/lib/storefront-themes';

const StorefrontLayout = ({ products = [], children }) => {
  const { settings, settingsLoading, error } = useStorefront();

  // ✅ تطبيق ثيم المتجر على جميع الصفحات (الرئيسية، المنتجات، التفاصيل، السلة)
  useEffect(() => {
    if (settings?.theme_name) {
      applyThemeTokens(settings.theme_name);
    }
  }, [settings?.theme_name]);

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

  const customColors = {
    '--storefront-primary': settings.primary_color || 'hsl(221, 83%, 53%)',
    '--storefront-accent': settings.accent_color || 'hsl(271, 48%, 55%)',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20" style={customColors}>
      <StorefrontHeader products={products} />
      <main className="min-h-[calc(100vh-400px)]">
        {children}
      </main>
      <StorefrontFooter />
    </div>
  );
};

export default StorefrontLayout;
