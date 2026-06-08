import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { ArrowRight, ArrowLeft, Check, Sparkles, Palette, FileText, Eye } from 'lucide-react';
import ThemeCard from '@/components/storefront/dashboard/ThemeCard';
import ColorGradientPicker from '@/components/storefront/dashboard/ColorGradientPicker';
import RichTextEditor from '@/components/storefront/RichTextEditor';
import GradientButton from '@/components/storefront/ui/GradientButton';
import { STOREFRONT_THEMES, DEFAULT_THEME_ID, getThemeById } from '@/lib/storefront-themes';

const THEMES = STOREFRONT_THEMES.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  gradient: t.gradient,
  preview: t.preview,
  colors: t.colors,
}));

const DEFAULT_CONTENT = {
  about_us: `مرحباً بك في متجرنا

نحن متجر متخصص في توفير أفضل المنتجات عالية الجودة لعملائنا الكرام.
نفخر بتقديم تجربة تسوق مميزة ومنتجات منتقاة بعناية.

## رؤيتنا
أن نكون الخيار الأول لعملائنا

## رسالتنا
تقديم منتجات عالية الجودة بأسعار تنافسية وخدمة متميزة

## تسوق معنا وستجد:
✓ منتجات أصلية 100%
✓ أسعار تنافسية
✓ توصيل سريع
✓ خدمة عملاء متميزة`,

  privacy_policy: `## المعلومات التي نجمعها:
• الاسم الكامل
• رقم الهاتف
• عنوان التوصيل
• سجل الطلبات

## كيف نستخدم معلوماتك:
• معالجة وتوصيل طلباتك
• التواصل معك بشأن الطلبات
• تحسين خدماتنا

## حماية البيانات:
نستخدم بروتوكولات أمان متقدمة لحماية معلوماتك.
لن نشارك بياناتك مع أطراف ثالثة بدون موافقتك.`,

  terms_conditions: `## 1. الطلبات والأسعار
• جميع الطلبات خاضعة لتوافر المخزون
• الأسعار قابلة للتغيير دون إشعار مسبق
• نحتفظ بالحق في رفض أو إلغاء أي طلب

## 2. الدفع والتوصيل
• الدفع عند الاستلام (نقداً)
• مدة التوصيل: 2-5 أيام عمل
• رسوم التوصيل تُحسب حسب المحافظة

## 3. المسؤولية
• يجب فحص المنتج قبل استلامه
• نحن غير مسؤولين عن أي ضرر بعد الاستلام`,

  return_policy: `## شروط الاسترجاع:
✓ المنتج في حالته الأصلية مع العبوة
✓ عدم استخدام أو غسل المنتج
✓ وجود الفاتورة الأصلية

## الاستثناءات (لا يمكن استرجاعها):
✗ الملابس الداخلية
✗ المنتجات المخصصة
✗ المنتجات المخفضة

## خطوات الاسترجاع:
1. اتصل بنا عبر واتساب أو تليغرام
2. أرسل المنتج مع الفاتورة
3. سنفحص المنتج
4. استرداد المبلغ خلال 3-5 أيام عمل

**ملاحظة:** العميل يتحمل تكلفة الإرجاع`
};

const StorefrontSetupWizard = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    meta_description: '',
    theme_name: DEFAULT_THEME_ID,
    primary_color: getThemeById(DEFAULT_THEME_ID).colors.primary,
    secondary_color: getThemeById(DEFAULT_THEME_ID).colors.secondary,
    accent_color: getThemeById(DEFAULT_THEME_ID).colors.accent,
    about_us: DEFAULT_CONTENT.about_us,
    privacy_policy: DEFAULT_CONTENT.privacy_policy,
    terms_conditions: DEFAULT_CONTENT.terms_conditions,
    return_policy: DEFAULT_CONTENT.return_policy
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_page_name, employee_code')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const slug = profile.employee_code 
          ? `${profile.employee_code}-shop`
          : `${user.id.substring(0, 8)}-shop`;
        
        setFormData(prev => ({ ...prev, slug }));
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const selectTheme = (theme) => {
    setFormData(prev => ({
      ...prev,
      theme_name: theme.id,
      primary_color: theme.colors.primary,
      secondary_color: theme.colors.secondary,
      accent_color: theme.colors.accent
    }));
  };

  const seedAllowedProducts = async (employeeId) => {
    try {
      // Pull this user's allowed products from user_product_permissions and
      // mirror them into employee_allowed_products so the storefront shows them.
      const { data: perms } = await supabase
        .from('user_product_permissions')
        .select('permission_type, allowed_items, has_full_access')
        .eq('user_id', employeeId);

      const productIds = new Set();
      (perms || []).forEach((p) => {
        if (p?.permission_type === 'product' && Array.isArray(p.allowed_items)) {
          p.allowed_items.forEach((id) => id && productIds.add(id));
        }
      });

      // If full access, pull every active product
      const hasFullAccess = (perms || []).some((p) => p?.has_full_access);
      if (hasFullAccess) {
        const { data: allProducts } = await supabase
          .from('products')
          .select('id')
          .eq('is_active', true);
        (allProducts || []).forEach((p) => productIds.add(p.id));
      }

      if (productIds.size === 0) return;

      const rows = Array.from(productIds).map((pid) => ({
        employee_id: employeeId,
        product_id: pid,
        is_active: true,
        added_by: employeeId,
      }));

      await supabase
        .from('employee_allowed_products')
        .upsert(rows, { onConflict: 'employee_id,product_id', ignoreDuplicates: true });
    } catch (err) {
      console.warn('seedAllowedProducts skipped:', err?.message);
    }
  };

  const createStore = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { error } = await supabase
        .from('employee_storefront_settings')
        .upsert({
          employee_id: user.id,
          ...formData,
          is_active: true
        }, { onConflict: 'employee_id' });

      if (error) throw error;

      // Auto-seed the storefront with the employee's allowed products
      await seedAllowedProducts(user.id);

      toast({
        title: '🎉 تم إنشاء المتجر بنجاح',
        description: 'تم تفعيل متجرك واستيراد منتجاتك المسموحة تلقائياً'
      });

      navigate('/dashboard/storefront');
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-blue-950/20 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-4">
            إعداد متجرك الإلكتروني
          </h1>
          <p className="text-lg text-muted-foreground">
            خطوة {step} من 4
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        <Card className="shadow-2xl">
          <CardContent className="p-8">
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <Sparkles className="h-16 w-16 mx-auto mb-4 text-purple-600" />
                  <h2 className="text-3xl font-bold mb-2">معلومات المتجر الأساسية</h2>
                  <p className="text-muted-foreground">حدد اسم ورابط متجرك الإلكتروني</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>رابط المتجر</Label>
                    <Input
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="my-shop"
                      dir="ltr"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      سيكون رابط متجرك: /storefront/{formData.slug}
                    </p>
                  </div>

                  <div>
                    <Label>وصف المتجر</Label>
                    <Input
                      value={formData.meta_description}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                      placeholder="وصف قصير عن متجرك..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Theme */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <Palette className="h-16 w-16 mx-auto mb-4 text-purple-600" />
                  <h2 className="text-3xl font-bold mb-2">اختر الثيم والألوان</h2>
                  <p className="text-muted-foreground">اختر تصميماً يناسب علامتك التجارية</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {THEMES.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      {...theme}
                      selected={formData.theme_name === theme.id}
                      onClick={() => selectTheme(theme)}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ColorGradientPicker
                    label="اللون الأساسي"
                    value={formData.primary_color}
                    onChange={(color) => setFormData(prev => ({ ...prev, primary_color: color }))}
                  />
                  <ColorGradientPicker
                    label="اللون الثانوي"
                    value={formData.secondary_color}
                    onChange={(color) => setFormData(prev => ({ ...prev, secondary_color: color }))}
                  />
                  <ColorGradientPicker
                    label="لون التمييز"
                    value={formData.accent_color}
                    onChange={(color) => setFormData(prev => ({ ...prev, accent_color: color }))}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Legal Pages */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-purple-600" />
                  <h2 className="text-3xl font-bold mb-2">الصفحات القانونية</h2>
                  <p className="text-muted-foreground">راجع وعدّل النصوص حسب حاجتك</p>
                </div>

                <Tabs defaultValue="about">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="about">من نحن</TabsTrigger>
                    <TabsTrigger value="privacy">الخصوصية</TabsTrigger>
                    <TabsTrigger value="terms">الشروط</TabsTrigger>
                    <TabsTrigger value="return">الاسترجاع</TabsTrigger>
                  </TabsList>

                  <TabsContent value="about" className="mt-4">
                    <RichTextEditor
                      value={formData.about_us}
                      onChange={(val) => setFormData(prev => ({ ...prev, about_us: val }))}
                      placeholder="اكتب عن متجرك..."
                      minHeight="400px"
                    />
                  </TabsContent>

                  <TabsContent value="privacy" className="mt-4">
                    <RichTextEditor
                      value={formData.privacy_policy}
                      onChange={(val) => setFormData(prev => ({ ...prev, privacy_policy: val }))}
                      placeholder="سياسة الخصوصية..."
                      minHeight="400px"
                    />
                  </TabsContent>

                  <TabsContent value="terms" className="mt-4">
                    <RichTextEditor
                      value={formData.terms_conditions}
                      onChange={(val) => setFormData(prev => ({ ...prev, terms_conditions: val }))}
                      placeholder="الشروط والأحكام..."
                      minHeight="400px"
                    />
                  </TabsContent>

                  <TabsContent value="return" className="mt-4">
                    <RichTextEditor
                      value={formData.return_policy}
                      onChange={(val) => setFormData(prev => ({ ...prev, return_policy: val }))}
                      placeholder="سياسة الاسترجاع..."
                      minHeight="400px"
                    />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Step 4: Preview & Create */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <Eye className="h-16 w-16 mx-auto mb-4 text-purple-600" />
                  <h2 className="text-3xl font-bold mb-2">معاينة وتفعيل</h2>
                  <p className="text-muted-foreground">راجع إعداداتك وقم بتفعيل المتجر</p>
                </div>

                <div className="space-y-4 bg-muted/30 p-6 rounded-lg">
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-semibold">رابط المتجر:</span>
                    <span className="text-muted-foreground">/storefront/{formData.slug}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-semibold">الثيم:</span>
                    <span className="text-muted-foreground">{getThemeById(formData.theme_name)?.name || formData.theme_name}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-10 w-10 rounded" style={{ backgroundColor: formData.primary_color }} />
                    <div className="h-10 w-10 rounded" style={{ backgroundColor: formData.secondary_color }} />
                    <div className="h-10 w-10 rounded" style={{ backgroundColor: formData.accent_color }} />
                  </div>
                </div>

                <GradientButton
                  gradient="from-purple-600 to-pink-600"
                  onClick={createStore}
                  disabled={loading}
                  className="w-full text-xl py-6"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent ml-2" />
                      جاري التفعيل...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-6 w-6 ml-2" />
                      تفعيل المتجر الآن
                    </>
                  )}
                </GradientButton>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-8 border-t">
              <Button
                variant="outline"
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1 || loading}
              >
                <ArrowRight className="h-4 w-4 ml-2" />
                السابق
              </Button>

              {step < 4 ? (
                <Button onClick={() => setStep(Math.min(4, step + 1))}>
                  التالي
                  <ArrowLeft className="h-4 w-4 mr-2" />
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StorefrontSetupWizard;
