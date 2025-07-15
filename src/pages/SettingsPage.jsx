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
  Sun, Moon, Monitor, Palette, ChevronRight, PackageX, Volume2, DollarSign
} from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import TelegramBotDialog from '@/components/settings/TelegramBotDialog';
import DeliverySettingsDialog from '@/components/settings/DeliverySettingsDialog';
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
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isDeliverySettingsOpen, setIsDeliverySettingsOpen] = useState(false);

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
            description="إعدادات التقارير وأسعار التوصيل وبوت التليغرام"
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ModernCard
              icon={FileText}
              title="إعدادات التقارير"
              description="تخصيص التقارير المالية والجرد والمبيعات وتصدير PDF"
              iconColor="from-indigo-500 to-purple-600"
              onClick={() => setIsReportsOpen(true)}
            >
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-2 bg-indigo-50 rounded border border-indigo-100">
                  <p className="text-sm font-bold text-indigo-600">{settings?.totalRevenue?.toLocaleString() || '0'}</p>
                  <p className="text-xs text-indigo-500">المبيعات</p>
                </div>
                <div className="text-center p-2 bg-purple-50 rounded border border-purple-100">
                  <p className="text-sm font-bold text-purple-600">{settings?.totalProducts || '0'}</p>
                  <p className="text-xs text-purple-500">المنتجات</p>
                </div>
              </div>
            </ModernCard>

            <ModernCard
              icon={DollarSign}
              title="أسعار التوصيل"
              description="إدارة أسعار وقواعد التوصيل للطلبات"
              iconColor="from-green-500 to-emerald-600"
              onClick={() => setIsDeliverySettingsOpen(true)}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">السعر الحالي:</span>
                <span className="font-bold text-green-600">{settings?.deliveryFee?.toLocaleString() || '5,000'} د.ع</span>
              </div>
            </ModernCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernCard
              icon={Truck}
              title="شركات التوصيل"
              description="ربط شركات التوصيل الخارجية والوضع المحلي"
              iconColor="from-cyan-500 to-blue-600"
              onClick={() => setIsLoginDialogOpen(true)}
            />

            <ModernCard
              icon={MessageCircle}
              title="بوت التليغرام"
              description="ربط البوت وإدارة رموز الموظفين البسيطة"
              iconColor="from-blue-500 to-indigo-600"
              onClick={() => setIsTelegramOpen(true)}
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

      <TelegramBotDialog
        open={isTelegramOpen}
        onOpenChange={setIsTelegramOpen}
      />

      <DeliverySettingsDialog
        open={isDeliverySettingsOpen}
        onOpenChange={setIsDeliverySettingsOpen}
      />
    </>
  );
};

export default SettingsPage;