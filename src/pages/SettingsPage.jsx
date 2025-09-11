import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useInventory } from '@/contexts/InventoryContext'; // النظام الموحد
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ProfileDialog } from '@/components/ProfileDialog';
import { AppearanceDialog } from '@/components/AppearanceDialog';
import { NotificationDialog } from '@/components/NotificationDialog';
import { DeliveryPartnerDialog } from '@/components/DeliveryPartnerDialog';
import { InventoryManagementDialog } from '@/components/InventoryManagementDialog';
import { TelegramBotDialog } from '@/components/TelegramBotDialog';
import { TelegramSettingsDialog } from '@/components/TelegramSettingsDialog';
import { DeliveryManagementDialog } from '@/components/DeliveryManagementDialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { 
  User, Store, Bot, Copy, Truck, LogIn, LogOut, Loader2, Users, Printer, 
  Settings as SettingsIcon, Home, Shield, FileText, Bell, Database, 
  Archive, Key, Download, Upload, Trash2, RefreshCw, MessageCircle, Mail,
   Sun, Moon, Monitor, Palette, ChevronRight, PackageX, Volume2, DollarSign,
   BarChart, TrendingUp, Activity, Settings
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

// Modern Card Component with icon and gradient background
const ModernCard = ({ 
  icon: Icon, 
  title, 
  description, 
  children, 
  footer, 
  onClick, 
  action, 
  badge,
  iconColor = "from-blue-500 to-blue-600"
}) => {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer border-border/50 hover:border-primary/20 bg-card/50 backdrop-blur-sm" onClick={onClick}>
      {/* Gradient background overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-r ${iconColor} text-white shadow-lg`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                {title}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {description}
              </CardDescription>
            </div>
          </div>
          {badge && (
            <div className="flex-shrink-0">
              {badge}
            </div>
          )}
        </div>
      </CardHeader>
      
      {children && (
        <CardContent className="relative pt-0">
          {children}
        </CardContent>
      )}
      
      {(footer || action) && (
        <CardFooter className="relative pt-3 border-t border-border/30">
          <div className="flex items-center justify-between w-full">
            {footer}
            {action && (
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                {action}
                <ChevronRight className="w-4 h-4 mr-1" />
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

// Section Header Component
const SectionHeader = ({ icon: Icon, title, description }) => {
  return (
    <div className="space-y-2 mb-6">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>
      <div className="h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
    </div>
  );
};

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuth();
  const { 
    isAdmin, 
    canManageEmployees, 
    canAccessDeliveryPartners, 
    canViewAllData,
    isEmployee,
    isSuperAdmin 
  } = usePermissions();
  const { 
    productStats,
    stockAlerts
  } = useInventory();
  const { isLoggedIn: isAlWaseetLoggedIn } = useAlWaseet();
  const { theme } = useTheme();

  // State management for dialogs
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isDeliveryPartnersOpen, setIsDeliveryPartnersOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isTelegramSettingsOpen, setIsTelegramSettingsOpen] = useState(false);
  const [isDeliveryManagementOpen, setIsDeliveryManagementOpen] = useState(false);

  // State for user data and settings
  const [userSettings, setUserSettings] = useState({});
  const [employeeCodes, setEmployeeCodes] = useState([]);

  // Load user-specific data
  useEffect(() => {
    if (user?.id && canViewAllData) {
      loadEmployeeCodes();
    }
  }, [user?.id, canViewAllData]);

  const loadEmployeeCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('telegram_employee_codes')
        .select('*')
        .eq('is_active', true);
      
      if (!error) {
        setEmployeeCodes(data || []);
      }
    } catch (error) {
      console.error('Error loading employee codes:', error);
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>الإعدادات - نظام إدارة المخازن</title>
        <meta name="description" content="إدارة إعدادات النظام والحساب الشخصي وشركاء التوصيل والإشعارات" />
        <meta name="keywords" content="إعدادات، حساب، شركاء التوصيل، إشعارات، نظام إدارة" />
      </Helmet>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">إعدادات النظام</h1>
              <p className="text-muted-foreground">إدارة حسابك وإعدادات النظام</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Account & Security Section */}
          <div>
            <SectionHeader 
              icon={Shield} 
              title="الحساب والأمان" 
              description="إدارة معلومات حسابك الشخصي وإعدادات الأمان والمظهر"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* User Profile */}
              <ModernCard
                icon={User}
                title="الملف الشخصي"
                description="إدارة معلوماتك الشخصية وإعدادات الحساب"
                iconColor="from-blue-500 to-blue-600"
                onClick={() => setIsProfileOpen(true)}
              >
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الاسم</span>
                    <span className="font-medium text-foreground">{user?.profile?.full_name || 'غير محدد'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">البريد الإلكتروني</span>
                    <span className="font-medium text-foreground">{user?.profile?.email || 'غير محدد'}</span>
                  </div>
                </div>
              </ModernCard>

              {/* Appearance Settings */}
              <ModernCard
                icon={Palette}
                title="المظهر والواجهة"
                description="تخصيص ألوان ومظهر النظام"
                iconColor="from-purple-500 to-purple-600"
                onClick={() => setIsAppearanceOpen(true)}
              >
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">المظهر الحالي</span>
                    <div className="flex items-center gap-2">
                      {theme === 'light' && <Sun className="w-4 h-4 text-yellow-500" />}
                      {theme === 'dark' && <Moon className="w-4 h-4 text-blue-500" />}
                      {theme === 'system' && <Monitor className="w-4 h-4 text-gray-500" />}
                      <span className="font-medium">
                        {theme === 'light' ? 'فاتح' : theme === 'dark' ? 'داكن' : 'النظام'}
                      </span>
                    </div>
                  </div>
                </div>
              </ModernCard>

              {/* Notifications */}
              <ModernCard
                icon={Bell}
                title="الإشعارات"
                description="إدارة إشعارات النظام والتنبيهات"
                iconColor="from-green-500 to-green-600"
                onClick={() => setIsNotificationOpen(true)}
              >
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الإشعارات الصوتية</span>
                    <span className="font-bold text-green-600">مفعلة</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">إشعارات سطح المكتب</span>
                    <span className="font-bold text-blue-600">مفعلة</span>
                  </div>
                </div>
              </ModernCard>
            </div>
          </div>

          {/* Employee & Customer Management */}
          <div>
            <SectionHeader 
              icon={Users} 
              title="إدارة الموظفين والعملاء" 
              description="إدارة الموظفين والعملاء وشركاء التوصيل"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Delivery Partners */}
              {canAccessDeliveryPartners && (
                <ModernCard
                  icon={Truck}
                  title="شركاء التوصيل"
                  description="إدارة حسابات شركات التوصيل والاتصال بواجهاتها البرمجية"
                  iconColor="from-orange-500 to-orange-600"
                  onClick={() => setIsDeliveryPartnersOpen(true)}
                  badge={
                    <Badge variant="outline" className={isAlWaseetLoggedIn ? "bg-green-50 text-green-700 border-green-300" : "bg-red-50 text-red-700 border-red-300"}>
                      {isAlWaseetLoggedIn ? 'متصل' : 'غير متصل'}
                    </Badge>
                  }
                >
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">الوسيط</span>
                      <span className={`font-bold ${isAlWaseetLoggedIn ? 'text-green-600' : 'text-red-600'}`}>
                        {isAlWaseetLoggedIn ? 'متصل' : 'غير متصل'}
                      </span>
                    </div>
                  </div>
                </ModernCard>
              )}
            </div>
          </div>

          {/* External Services */}
          <div>
            <SectionHeader 
              icon={Activity} 
              title="الخدمات الخارجية" 
              description="إدارة الروبوتات والخدمات المتكاملة"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Advanced Delivery Management - Admins Only */}
              {isAdmin && (
                <ModernCard
                  icon={Settings}
                  title="إدارة التوصيل المتقدمة"
                  description="مزامنة شاملة للطلبات والفواتير وإدارة إعدادات التوصيل المتقدمة"
                  iconColor="from-indigo-500 to-indigo-600"
                  onClick={() => setIsDeliveryManagementOpen(true)}
                  badge={
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                      مدير فقط
                    </Badge>
                  }
                >
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">مزامنة تلقائية</span>
                      <span className="font-bold text-green-600">مفعلة</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">آخر مزامنة شاملة</span>
                      <span className="font-bold text-blue-600">منذ ساعة</span>
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

              {/* إعدادات التليغرام الشخصية */}
              <ModernCard
                icon={Settings}
                title="إعدادات التليغرام الذكي"
                description="الموافقة التلقائية للطلبات والوجهة الافتراضية"
                iconColor="from-purple-500 to-purple-600"
                onClick={() => setIsTelegramSettingsOpen(true)}
                badge={
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                    شخصي
                  </Badge>
                }
              >
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الموافقة التلقائية</span>
                    <span className="font-bold text-purple-600">معطلة</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الوجهة الافتراضية</span>
                    <span className="font-bold text-blue-600">محلي</span>
                  </div>
                </div>
              </ModernCard>
            </div>
          </div>

          {/* System Management */}
          <div>
            <SectionHeader 
              icon={Database} 
              title="إدارة النظام" 
              description="المخزون والتقارير وإدارة البيانات"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Inventory Management */}
              <ModernCard
                icon={Store}
                title="إدارة المخزون"
                description="إدارة المنتجات والفئات وتنبيهات المخزون"
                iconColor="from-teal-500 to-teal-600"
                onClick={() => setIsInventoryOpen(true)}
              >
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">إجمالي المنتجات</span>
                    <span className="font-bold text-teal-600">{productStats?.totalProducts || '0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">تنبيهات المخزون</span>
                    <span className={`font-bold ${stockAlerts?.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {stockAlerts?.length || '0'}
                    </span>
                  </div>
                </div>
              </ModernCard>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ProfileDialog 
        open={isProfileOpen} 
        onOpenChange={setIsProfileOpen} 
      />
      
      <AppearanceDialog 
        open={isAppearanceOpen} 
        onOpenChange={setIsAppearanceOpen} 
      />
      
      <NotificationDialog 
        open={isNotificationOpen} 
        onOpenChange={setIsNotificationOpen} 
      />
      
      <DeliveryPartnerDialog 
        open={isDeliveryPartnersOpen} 
        onOpenChange={setIsDeliveryPartnersOpen} 
      />
      
      <InventoryManagementDialog 
        open={isInventoryOpen} 
        onOpenChange={setIsInventoryOpen} 
      />
      
      <TelegramBotDialog 
        open={isTelegramOpen} 
        onOpenChange={setIsTelegramOpen} 
      />
      
      <TelegramSettingsDialog 
        open={isTelegramSettingsOpen} 
        onOpenChange={setIsTelegramSettingsOpen} 
      />
      
      <DeliveryManagementDialog 
        open={isDeliveryManagementOpen} 
        onOpenChange={setIsDeliveryManagementOpen} 
      />
    </>
  );
}

export default SettingsPage;