import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { SupabaseProvider } from '@/contexts/SupabaseContext.jsx';
import { UnifiedAuthProvider } from '@/contexts/UnifiedAuthContext.jsx';
import { AiChatProvider } from '@/contexts/AiChatContext.jsx';
import { AlWaseetProvider } from '@/contexts/AlWaseetContext.jsx';
import { InventoryProvider } from '@/contexts/InventoryContext.jsx';
import { VariantsProvider } from '@/contexts/VariantsContext.jsx';
import { NotificationsProvider } from '@/contexts/NotificationsContext.jsx';
import { ProfitsProvider } from '@/contexts/ProfitsContext.jsx';
import { NotificationsSystemProvider } from '@/contexts/NotificationsSystemContext.jsx';
import StockMonitoringSystem from '@/components/dashboard/StockMonitoringSystem';

export const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <SupabaseProvider>
        <UnifiedAuthProvider>
          <NotificationsProvider>
            <NotificationsSystemProvider>
              <InventoryProvider>
                <ProfitsProvider>
                  <VariantsProvider>
                    <AlWaseetProvider>
                        <AiChatProvider>
                          <StockMonitoringSystem />
                          {children}
                        </AiChatProvider>
                    </AlWaseetProvider>
                  </VariantsProvider>
                </ProfitsProvider>
              </InventoryProvider>
            </NotificationsSystemProvider>
          </NotificationsProvider>
        </UnifiedAuthProvider>
      </SupabaseProvider>
    </ThemeProvider>
  );
};