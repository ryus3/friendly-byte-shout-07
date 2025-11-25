import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ThemeCard from '@/components/storefront/dashboard/ThemeCard';
import ColorGradientPicker from '@/components/storefront/dashboard/ColorGradientPicker';
import LogoUploader from '@/components/employee-storefront/LogoUploader';
import BannerUploader from '@/components/employee-storefront/BannerUploader';
import RichTextEditor from '@/components/storefront/RichTextEditor';
import PremiumButton from '@/components/storefront/ui/PremiumButton';
import PremiumLoader from '@/components/storefront/ui/PremiumLoader';
import GradientText from '@/components/storefront/ui/GradientText';
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

const DEFAULT_ABOUT_US = `# مرحباً بك في متجرنا

نحن متجر متخصص في توفير أفضل المنتجات عالية الجودة لعملائنا الكرام.

## لماذا نحن؟
✓ منتجات أصلية 100%
✓ أسعار تنافسية
✓ توصيل سريع لجميع المحافظات
✓ خدمة عملاء متميزة على مدار الساعة

نفخر بخدمة عملائنا وتقديم أفضل تجربة تسوق.`;

const DEFAULT_PRIVACY_POLICY = `# سياسة الخصوصية

في متجرنا، نحترم خصوصيتك ونلتزم بحماية معلوماتك الشخصية.

## المعلومات التي نجمعها:
• الاسم ورقم الهاتف
• عنوان التوصيل
• سجل الطلبات

## كيف نستخدم معلوماتك:
• معالجة الطلبات والتوصيل
• التواصل بشأن الطلبات
• تحسين خدماتنا

## حماية البيانات:
نستخدم تقنيات أمان متقدمة لحماية معلوماتك الشخصية.`;

const DEFAULT_TERMS = `# الشروط والأحكام

باستخدامك لهذا المتجر، فإنك توافق على الشروط التالية:

## 1. الطلبات:
• جميع الطلبات خاضعة للتوافر
• الأسعار قابلة للتغيير بدون إشعار مسبق

## 2. الدفع:
• الدفع عند الاستلام
• يجب فحص المنتج قبل الدفع

## 3. التوصيل:
• مدة التوصيل 2-5 أيام عمل
• رسوم التوصيل حسب المنطقة`;

const DEFAULT_RETURN_POLICY = `# سياسة الاسترجاع

نوفر ضمان الاسترجاع خلال 7 أيام من تاريخ الاستلام.

## شروط الاسترجاع:
✓ المنتج في حالته الأصلية
✓ عدم استخدام المنتج
✓ وجود الفاتورة الأصلية
✓ التغليف الأصلي سليم

## الاستثناءات:
✗ الملابس الداخلية
✗ المنتجات المخصصة حسب الطلب
✗ المنتجات المستخدمة أو التالفة`;

const StorefrontSettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // جلب الإعدادات مع الملف الشخصي
      const { data: settingsData, error } = await supabase
        .from('employee_storefront_settings')
        .select(`
          *,
          profile:profiles!employee_storefront_settings_employee_id_fkey (
            user_id,
            full_name,
            business_page_name,
            social_media,
            business_links
          )
        `)
        .eq('employee_id', user.id)
        .single();

      if (error) throw error;

      if (settingsData) {
        setSettings(settingsData);
        setProfile(settingsData.profile);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل الإعدادات',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('employee_storefront_settings')
        .update({
          meta_title: settings.meta_title,
          meta_description: settings.meta_description,
          logo_url: settings.logo_url,
          banner_url: settings.banner_url,
          theme_name: settings.theme_name,
          primary_color: settings.primary_color,
          secondary_color: settings.secondary_color,
          accent_color: settings.accent_color,
          font_family: settings.font_family,
          is_active: settings.is_active,
          about_us: settings.about_us,
          privacy_policy: settings.privacy_policy,
          terms_conditions: settings.terms_conditions,
          return_policy: settings.return_policy
        })
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
    return <PremiumLoader />;
  }

  if (!settings) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-xl">لم يتم العثور على المتجر</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-background via-background to-blue-50 dark:to-blue-950/20 min-h-screen space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <GradientText gradient="from-blue-600 via-purple-600 to-pink-600" className="text-2xl sm:text-3xl md:text-4xl">
          إعدادات المتجر
        </GradientText>
        <PremiumButton
          variant="success"
          size="md"
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          حفظ التغييرات
        </PremiumButton>
      </div>

      {/* معلومات أساسية */}
      <Card className="border-2 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Settings2 className="h-5 w-5" />
            المعلومات الأساسية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>رابط المتجر</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={`pos.ryusbrand.com/storefront/${settings.slug}`}
                readOnly
                className="flex-1 font-mono"
              />
              <PremiumButton
                variant="primary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`https://pos.ryusbrand.com/storefront/${settings.slug}`);
                  toast({ title: '✅ تم النسخ', description: 'تم نسخ رابط المتجر' });
                }}
              >
                <Copy className="h-4 w-4" />
              </PremiumButton>
            </div>
          </div>

          <div>
            <Label htmlFor="meta_title">اسم المتجر</Label>
            <Input
              id="meta_title"
              value={settings.meta_title || ''}
              onChange={(e) => setSettings({ ...settings, meta_title: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="meta_description">وصف المتجر (SEO)</Label>
            <Input
              id="meta_description"
              value={settings.meta_description || ''}
              onChange={(e) => setSettings({ ...settings, meta_description: e.target.value })}
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
            />
          </div>
        </CardContent>
      </Card>

      {/* معلومات التواصل */}
      <Card className="border-2 shadow-xl">
        <CardHeader>
          <CardTitle>معلومات التواصل</CardTitle>
          <p className="text-sm text-muted-foreground">
            ✅ يتم جلبها من ملفك الشخصي تلقائياً
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border-2 border-blue-200">
          <div>
            <Label>اسم الصفحة التجارية</Label>
            <Input 
              value={profile?.business_page_name || 'غير محدد'} 
              readOnly 
              className="bg-white dark:bg-gray-900 mt-1" 
            />
          </div>
          
          <div>
            <Label>روابط التواصل</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {profile?.business_links?.whatsapp && (
                <Badge variant="outline" className="justify-start gap-2">
                  📱 WhatsApp
                </Badge>
              )}
              {profile?.business_links?.telegram && (
                <Badge variant="outline" className="justify-start gap-2">
                  ✈️ Telegram
                </Badge>
              )}
              {profile?.social_media?.instagram && (
                <Badge variant="outline" className="justify-start gap-2">
                  📸 Instagram
                </Badge>
              )}
              {profile?.social_media?.facebook && (
                <Badge variant="outline" className="justify-start gap-2">
                  👥 Facebook
                </Badge>
              )}
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate('/dashboard/profile')}
          >
            تعديل في الملف الشخصي →
          </Button>
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

      {/* الصفحات القانونية */}
      <Card className="border-2 shadow-xl">
        <CardHeader>
          <CardTitle>الصفحات القانونية</CardTitle>
          <p className="text-sm text-muted-foreground">
            محتوى صفحات من نحن، الخصوصية، الشروط، والاسترجاع
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="about" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="about">من نحن</TabsTrigger>
              <TabsTrigger value="privacy">الخصوصية</TabsTrigger>
              <TabsTrigger value="terms">الشروط</TabsTrigger>
              <TabsTrigger value="return">الاسترجاع</TabsTrigger>
            </TabsList>
            
            <TabsContent value="about" className="mt-6">
              <RichTextEditor
                value={settings.about_us || DEFAULT_ABOUT_US}
                onChange={(value) => setSettings({...settings, about_us: value})}
                placeholder="اكتب نبذة عن متجرك..."
              />
            </TabsContent>
            
            <TabsContent value="privacy" className="mt-6">
              <RichTextEditor
                value={settings.privacy_policy || DEFAULT_PRIVACY_POLICY}
                onChange={(value) => setSettings({...settings, privacy_policy: value})}
                placeholder="سياسة الخصوصية..."
              />
            </TabsContent>
            
            <TabsContent value="terms" className="mt-6">
              <RichTextEditor
                value={settings.terms_conditions || DEFAULT_TERMS}
                onChange={(value) => setSettings({...settings, terms_conditions: value})}
                placeholder="الشروط والأحكام..."
              />
            </TabsContent>
            
            <TabsContent value="return" className="mt-6">
              <RichTextEditor
                value={settings.return_policy || DEFAULT_RETURN_POLICY}
                onChange={(value) => setSettings({...settings, return_policy: value})}
                placeholder="سياسة الاسترجاع..."
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Banner المتجر */}
      <Card className="border-2 shadow-xl">
        <CardHeader>
          <CardTitle>بانر المتجر (اختياري)</CardTitle>
          <p className="text-sm text-muted-foreground">
            يظهر في أعلى الصفحة الرئيسية للمتجر
          </p>
        </CardHeader>
        <CardContent>
          <BannerUploader
            currentBanner={settings.banner_url}
            onUpload={(url) => setSettings({ ...settings, banner_url: url })}
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
                selected={settings.theme_name === theme.id}
                onClick={() => setSettings({ ...settings, theme_name: theme.id })}
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
