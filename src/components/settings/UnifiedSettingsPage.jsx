import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Helmet } from 'react-helmet-async';
import PermissionsBasedSettings from './PermissionsBasedSettings';

/**
 * صفحة الإعدادات الموحدة
 * تعرض الإعدادات المناسبة حسب صلاحيات المستخدم
 */
const UnifiedSettingsPage = () => {
  const { hasPermission, canViewAllData } = usePermissions();

  return (
    <>
      <Helmet>
        <title>الإعدادات - نظام RYUS</title>
        <meta name="description" content="إدارة إعدادات حسابك والمتجر" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
        <PermissionsBasedSettings />
      </div>
    </>
  );
};

export default UnifiedSettingsPage;