import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { Shield, Eye, EyeOff, Key, Smartphone } from 'lucide-react';

const SecuritySettingsDialog = ({ open, onOpenChange }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [autoLogout, setAutoLogout] = useState(true);
  const [passwordReminder, setPasswordReminder] = useState(false);
  const [loginNotifications, setLoginNotifications] = useState(true);
  const [deviceTracking, setDeviceTracking] = useState(true);

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "خطأ",
        description: "كلمة المرور الجديدة وتأكيدها غير متطابقين",
        variant: "destructive"
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: "خطأ",
        description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "تم تغيير كلمة المرور",
      description: "تم تحديث كلمة المرور بنجاح"
    });
    
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            إعدادات الأمان
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* تغيير كلمة المرور */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Key className="w-4 h-4" />
              تغيير كلمة المرور
            </h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label>كلمة المرور الحالية</Label>
                <div className="relative">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPasswords(!showPasswords)}
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>كلمة المرور الجديدة</Label>
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>تأكيد كلمة المرور</Label>
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              
              <Button type="submit" className="w-full">
                تغيير كلمة المرور
              </Button>
            </form>
          </div>

          {/* إعدادات الأمان */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">إعدادات الأمان</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">المصادقة الثنائية</p>
                <p className="text-sm text-muted-foreground">طبقة حماية إضافية</p>
              </div>
              <Switch
                checked={twoFactorEnabled}
                onCheckedChange={setTwoFactorEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">انتهاء الجلسة التلقائي</p>
                <p className="text-sm text-muted-foreground">تسجيل خروج تلقائي بعد فترة عدم نشاط</p>
              </div>
              <Switch
                checked={autoLogout}
                onCheckedChange={setAutoLogout}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">انتهاء صلاحية كلمة المرور</p>
                <p className="text-sm text-muted-foreground">تذكير بتغيير كلمة المرور شهرياً</p>
              </div>
              <Switch
                checked={passwordReminder}
                onCheckedChange={setPasswordReminder}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">تنبيهات تسجيل الدخول</p>
                <p className="text-sm text-muted-foreground">إشعار عند الدخول من جهاز جديد</p>
              </div>
              <Switch
                checked={loginNotifications}
                onCheckedChange={setLoginNotifications}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">تتبع الأجهزة</p>
                <p className="text-sm text-muted-foreground">مراقبة الأجهزة المستخدمة للدخول</p>
              </div>
              <Switch
                checked={deviceTracking}
                onCheckedChange={setDeviceTracking}
              />
            </div>
          </div>

          {/* منطقة الخطر */}
          <div className="space-y-4 p-4 border border-destructive rounded-lg">
            <h3 className="font-semibold text-destructive">منطقة الخطر</h3>
            <Button variant="destructive" className="w-full">
              إعادة تعيين جميع الإعدادات
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SecuritySettingsDialog;