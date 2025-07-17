import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Mail, 
  Shield, 
  Settings, 
  Edit3, 
  Save, 
  X,
  Eye,
  ShoppingCart,
  Package,
  DollarSign,
  BarChart3,
  FileText,
  Users,
  Cog
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { permissionsMap, defaultPermissions } from '@/lib/permissions';

const EmployeeDetailsDialog = ({ employee, open, onOpenChange }) => {
  const { updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [employeeData, setEmployeeData] = useState({
    full_name: '',
    email: '',
    username: '',
    role: 'employee',
    status: 'active',
    permissions: {}
  });

  // Initialize data when employee changes
  useEffect(() => {
    if (employee) {
      setEmployeeData({
        full_name: employee.full_name || '',
        email: employee.email || '',
        username: employee.username || '',
        role: employee.role || 'employee',
        status: employee.status || 'active',
        permissions: employee.permissions || {}
      });
    }
  }, [employee]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateUser(employee.user_id, employeeData);
      setIsEditing(false);
      toast({
        title: "تم التحديث بنجاح",
        description: "تم تحديث بيانات الموظف بنجاح"
      });
    } catch (error) {
      console.error('Error updating employee:', error);
      toast({
        title: "خطأ في التحديث",
        description: "حدث خطأ أثناء تحديث بيانات الموظف",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (permissionId, enabled) => {
    setEmployeeData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionId]: enabled
      }
    }));
  };

  const handleRoleChange = (newRole) => {
    setEmployeeData(prev => ({
      ...prev,
      role: newRole,
      permissions: defaultPermissions[newRole] || {}
    }));
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      admin: { label: 'مدير عام', color: 'bg-red-500/20 text-red-500 border-red-500/30' },
      deputy: { label: 'نائب مدير', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' },
      employee: { label: 'موظف مبيعات', color: 'bg-blue-500/20 text-blue-500 border-blue-500/30' },
      warehouse: { label: 'موظف مخزن', color: 'bg-purple-500/20 text-purple-500 border-purple-500/30' }
    };
    const config = roleConfig[role] || roleConfig.employee;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: 'نشط', color: 'bg-green-500/20 text-green-500 border-green-500/30' },
      pending: { label: 'معلق', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' },
      suspended: { label: 'محظور', color: 'bg-red-500/20 text-red-500 border-red-500/30' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      pages: Eye,
      dashboard: BarChart3,
      products: Package,
      orders: ShoppingCart,
      purchases: FileText,
      accounting: DollarSign,
      employees: Users,
      customers: User,
      system: Cog
    };
    const IconComponent = icons[category] || Settings;
    return <IconComponent className="w-4 h-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            تفاصيل الموظف: {employee?.full_name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
            <TabsTrigger value="permissions">الصلاحيات</TabsTrigger>
            <TabsTrigger value="analytics">الإحصائيات</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  المعلومات الشخصية
                </CardTitle>
                <Button
                  variant={isEditing ? "destructive" : "outline"}
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? <X className="w-4 h-4 ml-2" /> : <Edit3 className="w-4 h-4 ml-2" />}
                  {isEditing ? 'إلغاء' : 'تعديل'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">الاسم الكامل</Label>
                    {isEditing ? (
                      <Input
                        id="full_name"
                        value={employeeData.full_name}
                        onChange={(e) => setEmployeeData(prev => ({ ...prev, full_name: e.target.value }))}
                      />
                    ) : (
                      <p className="text-foreground font-medium">{employeeData.full_name}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="username">اسم المستخدم</Label>
                    {isEditing ? (
                      <Input
                        id="username"
                        value={employeeData.username}
                        onChange={(e) => setEmployeeData(prev => ({ ...prev, username: e.target.value }))}
                      />
                    ) : (
                      <p className="text-foreground font-medium">@{employeeData.username}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <p className="text-foreground">{employeeData.email}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role">الدور الوظيفي</Label>
                    {isEditing ? (
                      <Select value={employeeData.role} onValueChange={handleRoleChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border z-[9999]">
                          <SelectItem value="admin">مدير عام</SelectItem>
                          <SelectItem value="deputy">نائب مدير</SelectItem>
                          <SelectItem value="employee">موظف مبيعات</SelectItem>
                          <SelectItem value="warehouse">موظف مخزن</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      getRoleBadge(employeeData.role)
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="status">حالة الحساب</Label>
                    {isEditing ? (
                      <Select 
                        value={employeeData.status} 
                        onValueChange={(value) => setEmployeeData(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border z-[9999]">
                          <SelectItem value="active">نشط</SelectItem>
                          <SelectItem value="pending">معلق</SelectItem>
                          <SelectItem value="suspended">محظور</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      getStatusBadge(employeeData.status)
                    )}
                  </div>
                </div>
                
                {isEditing && (
                  <div className="flex justify-end gap-2 pt-4">
                    <Button onClick={handleSave} disabled={loading}>
                      <Save className="w-4 h-4 ml-2" />
                      حفظ التغييرات
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <div className="grid gap-4">
              {permissionsMap.map((category) => (
                <Card key={category.category}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {getCategoryIcon(category.category)}
                      {category.categoryLabel}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {category.permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-secondary/30">
                          <div className="flex-1">
                            <Label htmlFor={permission.id} className="text-sm font-medium cursor-pointer">
                              {permission.label}
                            </Label>
                          </div>
                          <Switch
                            id={permission.id}
                            checked={employeeData.permissions[permission.id] || false}
                            onCheckedChange={(checked) => handlePermissionChange(permission.id, checked)}
                            disabled={!isEditing}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {isEditing && (
              <div className="flex justify-end gap-2 pt-4">
                <Button onClick={handleSave} disabled={loading}>
                  <Save className="w-4 h-4 ml-2" />
                  حفظ الصلاحيات
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">0 د.ع</p>
                      <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-8 h-8 text-purple-500" />
                    <div>
                      <p className="text-2xl font-bold">0%</p>
                      <p className="text-sm text-muted-foreground">معدل الأداء</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeDetailsDialog;