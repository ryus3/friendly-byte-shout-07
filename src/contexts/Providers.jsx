import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { UnifiedAuthProvider } from '@/contexts/UnifiedAuthContext.jsx';
import { SuperProvider } from '@/contexts/SuperContext.jsx';
import { AiChatProvider } from '@/contexts/AiChatContext.jsx';

export const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <UnifiedAuthProvider>
        <AiChatProvider>
          <SuperProvider>
            {children}
          </SuperProvider>
        </AiChatProvider>
      </UnifiedAuthProvider>
    </ThemeProvider>
  );
};