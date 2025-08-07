import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { UnifiedAuthProvider } from '@/contexts/UnifiedAuthContext.jsx';
import { SuperProvider } from '@/contexts/SuperContext.jsx';

export const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <UnifiedAuthProvider>
        <SuperProvider>
          {children}
        </SuperProvider>
      </UnifiedAuthProvider>
    </ThemeProvider>
  );
};