import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Shield, UserPlus, Eye, Settings, Trash2 } from 'lucide-react';

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
            <div className="text-center py-8">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">لا توجد أدوار مُعيَّنة للمستخدم</p>
              <p className="text-sm text-muted-foreground mt-1">قم بإضافة دور أولاً لتمكين الموظف من استخدام النظام</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {userRoles.map((userRole, index) => (
                  <motion.div
                    key={userRole.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/30 to-muted/50 rounded-xl border border-border/50 hover:border-border transition-all duration-200"
                  >
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <Badge variant="default" className="mb-1">
                          {userRole.roles.display_name}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          مستوى الصلاحية: {userRole.roles.hierarchy_level} • 
                          تاريخ الإضافة: {new Date(userRole.assigned_at).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveRole(userRole.id)}
                      disabled={saving}
                      className="hover:scale-105 transition-transform"
                    >
                      <Trash2 className="h-4 w-4 ml-1" />
                      حذف
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
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
          <CardContent className="space-y-4">
            <div className="flex space-x-3 space-x-reverse">
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="اختر دور..." />
                </SelectTrigger>
                <SelectContent>
                  {availableRolesToAdd.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center space-x-2 space-x-reverse w-full">
                        <span className="flex-1">{role.display_name}</span>
                        <Badge variant="outline" className="text-xs mr-auto">
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
                className="px-6"
              >
                <UserPlus className="h-4 w-4 ml-1" />
                إضافة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* شرح الأدوار */}
      <Card className="border-2 border-dashed border-muted-foreground/25">
        <CardHeader>
          <CardTitle className="flex items-center text-base text-muted-foreground">
            <Eye className="ml-2 h-5 w-5" />
            دليل الأدوار والصلاحيات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
              <Badge variant="default" className="bg-green-600">مدير عام</Badge>
              <span className="text-muted-foreground text-xs">جميع الصلاحيات</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Badge variant="default" className="bg-blue-600">مدير قسم</Badge>
              <span className="text-muted-foreground text-xs">إدارة قسم محدد</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <Badge variant="default" className="bg-purple-600">موظف مبيعات</Badge>
              <span className="text-muted-foreground text-xs">طلبات + أرباح</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <Badge variant="default" className="bg-orange-600">موظف مخزن</Badge>
              <span className="text-muted-foreground text-xs">مخزون + جرد</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-teal-50 dark:bg-teal-950/20 md:col-span-2">
              <Badge variant="default" className="bg-teal-600">كاشير</Badge>
              <span className="text-muted-foreground text-xs">طلبات سريعة + مدفوعات</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedRoleManager;