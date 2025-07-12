import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { 
  User, Store, Bot, Copy, Truck, LogIn, LogOut, Loader2, Users, Printer, 
  Settings as SettingsIcon, Home, Shield, FileText, Bell, Database, 
  Palette, Zap, Archive, Eye, Monitor, Sun, Moon, Smartphone, Volume2,
  Key, Download, Upload, Trash2, RefreshCw, MessageCircle, Mail
} from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditProfileDialog from '@/components/settings/EditProfileDialog';
import ManageEmployeesDialog from '@/components/settings/ManageEmployeesDialog';
import SecuritySettingsDialog from '@/components/settings/SecuritySettingsDialog';
import DeveloperSettingsDialog from '@/components/settings/DeveloperSettingsDialog';
import DisplaySettingsDialog from '@/components/settings/DisplaySettingsDialog';
import ReportsSettingsDialog from '@/components/settings/ReportsSettingsDialog';
import NotificationsSettingsDialog from '@/components/settings/NotificationsSettingsDialog';
import ProfileSecurityDialog from '@/components/settings/ProfileSecurityDialog';
import { useNavigate } from 'react-router-dom';

const SettingsSectionCard = ({ icon, title, description, children, footer, onClick, className, disabled = false, iconColor = "from-primary to-primary-dark" }) => {
  const Icon = icon;
  const cardClasses = `
    ${className} 
    ${onClick && !disabled ? 'cursor-pointer hover:border-primary hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:scale-[1.02]' : ''}
    ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
    border border-border/40 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${iconColor} shadow-md`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold">{title}</span>
        </CardTitle>
        {description && <CardDescription className="mt-1 text-sm text-muted-foreground">{description}</CardDescription>}
      </CardHeader>
      {children && <CardContent className="pt-0">{children}</CardContent>}
      {footer && <CardFooter className="pt-0">{footer}</CardFooter>}
    </Card>
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
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isDeveloperOpen, setIsDeveloperOpen] = useState(false);
  const [isDisplayOpen, setIsDisplayOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
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
  
  const handleCopyToken = () => {
    const token = `RYUS_${user?.id}_${Date.now()}`;
    navigator.clipboard.writeText(token);
    toast({
      title: "تم نسخ الرمز",
      description: "تم نسخ رمز الربط إلى الحافظة. سيكون متاحاً بعد ربط قاعدة البيانات."
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الإعدادات</h1>
          <p className="text-muted-foreground">قم بإدارة إعدادات حسابك وتفضيلات المتجر.</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* قسم الملف الشخصي والثيمات */}
            <div className="lg:col-span-1 space-y-6">
                <SettingsSectionCard 
                  icon={User} 
                  title="الملف الشخصي" 
                  description="تعديل معلوماتك الشخصية وإعدادات الحساب"
                  iconColor="from-blue-500 to-blue-700"
                  onClick={() => setIsEditProfileOpen(true)}
                >
                  <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                  </div>
                </SettingsSectionCard>

                {/* كارت المظهر والثيم */}
                <SettingsSectionCard
                  icon={Zap}
                  title="المظهر والثيم"
                  description="تخصيص مظهر التطبيق والإعدادات المتقدمة"
                  iconColor="from-purple-500 to-purple-700"
                  onClick={() => setIsDeveloperOpen(true)}
                />
            </div>
            
            {hasPermission('manage_app_settings') ? (
              <form onSubmit={handleStoreSettingsSubmit} className="lg:col-span-3">
                <SettingsSectionCard
                  icon={Store}
                  title="إعدادات المتجر والأجهزة"
                  description="إدارة الإعدادات العامة للمتجر والأجهزة المتصلة"
                  iconColor="from-green-500 to-green-700"
                  footer={
                    <Button type="submit" disabled={isStoreLoading} className="w-full">
                      {isStoreLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                      حفظ جميع الإعدادات
                    </Button>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-4 p-4 border rounded-lg bg-card/50">
                      <h4 className="font-semibold flex items-center gap-2 text-primary">
                        <SettingsIcon className="w-4 h-4" />
                        إعدادات عامة
                      </h4>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="deliveryFee" className="text-sm font-medium">أجور التوصيل (د.ع)</Label>
                          <Input 
                            id="deliveryFee" 
                            name="deliveryFee" 
                            type="number" 
                            value={storeSettings.deliveryFee} 
                            onChange={handleStoreSettingsChange} 
                            min="0"
                            className="text-center"
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

                    <div className="space-y-4 p-4 border rounded-lg bg-card/50">
                      <h4 className="font-semibold flex items-center gap-2 text-primary">
                        <Printer className="w-4 h-4" />
                        إعدادات الطباعة
                      </h4>
                      <div className="space-y-3">
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
                      <div className="space-y-4 p-4 border rounded-lg bg-card/50">
                        <h4 className="font-semibold flex items-center gap-2 text-primary">
                          <RefreshCw className="w-4 h-4" />
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
                </SettingsSectionCard>
              </form>
            ) : (
              <div className="lg:col-span-3">
                <SettingsSectionCard
                  icon={Store}
                  title="إعدادات المتجر والأجهزة"
                  description="هذه الإعدادات متاحة للمدير فقط. تحتاج صلاحيات إدارية للوصول."
                  iconColor="from-gray-400 to-gray-600"
                  disabled={true}
                />
              </div>
            )}

            <div className="lg:col-span-4 space-y-8">
              {/* قسم الإدارة والأمان */}
              <div>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-md">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  الإدارة والأمان
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {hasPermission('manage_users') ? (
                    <SettingsSectionCard
                      icon={Users}
                      title="إدارة الموظفين"
                      description="إدارة حسابات الموظفين وصلاحياتهم وتصنيفات المنتجات"
                      iconColor="from-purple-500 to-purple-700"
                      onClick={() => setIsManageEmployeesOpen(true)}
                    />
                  ) : (
                    <SettingsSectionCard
                      icon={Users}
                      title="إدارة الموظفين"
                      description="هذه الميزة متاحة للمدير فقط."
                      iconColor="from-gray-400 to-gray-600"
                      disabled={true}
                    />
                  )}

                  {hasPermission('view_security_settings') ? (
                    <SettingsSectionCard
                      icon={Key}
                      title="أمان الحساب"
                      description="كلمات المرور والمصادقة الثنائية"
                      iconColor="from-green-500 to-green-700"
                      onClick={() => setIsSecurityOpen(true)}
                    />
                  ) : (
                    <SettingsSectionCard
                      icon={Key}
                      title="أمان الحساب"
                      description="غير متاح لهذا المستخدم"
                      iconColor="from-gray-400 to-gray-600"
                      disabled={true}
                    />
                  )}

                  {hasPermission('manage_backup') && (
                    <SettingsSectionCard
                      icon={Archive}
                      title="النسخ الاحتياطي"
                      description="حفظ واستعادة بيانات النظام"
                      iconColor="from-indigo-500 to-indigo-700"
                      onClick={handleExportData}
                    />
                  )}

                  {hasPermission('manage_backup') && (
                    <SettingsSectionCard
                      icon={Database}
                      title="استيراد البيانات"
                      description="استيراد بيانات من ملفات خارجية"
                      iconColor="from-teal-500 to-teal-700"
                      onClick={handleImportData}
                    />
                  )}
                </div>
              </div>

              {/* قسم التطبيقات والتكامل */}
              <div>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-700 shadow-md">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  التطبيقات والتكامل
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hasPermission('use_telegram_bot') ? (
                    <SettingsSectionCard 
                      icon={MessageCircle} 
                      title="بوت التليغرام"
                      description="ربط النظام مع التليغرام لإدارة الطلبات"
                      iconColor="from-blue-400 to-blue-600"
                    >
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">استخدم هذا الرمز لربط حسابك مع بوت التليغرام:</p>
                        <div className="flex items-center gap-2">
                          <Input value={`RYUS_${user?.id}_TGBOT`} readOnly className="text-xs" />
                          <Button variant="outline" size="icon" onClick={handleCopyToken}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">سيكون متاحاً بعد ربط قاعدة البيانات</p>
                      </div>
                    </SettingsSectionCard>
                  ) : (
                    <SettingsSectionCard 
                      icon={MessageCircle} 
                      title="بوت التليغرام"
                      description="هذه الميزة غير متاحة لك"
                      iconColor="from-gray-400 to-gray-600"
                      disabled={true}
                    />
                  )}

                  {hasPermission('manage_delivery_company') ? (
                    <SettingsSectionCard 
                      icon={Truck} 
                      title="شركة التوصيل"
                      description="ربط مع أنظمة التوصيل الخارجية"
                      iconColor="from-red-500 to-red-700"
                    >
                      {isWaseetLoggedIn ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <p className="text-sm text-green-600 font-medium">متصل</p>
                          </div>
                          <p className="text-sm">الحساب: <span className="font-bold">{waseetUser?.username}</span></p>
                          <Button variant="destructive" size="sm" onClick={logoutWaseet} className="w-full">
                            <LogOut className="ml-2 w-4 h-4" />
                            قطع الاتصال
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <p className="text-sm text-red-600 font-medium">غير متصل</p>
                          </div>
                          <Button onClick={() => setIsLoginDialogOpen(true)} className="w-full">
                            <LogIn className="ml-2 w-4 h-4" />
                            تسجيل الدخول
                          </Button>
                        </div>
                      )}
                    </SettingsSectionCard>
                  ) : (
                    <SettingsSectionCard 
                      icon={Truck} 
                      title="شركة التوصيل"
                      description="هذه الميزة غير متاحة لك"
                      iconColor="from-gray-400 to-gray-600"
                      disabled={true}
                    />
                  )}

                  {hasPermission('manage_developer_settings') ? (
                    <SettingsSectionCard
                      icon={Palette}
                      title="إعدادات المطور"
                      description="تخصيص الألوان والثيمات المتقدمة"
                      iconColor="from-pink-500 to-pink-700"
                      onClick={() => setIsDeveloperOpen(true)}
                    />
                  ) : (
                    <SettingsSectionCard
                      icon={Palette}
                      title="إعدادات المطور"
                      description="غير متاح - تحتاج صلاحية خاصة"
                      iconColor="from-gray-400 to-gray-600"
                      disabled={true}
                    />
                  )}
                </div>
              </div>

              {/* قسم الإشعارات والاتصالات */}
              <div>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 shadow-md">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  الإشعارات والاتصالات
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {hasPermission('manage_notifications') && (
                    <SettingsSectionCard
                      icon={Bell}
                      title="الإشعارات"
                      description="إدارة إشعارات النظام والتنبيهات"
                      iconColor="from-orange-500 to-orange-700"
                      onClick={() => setIsNotificationsOpen(true)}
                    />
                  )}

                  {hasPermission('manage_notifications') && (
                    <SettingsSectionCard
                      icon={Smartphone}
                      title="الإشعارات المحمولة"
                      description="تنبيهات الهاتف المحمول"
                      iconColor="from-blue-500 to-blue-700"
                      onClick={() => toast({ title: "قريباً", description: "إشعارات الهاتف ستكون متاحة قريباً!" })}
                    />
                  )}

                  {hasPermission('manage_notifications') && (
                    <SettingsSectionCard
                      icon={Mail}
                      title="البريد الإلكتروني"
                      description="إعدادات إشعارات البريد"
                      iconColor="from-green-500 to-green-700"
                      onClick={() => toast({ title: "قريباً", description: "إشعارات البريد الإلكتروني ستكون متاحة قريباً!" })}
                    />
                  )}

                  {hasPermission('manage_notifications') && (
                    <SettingsSectionCard
                      icon={Volume2}
                      title="الأصوات"
                      description="إعدادات أصوات التنبيهات"
                      iconColor="from-purple-500 to-purple-700"
                      onClick={() => toast({ title: "الأصوات", description: "يمكنك التحكم في أصوات التنبيهات من إعدادات المتصفح." })}
                    />
                  )}
                </div>
              </div>

              {/* قسم التقارير والإشعارات */}
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-teal-600" />
                  التقارير والإشعارات
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hasPermission('view_accounting') && (
                    <SettingsSectionCard
                      icon={FileText}
                      title="التقارير"
                      description="إعدادات التقارير المالية"
                      iconColor="from-teal-500 to-teal-700"
                      onClick={() => navigate('/accounting')}
                    />
                  )}

                  <SettingsSectionCard
                    icon={Bell}
                    title="الإشعارات"
                    description="تنبيهات البريد والرسائل"
                    iconColor="from-yellow-500 to-yellow-700"
                    onClick={() => toast({ title: "قريباً", description: "إعدادات الإشعارات ستكون متاحة قريباً!" })}
                  />

                  <SettingsSectionCard
                    icon={Monitor}
                    title="العرض"
                    description="إعدادات الشاشة والتخطيط"
                    iconColor="from-indigo-500 to-indigo-700"
                    onClick={() => toast({ title: "قريباً", description: "إعدادات العرض ستكون متاحة قريباً!" })}
                  />
                </div>
              </div>
            </div>
        </div>
      </div>
      <ProfileSecurityDialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen} />
      <ManageEmployeesDialog open={isManageEmployeesOpen} onOpenChange={setIsManageEmployeesOpen} />
      <SecuritySettingsDialog open={isSecurityOpen} onOpenChange={setIsSecurityOpen} />
      <DeveloperSettingsDialog open={isDeveloperOpen} onOpenChange={setIsDeveloperOpen} />
      <DisplaySettingsDialog open={isDisplayOpen} onOpenChange={setIsDisplayOpen} />
      <ReportsSettingsDialog open={isReportsOpen} onOpenChange={setIsReportsOpen} />
      <NotificationsSettingsDialog open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen} />
      <DeliveryPartnerDialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen} />
    </>
  );
};

export default SettingsPage;