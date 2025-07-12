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
import { User, Store, Bot, Copy, Truck, LogIn, LogOut, Loader2, Users, Printer, Settings as SettingsIcon, Home } from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditProfileDialog from '@/components/settings/EditProfileDialog';
import { useNavigate } from 'react-router-dom';

const SettingsSectionCard = ({ icon, title, description, children, footer, onClick, className, disabled = false }) => {
  const Icon = icon;
  const cardClasses = `
    ${className} 
    ${onClick && !disabled ? 'cursor-pointer hover:border-primary transition-colors' : ''}
    ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
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
          <Icon className="w-6 h-6 text-primary" />
          <span className="text-xl">{title}</span>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
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

            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {hasPermission('manage_users') ? (
                <SettingsSectionCard
                  icon={Users}
                  title="إدارة الموظفين والصلاحيات"
                  description="إدارة حسابات الموظفين، أدوارهم، وصلاحيات الوصول."
                  onClick={() => navigate('/manage-employees')}
                />
              ) : (
                 <SettingsSectionCard
                  icon={Users}
                  title="إدارة الموظفين والصلاحيات"
                  description="هذه الميزة متاحة للمدير فقط."
                  disabled={true}
                />
              )}
              
              <SettingsSectionCard 
                icon={Bot} 
                title="بوت التليغرام"
                disabled={!hasPermission('use_telegram_bot')}
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
            </div>
        </div>
      </div>
      <DeliveryPartnerDialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen} />
      <EditProfileDialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen} />
    </>
  );
};

export default SettingsPage;