import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { UnifiedAuthProvider } from '@/contexts/UnifiedAuthContext.jsx';
import { AiChatProvider } from '@/contexts/AiChatContext.jsx';
import { NotificationsProvider } from '@/contexts/NotificationsContext.jsx';
import { NotificationsSystemProvider } from '@/contexts/NotificationsSystemContext.jsx';
import { InventoryProvider } from '@/contexts/InventoryContext.jsx';

export const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <UnifiedAuthProvider>
        <NotificationsSystemProvider>
          <NotificationsProvider>
            <AiChatProvider>
              <InventoryProvider>
                {children}
              </InventoryProvider>
            </AiChatProvider>
          </NotificationsProvider>
        </NotificationsSystemProvider>
      </UnifiedAuthProvider>
    </ThemeProvider>
  );
};