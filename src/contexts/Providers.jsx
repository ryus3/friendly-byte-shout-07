import React, { useEffect, memo, useCallback } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { UnifiedAuthProvider, useAuth } from '@/contexts/UnifiedAuthContext.jsx';
import { AiChatProvider } from '@/contexts/AiChatContext.jsx';
import { NotificationsProvider } from '@/contexts/NotificationsContext.jsx';
import { NotificationsSystemProvider } from '@/contexts/NotificationsSystemContext.jsx';
import { SuperProvider } from '@/contexts/SuperProvider.jsx';
import { ProfitsProvider } from '@/contexts/ProfitsContext.jsx';
import { AlWaseetProvider, useAlWaseet } from '@/contexts/AlWaseetContext.jsx';
import { SupabaseProvider } from '@/contexts/SupabaseContext.jsx';
import { VariantsProvider } from '@/contexts/VariantsContext.jsx';
import { GlobalSyncProgress } from '@/components/GlobalSyncProgress.jsx';
import { useAppStartSync } from '@/hooks/useAppStartSync';

// 🚀 تحسين الأداء: تغليف AppStartSync بـ memo
const AppStartSync = memo(() => {
  const { performComprehensiveSync } = useAppStartSync();
  const { syncVisibleOrdersBatch } = useAlWaseet();
  
  // 🚀 تحسين: useCallback للدالة
  const handleVisibleOrdersSync = useCallback((event) => {
    const { visibleOrders, autoSync = false } = event.detail || {};
    if (visibleOrders && visibleOrders.length > 0) {
      performComprehensiveSync(visibleOrders, syncVisibleOrdersBatch, autoSync);
    }
  }, [performComprehensiveSync, syncVisibleOrdersBatch]);
  
  useEffect(() => {
    window.addEventListener('requestAppStartSyncWithVisibleOrders', handleVisibleOrdersSync);
    return () => window.removeEventListener('requestAppStartSyncWithVisibleOrders', handleVisibleOrdersSync);
  }, [handleVisibleOrdersSync]);
  
  return <GlobalSyncProgress hideAutoSync={true} />;
});

// 🚀 تحسين الأداء: AlWaseetProvider يُحمَّل فقط بعد المصادقة لتسريع صفحة الدخول
const AuthGatedAlWaseet = ({ children }) => {
  const { user, loading } = useAuth();
  
  // قبل المصادقة: لا نحمّل AlWaseetProvider الضخم (251KB)
  // بعد المصادقة: نحمّله بشكل طبيعي
  if (loading || !user) {
    return <>{children}</>;
  }
  
  return (
    <AlWaseetProvider>
      <NotificationsProvider>
        <AiChatProvider>
          <ProfitsProvider>
            <SuperProvider>
              <VariantsProvider>
                <AppStartSync />
                {children}
              </VariantsProvider>
            </SuperProvider>
          </ProfitsProvider>
        </AiChatProvider>
      </NotificationsProvider>
    </AlWaseetProvider>
  );
};

export const AppProviders = ({ children }) => {
  return (
    <SupabaseProvider>
      <ThemeProvider>
        <UnifiedAuthProvider>
          <NotificationsSystemProvider>
            <AuthGatedAlWaseet>
              {children}
            </AuthGatedAlWaseet>
          </NotificationsSystemProvider>
        </UnifiedAuthProvider>
      </ThemeProvider>
    </SupabaseProvider>
  );
};