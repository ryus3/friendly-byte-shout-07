import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Shield, Eye } from 'lucide-react';
import { Label } from '@/components/ui/label';

const UnifiedRoleManager = ({ employee, onUpdate }) => {
  const { toast } = useToast();
  const [availableRoles, setAvailableRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    if (employee?.user_id) {
      fetchRoles();
      fetchUserRoles();
    }
  }, [employee?.user_id]);

  // جلب جميع الأدوار المتاحة
  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('hierarchy_level', { ascending: true });

      if (error) throw error;
      setAvailableRoles(data || []);
    } catch (error) {
      console.error('خطأ في جلب الأدوار:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب الأدوار المتاحة",
        variant: "destructive"
      });
    }
  };

  // جلب أدوار المستخدم الحالية
  const fetchUserRoles = async () => {
    if (!employee?.user_id) return;
    
    try {
      const { data, error } = await supabase
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
        .eq('user_id', employee.user_id)
        .eq('is_active', true);

      if (error) throw error;
      setUserRoles(data || []);
    } catch (error) {
      console.error('خطأ في جلب أدوار المستخدم:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب أدوار المستخدم",
        variant: "destructive"
      });
    }
  };

  // إضافة دور جديد
  const addRole = async () => {
    if (!selectedRoleId || !employee?.user_id) return;

    try {
      setIsLoading(true);
      
      // التحقق من عدم وجود الدور مسبقاً
      const existingRole = userRoles.find(ur => ur.role_id === selectedRoleId);
      if (existingRole) {
        toast({
          title: "تنبيه",
          description: "هذا الدور مضاف مسبقاً للمستخدم",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: employee.user_id,
          role_id: selectedRoleId,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "نجح",
        description: "تم إضافة الدور بنجاح"
      });

      // إعادة جلب البيانات
      await fetchUserRoles();
      setSelectedRoleId('');
      
      // استدعاء دالة التحديث
      if (onUpdate) onUpdate();
      
    } catch (error) {
      console.error('خطأ في إضافة الدور:', error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة الدور",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // حذف دور
  const removeRole = async (userRoleId) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('id', userRoleId);

      if (error) throw error;

      toast({
        title: "نجح",
        description: "تم حذف الدور بنجاح"
      });

      // إعادة جلب البيانات
      await fetchUserRoles();
      
      // استدعاء دالة التحديث
      if (onUpdate) onUpdate();
      
    } catch (error) {
      console.error('خطأ في حذف الدور:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف الدور",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // إذا لم يكن هناك موظف محدد
  if (!employee) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground">لم يتم تحديد موظف</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* الأدوار الحالية */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            الأدوار الحالية
          </CardTitle>
          <CardDescription>
            الأدوار المعينة حالياً للموظف {employee.full_name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userRoles.length > 0 ? (
            <div className="space-y-2">
              {userRoles.map((userRole) => (
                <div key={userRole.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">
                      {userRole.roles?.display_name || userRole.roles?.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      مضاف في: {new Date(userRole.assigned_at).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeRole(userRole.id)}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              لا توجد أدوار مضافة للموظف
            </p>
          )}
        </CardContent>
      </Card>

      {/* إضافة دور جديد */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            إضافة دور جديد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>اختر دور لإضافته</Label>
            <Select 
              value={selectedRoleId} 
              onValueChange={setSelectedRoleId}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر دور لإضافته" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles
                  .filter(role => !userRoles.some(ur => ur.role_id === role.id))
                  .map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.display_name || role.name}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={addRole} 
            disabled={!selectedRoleId || isLoading}
            className="w-full"
          >
            {isLoading ? 'جاري الإضافة...' : 'إضافة الدور'}
          </Button>
        </CardContent>
      </Card>

      {/* دليل الأدوار */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            دليل الأدوار المتاحة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {availableRoles.map(role => (
              <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Badge variant="outline">{role.display_name || role.name}</Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    {role.description || 'لا يوجد وصف'}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  المستوى: {role.hierarchy_level}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedRoleManager;