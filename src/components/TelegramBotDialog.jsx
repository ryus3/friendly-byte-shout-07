import React from 'react';
import { TelegramSettingsDialog } from './TelegramSettingsDialog';

export const TelegramBotDialog = ({ open, onOpenChange }) => {
  return (
    <TelegramSettingsDialog open={open} onOpenChange={onOpenChange} />
  );
};