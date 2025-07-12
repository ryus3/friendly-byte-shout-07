import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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

  const [notificationVolume, setNotificationVolume] = useState(() => {
    return parseFloat(localStorage.getItem('notificationVolume')) || 0.7;
  });

  const colorSchemes = [
    { 
      id: 'blue', 
      name: 'أزرق احترافي', 
      primary: '221 83% 53%',
      primaryRgb: '59 130 246',
      secondary: '210 40% 98%',
      accent: '221 83% 53%',
      gradient: 'linear-gradient(135deg, hsl(221, 83%, 53%), hsl(221, 83%, 63%))',
      description: 'النمط الافتراضي المناسب للأعمال' 
    },
    { 
      id: 'green', 
      name: 'أخضر طبيعي', 
      primary: '142 76% 36%',
      primaryRgb: '34 197 94',
      secondary: '138 76% 97%',
      accent: '142 86% 28%',
      gradient: 'linear-gradient(135deg, hsl(142, 76%, 36%), hsl(142, 76%, 46%))',
      description: 'مريح للعين ومناسب للاستخدام المطول' 
    },
    { 
      id: 'purple', 
      name: 'بنفسجي إبداعي', 
      primary: '262 83% 58%',
      primaryRgb: '147 51 234',
      secondary: '270 100% 98%',
      accent: '262 90% 50%',
      gradient: 'linear-gradient(135deg, hsl(262, 83%, 58%), hsl(262, 83%, 68%))',
      description: 'جذاب وحديث للواجهات الإبداعية' 
    },
    { 
      id: 'orange', 
      name: 'برتقالي جريء', 
      primary: '25 95% 53%',
      primaryRgb: '249 115 22',
      secondary: '25 100% 97%',
      accent: '25 95% 47%',
      gradient: 'linear-gradient(135deg, hsl(25, 95%, 53%), hsl(25, 95%, 63%))',
      description: 'نشيط ومحفز للإنتاجية' 
    },
    { 
      id: 'rose', 
      name: 'وردي دافئ', 
      primary: '330 81% 60%',
      primaryRgb: '244 63 94',
      secondary: '330 100% 98%',
      accent: '330 81% 50%',
      gradient: 'linear-gradient(135deg, hsl(330, 81%, 60%), hsl(330, 81%, 70%))',
      description: 'دافئ وودود للتطبيقات الاجتماعية' 
    },
    { 
      id: 'teal', 
      name: 'تركوازي هادئ', 
      primary: '173 80% 40%',
      primaryRgb: '20 184 166',
      secondary: '173 100% 97%',
      accent: '173 80% 30%',
      gradient: 'linear-gradient(135deg, hsl(173, 80%, 40%), hsl(173, 80%, 50%))',
      description: 'هادئ ومتوازن للتركيز' 
    },
    { 
      id: 'indigo', 
      name: 'نيلي ملكي', 
      primary: '239 84% 67%',
      primaryRgb: '99 102 241',
      secondary: '239 100% 98%',
      accent: '239 84% 60%',
      gradient: 'linear-gradient(135deg, hsl(239, 84%, 67%), hsl(239, 84%, 77%))',
      description: 'أنيق وملكي للتطبيقات الراقية' 
    },
    { 
      id: 'slate', 
      name: 'رمادي أنيق', 
      primary: '215 25% 27%',
      primaryRgb: '71 85 105',
      secondary: '210 40% 98%',
      accent: '215 25% 21%',
      gradient: 'linear-gradient(135deg, hsl(215, 25%, 27%), hsl(215, 25%, 37%))',
      description: 'كلاسيكي ومتوازن' 
    },
    { 
      id: 'sunset', 
      name: 'غروب ذهبي', 
      primary: '45 93% 47%',
      primaryRgb: '251 191 36',
      secondary: '45 100% 97%',
      accent: '45 93% 37%',
      gradient: 'linear-gradient(135deg, hsl(45, 93%, 47%), hsl(25, 93%, 57%))',
      description: 'دافئ ومشرق مثل غروب الشمس' 
    },
    { 
      id: 'ocean', 
      name: 'محيط عميق', 
      primary: '200 100% 40%',
      primaryRgb: '0 160 230',
      secondary: '200 100% 97%',
      accent: '200 100% 30%',
      gradient: 'linear-gradient(135deg, hsl(200, 100%, 40%), hsl(180, 100%, 50%))',
      description: 'هادئ وعميق مثل المحيط' 
    },
    { 
      id: 'forest', 
      name: 'غابة خضراء', 
      primary: '120 60% 25%',
      primaryRgb: '25 102 25',
      secondary: '120 60% 97%',
      accent: '120 60% 15%',
      gradient: 'linear-gradient(135deg, hsl(120, 60%, 25%), hsl(140, 60%, 35%))',
      description: 'طبيعي ومنعش مثل الغابة' 
    },
    { 
      id: 'royal', 
      name: 'ملكي أرجواني', 
      primary: '280 100% 35%',
      primaryRgb: '102 0 204',
      secondary: '280 100% 97%',
      accent: '280 100% 25%',
      gradient: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(300, 100%, 45%))',
      description: 'فخم وملكي بتدرج أرجواني' 
    }
  ];

  const applyColorScheme = (scheme, preview = false) => {
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
    root.style.setProperty('--gradient-primary', scheme.gradient);
    
    // Save to localStorage only if not preview
    if (!preview) {
      localStorage.setItem('colorScheme', scheme.id);
      localStorage.setItem('colorSchemeData', JSON.stringify(scheme));
    }
  };

  const handleSchemeChange = (scheme) => {
    setCurrentScheme(scheme.id);
    // معاينة مباشرة للألوان
    applyColorScheme(scheme, true);
  };

  const handleFontSizeChange = (value) => {
    const newSize = value[0];
    setFontSize(newSize);
    // لا نطبق فوراً - فقط نحدث حالة العرض
  };

  const handleAnimationToggle = (enabled) => {
    setAnimationsEnabled(enabled);
    // لا نطبق فوراً - فقط نحدث حالة العرض
  };

  const handleHighContrastToggle = (enabled) => {
    setHighContrast(enabled);
    // لا نطبق فوراً - فقط نحدث حالة العرض
  };

  const handleSoundToggle = (enabled) => {
    setSoundEnabled(enabled);
    
    if (enabled) {
      playNotificationSound();
    }
  };

  const handleVolumeChange = (value) => {
    const newVolume = value[0];
    setNotificationVolume(newVolume);
    // تشغيل صوت للاختبار بالمستوى الجديد
    playNotificationSound(newVolume);
  };

  const playNotificationSound = (volume = notificationVolume) => {
    try {
      // iPhone-style professional notification sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Professional notification sound (like iPhone default)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume * 0.4, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
      
      toast({
        title: "تم تشغيل الصوت",
        description: "صوت إشعار احترافي مثل iPhone",
        variant: "success",
        duration: 1500
      });
    } catch (error) {
      console.log('تعذر تشغيل الصوت:', error);
    }
  };

  const handleLayoutDensityChange = (density) => {
    setLayoutDensity(density);
    // لا نطبق فوراً - فقط نحدث حالة العرض
  };

  const handleBorderRadiusChange = (value) => {
    const newRadius = value[0];
    setBorderRadius(newRadius);
    // لا نطبق فوراً - فقط نحدث حالة العرض
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
    setNotificationVolume(0.7);
    
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
    localStorage.removeItem('notificationVolume');
    
    toast({
      title: "تم إعادة التعيين",
      description: "تم استعادة جميع الإعدادات الافتراضية"
    });
  };


  const applyAllSettings = () => {
    // تطبيق نمط الألوان
    const selectedScheme = colorSchemes.find(s => s.id === currentScheme);
    if (selectedScheme) {
      applyColorScheme(selectedScheme);
    }

    // تطبيق حجم الخط
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem('fontSize', fontSize.toString());

    // تطبيق التأثيرات
    if (animationsEnabled) {
      document.documentElement.classList.remove('no-animations');
      document.documentElement.style.setProperty('--animation-duration', '0.3s');
    } else {
      document.documentElement.classList.add('no-animations');
      document.documentElement.style.setProperty('--animation-duration', '0s');
    }
    localStorage.setItem('animationsEnabled', animationsEnabled.toString());

    // تطبيق التباين العالي
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
      document.documentElement.style.setProperty('--border', '240 3.7% 15.9%');
      document.documentElement.style.setProperty('--input', '240 3.7% 15.9%');
    } else {
      document.documentElement.classList.remove('high-contrast');
      document.documentElement.style.setProperty('--border', '214.3 31.8% 91.4%');
      document.documentElement.style.setProperty('--input', '214.3 31.8% 91.4%');
    }
    localStorage.setItem('highContrast', highContrast.toString());

    // تطبيق كثافة التخطيط
    document.documentElement.setAttribute('data-density', layoutDensity);
    const densityStyles = {
      compact: { '--spacing-unit': '0.75rem', '--component-height': '2rem' },
      comfortable: { '--spacing-unit': '1rem', '--component-height': '2.5rem' },
      spacious: { '--spacing-unit': '1.5rem', '--component-height': '3rem' }
    };
    Object.entries(densityStyles[layoutDensity]).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
    localStorage.setItem('layoutDensity', layoutDensity);

    // تطبيق انحناء الحواف
    document.documentElement.style.setProperty('--radius', `${borderRadius}px`);
    localStorage.setItem('borderRadius', borderRadius.toString());

    // حفظ إعداد الصوت ومستوى الصوت
    localStorage.setItem('soundEnabled', soundEnabled.toString());
    localStorage.setItem('notificationVolume', notificationVolume.toString());

    // عرض رسالة نجاح
    toast({
      title: "تم حفظ الإعدادات",
      description: "تم تطبيق جميع إعدادات المظهر بنجاح",
      className: "bg-green-50 border-green-200 text-green-800"
    });

    // إغلاق النافذة
    onOpenChange(false);
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
            قم بتخصيص تجربة استخدامك للنظام وجعلها مناسبة لاحتياجاتك
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
              <Label className="text-base font-semibold">أنماط الألوان</Label>
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

                {soundEnabled && (
                  <div className="space-y-2">
                    <Label className="text-sm">مستوى الصوت: {Math.round(notificationVolume * 100)}%</Label>
                    <Slider
                      value={[notificationVolume]}
                      onValueChange={handleVolumeChange}
                      max={1}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Preview */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">معاينة التصميم</Label>
              
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
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={applyAllSettings} className="bg-primary hover:bg-primary/90">
            <Check className="w-4 h-4 ml-1" />
            حفظ وإغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppearanceDialog;