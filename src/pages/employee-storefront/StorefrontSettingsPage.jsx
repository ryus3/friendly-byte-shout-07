import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import ThemeCustomizer from '@/components/employee-storefront/ThemeCustomizer';
import LogoUploader from '@/components/employee-storefront/LogoUploader';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const StorefrontSettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('employee_storefront_settings')
        .select('*')
        .eq('employee_id', user.id)
        .single();

      setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('employee_storefront_settings')
        .update(settings)
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ إعدادات المتجر بنجاح'
      });
    } catch (err) {
      console.error('Error saving settings:', err);
      toast({
        title: 'خطأ',
        description: 'فشل حفظ الإعدادات',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  if (!settings) {
    return <div className="p-8">لم يتم العثور على المتجر</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">إعدادات المتجر</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          حفظ التغييرات
        </Button>
      </div>

      {/* معلومات أساسية */}
      <Card>
        <CardHeader>
          <CardTitle>المعلومات الأساسية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>رابط المتجر</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={`pos.ryusbrand.com/storefront/${settings.storefront_slug}`}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`https://pos.ryusbrand.com/storefront/${settings.storefront_slug}`);
                  toast({ title: 'تم النسخ', description: 'تم نسخ رابط المتجر' });
                }}
              >
                نسخ
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="business_name">اسم المتجر</Label>
            <Input
              id="business_name"
              value={settings.business_name || ''}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="meta_description">وصف المتجر (يظهر في محركات البحث)</Label>
            <Textarea
              id="meta_description"
              value={settings.meta_description || ''}
              onChange={(e) => setSettings({ ...settings, meta_description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>تفعيل المتجر</Label>
              <p className="text-sm text-muted-foreground">السماح للزوار بالوصول للمتجر</p>
            </div>
            <Switch
              checked={settings.is_active || false}
              onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle>شعار المتجر</CardTitle>
        </CardHeader>
        <CardContent>
          <LogoUploader
            currentLogo={settings.logo_url}
            onUpload={(url) => setSettings({ ...settings, logo_url: url })}
          />
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>التصميم والألوان</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeCustomizer
            theme={settings.theme}
            primaryColor={settings.primary_color}
            accentColor={settings.accent_color}
            onChange={(updates) => setSettings({ ...settings, ...updates })}
          />
        </CardContent>
      </Card>

      {/* Banner */}
      {settings.banner_url && (
        <Card>
          <CardHeader>
            <CardTitle>بانر الصفحة الرئيسية</CardTitle>
          </CardHeader>
          <CardContent>
            <img src={settings.banner_url} alt="Banner" className="w-full rounded-lg" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StorefrontSettingsPage;
