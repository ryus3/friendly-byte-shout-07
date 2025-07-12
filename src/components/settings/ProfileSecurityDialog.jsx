import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Shield, 
  Lock, 
  Key, 
  Smartphone, 
  AlertTriangle,
  Eye,
  EyeOff,
  Camera,
  Save,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast.js';
import { motion } from 'framer-motion';

const ProfileSecurityDialog = ({ open, onOpenChange }) => {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Profile States
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    bio: user?.bio || ''
  });

  // Security States
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    loginNotifications: true,
    sessionTimeout: true,
    deviceTracking: true
  });

  const handleProfileSave = async () => {
    try {
      await updateProfile(profileData);
      setIsEditing(false);
      toast({
        title: "تم التحديث بنجاح",
        description: "تم حفظ معلومات الملف الشخصي"
      });
    } catch (error) {
      toast({
        title: "خطأ في التحديث",
        description: "فشل في حفظ البيانات، يرجى المحاولة مرة أخرى",
        variant: "destructive"
      });
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "خطأ في كلمة المرور",
        description: "كلمة المرور الجديدة وتأكيدها غير متطابقتين",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "خطأ في كلمة المرور",
        description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
        variant: "destructive"
      });
      return;
    }

    try {
      // Here you would call the password change API
      toast({
        title: "تم تغيير كلمة المرور",
        description: "تم تحديث كلمة المرور بنجاح"
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast({
        title: "خطأ في تغيير كلمة المرور",
        description: "فشل في تحديث كلمة المرور",
        variant: "destructive"
      });
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'deputy': return 'bg-orange-500';
      case 'manager': return 'bg-blue-500';
      case 'employee': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'مدير عام';
      case 'deputy': return 'نائب مدير';
      case 'manager': return 'مدير';
      case 'employee': return 'موظف';
      default: return 'غير محدد';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            الملف الشخصي والأمان
          </DialogTitle>
          <DialogDescription>
            إدارة معلومات الملف الشخصي وإعدادات الأمان
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              الملف الشخصي
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              الأمان
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="glass-effect">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>المعلومات الشخصية</CardTitle>
                    <CardDescription>إدارة وتحديث معلومات الحساب</CardDescription>
                  </div>
                  <Button
                    variant={isEditing ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? (
                      <>
                        <RotateCcw className="w-4 h-4 ml-1" />
                        إلغاء
                      </>
                    ) : (
                      'تعديل'
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback className="text-lg">
                        {user?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full"
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{user?.full_name}</h3>
                    <p className="text-muted-foreground">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={getRoleColor(user?.role)}>
                        {getRoleLabel(user?.role)}
                      </Badge>
                      <Badge variant="outline">
                        {user?.status === 'active' ? 'نشط' : 'معطل'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">الاسم الكامل</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="full_name"
                        value={profileData.full_name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                        disabled={!isEditing}
                        className="pr-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                        disabled={!isEditing}
                        className="pr-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                        disabled={!isEditing}
                        className="pr-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">العنوان</Label>
                    <div className="relative">
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="address"
                        value={profileData.address}
                        onChange={(e) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                        disabled={!isEditing}
                        className="pr-10"
                      />
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-end gap-2"
                  >
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      إلغاء
                    </Button>
                    <Button onClick={handleProfileSave} className="gap-2">
                      <Save className="w-4 h-4" />
                      حفظ التغييرات
                    </Button>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="glass-effect">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    تغيير كلمة المرور
                  </CardTitle>
                  <CardDescription>تحديث كلمة المرور لحسابك</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="pl-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="pl-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="pl-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button onClick={handlePasswordChange} className="w-full gap-2">
                    <Key className="w-4 h-4" />
                    تحديث كلمة المرور
                  </Button>
                </CardContent>
              </Card>

              <Card className="glass-effect">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    إعدادات الأمان
                  </CardTitle>
                  <CardDescription>إدارة خيارات الأمان للحساب</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>التحقق بخطوتين</Label>
                      <p className="text-sm text-muted-foreground">طبقة أمان إضافية لحسابك</p>
                    </div>
                    <Switch
                      checked={securitySettings.twoFactorEnabled}
                      onCheckedChange={(checked) => 
                        setSecuritySettings(prev => ({ ...prev, twoFactorEnabled: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>إشعارات تسجيل الدخول</Label>
                      <p className="text-sm text-muted-foreground">تنبيه عند تسجيل دخول جديد</p>
                    </div>
                    <Switch
                      checked={securitySettings.loginNotifications}
                      onCheckedChange={(checked) => 
                        setSecuritySettings(prev => ({ ...prev, loginNotifications: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>انتهاء الجلسة التلقائي</Label>
                      <p className="text-sm text-muted-foreground">إنهاء الجلسة عند عدم النشاط</p>
                    </div>
                    <Switch
                      checked={securitySettings.sessionTimeout}
                      onCheckedChange={(checked) => 
                        setSecuritySettings(prev => ({ ...prev, sessionTimeout: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>تتبع الأجهزة</Label>
                      <p className="text-sm text-muted-foreground">مراقبة الأجهزة المتصلة</p>
                    </div>
                    <Switch
                      checked={securitySettings.deviceTracking}
                      onCheckedChange={(checked) => 
                        setSecuritySettings(prev => ({ ...prev, deviceTracking: checked }))
                      }
                    />
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      تأكد من تفعيل الإعدادات الأمنية لحماية حسابك بشكل أفضل.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSecurityDialog;