import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { UnifiedAuthProvider } from '@/contexts/UnifiedAuthContext.jsx';
import { AiChatProvider } from '@/contexts/AiChatContext.jsx';
import { NotificationsProvider } from '@/contexts/NotificationsContext.jsx';
import { NotificationsSystemProvider } from '@/contexts/NotificationsSystemContext.jsx';
import { SuperProvider } from '@/contexts/SuperProvider.jsx';
import { ProfitsProvider } from '@/contexts/ProfitsContext.jsx';
import { AlWaseetProvider } from '@/contexts/AlWaseetContext.jsx';

export const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <UnifiedAuthProvider>
        <AlWaseetProvider>
          <NotificationsSystemProvider>
            <NotificationsProvider>
              <AiChatProvider>
                <ProfitsProvider>
                  <SuperProvider>
                    {children}
                  </SuperProvider>
                </ProfitsProvider>
              </AiChatProvider>
            </NotificationsProvider>
          </NotificationsSystemProvider>
        </AlWaseetProvider>
      </UnifiedAuthProvider>
    </ThemeProvider>
  );
};