import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useTheme } from '@/contexts/ThemeContext';
import useUnifiedPermissions from '@/hooks/useUnifiedPermissions';
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
  BarChart, TrendingUp
} from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import TelegramBotDialog from '@/components/settings/TelegramBotDialog';
import RestrictedTelegramSettings from '@/components/settings/RestrictedTelegramSettings';
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
import RoleManagementDialog from '@/components/manage-employees/RoleManagementDialog';
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
  const { user, hasPermission, updateUser } = useAuth();
  const { settings, updateSettings } = useInventory();
  const { isLoggedIn: isWaseetLoggedIn, waseetUser, logout: logoutWaseet, setSyncInterval, syncInterval } = useAlWaseet();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  
  // استخدام نظام الصلاحيات المحكم - يجب استدعاؤه قبل أي early returns
  const {
    isAdmin,
    canManageEmployees,
    canViewAllData,
    hasPermission: checkPermission,
    loading: permissionsLoading
  } = useUnifiedPermissions();

  // صلاحيات إضافية من النظام القديم للتوافق - مع التحقق من التحميل
  const canAccessDeliveryPartners = React.useMemo(() => {
    if (permissionsLoading) return false;
    return checkPermission('access_delivery_partners') || user?.delivery_partner_access;
  }, [checkPermission, permissionsLoading, user?.delivery_partner_access]);

  const canManageAccounting = React.useMemo(() => {
    if (permissionsLoading) return false;
    return checkPermission('manage_finances');
  }, [checkPermission, permissionsLoading]);

  const canManagePurchases = React.useMemo(() => {
    if (permissionsLoading) return false;
    return checkPermission('manage_purchases');
  }, [checkPermission, permissionsLoading]);

  const canManageSettings = React.useMemo(() => {
    if (permissionsLoading) return false;
    return checkPermission('manage_settings');
  }, [checkPermission, permissionsLoading]);
  
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
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);

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
                description="إضافة وتعديل الموظفين وإدارة الصلاحيات والمتغيرات"
                iconColor="from-green-500 to-green-600"
                onClick={() => setIsManageEmployeesOpen(true)}
              />
            )}

            {/* إدارة الأدوار والصلاحيات - للمدراء فقط */}
            {isAdmin && (
              <ModernCard
                icon={Shield}
                title="إدارة الأدوار والصلاحيات"
                description="تعيين أدوار الموظفين وإدارة صلاحيات المنتجات"
                iconColor="from-indigo-500 to-indigo-600"
                onClick={() => setIsRoleManagerOpen(true)}
                badge={<Badge variant="secondary">جديد</Badge>}
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
            icon={FileText} 
            title="إدارة التقارير والتكامل"
            description="تقارير مالية متقدمة، إحصائيات شاملة، وربط مع الأنظمة الخارجية"
          />
          
          <div className="grid grid-cols-1 gap-6 mb-8">
            <ModernCard
              icon={FileText}
              title="إدارة التقارير والإحصائيات"
              description="نظام متكامل لإنشاء وطباعة وتصدير التقارير المالية وتقارير المخزون مع إمكانية الإرسال بالإيميل وجدولة التقارير التلقائية"
              iconColor="from-gradient-start to-gradient-end"
              onClick={() => setIsReportsOpen(true)}
            >
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                    <div className="text-2xl font-bold text-blue-600">{settings?.todayRevenue?.toLocaleString() || '0'}</div>
                    <div className="text-xs text-muted-foreground">مبيعات اليوم (د.ع)</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                    <div className="text-2xl font-bold text-green-600">{settings?.monthRevenue?.toLocaleString() || '0'}</div>
                    <div className="text-xs text-muted-foreground">إجمالي الشهر (د.ع)</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                    <div className="text-2xl font-bold text-purple-600">{settings?.activeProducts || '0'}</div>
                    <div className="text-xs text-muted-foreground">المنتجات الفعالة</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                    <div className="text-2xl font-bold text-orange-600">{settings?.avgOrders || '0'}</div>
                    <div className="text-xs text-muted-foreground">متوسط الطلبات/يوم</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2 text-sm">
                    <Printer className="w-4 h-4 text-blue-500" />
                    <span>طباعة مباشرة</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Download className="w-4 h-4 text-green-500" />
                    <span>تصدير PDF</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-purple-500" />
                    <span>إرسال بالإيميل</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <RefreshCw className="w-4 h-4 text-orange-500" />
                    <span>تقارير تلقائية</span>
                  </div>
                </div>
              </div>
            </ModernCard>
          </div>

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

            {/* بوت التليغرام - إجباري للجميع مع رمز شخصي */}
            <ModernCard
              icon={MessageCircle}
              title="بوت التليغرام الذكي"
              description={isAdmin 
                ? "نظام إشعارات متقدم وإدارة الطلبات عبر التليغرام" 
                : "رمزك الشخصي للاتصال مع بوت التليغرام"
              }
              iconColor="from-blue-500 to-indigo-600"
              onClick={() => setIsTelegramOpen(true)}
            >
              <div className="space-y-3">
                {isAdmin ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">الموظفين المرتبطين</span>
                      <span className="font-bold text-blue-600">{settings?.connectedEmployees || '0'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">الإشعارات اليوم</span>
                      <span className="font-bold text-green-600">{settings?.todayNotifications || '0'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">رمزك الشخصي</span>
                      <span className="font-bold text-blue-600">عرض الرمز</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">حالة الاتصال</span>
                      <span className="font-bold text-green-600">متاح</span>
                    </div>
                  </>
                )}
              </div>
            </ModernCard>
          </div>

          {/* أدوات النظام - للمدراء فقط */}
          {isAdmin && (
            <>
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
            </>
          )}
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
      {canManageEmployees && (
        <ManageEmployeesDialog
          open={isManageEmployeesOpen}
          onOpenChange={setIsManageEmployeesOpen}
        />
      )}

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

      {canAccessDeliveryPartners && (
        <DeliveryPartnerDialog
          open={isLoginDialogOpen}
          onOpenChange={setIsLoginDialogOpen}
        />
      )}

      {/* حوار التليغرام - مختلف حسب الدور */}
      {isAdmin ? (
        <TelegramBotDialog 
          open={isTelegramOpen} 
          onOpenChange={setIsTelegramOpen} 
        />
      ) : (
        <RestrictedTelegramSettings 
          open={isTelegramOpen} 
          onOpenChange={setIsTelegramOpen}
        />
      )}

      {canAccessDeliveryPartners && (
        <DeliverySettingsDialog
          open={isDeliverySettingsOpen}
          onOpenChange={setIsDeliverySettingsOpen}
        />
      )}

      <RoleManagementDialog 
        open={isRoleManagerOpen} 
        onOpenChange={setIsRoleManagerOpen} 
      />
    </>
  );
};

export default SettingsPage;