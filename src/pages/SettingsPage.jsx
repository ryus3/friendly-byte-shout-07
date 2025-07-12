import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { 
  User, Store, Bot, Copy, Truck, LogIn, LogOut, Loader2, Users, Printer, 
  Settings as SettingsIcon, Home, Shield, FileText, Bell, Database, 
  Palette, Zap, Archive, Eye, Monitor
} from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditProfileDialog from '@/components/settings/EditProfileDialog';
import ManageProductCategoriesDialog from '@/components/settings/ManageProductCategoriesDialog';
import { useNavigate } from 'react-router-dom';

const SettingsSectionCard = ({ icon, title, description, children, footer, onClick, className, disabled = false, iconColor = "text-primary" }) => {
  const Icon = icon;
  const cardClasses = `
    ${className} 
    ${onClick && !disabled ? 'cursor-pointer hover:border-primary hover:shadow-md transition-all duration-200' : ''}
    ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
    border-2
  `;
  
  const handleClick = (e) => {
    if (disabled) {
      e.preventDefault();
      toast({ title: "غير متاح", description: "هذه الميزة غير متاحة حالياً.", variant: "destructive" });
    } else if (onClick) {
      onClick(e);
    }
  };

  return (
    <Card className={cardClasses} onClick={handleClick}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${iconColor}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl">{title}</span>
        </CardTitle>
        {description && <CardDescription className="mt-2 text-sm">{description}</CardDescription>}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
};

const SettingsPage = () => {
  const { user, hasPermission, updateUser } = useAuth();
  const { settings, updateSettings } = useInventory();
  const { isLoggedIn: isWaseetLoggedIn, waseetUser, logout: logoutWaseet, setSyncInterval, syncInterval } = useAlWaseet();
  const navigate = useNavigate();
  
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isCategoriesDialogOpen, setIsCategoriesDialogOpen] = useState(false);
  
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
    toast({
      title: "🚧 هذه الميزة غير مطبقة بعد",
      description: "لكن لا تقلق! يمكنك طلبها في الرسالة التالية! 🚀"
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
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 space-y-8">
                <SettingsSectionCard 
                  icon={User} 
                  title="الملف الشخصي" 
                  description="تعديل معلوماتك الشخصية، كلمة المرور، والنمط."
                  onClick={() => setIsEditProfileOpen(true)}
                >
                  <CardContent>
                    <div className="space-y-2">
                        <p className="font-semibold">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </CardContent>
                </SettingsSectionCard>
            </div>
            
            {hasPermission('manage_app_settings') ? (
              <form onSubmit={handleStoreSettingsSubmit} className="lg:col-span-2">
                <SettingsSectionCard
                  icon={Store}
                  title="إعدادات المتجر والأجهزة"
                  footer={<Button type="submit" disabled={isStoreLoading}>{isStoreLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ الإعدادات</Button>}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h4 className="font-semibold flex items-center gap-2"><SettingsIcon className="w-4 h-4" />إعدادات عامة</h4>
                      <div className="space-y-2">
                        <Label htmlFor="deliveryFee">أجور التوصيل (د.ع)</Label>
                        <Input id="deliveryFee" name="deliveryFee" type="number" value={storeSettings.deliveryFee} onChange={handleStoreSettingsChange} min="0" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lowStockThreshold">حد المخزون المنخفض</Label>
                        <Input id="lowStockThreshold" name="lowStockThreshold" type="number" value={storeSettings.lowStockThreshold} onChange={handleStoreSettingsChange} min="0" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mediumStockThreshold">حد المخزون المتوسط</Label>
                        <Input id="mediumStockThreshold" name="mediumStockThreshold" type="number" value={storeSettings.mediumStockThreshold} onChange={handleStoreSettingsChange} min="0" />
                      </div>
                    </div>
                     <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold flex items-center gap-2"><Printer className="w-4 h-4" />إعدادات الطباعة</h4>
                         <div className="space-y-2">
                            <Label>حجم ورق الملصقات</Label>
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
                            <Label>اتجاه الطباعة</Label>
                            <Select value={storeSettings.printer.orientation} onValueChange={(v) => handlePrinterSettingChange('orientation', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="portrait">عمودي (Portrait)</SelectItem>
                                    <SelectItem value="landscape">أفقي (Landscape)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         {hasPermission('manage_delivery_sync') && (
                          <div className="space-y-2">
                            <Label htmlFor="syncInterval">المزامنة التلقائية للطلبات</Label>
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
                        )}
                     </div>
                  </div>
                </SettingsSectionCard>
              </form>
            ) : (
                 <SettingsSectionCard
                  icon={Store}
                  title="إعدادات المتجر والأجهزة"
                  description="هذه الإعدادات متاحة للمدير فقط."
                  disabled={true}
                />
            )}

            <div className="lg:col-span-3 space-y-8">
              {/* قسم الإدارة والأمان */}
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-blue-600" />
                  الإدارة والأمان
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hasPermission('manage_users') ? (
                    <SettingsSectionCard
                      icon={Users}
                      title="إدارة الموظفين"
                      description="إدارة حسابات الموظفين، أدوارهم، وصلاحيات الوصول."
                      iconColor="from-purple-500 to-purple-700"
                      onClick={() => navigate('/manage-employees')}
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

                  {hasPermission('view_settings') && (
                    <SettingsSectionCard
                      icon={Shield}
                      title="الأمان"
                      description="إعدادات الحماية والخصوصية"
                      iconColor="from-green-500 to-green-700"
                      onClick={() => toast({ title: "قريباً", description: "هذه الميزة ستكون متاحة قريباً!" })}
                    />
                  )}

                  <SettingsSectionCard
                    icon={Archive}
                    title="النسخ الاحتياطي"
                    description="حفظ واستعادة البيانات"
                    iconColor="from-blue-500 to-blue-700"
                    onClick={() => toast({ title: "قريباً", description: "ميزة النسخ الاحتياطي ستكون متاحة قريباً!" })}
                  />
                </div>
              </div>

              {/* قسم التطبيقات والتكامل */}
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-yellow-600" />
                  التطبيقات والتكامل
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <SettingsSectionCard 
                    icon={Bot} 
                    title="بوت التليغرام"
                    description="ربط النظام مع التليغرام"
                    iconColor="from-blue-400 to-blue-600"
                    disabled={!hasPermission('use_ai_assistant')}
                  >
                    <p className="text-sm text-muted-foreground mb-3">استخدم هذا الرمز لربط حسابك مع بوت التليغرام.</p>
                    <div className="flex items-center gap-2">
                      <Input value={'قيد التطوير...'} readOnly />
                      <Button variant="outline" size="icon" onClick={handleCopyToken}><Copy className="w-4 h-4" /></Button>
                    </div>
                  </SettingsSectionCard>

                  <SettingsSectionCard 
                    icon={Truck} 
                    title="شركة التوصيل"
                    description="ربط مع أنظمة التوصيل"
                    iconColor="from-red-500 to-red-700"
                    disabled={!hasPermission('manage_delivery_company')}
                  >
                    {isWaseetLoggedIn ? (
                      <div className="space-y-3">
                        <p className="text-sm text-green-500">متصل بحساب: <span className="font-bold">{waseetUser?.username}</span></p>
                        <Button variant="destructive" size="sm" onClick={logoutWaseet}><LogOut className="ml-2 w-4 h-4" />تسجيل الخروج</Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">أنت غير متصل بحساب شركة التوصيل.</p>
                        <Button onClick={() => setIsLoginDialogOpen(true)}><LogIn className="ml-2 w-4 h-4" />تسجيل الدخول</Button>
                      </div>
                    )}
                  </SettingsSectionCard>

                  {hasPermission('use_ai_assistant') && (
                    <SettingsSectionCard
                      icon={Zap}
                      title="المطور"
                      description="تخصيص الألوان وتيم الإظهار"
                      iconColor="from-pink-500 to-pink-700"
                      onClick={() => toast({ title: "قريباً", description: "أدوات المطور ستكون متاحة قريباً!" })}
                    />
                  )}
                </div>
              </div>

              {/* قسم إدارة المنتجات والصلاحيات */}
              {hasPermission('manage_users') && (
                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Eye className="w-6 h-6 text-orange-600" />
                    إدارة صلاحيات المنتجات
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <SettingsSectionCard
                      icon={Eye}
                      title="صلاحيات التصنيفات"
                      description="تحديد التصنيفات المرئية لكل موظف"
                      iconColor="from-orange-500 to-orange-700"
                      onClick={() => setIsCategoriesDialogOpen(true)}
                    />
                  </div>
                </div>
              )}

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
      <DeliveryPartnerDialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen} />
      <EditProfileDialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen} />
      <ManageProductCategoriesDialog open={isCategoriesDialogOpen} onOpenChange={setIsCategoriesDialogOpen} />
    </>
  );
};

export default SettingsPage;