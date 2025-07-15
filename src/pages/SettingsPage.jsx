import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast.js';
import { 
  User, Store, Bot, Copy, Truck, LogIn, LogOut, Loader2, Users, Printer, 
  Settings as SettingsIcon, Home, Shield, FileText, Bell, Database, 
  Archive, Key, Download, Upload, Trash2, RefreshCw, MessageCircle, Mail,
  Sun, Moon, Monitor, Palette, ChevronRight, PackageX, Volume2
} from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditProfileDialog from '@/components/settings/EditProfileDialog';
import ManageEmployeesDialog from '@/components/settings/ManageEmployeesDialog';
import CustomerSettingsDialog from '@/components/settings/CustomerSettingsDialog';
import NotificationSettingsDialog from '@/components/settings/NotificationSettingsDialog';
import StockNotificationSettings from '@/components/settings/StockNotificationSettings';
import ReportsSettingsDialog from '@/components/settings/ReportsSettingsDialog';
import ProfileSecurityDialog from '@/components/settings/ProfileSecurityDialog';
import AppearanceDialog from '@/components/settings/AppearanceDialog';
import SystemStatusDashboard from '@/components/dashboard/SystemStatusDashboard';

const ModernCard = ({ icon, title, description, children, footer, onClick, className, disabled = false, iconColor = "from-primary to-primary-dark", action, badge }) => {
  const Icon = icon;
  const cardClasses = `
    ${className} 
    group relative overflow-hidden
    ${onClick ? 'cursor-pointer hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-1' : ''}
    bg-card border border-border/50 rounded-xl backdrop-blur-sm
    transition-all duration-300 ease-out
    shadow-lg hover:shadow-2xl
    hover:border-primary/40
  `;
  
  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <Card className={cardClasses} onClick={handleClick}>
      <div className={`absolute inset-0 bg-gradient-to-br ${iconColor} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
      
      <CardHeader className="pb-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${iconColor} shadow-lg group-hover:shadow-xl transition-shadow duration-300`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-200">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="mt-1 text-sm text-muted-foreground">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {badge}
            {onClick && (
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
            )}
          </div>
        </div>
      </CardHeader>
      
      {children && <CardContent className="pt-0 relative">{children}</CardContent>}
      {footer && <CardFooter className="pt-0 relative">{footer}</CardFooter>}
      {action && (
        <div className="absolute top-4 right-4">
          {action}
        </div>
      )}
    </Card>
  );
};

const SectionHeader = ({ icon, title, description }) => {
  const Icon = icon;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-foreground">{title}</h2>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
    </div>
  );
};

const SettingsPage = () => {
  const { user, hasPermission, updateUser } = useAuth();
  const { settings, updateSettings } = useInventory();
  const { isLoggedIn: isWaseetLoggedIn, waseetUser, logout: logoutWaseet, setSyncInterval, syncInterval } = useAlWaseet();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isManageEmployeesOpen, setIsManageEmployeesOpen] = useState(false);
  const [isCustomerSettingsOpen, setIsCustomerSettingsOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isStockSettingsOpen, setIsStockSettingsOpen] = useState(false);

  if (!user) return <div className="flex h-full w-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <>
      <Helmet>
        <title>الإعدادات - نظام RYUS</title>
        <meta name="description" content="إدارة إعدادات حسابك والمتجر." />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
        <div className="container mx-auto px-6 py-8 space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              الإعدادات
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              قم بإدارة إعدادات حسابك وتخصيص تجربة استخدام النظام
            </p>
          </div>

          <SectionHeader 
            icon={User} 
            title="الحساب والأمان"
            description="إدارة معلوماتك الشخصية وإعدادات الأمان"
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ModernCard
              icon={User}
              title="الملف الشخصي والأمان"
              description="إدارة معلوماتك الشخصية وإعدادات الأمان المتقدمة"
              iconColor="from-blue-500 to-blue-600"
              onClick={() => setIsEditProfileOpen(true)}
            />

            <ModernCard
              icon={Palette}
              title="المظهر والثيم"
              description="تخصيص مظهر التطبيق والألوان والخطوط والعرض"
              iconColor="from-purple-500 to-purple-600"
              onClick={() => setIsAppearanceOpen(true)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ModernCard
              icon={Bell}
              title="الإشعارات والأصوات"
              description="تخصيص إشعارات النظام والأصوات والتنبيهات"
              iconColor="from-orange-500 to-orange-600"
              onClick={() => setIsNotificationSettingsOpen(true)}
            />

            <ModernCard
              icon={PackageX}
              title="إعدادات المخزون المنخفض"
              description="تحديد حدود المخزون المنخفض والتنبيهات التلقائية"
              iconColor="from-red-500 to-red-600"
              onClick={() => setIsStockSettingsOpen(true)}
            />
          </div>

          <SectionHeader 
            icon={Users} 
            title="إدارة الموظفين والعملاء"
            description="إدارة فريق العمل والعملاء وصلاحيات الوصول"
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {hasPermission('manage_employees') && (
              <ModernCard
                icon={Users}
                title="إدارة الموظفين"
                description="إضافة وتعديل الموظفين وإدارة الصلاحيات"
                iconColor="from-green-500 to-green-600"
                onClick={() => setIsManageEmployeesOpen(true)}
              />
            )}

            <ModernCard
              icon={User}
              title="إعدادات العملاء"
              description="إدارة بيانات العملاء والفئات والعضويات"
              iconColor="from-blue-500 to-blue-600"
              onClick={() => setIsCustomerSettingsOpen(true)}
            />
          </div>

          <SectionHeader 
            icon={FileText} 
            title="التقارير والتوصيل"
            description="إعدادات التقارير وشركات التوصيل والتليغرام"
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard
              icon={FileText}
              title="إعدادات التقارير"
              description="تخصيص التقارير المالية والجرد والمبيعات"
              iconColor="from-indigo-500 to-indigo-600"
              onClick={() => setIsReportsOpen(true)}
            />

            <ModernCard
              icon={Truck}
              title="شركات التوصيل"
              description="إعدادات التليغرام وشركات التوصيل المدمجة"
              iconColor="from-cyan-500 to-cyan-600"
              onClick={() => setIsLoginDialogOpen(true)}
            />
          </div>

          <SectionHeader 
            icon={SettingsIcon} 
            title="أدوات النظام"
            description="أدوات النسخ الاحتياطي والذكاء الاصطناعي وإدارة البيانات"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ModernCard
              icon={Archive}
              title="النسخ الاحتياطي والاستعادة"
              description="تصدير واستيراد البيانات مع نسخ احتياطية آمنة"
              iconColor="from-indigo-500 to-indigo-600"
            />

            <ModernCard
              icon={Bot}
              title="الذكاء الاصطناعي"
              description="مساعد ذكي وتحليلات متقدمة للبيانات"
              iconColor="from-purple-500 to-purple-600"
              onClick={() => navigate('/ai-chat')}
            />
          </div>
        </div>
      </div>

      <ProfileSecurityDialog 
        open={isEditProfileOpen} 
        onOpenChange={setIsEditProfileOpen} 
      />
      
      <AppearanceDialog 
        open={isAppearanceOpen} 
        onOpenChange={setIsAppearanceOpen} 
      />
      
      <NotificationSettingsDialog
        open={isNotificationSettingsOpen}
        onOpenChange={setIsNotificationSettingsOpen}
      />

      <ManageEmployeesDialog
        open={isManageEmployeesOpen}
        onOpenChange={setIsManageEmployeesOpen}
      />

      <CustomerSettingsDialog
        open={isCustomerSettingsOpen}
        onOpenChange={setIsCustomerSettingsOpen}
      />

      <ReportsSettingsDialog
        open={isReportsOpen}
        onOpenChange={setIsReportsOpen}
      />

      <StockNotificationSettings
        open={isStockSettingsOpen}
        onOpenChange={setIsStockSettingsOpen}
      />

      <DeliveryPartnerDialog
        open={isLoginDialogOpen}
        onOpenChange={setIsLoginDialogOpen}
      />
    </>
  );
};

export default SettingsPage;