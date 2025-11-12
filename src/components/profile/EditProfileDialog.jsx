import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, X, Save, User, Briefcase, Shield } from 'lucide-react';
import Loader from '@/components/ui/loader';

const EditProfileDialog = ({ isOpen, onClose, profile }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    employee_code: '',
    telegram_code: '',
    business_name: '',
    business_page_name: '',
    business_links: []
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        username: profile.username || '',
        email: profile.email || '',
        phone: profile.phone || '',
        employee_code: profile.employee_code || '',
        telegram_code: profile.telegram_code || '',
        business_name: profile.business_name || '',
        business_page_name: profile.business_page_name || '',
        business_links: profile.business_links || []
      });
    }
  }, [profile]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddLink = () => {
    setFormData(prev => ({
      ...prev,
      business_links: [...prev.business_links, { type: 'website', url: '', title: '' }]
    }));
  };

  const handleRemoveLink = (index) => {
    setFormData(prev => ({
      ...prev,
      business_links: prev.business_links.filter((_, i) => i !== index)
    }));
  };

  const handleLinkChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      business_links: prev.business_links.map((link, i) => 
        i === index ? { ...link, [field]: value } : link
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
        full_name: formData.full_name,
        username: formData.username,
        phone: formData.phone,
        business_name: formData.business_name,
        business_page_name: formData.business_page_name,
        business_links: formData.business_links
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: 'تم التحديث بنجاح',
        description: 'تم تحديث معلومات الملف الشخصي بنجاح',
      });

      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث الملف الشخصي',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'كلمات المرور غير متطابقة',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: 'خطأ',
        description: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: 'تم التحديث بنجاح',
        description: 'تم تغيير كلمة المرور بنجاح',
      });

      setPasswordData({ newPassword: '', confirmPassword: '' });
      setActiveTab('personal');
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تغيير كلمة المرور',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <User className="w-6 h-6 text-primary" />
            تعديل الملف الشخصي
          </DialogTitle>
          <DialogDescription>
            قم بتحديث معلوماتك الشخصية ومعلومات عملك وإعدادات الأمان
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              معلومات شخصية
            </TabsTrigger>
            <TabsTrigger value="business" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              معلومات الأعمال
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              الأمان
            </TabsTrigger>
          </TabsList>

          {/* Personal Tab */}
          <TabsContent value="personal">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">الاسم الكامل</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    placeholder="أدخل الاسم الكامل"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">اسم المستخدم</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    placeholder="أدخل اسم المستخدم"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-secondary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="07XX XXX XXXX"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee_code" className="flex items-center gap-2">
                      معرف الموظف
                      <Badge variant="outline" className="text-xs">غير قابل للتعديل</Badge>
                    </Label>
                    <Input
                      id="employee_code"
                      value={formData.employee_code}
                      disabled={true}
                      className="bg-muted cursor-not-allowed opacity-70"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telegram_code" className="flex items-center gap-2">
                      رمز التليغرام
                      <Badge variant="outline" className="text-xs">غير قابل للتعديل</Badge>
                    </Label>
                    <Input
                      id="telegram_code"
                      value={formData.telegram_code}
                      disabled={true}
                      className="bg-muted cursor-not-allowed opacity-70"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  حفظ التغييرات
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Business Tab */}
          <TabsContent value="business">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="business_name">اسم النشاط التجاري</Label>
                  <Input
                    id="business_name"
                    value={formData.business_name}
                    onChange={(e) => handleChange('business_name', e.target.value)}
                    placeholder="أدخل اسم النشاط التجاري"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business_page_name">اسم الصفحة التجارية</Label>
                  <Input
                    id="business_page_name"
                    value={formData.business_page_name}
                    onChange={(e) => handleChange('business_page_name', e.target.value)}
                    placeholder="أدخل اسم الصفحة التجارية"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>روابط الأنشطة التجارية</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddLink}
                    >
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة رابط
                    </Button>
                  </div>

                  {formData.business_links.map((link, index) => (
                    <div key={index} className="flex gap-2 p-3 bg-secondary/20 rounded-lg">
                      <div className="flex-1 space-y-2">
                        <select
                          value={link.type}
                          onChange={(e) => handleLinkChange(index, 'type', e.target.value)}
                          className="w-full p-2 rounded-md border border-input bg-background"
                        >
                          <option value="website">موقع إلكتروني</option>
                          <option value="facebook">فيسبوك</option>
                          <option value="instagram">انستقرام</option>
                          <option value="whatsapp">واتساب</option>
                          <option value="telegram">تليغرام</option>
                          <option value="other">آخر</option>
                        </select>
                        
                        <Input
                          placeholder="عنوان الرابط"
                          value={link.title}
                          onChange={(e) => handleLinkChange(index, 'title', e.target.value)}
                        />
                        
                        <Input
                          placeholder="https://example.com"
                          value={link.url}
                          onChange={(e) => handleLinkChange(index, 'url', e.target.value)}
                        />
                      </div>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveLink(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  {formData.business_links.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      لم يتم إضافة أي روابط بعد
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  حفظ التغييرات
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_password">كلمة المرور الجديدة</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm_password">تأكيد كلمة المرور</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                  تغيير كلمة المرور
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileDialog;