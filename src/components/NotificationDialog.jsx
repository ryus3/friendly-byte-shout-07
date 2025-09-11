import React from 'react';
import NotificationSettingsDialog from './settings/NotificationSettingsDialog';

export const NotificationDialog = ({ open, onOpenChange }) => {
  return (
    <NotificationSettingsDialog open={open} onOpenChange={onOpenChange} />
  );
};