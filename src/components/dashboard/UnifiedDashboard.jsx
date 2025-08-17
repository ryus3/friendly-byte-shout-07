import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Helmet } from 'react-helmet-async';
import SystemStatusDashboard from './SystemStatusDashboard';
import ManagerDashboardSection from './ManagerDashboardSection';

/**
 * لوحة التحكم الموحدة
 * يعرض المحتوى المناسب حسب صلاحيات المستخدم
 */
const UnifiedDashboard = () => {
  const { hasPermission, canViewAllData, isAdmin } = usePermissions();

  return (
    <>
      <Helmet>
        <title>لوحة التحكم - نظام RYUS</title>
        <meta name="description" content="لوحة التحكم الرئيسية لإدارة الأعمال" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
        {/* حالة النظام العامة - للجميع */}
        <SystemStatusDashboard />
        
        {/* قسم المدير - للمديرين فقط */}
        {canViewAllData && (
          <ManagerDashboardSection />
        )}
        
        {/* قسم الموظفين - للموظفين فقط */}
        {!canViewAllData && (
          <div className="container mx-auto px-6 py-8">
            <div className="bg-card rounded-xl border border-border/50 p-6 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">مرحباً بك في نظام RYUS</h2>
              <p className="text-muted-foreground">
                يمكنك الوصول إلى الأقسام المخصصة لك من خلال القائمة الجانبية.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UnifiedDashboard;