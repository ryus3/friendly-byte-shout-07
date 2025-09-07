import React, { useEffect } from 'react';
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

// تشغيل المزامنة الشاملة عند بدء التطبيق مع دعم للطلبات المرئية
const AppStartSync = () => {
  const { performComprehensiveSync } = useAppStartSync();
  const { syncVisibleOrdersBatch } = useAlWaseet();
  
  // محاولة الحصول على الطلبات المرئية من النظام
  useEffect(() => {
    const handleVisibleOrdersSync = (event) => {
      const { visibleOrders } = event.detail || {};
      if (visibleOrders && visibleOrders.length > 0) {
        console.log('🔄 تشغيل المزامنة الشاملة مع الطلبات المرئية');
        performComprehensiveSync(visibleOrders, syncVisibleOrdersBatch);
      }
    };
    
    window.addEventListener('requestAppStartSyncWithVisibleOrders', handleVisibleOrdersSync);
    return () => window.removeEventListener('requestAppStartSyncWithVisibleOrders', handleVisibleOrdersSync);
  }, [performComprehensiveSync, syncVisibleOrdersBatch]);
  
  return <GlobalSyncProgress hideAutoSync={true} />;
};
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