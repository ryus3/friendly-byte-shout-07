import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { UnifiedAuthProvider } from '@/contexts/UnifiedAuthContext.jsx';
import { AiChatProvider } from '@/contexts/AiChatContext.jsx';
import { NotificationsProvider } from '@/contexts/NotificationsContext.jsx';
import { NotificationsSystemProvider } from '@/contexts/NotificationsSystemContext.jsx';
import { SuperProvider } from '@/contexts/SuperProvider.jsx';
import { ProfitsProvider } from '@/contexts/ProfitsContext.jsx';
import { AlWaseetProvider } from '@/contexts/AlWaseetContext.jsx';
import { SupabaseProvider } from '@/contexts/SupabaseContext.jsx';
import { VariantsProvider } from '@/contexts/VariantsContext.jsx';
import { useGlobalInvoiceSync } from '@/hooks/useGlobalInvoiceSync';

// Global invoice sync component
const GlobalInvoiceSync = () => {
  useGlobalInvoiceSync();
  return null;
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
                        <GlobalInvoiceSync />
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