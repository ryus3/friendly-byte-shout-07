import React from 'react';
import UnifiedEmployeePermissionsDialog from './UnifiedEmployeePermissionsDialog';

const EditEmployeeDialog = ({ employee, open, onOpenChange }) => {
  return (
    <UnifiedEmployeePermissionsDialog
      employee={employee}
      open={open}
      onOpenChange={onOpenChange}
      mode="edit"
    />
  );
};

export default EditEmployeeDialog;