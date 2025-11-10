import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/supabase';
import { toast } from '@/hooks/use-toast';
import { Plus, X, Save, User, Briefcase } from 'lucide-react';
import Loader from '@/components/ui/loader';

const EditProfileDialog = ({ profile, open, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    username: profile.username || '',
    email: profile.email || '',
    employee_code: profile.employee_code || '',
    telegram_code: profile.telegram_code || '',
    business_name: profile.business_name || '',
    business_page_name: profile.business_page_name || '',
    business_links: profile.business_links || []
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          username: formData.username,
          email: formData.email,
          employee_code: formData.employee_code,
          telegram_code: formData.telegram_code,
          business_name: formData.business_name,
          business_page_name: formData.business_page_name,
          business_links: formData.business_links
        })
        .eq('user_id', profile.user_id);

      if (error) throw error;

      toast({
        title: 'تم التحديث بنجاح',
        description: 'تم حفظ التغييرات على الملف الشخصي'
      });

      if (onUpdate) onUpdate();
      onClose();

    } catch (error) {
      console.error('خطأ في تحديث الملف الشخصي:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحديث الملف الشخصي',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل الملف الشخصي</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="personal">
              <User className="w-4 h-4 ml-2" />
              معلومات شخصية
            </TabsTrigger>
            <TabsTrigger value="business">
              <Briefcase className="w-4 h-4 ml-2" />
              معلومات الأعمال
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4 mt-4">
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
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="أدخل البريد الإلكتروني"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee_code">معرف الموظف</Label>
                <Input
                  id="employee_code"
                  value={formData.employee_code}
                  onChange={(e) => handleChange('employee_code', e.target.value)}
                  placeholder="مثال: EMP001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegram_code">رمز التليغرام</Label>
                <Input
                  id="telegram_code"
                  value={formData.telegram_code}
                  onChange={(e) => handleChange('telegram_code', e.target.value)}
                  placeholder="مثال: @username"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="business" className="space-y-4 mt-4">
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
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader /> : (
              <>
                <Save className="w-4 h-4 ml-2" />
                حفظ التغييرات
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileDialog;