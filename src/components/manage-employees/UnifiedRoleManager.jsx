import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Shield, UserPlus, Eye, Settings } from 'lucide-react';

const UnifiedRoleManager = ({ user: selectedUser, onClose, onUpdate }) => {
  const [userRoles, setUserRoles] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    if (!selectedUser?.user_id) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);

        // جلب الأدوار المتاحة
        const { data: roles, error: rolesError } = await supabase
          .from('roles')
          .select('*')
          .eq('is_active', true)
          .order('hierarchy_level', { ascending: false });

        if (rolesError) throw rolesError;

        // جلب أدوار المستخدم الحالية
        const { data: currentRoles, error: currentRolesError } = await supabase
          .from('user_roles')
          .select(`
            id,
            role_id,
            assigned_at,
            roles (
              id,
              name,
              display_name,
              hierarchy_level
            )
          `)
          .eq('user_id', selectedUser.user_id)
          .eq('is_active', true);

        if (currentRolesError) throw currentRolesError;

        setAvailableRoles(roles || []);
        setUserRoles(currentRoles || []);
      } catch (error) {
        console.error('خطأ في جلب البيانات:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ في جلب البيانات',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedUser?.user_id]);

  // إضافة دور جديد
  const handleAddRole = async () => {
    if (!selectedRoleId) {
      toast({
        title: 'تنبيه',
        description: 'يرجى اختيار دور أولاً',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.user_id,
          role_id: selectedRoleId,
          assigned_by: null, // يمكن إضافة معرف المستخدم الحالي هنا
          is_active: true
        });

      if (error) throw error;

      // إعادة جلب البيانات
      const { data: updatedRoles } = await supabase
        .from('user_roles')
        .select(`
          id,
          role_id,
          assigned_at,
          roles (
            id,
            name,
            display_name,
            hierarchy_level
          )
        `)
        .eq('user_id', selectedUser.user_id)
        .eq('is_active', true);

      setUserRoles(updatedRoles || []);
      setSelectedRoleId('');

      toast({
        title: 'نجح',
        description: 'تم إضافة الدور بنجاح',
      });

      onUpdate?.();
    } catch (error) {
      console.error('خطأ في إضافة الدور:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في إضافة الدور',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // حذف دور
  const handleRemoveRole = async (userRoleId) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('id', userRoleId);

      if (error) throw error;

      // إعادة جلب البيانات
      const { data: updatedRoles } = await supabase
        .from('user_roles')
        .select(`
          id,
          role_id,
          assigned_at,
          roles (
            id,
            name,
            display_name,
            hierarchy_level
          )
        `)
        .eq('user_id', selectedUser.user_id)
        .eq('is_active', true);

      setUserRoles(updatedRoles || []);

      toast({
        title: 'نجح',
        description: 'تم حذف الدور بنجاح',
      });

      onUpdate?.();
    } catch (error) {
      console.error('خطأ في حذف الدور:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في حذف الدور',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // تصفية الأدوار المتاحة للإضافة
  const availableRolesToAdd = availableRoles.filter(role => 
    !userRoles.some(ur => ur.role_id === role.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">إدارة أدوار المستخدم</h3>
          <p className="text-sm text-muted-foreground">
            {selectedUser?.full_name} ({selectedUser?.email})
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          إغلاق
        </Button>
      </div>

      {/* الأدوار الحالية */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Shield className="ml-2 h-5 w-5" />
            الأدوار الحالية ({userRoles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userRoles.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              لا توجد أدوار مُعيَّنة للمستخدم
            </p>
          ) : (
            <div className="space-y-2">
              {userRoles.map((userRole) => (
                <div
                  key={userRole.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Badge variant="default">
                      {userRole.roles.display_name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      مستوى {userRole.roles.hierarchy_level}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="text-xs text-muted-foreground">
                      {new Date(userRole.assigned_at).toLocaleDateString('ar-EG')}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveRole(userRole.id)}
                      disabled={saving}
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* إضافة دور جديد */}
      {availableRolesToAdd.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <UserPlus className="ml-2 h-5 w-5" />
              إضافة دور جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2 space-x-reverse">
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="اختر دور..." />
                </SelectTrigger>
                <SelectContent>
                  {availableRolesToAdd.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <span>{role.display_name}</span>
                        <Badge variant="outline" className="text-xs">
                          مستوى {role.hierarchy_level}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAddRole} 
                disabled={!selectedRoleId || saving}
              >
                إضافة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* شرح الأدوار */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Eye className="ml-2 h-5 w-5" />
            شرح الأدوار
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">مدير عام:</span>
              <span className="text-muted-foreground">جميع الصلاحيات</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">مدير قسم:</span>
              <span className="text-muted-foreground">إدارة قسم محدد</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">موظف مبيعات:</span>
              <span className="text-muted-foreground">إنشاء طلبات ومتابعة أرباح</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">موظف مخزن:</span>
              <span className="text-muted-foreground">إدارة المخزون والجرد</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">كاشير:</span>
              <span className="text-muted-foreground">استقبال المدفوعات والطلبات السريعة</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedRoleManager;