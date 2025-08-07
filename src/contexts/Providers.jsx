import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { UnifiedAuthProvider } from '@/contexts/UnifiedAuthContext.jsx';
import { SuperProvider } from '@/contexts/SuperContext.jsx';
import { AiChatProvider } from '@/contexts/AiChatContext.jsx';
import { NotificationsProvider } from '@/contexts/NotificationsContext.jsx';
import { InventoryProvider } from '@/contexts/InventoryContext.jsx';

export const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <UnifiedAuthProvider>
        <AiChatProvider>
          <NotificationsProvider>
            <InventoryProvider>
              <SuperProvider>
                {children}
              </SuperProvider>
            </InventoryProvider>
          </NotificationsProvider>
        </AiChatProvider>
      </UnifiedAuthProvider>
    </ThemeProvider>
  );
};