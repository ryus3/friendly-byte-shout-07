import React, { useState, useEffect } from 'react';
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
  const [currentRoles, setCurrentRoles] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // جلب الأدوار المتاحة وأدوار المستخدم الحالية
  useEffect(() => {
    if (!selectedUser?.user_id) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // جلب جميع الأدوار المتاحة
        const { data: roles, error: rolesError } = await supabase
          .from('roles')
          .select('*')
          .eq('is_active', true)
          .order('hierarchy_level');

        if (rolesError) throw rolesError;

        // جلب أدوار المستخدم الحالية
        const { data: userRoles, error: userRolesError } = await supabase
          .from('user_roles')
          .select(`
            role_id,
            roles (
              id,
              name,
              display_name,
              hierarchy_level,
              description
            )
          `)
          .eq('user_id', selectedUser.user_id)
          .eq('is_active', true);

        if (userRolesError) throw userRolesError;

        setAvailableRoles(roles || []);
        setCurrentRoles(userRoles?.map(ur => ur.roles) || []);

      } catch (error) {
        console.error('خطأ في جلب البيانات:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ في جلب بيانات الأدوار',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedUser?.user_id]);

  // إضافة دور جديد
  const addRole = async (roleId) => {
    try {
      setSaving(true);

      // التحقق من عدم وجود الدور مسبقاً
      const existingRole = currentRoles.find(r => r.id === roleId);
      if (existingRole) {
        toast({
          title: 'تنبيه',
          description: 'الدور موجود بالفعل',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.user_id,
          role_id: roleId,
          is_active: true
        });

      if (error) throw error;

      // إعادة جلب البيانات
      const { data: userRoles, error: fetchError } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles (
            id,
            name,
            display_name,
            hierarchy_level,
            description
          )
        `)
        .eq('user_id', selectedUser.user_id)
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      setCurrentRoles(userRoles?.map(ur => ur.roles) || []);

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
  const removeRole = async (roleId) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('user_id', selectedUser.user_id)
        .eq('role_id', roleId);

      if (error) throw error;

      setCurrentRoles(currentRoles.filter(r => r.id !== roleId));

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

  // الحصول على لون الدور
  const getRoleColor = (hierarchyLevel) => {
    switch (hierarchyLevel) {
      case 1: return 'bg-red-500 text-white';
      case 2: return 'bg-blue-500 text-white';
      case 3: return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (!selectedUser) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground">لم يتم تحديد موظف</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-muted/30 to-muted/50 p-3 sm:p-4 rounded-lg border border-border/50">
        <h3 className="font-semibold mb-3 flex items-center text-sm sm:text-base">
          <Shield className="ml-2 h-4 w-4 text-primary" />
          إدارة الأدوار والصلاحيات الهرمية
        </h3>
        
        <div className="space-y-4">
          {/* الأدوار الحالية */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">الأدوار الحالية</Label>
            <div className="flex flex-wrap gap-2">
              {currentRoles.length > 0 ? (
                currentRoles.map(role => (
                  <div key={role.id} className="flex items-center gap-2 bg-background border rounded-lg p-2">
                    <Badge variant="secondary" className={getRoleColor(role.hierarchy_level)}>
                      {role.display_name}
                    </Badge>
                    <button
                      onClick={() => removeRole(role.id)}
                      disabled={saving}
                      className="text-destructive hover:text-destructive/80 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد أدوار مُعيّنة</p>
              )}
            </div>
          </div>

          {/* إضافة دور جديد */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">إضافة دور جديد</Label>
            <div className="flex gap-2">
              <Select onValueChange={addRole} disabled={saving}>
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue placeholder="اختر دور لإضافته" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles
                    .filter(role => !currentRoles.some(cr => cr.id === role.id))
                    .map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getRoleColor(role.hierarchy_level)}>
                            مستوى {role.hierarchy_level}
                          </Badge>
                          <span>{role.display_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* دليل الأدوار */}
      <Card className="border-2 border-dashed border-muted-foreground/25">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm text-muted-foreground">
            <Eye className="ml-2 h-4 w-4" />
            دليل النظام الهرمي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 text-xs">
            {availableRoles.map(role => (
              <div key={role.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getRoleColor(role.hierarchy_level)}>
                    مستوى {role.hierarchy_level}
                  </Badge>
                  <span className="font-medium">{role.display_name}</span>
                </div>
                <span className="text-muted-foreground text-xs">{role.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedRoleManager;