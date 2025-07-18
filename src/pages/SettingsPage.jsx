import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useTheme } from '@/contexts/ThemeContext';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast.js';
import { 
  User, Store, Bot, Copy, Truck, LogIn, LogOut, Loader2, Users, Printer, 
  Settings as SettingsIcon, Home, Shield, FileText, Bell, Database, 
  Archive, Key, Download, Upload, Trash2, RefreshCw, MessageCircle, Mail,
  Sun, Moon, Monitor, Palette, ChevronRight, Volume2, DollarSign,
  BarChart, TrendingUp
} from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import TelegramBotDialog from '@/components/settings/TelegramBotDialog';

import DeliverySettingsDialog from '@/components/settings/DeliverySettingsDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditProfileDialog from '@/components/settings/EditProfileDialog';

import CustomerSettingsDialog from '@/components/settings/CustomerSettingsDialog';
import NotificationSettingsDialog from '@/components/settings/NotificationSettingsDialog';
import RestrictedStockSettings from '@/components/settings/RestrictedStockSettings';
import { PackageX } from 'lucide-react';
import EmployeeProfitsManager from '@/components/manage-employees/EmployeeProfitsManager';
import ReportsSettingsDialog from '@/components/settings/ReportsSettingsDialog';
import AppearanceDialog from '@/components/settings/AppearanceDialog';

// مكون حديث للبطاقات
const ModernCard = ({ icon: Icon, title, description, iconColor, onClick, children, isDisabled = false }) => (
  <Card 
    className={`group relative overflow-hidden transition-all duration-300 transform cursor-pointer hover:scale-[1.02] hover:shadow-xl border-border/50 backdrop-blur-sm ${
      isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/30'
    }`}
    onClick={!isDisabled ? onClick : undefined}
  >
    <CardHeader className="relative">
      <div className="flex items-center space-x-3 rtl:space-x-reverse">
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${iconColor} flex items-center justify-center shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </CardDescription>
        </div>
      </div>
    </CardHeader>
    {children && (
      <CardContent className="pt-0">
        {children}
      </CardContent>
    )}
  </Card>
);

// مكون عنوان القسم
const SectionHeader = ({ icon: Icon, title, description }) => (
  <div className="flex items-center space-x-4 rtl:space-x-reverse mb-6">
    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
      <Icon className="w-7 h-7 text-white" />
    </div>
    <div>
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      <p className="text-muted-foreground">{description}</p>
    </div>
  </div>
);

const SettingsPage = () => {
  const { user, handleLogout } = useAuth();
  const { settings, updateSettings } = useInventory();
  const { isLoggedIn: isWaseetLoggedIn, waseetUser, logout: logoutWaseet, setSyncInterval, syncInterval } = useAlWaseet();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  
  // استخدام نظام الصلاحيات المحكم - يجب استدعاؤه قبل أي early returns
  const {
    isAdmin,
    isEmployee,
    canManageEmployees,
    canManageSettings,
    canAccessDeliveryPartners,
    canManageAccounting,
    canManagePurchases
  } = usePermissionBasedData();
  
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  
  const [isCustomerSettingsOpen, setIsCustomerSettingsOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  
  const [isTelegramDialogOpen, setIsTelegramDialogOpen] = useState(false);
  const [isDeliverySettingsOpen, setIsDeliverySettingsOpen] = useState(false);
  const [isProfitsManagerOpen, setIsProfitsManagerOpen] = useState(false);

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

            <RestrictedStockSettings />
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

            {/* بوت التليغرام الذكي - للجميع */}
            <ModernCard
              icon={MessageCircle}
              title="بوت التليغرام الذكي"
              description="ربط حسابك مع التليغرام لاستقبال إشعارات ذكية"
              iconColor="from-blue-500 to-cyan-500"
              onClick={() => setIsTelegramDialogOpen(true)}
            />
          </div>

          <SectionHeader 
            icon={FileText} 
            title="إدارة التقارير والتكامل"
            description="تقارير مالية متقدمة، إحصائيات شاملة، وربط مع الأنظمة الخارجية"
          />
          
          <div className="grid grid-cols-1 gap-6 mb-8">
            {/* التقارير - للمدراء فقط */}
            {canManageSettings && (
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button className="h-auto py-3 px-4 flex flex-col items-center justify-center space-y-2">
                      <Download className="w-5 h-5" />
                      <span className="text-sm">تصدير PDF</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 flex flex-col items-center justify-center space-y-2">
                      <Mail className="w-5 h-5" />
                      <span className="text-sm">إرسال إيميل</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-5 h-5" />
                      <span className="text-sm">تحديث تلقائي</span>
                    </Button>
                  </div>
                </div>
              </ModernCard>
            )}
          </div>

          {/* أدوات النظام والنسخ الاحتياطي - للمدراء فقط */}
          {canManageSettings && (
            <>
              <SectionHeader 
                icon={Database} 
                title="أدوات النظام والنسخ الاحتياطي"
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

      <CustomerSettingsDialog 
        open={isCustomerSettingsOpen}
        onOpenChange={setIsCustomerSettingsOpen}
      />

      <ReportsSettingsDialog 
        open={isReportsOpen}
        onOpenChange={setIsReportsOpen}
      />

      {canManageEmployees && (
        <EmployeeProfitsManager 
          open={isProfitsManagerOpen}
          onOpenChange={setIsProfitsManagerOpen}
        />
      )}

      {canAccessDeliveryPartners && (
        <DeliveryPartnerDialog
          open={isLoginDialogOpen}
          onOpenChange={setIsLoginDialogOpen}
        />
      )}

      {/* حوار التليغرام الذكي - للجميع */}
      <TelegramBotDialog 
        open={isTelegramDialogOpen} 
        onOpenChange={setIsTelegramDialogOpen} 
      />

      {canAccessDeliveryPartners && (
        <DeliverySettingsDialog
          open={isDeliverySettingsOpen}
          onOpenChange={setIsDeliverySettingsOpen}
        />
      )}
    </>
  );
};

export default SettingsPage;