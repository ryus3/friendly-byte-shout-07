import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { 
  Sun, Moon, Monitor, Palette, Type, Zap, Eye, 
  ArrowLeft, RotateCcw, Check, Settings, 
  Contrast, Volume2, Heart, Sparkles 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AppearanceSettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  
  const [fontSize, setFontSize] = useState(16);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentScheme, setCurrentScheme] = useState('blue');

  const colorSchemes = [
    { id: 'blue', name: 'أزرق احترافي', primary: 'hsl(221, 83%, 53%)', secondary: 'hsl(221, 83%, 93%)', description: 'النمط الافتراضي المناسب للأعمال' },
    { id: 'green', name: 'أخضر طبيعي', primary: 'hsl(142, 76%, 36%)', secondary: 'hsl(142, 76%, 93%)', description: 'مريح للعين ومناسب للاستخدام المطول' },
    { id: 'purple', name: 'بنفسجي إبداعي', primary: 'hsl(262, 83%, 58%)', secondary: 'hsl(262, 83%, 93%)', description: 'جذاب وحديث للواجهات الإبداعية' },
    { id: 'orange', name: 'برتقالي جريء', primary: 'hsl(25, 95%, 53%)', secondary: 'hsl(25, 95%, 93%)', description: 'نشيط ومحفز للإنتاجية' },
    { id: 'teal', name: 'تركوازي أنيق', primary: 'hsl(173, 80%, 40%)', secondary: 'hsl(173, 80%, 93%)', description: 'هادئ ومتوازن' },
    { id: 'rose', name: 'وردي دافئ', primary: 'hsl(330, 81%, 60%)', secondary: 'hsl(330, 81%, 93%)', description: 'دافئ وودود' }
  ];

  const handleSchemeChange = (scheme) => {
    setCurrentScheme(scheme.id);
    // Here you would apply the color scheme to CSS variables
    toast({
      title: "تم تطبيق النمط",
      description: `تم تفعيل ${scheme.name} بنجاح`,
      className: "bg-card border-primary/20"
    });
  };

  const handleFontSizeChange = (value) => {
    setFontSize(value[0]);
    document.documentElement.style.fontSize = `${value[0]}px`;
  };

  const resetToDefaults = () => {
    setTheme('system');
    setFontSize(16);
    setAnimationsEnabled(true);
    setHighContrast(false);
    setSoundEnabled(true);
    setCurrentScheme('blue');
    toast({
      title: "تم إعادة التعيين",
      description: "تم استعادة الإعدادات الافتراضية"
    });
  };

  return (
    <>
      <Helmet>
        <title>إعدادات المظهر - نظام RYUS</title>
        <meta name="description" content="تخصيص مظهر التطبيق والألوان والخطوط." />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
        <div className="container mx-auto px-6 py-8 space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => navigate('/settings')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                إعدادات المظهر والثيم
              </h1>
              <p className="text-muted-foreground mt-1">
                قم بتخصيص تجربة استخدامك للنظام وجعلها مناسبة لاحتياجاتك
              </p>
            </div>
            <div className="mr-auto">
              <Button variant="outline" onClick={resetToDefaults} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                إعادة تعيين
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Theme Selection */}
            <Card className="lg:col-span-2 shadow-lg border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  نمط العرض والألوان
                </CardTitle>
                <CardDescription>
                  اختر النمط العام وألوان النظام المفضلة لديك
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Theme Mode */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">نمط العرض</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { value: 'light', label: 'النمط الفاتح', icon: Sun, desc: 'مناسب للنهار' },
                      { value: 'dark', label: 'النمط الداكن', icon: Moon, desc: 'مريح للعين' },
                      { value: 'system', label: 'تلقائي', icon: Monitor, desc: 'حسب النظام' }
                    ].map((themeOption) => {
                      const IconComponent = themeOption.icon;
                      return (
                        <div
                          key={themeOption.value}
                          className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
                            theme === themeOption.value 
                              ? 'border-primary bg-primary/5 shadow-md' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setTheme(themeOption.value)}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <div className={`p-3 rounded-lg ${theme === themeOption.value ? 'bg-primary text-white' : 'bg-secondary'}`}>
                              <IconComponent className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                              <p className="font-medium">{themeOption.label}</p>
                              <p className="text-xs text-muted-foreground">{themeOption.desc}</p>
                            </div>
                          </div>
                          {theme === themeOption.value && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-primary" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Color Schemes */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">أنماط الألوان</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {colorSchemes.map((scheme) => (
                      <div
                        key={scheme.id}
                        className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
                          currentScheme === scheme.id 
                            ? 'border-primary bg-primary/5 shadow-md' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleSchemeChange(scheme)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            <div 
                              className="w-4 h-4 rounded-full border border-white shadow-sm"
                              style={{ backgroundColor: scheme.primary }}
                            ></div>
                            <div 
                              className="w-4 h-4 rounded-full border border-white shadow-sm"
                              style={{ backgroundColor: scheme.secondary }}
                            ></div>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{scheme.name}</p>
                            <p className="text-xs text-muted-foreground">{scheme.description}</p>
                          </div>
                        </div>
                        {currentScheme === scheme.id && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-4 h-4 text-primary" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Typography & Display */}
            <div className="space-y-6">
              <Card className="shadow-lg border-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Type className="w-5 h-5" />
                    الخطوط والعرض
                  </CardTitle>
                  <CardDescription>تخصيص أحجام النصوص وخيارات العرض</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">حجم الخط الأساسي</Label>
                    <div className="space-y-3">
                      <Slider
                        value={[fontSize]}
                        onValueChange={handleFontSizeChange}
                        max={24}
                        min={12}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>صغير (12px)</span>
                        <span className="font-medium text-foreground">{fontSize}px</span>
                        <span>كبير (24px)</span>
                      </div>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-lg border">
                      <p style={{ fontSize: `${fontSize}px` }}>نموذج للنص بالحجم المحدد</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          التأثيرات المتحركة
                        </Label>
                        <p className="text-xs text-muted-foreground">تحريك العناصر والانتقالات</p>
                      </div>
                      <Switch
                        checked={animationsEnabled}
                        onCheckedChange={setAnimationsEnabled}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Contrast className="w-4 h-4" />
                          التباين العالي
                        </Label>
                        <p className="text-xs text-muted-foreground">تحسين الرؤية والوضوح</p>
                      </div>
                      <Switch
                        checked={highContrast}
                        onCheckedChange={setHighContrast}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Volume2 className="w-4 h-4" />
                          الأصوات التفاعلية
                        </Label>
                        <p className="text-xs text-muted-foreground">أصوات للإشعارات والتفاعلات</p>
                      </div>
                      <Switch
                        checked={soundEnabled}
                        onCheckedChange={setSoundEnabled}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preview Card */}
              <Card className="shadow-lg border-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    معاينة النمط
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 bg-primary text-primary-foreground rounded-lg">
                      <p className="text-sm font-medium">عنصر أساسي</p>
                    </div>
                    <div className="p-3 bg-secondary text-secondary-foreground rounded-lg">
                      <p className="text-sm">عنصر ثانوي</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">نص توضيحي</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="default">تسمية</Badge>
                      <Badge variant="outline">تسمية فرعية</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center pt-8">
            <div className="flex gap-4">
              <Button onClick={() => navigate('/settings')} variant="outline" size="lg">
                العودة للإعدادات
              </Button>
              <Button onClick={() => toast({ title: "تم الحفظ", description: "تم حفظ جميع إعدادات المظهر" })} size="lg" className="gap-2">
                <Heart className="w-4 h-4" />
                حفظ التفضيلات
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AppearanceSettingsPage;