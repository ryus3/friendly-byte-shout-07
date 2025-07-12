import React, { createContext, useState, useContext } from 'react';
import { useAuth } from './AuthContext';

const AiChatContext = createContext();

export const useAiChat = () => useContext(AiChatContext);

export const AiChatProvider = ({ children }) => {
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const { hasPermission } = useAuth();
  
  const canUseAiChat = hasPermission('use_ai_assistant');

  const value = {
    aiChatOpen,
    setAiChatOpen,
    canUseAiChat
  };

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
};