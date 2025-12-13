import React, { useEffect, memo, useCallback } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { UnifiedAuthProvider } from '@/contexts/UnifiedAuthContext.jsx';
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

export const AppProviders = ({ children }) => {
  return (
    <SupabaseProvider>
      <ThemeProvider>
        <UnifiedAuthProvider>
          <NotificationsSystemProvider>
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
          </NotificationsSystemProvider>
        </UnifiedAuthProvider>
      </ThemeProvider>
    </SupabaseProvider>
  );
};