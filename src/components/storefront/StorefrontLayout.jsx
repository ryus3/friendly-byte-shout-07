import React from 'react';
import { Outlet } from 'react-router-dom';
import StorefrontHeader from './StorefrontHeader';
import StorefrontFooter from './StorefrontFooter';
import AnnouncementBar from './AnnouncementBar';
import { useStorefront } from '@/contexts/StorefrontContext';
import { Skeleton } from '@/components/ui/skeleton';

const StorefrontLayout = () => {
  const { settings, settingsLoading, error } = useStorefront();

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-16 w-full" />
        <div className="container mx-auto p-8">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
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
    '--storefront-primary': settings.primary_color || 'hsl(var(--primary))',
    '--storefront-accent': settings.accent_color || 'hsl(var(--accent))',
  };

  return (
    <div className="min-h-screen bg-background" style={customColors}>
      <AnnouncementBar />
      <StorefrontHeader />
      <main className="min-h-[calc(100vh-200px)]">
        <Outlet />
      </main>
      <StorefrontFooter />
    </div>
  );
};

export default StorefrontLayout;
