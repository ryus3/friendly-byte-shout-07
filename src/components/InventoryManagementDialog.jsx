import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Package, AlertTriangle, TrendingDown, BarChart } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export const InventoryManagementDialog = ({ open, onOpenChange }) => {
  const [settings, setSettings] = useState({
    lowStockAlert: true,
    lowStockThreshold: 10,
    autoReorder: false,
    reorderPoint: 5,
    trackExpiry: true,
    expiryAlert: true,
    expiryDays: 7
  });

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast({
      title: "تم حفظ الإعداد",
      description: "تم تحديث إعدادات إدارة المخزون بنجاح"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            إعدادات إدارة المخزون
          </DialogTitle>
          <DialogDescription>
            تخصيص إعدادات تتبع المخزون والتنبيهات
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* تنبيهات المخزون المنخفض */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                تنبيهات المخزون المنخفض
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="lowStockAlert">تفعيل تنبيهات المخزون المنخفض</Label>
                <Switch
                  id="lowStockAlert"
                  checked={settings.lowStockAlert}
                  onCheckedChange={(checked) => handleSettingChange('lowStockAlert', checked)}
                />
              </div>
              
              {settings.lowStockAlert && (
                <div className="space-y-2">
                  <Label htmlFor="lowStockThreshold">حد التنبيه (قطعة)</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    value={settings.lowStockThreshold}
                    onChange={(e) => handleSettingChange('lowStockThreshold', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* إعادة الطلب التلقائي */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-4 w-4" />
                إعادة الطلب التلقائي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="autoReorder">تفعيل إعادة الطلب التلقائي</Label>
                <Switch
                  id="autoReorder"
                  checked={settings.autoReorder}
                  onCheckedChange={(checked) => handleSettingChange('autoReorder', checked)}
                />
              </div>
              
              {settings.autoReorder && (
                <div className="space-y-2">
                  <Label htmlFor="reorderPoint">نقطة إعادة الطلب (قطعة)</Label>
                  <Input
                    id="reorderPoint"
                    type="number"
                    value={settings.reorderPoint}
                    onChange={(e) => handleSettingChange('reorderPoint', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* تتبع انتهاء الصلاحية */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart className="h-4 w-4" />
                تتبع انتهاء الصلاحية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="trackExpiry">تفعيل تتبع انتهاء الصلاحية</Label>
                <Switch
                  id="trackExpiry"
                  checked={settings.trackExpiry}
                  onCheckedChange={(checked) => handleSettingChange('trackExpiry', checked)}
                />
              </div>
              
              {settings.trackExpiry && (
                <>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="expiryAlert">تنبيهات انتهاء الصلاحية</Label>
                    <Switch
                      id="expiryAlert"
                      checked={settings.expiryAlert}
                      onCheckedChange={(checked) => handleSettingChange('expiryAlert', checked)}
                    />
                  </div>
                  
                  {settings.expiryAlert && (
                    <div className="space-y-2">
                      <Label htmlFor="expiryDays">التنبيه قبل انتهاء الصلاحية (أيام)</Label>
                      <Input
                        id="expiryDays"
                        type="number"
                        value={settings.expiryDays}
                        onChange={(e) => handleSettingChange('expiryDays', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};