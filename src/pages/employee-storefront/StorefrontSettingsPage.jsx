import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import ThemeCustomizer from '@/components/employee-storefront/ThemeCustomizer';
import LogoUploader from '@/components/employee-storefront/LogoUploader';
import GradientButton from '@/components/storefront/ui/GradientButton';
import GradientText from '@/components/storefront/ui/GradientText';
import ThemeCard from '@/components/storefront/dashboard/ThemeCard';
import ColorGradientPicker from '@/components/storefront/dashboard/ColorGradientPicker';
import { toast } from '@/hooks/use-toast';
import { Loader2, Copy, Palette, Settings2 } from 'lucide-react';

const THEMES = [
  { 
    id: 'modern', 
    name: 'حديث وأنيق', 
    description: 'تصميم عصري بسيط',
    gradient: 'from-blue-500 to-purple-500'
  },
  { 
    id: 'luxury', 
    name: 'فاخر', 
    description: 'أناقة راقية',
    gradient: 'from-amber-500 to-orange-500'
  },
  { 
    id: 'vibrant', 
    name: 'نابض بالحياة', 
    description: 'ألوان جريئة ومثيرة',
    gradient: 'from-pink-500 to-purple-500'
  },
  { 
    id: 'natural', 
    name: 'طبيعي', 
    description: 'ألوان هادئة ومريحة',
    gradient: 'from-emerald-500 to-teal-500'
  }
];

const PRESET_GRADIENTS = [
  { id: 'sunset', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', primary: '#f093fb', accent: '#f5576c' },
  { id: 'ocean', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', primary: '#4facfe', accent: '#00f2fe' },
  { id: 'forest', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', primary: '#43e97b', accent: '#38f9d7' },
  { id: 'royal', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', primary: '#667eea', accent: '#764ba2' },
  { id: 'fire', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', primary: '#fa709a', accent: '#fee140' },
  { id: 'sky', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', primary: '#a8edea', accent: '#fed6e3' }
];

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
        title: '✅ تم الحفظ',
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

  const applyPresetGradient = (preset) => {
    setSettings({ ...settings, primary_color: preset.primary, accent_color: preset.accent });
    toast({ title: '🎨 تم تطبيق التدرج', description: 'يمكنك حفظ التغييرات الآن' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return <div className="p-8">لم يتم العثور على المتجر</div>;
  }

  return (
    <div className="p-8 bg-gradient-to-br from-background via-background to-blue-50 dark:to-blue-950/20 min-h-screen space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <GradientText gradient="from-blue-600 via-purple-600 to-pink-600" className="text-4xl">
          إعدادات المتجر
        </GradientText>
        <GradientButton
          gradient="from-emerald-500 to-teal-500"
          onClick={handleSave}
          disabled={saving}
          className="px-8"
        >
          {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          حفظ التغييرات
        </GradientButton>
      </div>

      {/* معلومات أساسية */}
      <Card className="border-2 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            المعلومات الأساسية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>رابط المتجر</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={`pos.ryusbrand.com/storefront/${settings.storefront_slug}`}
                readOnly
                className="flex-1 font-mono"
              />
              <GradientButton
                gradient="from-blue-500 to-cyan-500"
                onClick={() => {
                  navigator.clipboard.writeText(`https://pos.ryusbrand.com/storefront/${settings.storefront_slug}`);
                  toast({ title: '✅ تم النسخ', description: 'تم نسخ رابط المتجر' });
                }}
              >
                <Copy className="h-4 w-4" />
              </GradientButton>
            </div>
          </div>

          <div>
            <Label htmlFor="business_name">اسم المتجر</Label>
            <Input
              id="business_name"
              value={settings.business_name || ''}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="meta_description">وصف المتجر (SEO)</Label>
            <Textarea
              id="meta_description"
              value={settings.meta_description || ''}
              onChange={(e) => setSettings({ ...settings, meta_description: e.target.value })}
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-2 border-emerald-200 dark:border-emerald-800">
            <div>
              <Label className="text-lg">تفعيل المتجر</Label>
              <p className="text-sm text-muted-foreground">السماح للزوار بالوصول للمتجر</p>
            </div>
            <Switch
              checked={settings.is_active || false}
              onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-teal-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card className="border-2 shadow-xl">
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

      {/* Theme Selection */}
      <Card className="border-2 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            اختر قالب التصميم
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {THEMES.map(theme => (
              <ThemeCard
                key={theme.id}
                name={theme.name}
                description={theme.description}
                gradient={theme.gradient}
                selected={settings.theme === theme.id}
                onClick={() => setSettings({ ...settings, theme: theme.id })}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Color Customization */}
      <Card className="border-2 shadow-xl">
        <CardHeader>
          <GradientText gradient="from-blue-600 to-purple-600" className="text-2xl">
            التدرجات اللونية
          </GradientText>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ColorGradientPicker
              label="اللون الأساسي"
              value={settings.primary_color}
              onChange={(color) => setSettings({ ...settings, primary_color: color })}
            />
            <ColorGradientPicker
              label="اللون الثانوي"
              value={settings.accent_color}
              onChange={(color) => setSettings({ ...settings, accent_color: color })}
            />
          </div>
          
          {/* Preset Gradients */}
          <div>
            <h3 className="text-lg font-semibold mb-4">تدرجات جاهزة:</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {PRESET_GRADIENTS.map(preset => (
                <button
                  key={preset.id}
                  className="h-20 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-110 transition-all duration-300 border-4 border-white dark:border-gray-800"
                  style={{ background: preset.gradient }}
                  onClick={() => applyPresetGradient(preset)}
                  title="اضغط للتطبيق"
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StorefrontSettingsPage;
