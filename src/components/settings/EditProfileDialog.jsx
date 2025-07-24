import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Home } from 'lucide-react';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EditProfileDialog = ({ open, onOpenChange }) => {
  const { user, updateUserProfile, changePassword, loading, updateUser, hasPermission } = useAuth();
  
  const [activeTab, setActiveTab] = useState('profile');
  
  const [profileData, setProfileData] = useState({ fullName: '', username: '', defaultCustomerName: '' });
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [defaultPage, setDefaultPage] = useState(user?.defaultPage || '/');

  useEffect(() => {
    if (user) {
      setProfileData({ 
        fullName: user.full_name || '', 
        username: user.username || '',
        defaultCustomerName: user.default_customer_name || ''
      });
      setDefaultPage(user.defaultPage || '/');
    }
  }, [user, open]);

  const handleProfileChange = (e) => setProfileData({ ...profileData, [e.target.name]: e.target.value });
  const handlePasswordChange = (e) => setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  
  const handleDefaultPageChange = (newPage) => {
    setDefaultPage(newPage);
  };
  
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    
    const profileUpdates = {};
    if (profileData.fullName !== user.full_name) {
        profileUpdates.full_name = profileData.fullName;
    }
    if (profileData.username !== user.username) {
        profileUpdates.username = profileData.username;
    }
    if (profileData.defaultCustomerName !== user.default_customer_name) {
        profileUpdates.default_customer_name = profileData.defaultCustomerName;
    }

    const pageUpdate = defaultPage !== user.defaultPage;

    if (Object.keys(profileUpdates).length > 0) {
        await updateUserProfile(profileUpdates);
    }
    
    if (pageUpdate) {
        await updateUser(user.id, { default_page: defaultPage });
    }

    if (Object.keys(profileUpdates).length > 0 || pageUpdate) {
        toast({ title: "نجاح", description: "تم تحديث الملف الشخصي بنجاح." });
    }
  };
  
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: "خطأ", description: "كلمة المرور الجديدة غير متطابقة.", variant: "destructive" });
      return;
    }
    if (!passwordData.newPassword) {
      toast({ title: "خطأ", description: "الرجاء إدخال كلمة مرور جديدة.", variant: "destructive" });
      return;
    }
    const result = await changePassword(passwordData.newPassword);
    if(result.success) {
        setPasswordData({ newPassword: '', confirmPassword: '' });
    }
  };

  const availablePages = [
    { value: '/', label: 'لوحة التحكم' },
    { value: '/quick-order', label: 'طلب سريع' },
    { value: '/my-orders', label: 'طلباتي' },
    { value: '/products', label: 'المنتجات' },
    { value: '/inventory', label: 'الجرد التفصيلي' },
  ];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تعديل الملف الشخصي</DialogTitle>
          <DialogDescription>
            قم بتحديث معلوماتك الشخصية أو تغيير كلمة المرور.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full pt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
            <TabsTrigger value="security">الأمان</TabsTrigger>
            <TabsTrigger value="appearance">النمط</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="mt-4">
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input id="fullName" name="fullName" value={profileData.fullName} onChange={handleProfileChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input id="username" name="username" value={profileData.username} onChange={handleProfileChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" value={user?.email || ''} disabled />
              </div>
              
              {hasPermission('manage_default_customer_name') && (
                <div className="space-y-2">
                  <Label htmlFor="defaultCustomerName">اسم الزبون الافتراضي</Label>
                  <Input 
                    id="defaultCustomerName" 
                    name="defaultCustomerName" 
                    value={profileData.defaultCustomerName} 
                    onChange={handleProfileChange}
                    placeholder="اختياري - سيظهر تلقائياً في الطلبات الجديدة"
                  />
                  <p className="text-xs text-muted-foreground">
                    يمكنك تعديل هذا الاسم لاحقاً في أي طلب جديد
                  </p>
                </div>
              )}

              {hasPermission('set_default_page') && (
                <div className="space-y-2">
                    <Label htmlFor="defaultPage">الصفحة الرئيسية الافتراضية</Label>
                    <Select value={defaultPage} onValueChange={handleDefaultPageChange}>
                        <SelectTrigger id="defaultPage"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {availablePages.map(page => (
                                <SelectItem key={page.value} value={page.value}>{page.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  حفظ التغييرات
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                  <Input id="newPassword" name="newPassword" type="password" value={passwordData.newPassword} onChange={handlePasswordChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
                  <Input id="confirmPassword" name="confirmPassword" type="password" value={passwordData.confirmPassword} onChange={handlePasswordChange} />
                </div>
                <DialogFooter>
                   <Button type="submit" disabled={loading} className="w-full">
                     {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                     تغيير كلمة المرور
                   </Button>
                </DialogFooter>
            </form>
          </TabsContent>
          
          <TabsContent value="appearance" className="mt-4">
             <div className="space-y-4">
                <p className="text-sm text-muted-foreground">اختر النمط الذي يناسبك.</p>
                <ThemeSwitcher />
             </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileDialog;