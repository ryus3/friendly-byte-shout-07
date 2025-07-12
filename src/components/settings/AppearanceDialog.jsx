import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast.js';
import { 
  Sun, Moon, Monitor, Palette, Type, Zap, Eye, 
  RotateCcw, Check, Settings, Contrast, Volume2, Sparkles,
  Paintbrush, Grid, Layout, Download, Upload
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const AppearanceDialog = ({ open, onOpenChange }) => {
  const { theme, setTheme } = useTheme();
  
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(getComputedStyle(document.documentElement).fontSize) || 16;
  });
  
  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    return !document.documentElement.classList.contains('no-animations');
  });
  
  const [highContrast, setHighContrast] = useState(() => {
    return document.documentElement.classList.contains('high-contrast');
  });
  
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('soundEnabled') !== 'false';
  });
  
  const [reducedMotion, setReducedMotion] = useState(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  
  const [currentScheme, setCurrentScheme] = useState(() => {
    return localStorage.getItem('colorScheme') || 'blue';
  });
  
  const [layoutDensity, setLayoutDensity] = useState(() => {
    return document.documentElement.getAttribute('data-density') || 'comfortable';
  });
  
  const [borderRadius, setBorderRadius] = useState(() => {
    const radius = getComputedStyle(document.documentElement).getPropertyValue('--radius');
    return parseInt(radius) || 8;
  });

  const colorSchemes = [
    { 
      id: 'blue', 
      name: 'أزرق احترافي', 
      primary: '221 83% 53%',
      primaryRgb: '59 130 246',
      secondary: '210 40% 98%',
      accent: '221 83% 53%',
      description: 'النمط الافتراضي المناسب للأعمال' 
    },
    { 
      id: 'green', 
      name: 'أخضر طبيعي', 
      primary: '142 76% 36%',
      primaryRgb: '34 197 94',
      secondary: '138 76% 97%',
      accent: '142 86% 28%',
      description: 'مريح للعين ومناسب للاستخدام المطول' 
    },
    { 
      id: 'purple', 
      name: 'بنفسجي إبداعي', 
      primary: '262 83% 58%',
      primaryRgb: '147 51 234',
      secondary: '270 100% 98%',
      accent: '262 90% 50%',
      description: 'جذاب وحديث للواجهات الإبداعية' 
    },
    { 
      id: 'orange', 
      name: 'برتقالي جريء', 
      primary: '25 95% 53%',
      primaryRgb: '249 115 22',
      secondary: '25 100% 97%',
      accent: '25 95% 47%',
      description: 'نشيط ومحفز للإنتاجية' 
    },
    { 
      id: 'rose', 
      name: 'وردي دافئ', 
      primary: '330 81% 60%',
      primaryRgb: '244 63 94',
      secondary: '330 100% 98%',
      accent: '330 81% 50%',
      description: 'دافئ وودود للتطبيقات الاجتماعية' 
    },
    { 
      id: 'slate', 
      name: 'رمادي أنيق', 
      primary: '215 25% 27%',
      primaryRgb: '71 85 105',
      secondary: '210 40% 98%',
      accent: '215 25% 21%',
      description: 'كلاسيكي ومتوازن' 
    }
  ];

  const applyColorScheme = (scheme) => {
    const root = document.documentElement;
    
    // Apply HSL values for CSS variables
    root.style.setProperty('--primary', scheme.primary);
    root.style.setProperty('--primary-foreground', '210 40% 98%');
    root.style.setProperty('--secondary', scheme.secondary);
    root.style.setProperty('--secondary-foreground', '222.2 84% 4.9%');
    root.style.setProperty('--accent', scheme.accent);
    root.style.setProperty('--accent-foreground', '210 40% 98%');
    
    // Apply RGB values for gradient compatibility
    root.style.setProperty('--primary-rgb', scheme.primaryRgb);
    
    // Save to localStorage
    localStorage.setItem('colorScheme', scheme.id);
    localStorage.setItem('colorSchemeData', JSON.stringify(scheme));
  };

  const handleSchemeChange = (scheme) => {
    setCurrentScheme(scheme.id);
    applyColorScheme(scheme);
    
    toast({
      title: "تم تطبيق النمط",
      description: `تم تفعيل ${scheme.name} بنجاح`,
      className: "bg-card border-primary/20"
    });
  };

  const handleFontSizeChange = (value) => {
    const newSize = value[0];
    setFontSize(newSize);
    
    // Apply immediately to root element
    document.documentElement.style.fontSize = `${newSize}px`;
    
    // Save to localStorage
    localStorage.setItem('fontSize', newSize.toString());
    
    toast({
      title: "تم تحديث حجم الخط",
      description: `تم تعيين حجم الخط إلى ${newSize}px`
    });
  };

  const handleAnimationToggle = (enabled) => {
    setAnimationsEnabled(enabled);
    
    if (enabled) {
      document.documentElement.classList.remove('no-animations');
      document.documentElement.style.setProperty('--animation-duration', '0.3s');
    } else {
      document.documentElement.classList.add('no-animations');
      document.documentElement.style.setProperty('--animation-duration', '0s');
    }
    
    // Save to localStorage
    localStorage.setItem('animationsEnabled', enabled.toString());
    
    toast({
      title: enabled ? "تم تفعيل التأثيرات" : "تم إيقاف التأثيرات",
      description: enabled ? "التأثيرات المتحركة مفعلة" : "التأثيرات المتحركة معطلة"
    });
  };

  const handleHighContrastToggle = (enabled) => {
    setHighContrast(enabled);
    
    if (enabled) {
      document.documentElement.classList.add('high-contrast');
      // Apply high contrast styles
      document.documentElement.style.setProperty('--border', '240 3.7% 15.9%');
      document.documentElement.style.setProperty('--input', '240 3.7% 15.9%');
    } else {
      document.documentElement.classList.remove('high-contrast');
      // Restore normal contrast
      document.documentElement.style.setProperty('--border', '214.3 31.8% 91.4%');
      document.documentElement.style.setProperty('--input', '214.3 31.8% 91.4%');
    }
    
    // Save to localStorage
    localStorage.setItem('highContrast', enabled.toString());
    
    toast({
      title: enabled ? "تم تفعيل التباين العالي" : "تم إيقاف التباين العالي",
      description: enabled ? "تم تحسين التباين للرؤية الأفضل" : "تم إرجاع التباين للوضع العادي"
    });
  };

  const handleSoundToggle = (enabled) => {
    setSoundEnabled(enabled);
    localStorage.setItem('soundEnabled', enabled.toString());
    
    if (enabled) {
      // Test sound
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUE');
        audio.volume = 0.2;
        audio.play().catch(() => {});
      } catch (error) {
        console.log('تعذر تشغيل الصوت التجريبي');
      }
    }
    
    toast({
      title: enabled ? "تم تفعيل الأصوات" : "تم إيقاف الأصوات",
      description: enabled ? "الأصوات التفاعلية مفعلة" : "الأصوات التفاعلية معطلة"
    });
  };

  const handleLayoutDensityChange = (density) => {
    setLayoutDensity(density);
    document.documentElement.setAttribute('data-density', density);
    
    // Apply density-specific styles
    const densityStyles = {
      compact: { '--spacing-unit': '0.75rem', '--component-height': '2rem' },
      comfortable: { '--spacing-unit': '1rem', '--component-height': '2.5rem' },
      spacious: { '--spacing-unit': '1.5rem', '--component-height': '3rem' }
    };
    
    Object.entries(densityStyles[density]).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
    
    // Save to localStorage
    localStorage.setItem('layoutDensity', density);
    
    toast({
      title: "تم تحديث كثافة التخطيط",
      description: `تم تعيين التخطيط إلى ${density === 'compact' ? 'مضغوط' : density === 'comfortable' ? 'مريح' : 'متباعد'}`
    });
  };

  const handleBorderRadiusChange = (value) => {
    const newRadius = value[0];
    setBorderRadius(newRadius);
    
    // Apply to CSS variables
    document.documentElement.style.setProperty('--radius', `${newRadius}px`);
    
    // Save to localStorage
    localStorage.setItem('borderRadius', newRadius.toString());
    
    toast({
      title: "تم تحديث انحناء الحواف",
      description: `تم تعيين انحناء الحواف إلى ${newRadius}px`
    });
  };

  const resetToDefaults = () => {
    // Reset all values
    setTheme('system');
    setFontSize(16);
    setAnimationsEnabled(true);
    setHighContrast(false);
    setSoundEnabled(true);
    setReducedMotion(false);
    setCurrentScheme('blue');
    setLayoutDensity('comfortable');
    setBorderRadius(8);
    
    // Apply defaults to DOM
    document.documentElement.style.fontSize = '16px';
    document.documentElement.classList.remove('no-animations', 'high-contrast');
    document.documentElement.setAttribute('data-density', 'comfortable');
    document.documentElement.style.setProperty('--radius', '8px');
    document.documentElement.style.setProperty('--animation-duration', '0.3s');
    
    // Apply default color scheme
    const defaultScheme = colorSchemes.find(s => s.id === 'blue');
    applyColorScheme(defaultScheme);
    
    // Clear localStorage
    localStorage.removeItem('fontSize');
    localStorage.removeItem('animationsEnabled');
    localStorage.removeItem('highContrast');
    localStorage.removeItem('soundEnabled');
    localStorage.removeItem('layoutDensity');
    localStorage.removeItem('borderRadius');
    localStorage.removeItem('colorScheme');
    localStorage.removeItem('colorSchemeData');
    
    toast({
      title: "تم إعادة التعيين",
      description: "تم استعادة جميع الإعدادات الافتراضية"
    });
  };

  const exportSettings = () => {
    const settings = {
      theme,
      fontSize,
      animationsEnabled,
      highContrast,
      soundEnabled,
      reducedMotion,
      currentScheme,
      layoutDensity,
      borderRadius,
      colorSchemeData: localStorage.getItem('colorSchemeData')
    };
    
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `ryus-appearance-settings-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "تم تصدير الإعدادات",
      description: "تم حفظ إعدادات المظهر في ملف JSON"
    });
  };

  const importSettings = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        
        // Apply imported settings
        if (settings.theme) setTheme(settings.theme);
        if (settings.fontSize) handleFontSizeChange([settings.fontSize]);
        if (typeof settings.animationsEnabled === 'boolean') handleAnimationToggle(settings.animationsEnabled);
        if (typeof settings.highContrast === 'boolean') handleHighContrastToggle(settings.highContrast);
        if (typeof settings.soundEnabled === 'boolean') handleSoundToggle(settings.soundEnabled);
        if (settings.layoutDensity) handleLayoutDensityChange(settings.layoutDensity);
        if (settings.borderRadius) handleBorderRadiusChange([settings.borderRadius]);
        
        if (settings.currentScheme && settings.colorSchemeData) {
          const schemeData = JSON.parse(settings.colorSchemeData);
          handleSchemeChange(schemeData);
        }
        
        toast({
          title: "تم استيراد الإعدادات",
          description: "تم تطبيق جميع الإعدادات المستوردة بنجاح"
        });
      } catch (error) {
        toast({
          title: "خطأ في الاستيراد",
          description: "فشل في قراءة ملف الإعدادات",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  // Load settings on component mount
  React.useEffect(() => {
    const savedScheme = localStorage.getItem('colorSchemeData');
    if (savedScheme) {
      try {
        const schemeData = JSON.parse(savedScheme);
        applyColorScheme(schemeData);
      } catch (error) {
        console.error('Failed to load saved color scheme:', error);
      }
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            إعدادات المظهر والثيم
          </DialogTitle>
          <DialogDescription>
            قم بتخصيص تجربة استخدامك للنظام وجعلها مناسبة لاحتياجاتك - جميع التغييرات تطبق فوراً
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Theme Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Theme Mode */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">نمط العرض</Label>
                <Button variant="outline" size="sm" onClick={resetToDefaults}>
                  <RotateCcw className="w-4 h-4 ml-1" />
                  إعادة تعيين
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: 'فاتح', icon: Sun, desc: 'للنهار' },
                  { value: 'dark', label: 'داكن', icon: Moon, desc: 'مريح' },
                  { value: 'system', label: 'تلقائي', icon: Monitor, desc: 'حسب النظام' }
                ].map((themeOption) => {
                  const IconComponent = themeOption.icon;
                  return (
                    <div
                      key={themeOption.value}
                      className={`relative p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                        theme === themeOption.value 
                          ? 'border-primary bg-primary/5 shadow-md' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setTheme(themeOption.value)}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={`p-2 rounded-md ${theme === themeOption.value ? 'bg-primary text-white' : 'bg-secondary'}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-sm">{themeOption.label}</p>
                          <p className="text-xs text-muted-foreground">{themeOption.desc}</p>
                        </div>
                      </div>
                      {theme === themeOption.value && (
                        <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Color Schemes */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">أنماط الألوان (تطبق فوراً)</Label>
              <div className="grid grid-cols-2 gap-3">
                {colorSchemes.map((scheme) => (
                  <div
                    key={scheme.id}
                    className={`relative p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
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
                          style={{ backgroundColor: `hsl(${scheme.primary})` }}
                        ></div>
                        <div 
                          className="w-4 h-4 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: `hsl(${scheme.secondary})` }}
                        ></div>
                        <div 
                          className="w-4 h-4 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: `hsl(${scheme.accent})` }}
                        ></div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{scheme.name}</p>
                        <p className="text-xs text-muted-foreground">{scheme.description}</p>
                      </div>
                    </div>
                    {currentScheme === scheme.id && (
                      <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Layout Settings */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">إعدادات التخطيط</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>كثافة التخطيط</Label>
                  <Select value={layoutDensity} onValueChange={handleLayoutDensityChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">مضغوط</SelectItem>
                      <SelectItem value="comfortable">مريح</SelectItem>
                      <SelectItem value="spacious">متباعد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>انحناء الحواف: {borderRadius}px</Label>
                  <Slider
                    value={[borderRadius]}
                    onValueChange={handleBorderRadiusChange}
                    max={20}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          <div className="space-y-4">
            {/* Typography */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Type className="w-4 h-4" />
                الخطوط والنصوص
              </Label>
              <div className="space-y-3">
                <Label className="text-sm">حجم الخط الأساسي: {fontSize}px</Label>
                <Slider
                  value={[fontSize]}
                  onValueChange={handleFontSizeChange}
                  max={24}
                  min={12}
                  step={1}
                  className="w-full"
                />
                <div className="p-3 bg-secondary/30 rounded-lg border">
                  <p style={{ fontSize: `${fontSize}px` }}>نموذج للنص بالحجم المحدد</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Accessibility */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" />
                إعدادات الوصول
              </Label>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">التأثيرات المتحركة</Label>
                    <p className="text-xs text-muted-foreground">تحريك العناصر والانتقالات</p>
                  </div>
                  <Switch
                    checked={animationsEnabled}
                    onCheckedChange={handleAnimationToggle}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">التباين العالي</Label>
                    <p className="text-xs text-muted-foreground">تحسين الرؤية والوضوح</p>
                  </div>
                  <Switch
                    checked={highContrast}
                    onCheckedChange={handleHighContrastToggle}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">الأصوات التفاعلية</Label>
                    <p className="text-xs text-muted-foreground">أصوات للإشعارات</p>
                  </div>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={handleSoundToggle}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Preview & Export */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">معاينة وتصدير</Label>
              
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

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportSettings} className="flex-1">
                  <Download className="w-4 h-4 ml-1" />
                  تصدير
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => document.getElementById('import-settings').click()}>
                  <Upload className="w-4 h-4 ml-1" />
                  استيراد
                </Button>
                <input
                  id="import-settings"
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={importSettings}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button onClick={() => {
            toast({ 
              title: "تم الحفظ", 
              description: "جميع الإعدادات محفوظة تلقائياً" 
            });
            onOpenChange(false);
          }}>
            إغلاق وحفظ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppearanceDialog;