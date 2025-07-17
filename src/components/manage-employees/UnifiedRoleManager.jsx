import React, { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Shield, UserPlus, Eye, Settings, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

const UnifiedRoleManager = ({ user: selectedUser, onClose, onUpdate, open, onOpenChange }) => {
  const [currentRole, setCurrentRole] = useState(selectedUser?.role || 'employee');
  const [permissions, setPermissions] = useState(selectedUser?.permissions || []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // الأدوار المتاحة في النظام
  const availableRoles = [
    { value: 'admin', label: 'مدير عام', description: 'جميع الصلاحيات' },
    { value: 'deputy', label: 'نائب مدير', description: 'صلاحيات إدارية محدودة' },
    { value: 'manager', label: 'مدير قسم', description: 'إدارة قسم محدد' },
    { value: 'employee', label: 'موظف', description: 'صلاحيات أساسية' },
    { value: 'warehouse', label: 'مخزن', description: 'إدارة المخزون' },
    { value: 'cashier', label: 'كاشير', description: 'نقاط البيع' }
  ];

  const handleSaveRole = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          role: currentRole,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', selectedUser.user_id);

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تم تحديث دور الموظف بنجاح',
      });

      onUpdate?.();
    } catch (error) {
      console.error('خطأ في تحديث الدور:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في تحديث الدور',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // إذا لم يكن هناك مستخدم محدد
  if (!selectedUser) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground">لم يتم تحديد موظف</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-muted/30 to-muted/50 p-3 sm:p-4 rounded-lg border border-border/50">
        <h3 className="font-semibold mb-3 flex items-center text-sm sm:text-base">
          <Shield className="ml-2 h-4 w-4 text-primary" />
          إدارة الأدوار والصلاحيات
        </h3>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">الدور الحالي</Label>
            <Select value={currentRole} onValueChange={setCurrentRole}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label} - {role.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveRole} disabled={saving} className="px-6 h-9">
              {saving ? 'جاري الحفظ...' : 'حفظ الدور'}
            </Button>
          </div>
        </div>
      </div>

      {/* دليل الأدوار */}
      <Card className="border-2 border-dashed border-muted-foreground/25">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm text-muted-foreground">
            <Eye className="ml-2 h-4 w-4" />
            دليل الأدوار والصلاحيات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
              <Badge variant="default" className="bg-red-600 text-xs">مدير عام</Badge>
              <span className="text-muted-foreground text-xs">جميع الصلاحيات</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Badge variant="default" className="bg-blue-600 text-xs">نائب مدير</Badge>
              <span className="text-muted-foreground text-xs">صلاحيات محدودة</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <Badge variant="default" className="bg-purple-600 text-xs">مدير قسم</Badge>
              <span className="text-muted-foreground text-xs">إدارة قسم محدد</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <Badge variant="default" className="bg-orange-600 text-xs">موظف مخزن</Badge>
              <span className="text-muted-foreground text-xs">مخزون + جرد</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedRoleManager;