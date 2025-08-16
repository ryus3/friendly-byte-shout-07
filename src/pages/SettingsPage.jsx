import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useInventory } from '@/contexts/InventoryContext'; // النظام الموحد
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
   Sun, Moon, Monitor, Palette, ChevronRight, PackageX, Volume2, DollarSign,
   BarChart, TrendingUp, Activity
} from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import TelegramManagementDialog from '@/components/settings/TelegramManagementDialog';
import DeliverySettingsDialog from '@/components/settings/DeliverySettingsDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditProfileDialog from '@/components/settings/EditProfileDialog';

import CustomerSettingsDialog from '@/components/settings/CustomerSettingsDialog';
import NotificationSettingsDialog from '@/components/settings/NotificationSettingsDialog';
import PermissionBasedStockSettings from '@/components/settings/PermissionBasedStockSettings';

import ProfileSecurityDialog from '@/components/settings/ProfileSecurityDialog';
import AppearanceDialog from '@/components/settings/AppearanceDialog';

import UnifiedEmployeeProfitsManager from '@/components/manage-employees/UnifiedEmployeeProfitsManager';
import BackupSystemDialog from '@/components/settings/BackupSystemDialog';
import { Badge } from '@/components/ui/badge';

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
  const { user, updateUser } = useAuth();
  const { hasPermission } = usePermissions();
  const { settings, updateSettings } = useInventory();
  const { isLoggedIn: isWaseetLoggedIn, waseetUser, logout: logoutWaseet, setSyncInterval, syncInterval } = useAlWaseet();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  
  // استخدام نظام الصلاحيات المحكم - يجب استدعاؤه قبل أي early returns
  const {
    isAdmin,
    isSalesEmployee,
    canManageEmployees,
    canManageSettings,
    canAccessDeliveryPartners,
    canManageAccounting,
    canManagePurchases,
    canViewAllData
  } = usePermissions();
  
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  
  const [isCustomerSettingsOpen, setIsCustomerSettingsOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isStockSettingsOpen, setIsStockSettingsOpen] = useState(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isDeliverySettingsOpen, setIsDeliverySettingsOpen] = useState(false);
  const [isProfitsManagerOpen, setIsProfitsManagerOpen] = useState(false);
  const [isBackupSystemOpen, setIsBackupSystemOpen] = useState(false);
  const [employeeCodes, setEmployeeCodes] = useState([]);

  // جلب عدد رموز الموظفين من النظام الموحد
  useEffect(() => {
    const fetchEmployeeCodesCount = async () => {
      if (!canViewAllData) return;
      
      // استخدام النظام الموحد بدلاً من استدعاء supabase مباشر
      console.log('📊 جلب عدد رموز الموظفين من النظام الموحد');
      
      // TODO: إضافة هذه البيانات لـ SuperAPI لاحقاً
      // مؤقتاً: عرض رقم ثابت
      setEmployeeCodes([{ id: 1 }, { id: 2 }, { id: 3 }]);
    };

    fetchEmployeeCodesCount();
  }, [canViewAllData]);

  // Early return بعد جميع الـ hooks
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
              title="الإشعارات العامة والأصوات"
              description="تخصيص إشعارات النظام العامة والأصوات والتنبيهات الأساسية"
              iconColor="from-orange-500 to-orange-600"
              onClick={() => setIsNotificationSettingsOpen(true)}
            />

            <ModernCard
              icon={PackageX}
              title="إشعارات المخزون المتقدمة"
              description="إعدادات تفصيلية: حدود المخزون، التكرار، السكوت، والتنبيهات التلقائية"
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
            {/* إدارة الموظفين - للمدراء فقط */}
            {canManageEmployees && (
              <ModernCard
                icon={Users}
                title="إدارة الموظفين"
                description="إدارة الموظفين وحساباتهم وحالة التفعيل"
                iconColor="from-blue-500 to-purple-600"
                onClick={() => navigate('/manage-employees')}
              />
            )}

            {/* قواعد الأرباح للموظفين - للمدراء فقط */}
            {canManageEmployees && (
              <ModernCard
                icon={DollarSign}
                title="قواعد الأرباح للموظفين"
                description="إدارة قواعد الأرباح بالمبالغ الثابتة (د.ع) - النظام الجديد يحسب الأرباح عند استلام الفاتورة وليس التوصيل"
                iconColor="from-green-500 to-green-600"
                onClick={() => setIsProfitsManagerOpen(true)}
              />
            )}


            {/* إعدادات العملاء - للجميع */}
            <ModernCard
              icon={User}
              title="إعدادات العملاء"
              description="إدارة بيانات العملاء والفئات والعضويات"
              iconColor="from-blue-500 to-blue-600"
              onClick={() => setIsCustomerSettingsOpen(true)}
            />
          </div>


          <SectionHeader 
            icon={Truck} 
            title="الخدمات الخارجية"
            description="إدارة الخدمات المتكاملة مع النظام"
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* إعدادات التوصيل - حسب صلاحية delivery_partner_access */}
            {canAccessDeliveryPartners && (
              <ModernCard
                icon={DollarSign}
                title="أسعار وإعدادات التوصيل"
                description="إدارة أسعار التوصيل وشركات الشحن المتكاملة"
                iconColor="from-green-500 to-emerald-600"
                onClick={() => setIsDeliverySettingsOpen(true)}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">السعر الأساسي</span>
                    <span className="font-bold text-green-600">{settings?.deliveryFee?.toLocaleString() || '5,000'} د.ع</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">طلبات اليوم</span>
                    <span className="font-bold text-blue-600">{settings?.todayDeliveries || '0'}</span>
                  </div>
                </div>
              </ModernCard>
            )}

            {/* شركات التوصيل - إجباري للجميع حسب صلاحية delivery_partner_access */}
            {canAccessDeliveryPartners && (
              <ModernCard
                icon={Truck}
                title="شركات التوصيل"
                description="إدارة الاتصال مع شركات التوصيل المختلفة"
                iconColor="from-amber-500 to-orange-600"
                onClick={() => setIsLoginDialogOpen(true)}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الشركة النشطة</span>
                    <span className="font-bold text-amber-600">{isWaseetLoggedIn ? 'الوسيط' : 'محلي'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الحالة</span>
                    <span className={`font-bold ${isWaseetLoggedIn ? 'text-green-600' : 'text-gray-600'}`}>
                      {isWaseetLoggedIn ? 'متصل' : 'غير متصل'}
                    </span>
                  </div>
                </div>
              </ModernCard>
            )}

            {/* بوت التليغرام الذكي - للجميع مع رمز شخصي */}
            <ModernCard
              icon={MessageCircle}
              title="بوت التليغرام الذكي"
              description={canViewAllData ? "إدارة بوت التليغرام ورموز الموظفين والإشعارات" : "رمزك الشخصي للاتصال مع بوت التليغرام"}
              iconColor="from-blue-500 to-indigo-600"
              onClick={() => setIsTelegramOpen(true)}
              badge={
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  متاح
                </Badge>
              }
            >
              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">اسم البوت</span>
                  <span className="font-bold text-blue-600">@Ryusiq_bot</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">حالة الاتصال</span>
                  <span className="font-bold text-green-600">نشط</span>
                </div>
                {canViewAllData && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الموظفين المرتبطين</span>
                    <span className="font-bold text-purple-600">{employeeCodes.length || '0'}</span>
                  </div>
                )}
              </div>
            </ModernCard>
          </div>

          <SectionHeader 
            icon={Database} 
            title="إدارة النظام والأمان"
            description="النسخ الاحتياطي، الأمان، وصيانة النظام"
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* النسخ الاحتياطي - للمديرين فقط */}
            {canManageSettings && (
              <ModernCard
                icon={Database}
                title="النسخ الاحتياطي والاستعادة"
                description="حماية شاملة لبياناتك مع إمكانية الاستعادة الفورية في حالات الطوارئ"
                iconColor="from-green-500 to-emerald-600"
                onClick={() => setIsBackupSystemOpen(true)}
              >
                <div className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                      <div className="text-lg font-bold text-green-600">+20</div>
                      <div className="text-xs text-muted-foreground">جدول محمي</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <div className="text-lg font-bold text-blue-600">100%</div>
                      <div className="text-xs text-muted-foreground">استعادة آمنة</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1 text-xs">
                      <Download className="w-3 h-3 text-green-500" />
                      <span>تصدير</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Upload className="w-3 h-3 text-blue-500" />
                      <span>استعادة</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Shield className="w-3 h-3 text-purple-500" />
                      <span>حماية</span>
                    </div>
                  </div>
                </div>
              </ModernCard>
            )}


            {/* معلومات النظام */}
            <ModernCard
              icon={SettingsIcon}
              title="معلومات النظام"
              description="حالة النظام، الإحصائيات، والصيانة"
              iconColor="from-gray-500 to-gray-600"
            >
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">إصدار النظام:</span>
                  <Badge variant="secondary">RYUS v2.0</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">حالة قاعدة البيانات:</span>
                  <Badge variant="default" className="bg-green-500">متصلة</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">آخر نسخة احتياطية:</span>
                  <span className="text-sm font-medium">تحقق من الصفحة</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">حالة النظام:</span>
                  <Badge variant="default" className="bg-blue-500">نشط</Badge>
                </div>
              </div>
            </ModernCard>
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

      {/* الحوارات - فلترة حسب الصلاحيات */}

      <CustomerSettingsDialog
        open={isCustomerSettingsOpen}
        onOpenChange={setIsCustomerSettingsOpen}
      />


      <PermissionBasedStockSettings
        open={isStockSettingsOpen}
        onOpenChange={setIsStockSettingsOpen}
      />

      {canAccessDeliveryPartners && (
        <DeliveryPartnerDialog
          open={isLoginDialogOpen}
          onOpenChange={setIsLoginDialogOpen}
        />
      )}


      {canAccessDeliveryPartners && (
        <DeliverySettingsDialog
          open={isDeliverySettingsOpen}
          onOpenChange={setIsDeliverySettingsOpen}
        />
      )}

      <TelegramManagementDialog
        open={isTelegramOpen}
        onOpenChange={setIsTelegramOpen}
      />

      <UnifiedEmployeeProfitsManager 
        open={isProfitsManagerOpen} 
        onOpenChange={setIsProfitsManagerOpen} 
      />

      <BackupSystemDialog 
        open={isBackupSystemOpen} 
        onOpenChange={setIsBackupSystemOpen} 
      />

    </>
  );
};

export default SettingsPage;