import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { SupabaseProvider } from '@/contexts/SupabaseContext.jsx';
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import { AiChatProvider } from '@/contexts/AiChatContext.jsx';
import { AlWaseetProvider } from '@/contexts/AlWaseetContext.jsx';
import { InventoryProvider } from '@/contexts/InventoryContext.jsx';
import { VariantsProvider } from '@/contexts/VariantsContext.jsx';
import { NotificationsProvider } from '@/contexts/NotificationsContext.jsx';

export const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <SupabaseProvider>
        <AuthProvider>
          <NotificationsProvider>
              <InventoryProvider>
                <VariantsProvider>
                  <AlWaseetProvider>
                      <AiChatProvider>
                        {children}
                      </AiChatProvider>
                  </AlWaseetProvider>
                </VariantsProvider>
              </InventoryProvider>
          </NotificationsProvider>
        </AuthProvider>
      </SupabaseProvider>
    </ThemeProvider>
  );
};