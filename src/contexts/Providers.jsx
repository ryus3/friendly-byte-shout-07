import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import { AiChatProvider } from '@/contexts/AiChatContext.jsx';
import { InventoryProvider } from '@/contexts/InventoryContext.jsx';
import { VariantsProvider } from '@/contexts/VariantsContext.jsx';
import { NotificationsProvider } from '@/contexts/NotificationsContext.jsx';

export const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <InventoryProvider>
            <VariantsProvider>
              <AiChatProvider>
                {children}
              </AiChatProvider>
            </VariantsProvider>
          </InventoryProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};