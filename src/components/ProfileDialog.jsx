import React from 'react';
import EditProfileDialog from './settings/EditProfileDialog';

export const ProfileDialog = ({ open, onOpenChange }) => {
  return (
    <EditProfileDialog open={open} onOpenChange={onOpenChange} />
  );
};