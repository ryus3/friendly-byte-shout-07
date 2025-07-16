import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Users, UserCheck, Loader2, Plus, Trash2, Edit, 
  Eye, Crown, Settings, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RoleManagementDialog = ({ open, onOpenChange }) => {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employees');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [saving, setSaving] = useState(false);

  // جلب البيانات عند فتح الحوار
  useEffect(() => {
    if (!open) return;
    fetchAllData();
  }, [open]);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // جلب الموظفين
      const { data: employeesData, error: employeesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (employeesError) throw employeesError;

      // جلب الأدوار
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('hierarchy_level');

      if (rolesError) throw rolesError;

      // جلب الصلاحيات
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .eq('is_active', true)
        .order('category', 'display_name');

      if (permissionsError) throw permissionsError;

      // جلب أدوار المستخدمين
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select(`
          *,
          roles (
            id,
            name,
            display_name,
            hierarchy_level
          ),
          profiles (
            full_name,
            email
          )
        `)
        .eq('is_active', true);

      if (userRolesError) throw userRolesError;

      setEmployees(employeesData || []);
      setRoles(rolesData || []);
      setPermissions(permissionsData || []);
      setUserRoles(userRolesData || []);
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

  // إضافة دور لموظف
  const handleAssignRole = async () => {
    if (!selectedEmployee || !selectedRoleId) {
      toast({
        title: 'تنبيه',
        description: 'يرجى اختيار موظف ودور',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedEmployee.user_id,
          role_id: selectedRoleId,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تم تعيين الدور بنجاح'
      });

      // إعادة جلب البيانات
      await fetchAllData();
      setSelectedEmployee(null);
      setSelectedRoleId('');
    } catch (error) {
      console.error('خطأ في تعيين الدور:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في تعيين الدور',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // حذف دور من موظف
  const handleRemoveRole = async (userRoleId) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('id', userRoleId);

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تم حذف الدور بنجاح'
      });

      await fetchAllData();
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

  // تجميع البيانات حسب الموظف
  const getEmployeeRoles = (employeeId) => {
    return userRoles.filter(ur => ur.user_id === employeeId);
  };

  // تجميع الصلاحيات حسب الفئة
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {});

  // احصائيات الأدوار
  const getRoleStats = () => {
    const stats = {};
    roles.forEach(role => {
      stats[role.id] = userRoles.filter(ur => ur.role_id === role.id).length;
    });
    return stats;
  };

  const roleStats = getRoleStats();

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="mr-2 text-lg">جاري تحميل البيانات...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <Shield className="ml-3 h-7 w-7 text-primary" />
            إدارة الأدوار والصلاحيات المتقدمة
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="employees" className="flex items-center">
              <Users className="ml-2 h-4 w-4" />
              الموظفين والأدوار
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center">
              <Crown className="ml-2 h-4 w-4" />
              إدارة الأدوار
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center">
              <Settings className="ml-2 h-4 w-4" />
              الصلاحيات
            </TabsTrigger>
            <TabsTrigger value="assign" className="flex items-center">
              <UserCheck className="ml-2 h-4 w-4" />
              تعيين أدوار
            </TabsTrigger>
          </TabsList>

          {/* تبويب الموظفين والأدوار */}
          <TabsContent value="employees" className="space-y-4">
            <div className="grid gap-4">
              {employees.map((employee, index) => {
                const employeeRoles = getEmployeeRoles(employee.user_id);
                return (
                  <motion.div
                    key={employee.user_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 space-x-reverse">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                              <Users className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold">{employee.full_name}</h3>
                              <p className="text-sm text-muted-foreground">{employee.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                              {employee.status === 'active' ? 'نشط' : 'معلق'}
                            </Badge>
                            <Badge variant="outline">
                              {employeeRoles.length} دور
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {employeeRoles.length === 0 ? (
                          <div className="text-center py-4">
                            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                            <p className="text-muted-foreground">لا توجد أدوار مُعيَّنة</p>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {employeeRoles.map((userRole) => (
                              <div key={userRole.id} className="flex items-center space-x-2 space-x-reverse">
                                <Badge 
                                  variant="default" 
                                  className="flex items-center space-x-1 space-x-reverse"
                                >
                                  <span>{userRole.roles.display_name}</span>
                                  <span className="text-xs opacity-75">
                                    (مستوى {userRole.roles.hierarchy_level})
                                  </span>
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveRole(userRole.id)}
                                  disabled={saving}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* تبويب إدارة الأدوار */}
          <TabsContent value="roles" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((role, index) => (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            role.hierarchy_level === 1 ? 'bg-gradient-to-br from-red-500 to-red-600' :
                            role.hierarchy_level === 2 ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                            'bg-gradient-to-br from-green-500 to-green-600'
                          }`}>
                            <Crown className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{role.display_name}</h3>
                            <p className="text-xs text-muted-foreground">
                              مستوى الصلاحية: {role.hierarchy_level}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {roleStats[role.id] || 0} موظف
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {role.description || 'لا يوجد وصف'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          الاسم التقني: {role.name}
                        </span>
                        {role.is_active ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* تبويب الصلاحيات */}
          <TabsContent value="permissions" className="space-y-4">
            {Object.entries(groupedPermissions).map(([category, perms]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Eye className="ml-2 h-5 w-5" />
                    {category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {perms.map((permission) => (
                      <div 
                        key={permission.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{permission.display_name}</p>
                          <p className="text-xs text-muted-foreground">{permission.name}</p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* تبويب تعيين الأدوار */}
          <TabsContent value="assign" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="ml-2 h-5 w-5" />
                  تعيين دور جديد لموظف
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">اختر الموظف:</label>
                    <Select 
                      value={selectedEmployee?.user_id || ''} 
                      onValueChange={(value) => setSelectedEmployee(employees.find(e => e.user_id === value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر موظف..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.user_id} value={employee.user_id}>
                            <div className="flex items-center space-x-2 space-x-reverse">
                              <span>{employee.full_name}</span>
                              <span className="text-xs text-muted-foreground">({employee.email})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">اختر الدور:</label>
                    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر دور..." />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center space-x-2 space-x-reverse w-full">
                              <span className="flex-1">{role.display_name}</span>
                              <Badge variant="outline" className="text-xs">
                                مستوى {role.hierarchy_level}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={handleAssignRole}
                  disabled={!selectedEmployee || !selectedRoleId || saving}
                  className="w-full"
                >
                  {saving ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري التعيين...
                    </>
                  ) : (
                    <>
                      <Plus className="ml-2 h-4 w-4" />
                      تعيين الدور
                    </>
                  )}
                </Button>

                {selectedEmployee && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">أدوار الموظف الحالية:</h4>
                    <div className="flex flex-wrap gap-2">
                      {getEmployeeRoles(selectedEmployee.user_id).map((userRole) => (
                        <Badge key={userRole.id} variant="secondary">
                          {userRole.roles.display_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default RoleManagementDialog;