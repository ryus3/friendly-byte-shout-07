import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  PackageX, Volume2, VolumeX, Clock, AlertTriangle, 
  CheckCircle, BellOff, Settings, RefreshCw 
} from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';

const StockNotificationSettings = ({ open, onOpenChange }) => {
  const { isAdmin } = useAuth();
  const { canManageSettings } = usePermissionBasedData();
  
  const [settings, setSettings] = useLocalStorage('inventorySettings', {
    enableLowStockNotifications: true,
    enableOutOfStockNotifications: true,
    lowStockThreshold: 5,
    averageStockThreshold: 10,
    criticalThreshold: 2,
    enableSounds: true,
    autoSilenceAfterRead: false,
    permanentlySilencedProducts: [],
    notificationFrequencyHours: 24,
    lastSavedAt: null
  });
  
  // منع الوصول للموظفين - بعد استدعاء جميع الhooks
  if (!isAdmin && !canManageSettings) {
    return null;
  }

  const handleSettingChange = async (key, value) => {
    const updatedSettings = { 
      ...settings, 
      [key]: value,
      lastSavedAt: new Date().toISOString()
    };
    
    setSettings(updatedSettings);
    
    // حفظ فوري في قاعدة البيانات
    try {
      await saveSettingsToDatabase(updatedSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "خطأ في الحفظ",
        description: "تعذر حفظ الإعدادات تلقائياً",
        variant: "destructive"
      });
    }
  };

  const saveSettingsToDatabase = async (settingsToSave) => {
    try {
      // أولاً حاول التحديث
      const { data, error: updateError } = await supabase
        .from('settings')
        .update({ 
          value: settingsToSave,
          description: 'إعدادات تنبيهات المخزون المحفوظة',
          updated_at: new Date().toISOString()
        })
        .eq('key', 'stock_notification_settings')
        .select();

      if (updateError) {
        console.error('Update failed, trying insert:', updateError);
        // إذا فشل التحديث، حاول الإدراج
        const { error: insertError } = await supabase
          .from('settings')
          .insert({
            key: 'stock_notification_settings',
            value: settingsToSave,
            description: 'إعدادات تنبيهات المخزون المحفوظة'
          });

        if (insertError) {
          console.error('Insert also failed:', insertError);
          throw insertError;
        }
      }
      
      console.log('Settings saved successfully:', settingsToSave);
    } catch (error) {
      console.error('Error saving settings to database:', error);
      throw error;
    }
  };

  const silenceProductNotifications = (productSku) => {
    const silencedProducts = [...settings.permanentlySilencedProducts];
    if (!silencedProducts.includes(productSku)) {
      silencedProducts.push(productSku);
      setSettings(prev => ({ 
        ...prev, 
        permanentlySilencedProducts: silencedProducts 
      }));
      
      // حذف الإشعارات الحالية لهذا المنتج
      const notificationKeys = Object.keys(localStorage).filter(key => 
        key.includes('low_stock_') && key.includes(productSku)
      );
      notificationKeys.forEach(key => localStorage.removeItem(key));
      
      toast({
        title: "تم إسكات التنبيهات",
        description: `تم إسكات تنبيهات المخزون نهائياً لهذا المنتج`,
        duration: 3000
      });
    }
  };

  const unsilenceProductNotifications = async (productSku) => {
    const silencedProducts = settings.permanentlySilencedProducts.filter(
      sku => sku !== productSku
    );
    const updatedSettings = { 
      ...settings, 
      permanentlySilencedProducts: silencedProducts,
      lastSavedAt: new Date().toISOString()
    };
    
    setSettings(updatedSettings);
    
    try {
      await saveSettingsToDatabase(updatedSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
    
    toast({
      title: "تم إلغاء الإسكات",
      description: `تم تفعيل تنبيهات المخزون مرة أخرى`,
      duration: 3000
    });
  };

  const clearAllSilencedProducts = async () => {
    const updatedSettings = { 
      ...settings, 
      permanentlySilencedProducts: [],
      lastSavedAt: new Date().toISOString()
    };
    
    setSettings(updatedSettings);
    
    try {
      await saveSettingsToDatabase(updatedSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
    
    toast({
      title: "تم إلغاء جميع الإسكاتات",
      description: "تم تفعيل تنبيهات المخزون لجميع المنتجات",
      duration: 3000
    });
  };

  const resetNotificationHistory = () => {
    // حذف تاريخ الإشعارات المرسلة من localStorage
    const notificationKeys = Object.keys(localStorage).filter(key => 
      key.includes('low_stock_') || key.includes('out_of_stock_')
    );
    notificationKeys.forEach(key => localStorage.removeItem(key));
    
    toast({
      title: "تم إعادة تعيين التاريخ",
      description: "سيتم إرسال تنبيهات جديدة للمنتجات المنخفضة",
      duration: 3000
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="w-5 h-5 text-primary" />
            إعدادات تنبيهات المخزون
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-4 h-4" />
                الإعدادات العامة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">تفعيل تنبيهات المخزون المنخفض</Label>
                  <p className="text-xs text-muted-foreground">
                    إرسال إشعار عندما ينخفض مخزون المنتج
                  </p>
                </div>
                <Switch
                  checked={settings.enableLowStockNotifications}
                  onCheckedChange={(checked) => 
                    handleSettingChange('enableLowStockNotifications', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">تفعيل تنبيهات نفاد المخزون</Label>
                  <p className="text-xs text-muted-foreground">
                    إرسال إشعار عندما ينفد المخزون تماماً (0 قطعة)
                  </p>
                </div>
                <Switch
                  checked={settings.enableOutOfStockNotifications}
                  onCheckedChange={(checked) => 
                    handleSettingChange('enableOutOfStockNotifications', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">أصوات التنبيهات</Label>
                  <p className="text-xs text-muted-foreground">
                    تشغيل أصوات عند ظهور تنبيهات المخزون
                  </p>
                </div>
                <Switch
                  checked={settings.enableSounds}
                  onCheckedChange={(checked) => 
                    handleSettingChange('enableSounds', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">إسكات تلقائي بعد القراءة</Label>
                  <p className="text-xs text-muted-foreground">
                    عدم إرسال نفس التنبيه بعد قراءته
                  </p>
                </div>
                <Switch
                  checked={settings.autoSilenceAfterRead}
                  onCheckedChange={(checked) => 
                    handleSettingChange('autoSilenceAfterRead', checked)
                  }
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">المخزون المنخفض (فما دون)</Label>
                  <p className="text-xs text-muted-foreground">
                    حد التنبيه للمخزون المنخفض
                  </p>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={settings.lowStockThreshold || 5}
                    onChange={(e) => 
                      handleSettingChange('lowStockThreshold', parseInt(e.target.value) || 5)
                    }
                    className="max-w-32"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-medium">المخزون المتوسط (فما دون)</Label>
                  <p className="text-xs text-muted-foreground">
                    حد التنبيه للمخزون المتوسط
                  </p>
                  <Input
                    type="number"
                    min="5"
                    max="100"
                    value={settings.averageStockThreshold || 10}
                    onChange={(e) => 
                      handleSettingChange('averageStockThreshold', parseInt(e.target.value) || 10)
                    }
                    className="max-w-32"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">حد التنبيه الحرج</Label>
                <p className="text-xs text-muted-foreground">
                  عدد القطع التي تعتبر حرجة (إشعار أحمر)
                </p>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.criticalThreshold}
                  onChange={(e) => 
                    handleSettingChange('criticalThreshold', parseInt(e.target.value) || 2)
                  }
                  className="max-w-32"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="font-medium">تكرار إشعارات المخزون</Label>
                <p className="text-xs text-muted-foreground">
                  كل كم ساعة يتم إرسال نفس التنبيه للمنتج المنخفض
                </p>
                <Select 
                  value={String(settings.notificationFrequencyHours || 24)} 
                  onValueChange={(value) => handleSettingChange('notificationFrequencyHours', parseInt(value))}
                >
                  <SelectTrigger className="max-w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">كل ساعة</SelectItem>
                    <SelectItem value="6">كل 6 ساعات</SelectItem>
                    <SelectItem value="12">كل 12 ساعة</SelectItem>
                    <SelectItem value="24">كل 24 ساعة (يومياً)</SelectItem>
                    <SelectItem value="72">كل 3 أيام</SelectItem>
                    <SelectItem value="168">كل أسبوع</SelectItem>
                    <SelectItem value="0">مرة واحدة فقط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Silenced Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellOff className="w-4 h-4" />
                  المنتجات المسكتة نهائياً
                </div>
                <Badge variant="secondary">
                  {settings.permanentlySilencedProducts.length} منتج
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {settings.permanentlySilencedProducts.length > 0 ? (
                <div className="space-y-3">
                  {settings.permanentlySilencedProducts.map((sku, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <BellOff className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{sku}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unsilenceProductNotifications(sku)}
                        className="text-primary hover:text-primary"
                      >
                        إلغاء الإسكات
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllSilencedProducts}
                    className="w-full"
                  >
                    إلغاء إسكات جميع المنتجات
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <BellOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>لا توجد منتجات مسكتة</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Management Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                إعادة تعيين
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                onClick={resetNotificationHistory}
                className="w-full justify-start"
              >
                <Clock className="w-4 h-4 mr-2" />
                إعادة تعيين تاريخ الإشعارات
              </Button>
              <p className="text-xs text-muted-foreground">
                سيؤدي هذا إلى إرسال تنبيهات جديدة للمنتجات المنخفضة حتى لو تم إرسال تنبيه سابقاً
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button onClick={async () => {
              try {
                await saveSettingsToDatabase(settings);
                toast({
                  title: "تم الحفظ بنجاح",
                  description: "تم حفظ إعدادات تنبيهات المخزون في قاعدة البيانات",
                  variant: "success"
                });
                onOpenChange(false);
              } catch (error) {
                toast({
                  title: "خطأ في الحفظ",
                  description: "تعذر حفظ الإعدادات، يرجى المحاولة مرة أخرى",
                  variant: "destructive"
                });
              }
            }}>
              <CheckCircle className="w-4 h-4 mr-2" />
              حفظ الإعدادات
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StockNotificationSettings;