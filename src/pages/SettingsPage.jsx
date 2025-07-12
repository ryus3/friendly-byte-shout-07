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
  Sun, Moon, Monitor, Palette, ChevronRight
} from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditProfileDialog from '@/components/settings/EditProfileDialog';
import CustomerSettingsDialog from '@/components/settings/CustomerSettingsDialog';

import ReportsSettingsDialog from '@/components/settings/ReportsSettingsDialog';
import ProfileSecurityDialog from '@/components/settings/ProfileSecurityDialog';
import AppearanceDialog from '@/components/settings/AppearanceDialog';
import SystemIntegrityTest from '@/components/test/SystemIntegrityTest';

const ModernCard = ({ icon, title, description, children, footer, onClick, className, disabled = false, iconColor = "from-primary to-primary-dark", action, badge }) => {
  const Icon = icon;
  const cardClasses = `
    ${className} 
    group relative overflow-hidden
    ${onClick && !disabled ? 'cursor-pointer hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-1' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    bg-card border border-border/50 rounded-xl backdrop-blur-sm
    transition-all duration-300 ease-out
    shadow-lg hover:shadow-2xl
    ${!disabled ? 'hover:border-primary/40' : ''}
  `;
  
  const handleClick = (e) => {
    if (disabled) {
      e.preventDefault();
      toast({ title: "غير متاح", description: "هذه الميزة غير متاحة حالياً أو لا تملك الصلاحيات الكافية.", variant: "destructive" });
    } else if (onClick) {
      onClick(e);
    }
  };

  return (
    <Card className={cardClasses} onClick={handleClick}>
      {/* Background gradient effect */}
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
            {onClick && !disabled && (
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
  
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  
  const [storeSettings, setStoreSettings] = useState({
    deliveryFee: 5000,
    lowStockThreshold: 5,
    mediumStockThreshold: 10,
    printer: { paperSize: 'a4', orientation: 'portrait' }
  });
  
  useEffect(() => {
    if (settings) {
      setStoreSettings(prev => ({
        ...prev,
        deliveryFee: settings.deliveryFee || 5000,
        lowStockThreshold: settings.lowStockThreshold || 5,
        mediumStockThreshold: settings.mediumStockThreshold || 10,
        printer: settings.printer || { paperSize: 'a4', orientation: 'portrait' }
      }));
    }
  }, [settings, user]);
  
  const handleStoreSettingsChange = (e) => {
      const { name, value } = e.target;
      const numValue = Number(value);
      if (numValue >= 0) {
        setStoreSettings(prev => ({ ...prev, [name]: numValue }));
      }
  };

  const handlePrinterSettingChange = (key, value) => {
    setStoreSettings(prev => ({ ...prev, printer: { ...prev.printer, [key]: value } }));
  }

  const handleStoreSettingsSubmit = async (e) => {
    e.preventDefault();
    setIsStoreLoading(true);
    await updateSettings(storeSettings);
    setIsStoreLoading(false);
  };
  
  const handleCopyToken = (employeeId) => {
    const shortCode = `BOT_${user?.id?.slice(-4) || 'USER'}_${employeeId || 'MAIN'}`;
    navigator.clipboard.writeText(shortCode);
    toast({
      title: "تم نسخ الرمز المختصر",
      description: `رمز التليجرام: ${shortCode}`
    });
  };

  const handleExportData = () => {
    toast({
      title: "تصدير البيانات",
      description: "سيتم تصدير البيانات إلى ملف Excel قريباً!"
    });
  };

  const handleImportData = () => {
    toast({
      title: "استيراد البيانات", 
      description: "ميزة استيراد البيانات ستكون متاحة قريباً!"
    });
  };

  if (!user) return <div className="flex h-full w-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <>
      <Helmet>
        <title>الإعدادات - نظام RYUS</title>
        <meta name="description" content="إدارة إعدادات حسابك والمتجر." />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
        <div className="container mx-auto px-6 py-8 space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              الإعدادات
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              قم بإدارة إعدادات حسابك وتخصيص تجربة استخدام النظام
            </p>
          </div>

          {/* Profile Section */}
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
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-secondary/30 to-secondary/10 rounded-lg border border-primary/10">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded">{user.role}</span>
                      <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">نشط</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <Shield className="w-4 h-4 text-green-500" />
                    <div>
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">أمان محسن</span>
                      <p className="text-xs text-green-500 opacity-70">التحقق بخطوتين</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Key className="w-4 h-4 text-blue-500" />
                    <div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">كلمة مرور قوية</span>
                      <p className="text-xs text-blue-500 opacity-70">محدثة مؤخراً</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <Bell className="w-4 h-4 text-purple-500" />
                    <div>
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400">إشعارات الدخول</span>
                      <p className="text-xs text-purple-500 opacity-70">مفعلة</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <LogIn className="w-4 h-4 text-orange-500" />
                    <div>
                      <span className="text-xs font-medium text-orange-600 dark:text-orange-400">جلسة آمنة</span>
                      <p className="text-xs text-orange-500 opacity-70">انتهاء تلقائي</p>
                    </div>
                  </div>
                </div>
              </div>
            </ModernCard>


            <ModernCard
              icon={Palette}
              title="المظهر والثيم"
              description="تخصيص مظهر التطبيق والألوان والخطوط والعرض"
              iconColor="from-purple-500 to-purple-600"
              onClick={() => setIsAppearanceOpen(true)}
            >
              <div className="space-y-6">
                {/* Theme Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">نمط العرض الحالي</Label>
                  <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                    <div className="p-2 rounded-lg bg-primary/10">
                      {theme === 'light' ? (
                        <Sun className="w-5 h-5 text-yellow-500" />
                      ) : theme === 'dark' ? (
                        <Moon className="w-5 h-5 text-blue-400" />
                      ) : (
                        <Monitor className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {theme === 'light' ? 'النمط الفاتح' : theme === 'dark' ? 'النمط الداكن' : 'النمط التلقائي'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        اضغط للتخصيص المتقدم
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Theme Toggle */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                    className="flex flex-col items-center gap-1 h-auto py-2"
                  >
                    <Sun className="w-3 h-3" />
                    <span className="text-xs">فاتح</span>
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                    className="flex flex-col items-center gap-1 h-auto py-2"
                  >
                    <Moon className="w-3 h-3" />
                    <span className="text-xs">داكن</span>
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('system')}
                    className="flex flex-col items-center gap-1 h-auto py-2"
                  >
                    <Monitor className="w-3 h-3" />
                    <span className="text-xs">تلقائي</span>
                  </Button>
                </div>

                {/* Features Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <span className="text-xs text-blue-600 dark:text-blue-400">🎨 أنماط ألوان متقدمة</span>
                    <ChevronRight className="w-3 h-3 text-blue-500" />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-xs text-green-600 dark:text-green-400">📝 أحجام خطوط مخصصة</span>
                    <ChevronRight className="w-3 h-3 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                    <span className="text-xs text-purple-600 dark:text-purple-400">✨ تأثيرات بصرية متقدمة</span>
                    <ChevronRight className="w-3 h-3 text-purple-500" />
                  </div>
                </div>
              </div>
            </ModernCard>
          </div>

          {/* Store Management - Unified Section */}
          {hasPermission('manage_app_settings') && (
            <>
              <SectionHeader 
                icon={Store} 
                title="إدارة المتجر"
                description="إعدادات المتجر والتوصيل والمزامنة والموظفين"
              />
              
              {/* Main Management Row - Professional Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <ModernCard
                  icon={Truck}
                  title="شركة التوصيل"
                  description="إدارة إعدادات شركات التوصيل والشحن"
                  iconColor="from-blue-500 to-blue-600"
                  onClick={() => setIsLoginDialogOpen(true)}
                >
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">حالة الاتصال</p>
                      <p className="text-xs text-blue-500 opacity-70">
                        {isWaseetLoggedIn ? 'متصل بالوسيط' : 'غير متصل'}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      اضغط لإدارة إعدادات التوصيل والشحن
                    </div>
                  </div>
                </ModernCard>

                <ModernCard
                  icon={Bot}
                  title="بوت التليغرام"
                  description="إدارة بوت التليغرام والاشعارات التلقائية"
                  iconColor="from-cyan-500 to-cyan-600"
                >
                  <div className="space-y-3">
                    <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                      <p className="text-sm font-medium text-cyan-600 dark:text-cyan-400">حالة البوت</p>
                      <p className="text-xs text-cyan-500 opacity-70">جاهز للاستخدام</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleCopyToken(user?.id)} className="w-full">
                      <Copy className="w-3 h-3 ml-1" />
                      نسخ رمز البوت الشخصي
                    </Button>
                  </div>
                </ModernCard>

                <ModernCard
                  icon={Users}
                  title="إدارة الموظفين"
                  description="إدارة الموظفين والصلاحيات والمراجعة"
                  iconColor="from-purple-500 to-purple-600"
                  onClick={() => setIsManageEmployeesOpen(true)}
                >
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-400">عدد الموظفين</p>
                      <p className="text-xs text-purple-500 opacity-70">نشط حالياً</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      اضغط لإدارة الموظفين والصلاحيات
                    </div>
                  </div>
                </ModernCard>

                <ModernCard
                  icon={Bell}
                  title="الإشعارات"
                  description="إدارة إعدادات الإشعارات والتنبيهات"
                  iconColor="from-orange-500 to-orange-600"
                  onClick={() => navigate('/notifications')}
                  className="bg-gradient-to-br from-background to-orange-50/30 dark:to-orange-950/30"
                >
                  <div className="space-y-3">
                    <div className="p-3 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
                      <p className="text-sm font-medium text-orange-600 dark:text-orange-400">الحالة</p>
                      <p className="text-xs text-orange-500 opacity-70">مفعلة</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      تخصيص أصوات الإشعارات والتنبيهات
                    </div>
                  </div>
                </ModernCard>
              </div>

              {/* Second Row - Customer Settings */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <ModernCard
                  icon={Users}
                  title="إعدادات الزبائن"
                  description="إدارة الاسم الافتراضي للزبائن في الطلبات"
                  iconColor="from-emerald-500 to-emerald-600"
                  onClick={() => setIsCustomerSettingsOpen(true)}
                  disabled={!hasPermission('manage_default_customer_name')}
                  className="lg:col-span-1"
                >
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <User className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-emerald-700 dark:text-emerald-300">اسم الزبون الافتراضي</h4>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">يظهر تلقائياً في الطلبات الجديدة</p>
                        </div>
                      </div>
                      
                      <div className="bg-white/50 dark:bg-black/20 p-3 rounded border">
                        <p className="text-sm font-medium text-foreground">
                          {user?.default_customer_name || 'لم يتم تعيين اسم افتراضي'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          اضغط لتعديل الاسم الافتراضي للزبائن
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <MessageCircle className="w-4 h-4 text-blue-500" />
                        <div>
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">قابل للتعديل</span>
                          <p className="text-xs text-blue-500 opacity-70">في كل طلب</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <RefreshCw className="w-4 h-4 text-purple-500" />
                        <div>
                          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">تلقائي</span>
                          <p className="text-xs text-purple-500 opacity-70">ملء فوري</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </ModernCard>
              </div>
              
              <form onSubmit={handleStoreSettingsSubmit}>
                <ModernCard
                  icon={Store}
                  title="إعدادات المتجر والأجهزة"
                  description="تكوين الإعدادات الأساسية للمتجر والطباعة"
                  iconColor="from-green-500 to-green-600"
                  footer={
                    <Button type="submit" disabled={isStoreLoading} className="w-full" size="lg">
                      {isStoreLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                      حفظ جميع الإعدادات
                    </Button>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4 p-5 border border-border/30 rounded-xl bg-card">
                      <h4 className="font-semibold flex items-center gap-2 text-primary text-lg">
                        <SettingsIcon className="w-5 h-5" />
                        إعدادات عامة
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="deliveryFee" className="text-sm font-medium">أجور التوصيل (د.ع)</Label>
                          <Input 
                            id="deliveryFee" 
                            name="deliveryFee" 
                            type="number" 
                            value={storeSettings.deliveryFee} 
                            onChange={handleStoreSettingsChange} 
                            min="0"
                            className="text-center text-lg font-semibold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lowStockThreshold" className="text-sm font-medium">حد المخزون المنخفض</Label>
                          <Input 
                            id="lowStockThreshold" 
                            name="lowStockThreshold" 
                            type="number" 
                            value={storeSettings.lowStockThreshold} 
                            onChange={handleStoreSettingsChange} 
                            min="0"
                            className="text-center"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mediumStockThreshold" className="text-sm font-medium">حد المخزون المتوسط</Label>
                          <Input 
                            id="mediumStockThreshold" 
                            name="mediumStockThreshold" 
                            type="number" 
                            value={storeSettings.mediumStockThreshold} 
                            onChange={handleStoreSettingsChange} 
                            min="0"
                            className="text-center"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-5 border border-border/30 rounded-xl bg-secondary/20">
                      <h4 className="font-semibold flex items-center gap-2 text-primary text-lg">
                        <Printer className="w-5 h-5" />
                        إعدادات الطباعة
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">حجم ورق الملصقات</Label>
                          <Select value={storeSettings.printer.paperSize} onValueChange={(v) => handlePrinterSettingChange('paperSize', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="a4">A4</SelectItem>
                              <SelectItem value="label-100x50">ملصق 100x50mm</SelectItem>
                              <SelectItem value="label-50x25">ملصق 50x25mm</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">اتجاه الطباعة</Label>
                          <Select value={storeSettings.printer.orientation} onValueChange={(v) => handlePrinterSettingChange('orientation', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="portrait">عمودي (Portrait)</SelectItem>
                              <SelectItem value="landscape">أفقي (Landscape)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {hasPermission('manage_delivery_sync') && (
                      <div className="space-y-4 p-5 border border-border/30 rounded-xl bg-secondary/20">
                        <h4 className="font-semibold flex items-center gap-2 text-primary text-lg">
                          <RefreshCw className="w-5 h-5" />
                          المزامنة التلقائية
                        </h4>
                        <div className="space-y-2">
                          <Label htmlFor="syncInterval" className="text-sm font-medium">فترة مزامنة الطلبات</Label>
                          <Select value={String(syncInterval)} onValueChange={(v) => setSyncInterval(Number(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="300000">كل 5 دقائق</SelectItem>
                              <SelectItem value="900000">كل 15 دقيقة</SelectItem>
                              <SelectItem value="1800000">كل 30 دقيقة</SelectItem>
                              <SelectItem value="3600000">كل ساعة</SelectItem>
                              <SelectItem value="21600000">كل 6 ساعات</SelectItem>
                              <SelectItem value="86400000">كل 24 ساعة</SelectItem>
                              <SelectItem value="0">إيقاف</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </ModernCard>
              </form>
            </>
          )}

          {/* Management Tools */}
          <SectionHeader 
            icon={Shield} 
            title="الأدوات والخدمات"
            description="إشعارات وتقارير وأدوات متقدمة"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ModernCard
              icon={Bell}
              title="مركز الإشعارات"
              description="إدارة الإشعارات والتنبيهات الفورية"
              iconColor="from-orange-500 to-orange-600"
              onClick={() => navigate('/notifications')}
            >
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">الإشعارات الفورية</p>
                  <p className="text-xs text-orange-500 opacity-70">متاحة مع ألوان تصنيفية</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  اضغط لعرض وإدارة جميع الإشعارات
                </div>
              </div>
            </ModernCard>
            
            <ModernCard
              icon={FileText}
              title="فحص وتقارير النظام"
              description="فحص سلامة النظام وتصدير التقارير"
              iconColor="from-green-500 to-green-600"
              onClick={() => setIsReportsOpen(true)}
            >
              <div className="space-y-3">
                <SystemIntegrityTest />
              </div>
            </ModernCard>
          </div>

          {/* Tools and Security Section */}
          <SectionHeader 
            icon={SettingsIcon} 
            title="أدوات النظام والأمان"
            description="أدوات مساعدة وإعدادات الأمان المتقدمة"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ModernCard
              icon={FileText}
              title="التقارير"
              description="إنشاء وإدارة التقارير المالية"
              iconColor="from-teal-500 to-teal-600"
              onClick={() => setIsReportsOpen(true)}
            />

            <ModernCard
              icon={Archive}
              title="النسخ الاحتياطي"
              description="نسخ احتياطية واستعادة البيانات"
              iconColor="from-indigo-500 to-indigo-600"
              onClick={handleExportData}
            />

          </div>

          {/* Integration and Data Section */}
          {hasPermission('manage_integrations') && (
            <>
              <SectionHeader 
                icon={Database} 
                title="التكامل وإدارة البيانات"
                description="استيراد وتصدير البيانات والتكامل مع الأنظمة الخارجية"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ModernCard
                  icon={Upload}
                  title="استيراد البيانات"
                  description="استيراد البيانات من ملفات خارجية"
                  iconColor="from-indigo-500 to-indigo-600"
                  onClick={handleImportData}
                />

                <ModernCard
                  icon={Download}
                  title="تصدير البيانات"
                  description="تصدير البيانات إلى ملفات Excel"
                  iconColor="from-green-500 to-green-600"
                  onClick={handleExportData}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <ProfileSecurityDialog 
        open={isEditProfileOpen} 
        onOpenChange={setIsEditProfileOpen} 
      />
      
      <AppearanceDialog 
        open={isAppearanceOpen} 
        onOpenChange={setIsAppearanceOpen} 
      />
      
      {hasPermission('manage_users') && (
        <ManageEmployeesDialog 
          open={isManageEmployeesOpen} 
          onOpenChange={setIsManageEmployeesOpen} 
        />
      )}
      
      {hasPermission('manage_app_settings') && (
        <>
          <ReportsSettingsDialog 
            open={isReportsOpen} 
            onOpenChange={setIsReportsOpen} 
          />
        </>
      )}
      
      <CustomerSettingsDialog
        open={isCustomerSettingsOpen}
        onOpenChange={setIsCustomerSettingsOpen}
      />
      
      <DeliveryPartnerDialog
        open={isLoginDialogOpen}
        onOpenChange={setIsLoginDialogOpen}
      />
    </>
  );
};

export default SettingsPage;