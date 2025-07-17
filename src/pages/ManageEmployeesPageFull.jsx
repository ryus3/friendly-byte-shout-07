import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  UserPlus, 
  ArrowRight, 
  Shield, 
  Settings, 
  User,
  Mail,
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
  Cog,
  Power,
  PowerOff
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { permissionsMap, defaultPermissions } from '@/lib/permissions';

const ManageEmployeesPageFull = () => {
  const { allUsers, updateUser } = useAuth();
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState({ searchTerm: '', status: 'all', role: 'all' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
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

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };
  
  const handleSelectFilterChange = (name, value) => {
    setFilters({ ...filters, [name]: value });
  };

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(user => {
      const searchTermMatch = (user.full_name?.toLowerCase() || '').includes(filters.searchTerm.toLowerCase()) ||
                              (user.email?.toLowerCase() || '').includes(filters.searchTerm.toLowerCase()) ||
                              (user.username?.toLowerCase() || '').includes(filters.searchTerm.toLowerCase());
      const statusMatch = filters.status === 'all' || user.status === filters.status;
      const roleMatch = filters.role === 'all' || user.role === filters.role;
      return searchTermMatch && statusMatch && roleMatch;
    }).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [allUsers, filters]);

  const handleSelectEmployee = (employee) => {
    setSelectedEmployee(employee);
    setEmployeeData({
      full_name: employee.full_name || '',
      email: employee.email || '',
      username: employee.username || '',
      role: employee.role || 'employee',
      status: employee.status || 'active',
      permissions: employee.permissions || {}
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!selectedEmployee) return;
    
    setLoading(true);
    try {
      await updateUser(selectedEmployee.user_id, employeeData);
      setIsEditing(false);
      
      // Update selected employee data
      setSelectedEmployee({ ...selectedEmployee, ...employeeData });
      
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
      permissions: { ...defaultPermissions[newRole] || {} }
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

  const handleAddNew = () => {
    toast({
      title: "لإضافة موظف جديد",
      description: "اطلب منه التسجيل في النظام ثم قم بالموافقة عليه من لوحة التحكم.",
    });
  };

  return (
    <>
      <Helmet>
        <title>إدارة الموظفين - RYUS</title>
        <meta name="description" content="إدارة صلاحيات وحسابات الموظفين" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate('/settings')}>
                <ArrowRight className="h-4 w-4 ml-2" />
                رجوع
              </Button>
              <div>
                <h1 className="text-3xl font-bold gradient-text">إدارة الموظفين</h1>
                <p className="text-muted-foreground mt-1">عرض وتعديل صلاحيات وحسابات الموظفين</p>
              </div>
            </div>
            <Button onClick={handleAddNew}>
              <UserPlus className="w-4 h-4 ml-2" />
              إضافة موظف جديد
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Sidebar - Employee List */}
            <div className="lg:col-span-1 space-y-4">
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>البحث والفلترة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="البحث..." 
                      name="searchTerm"
                      value={filters.searchTerm} 
                      onChange={handleFilterChange} 
                      className="pr-10" 
                    />
                  </div>
                  
                  <Select name="status" value={filters.status} onValueChange={(v) => handleSelectFilterChange('status', v)}>
                    <SelectTrigger><SelectValue placeholder="حالة الموظف" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="pending">قيد المراجعة</SelectItem>
                      <SelectItem value="suspended">معلق</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select name="role" value={filters.role} onValueChange={(v) => handleSelectFilterChange('role', v)}>
                    <SelectTrigger><SelectValue placeholder="دور الموظف" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأدوار</SelectItem>
                      <SelectItem value="admin">مدير عام</SelectItem>
                      <SelectItem value="deputy">نائب مدير</SelectItem>
                      <SelectItem value="employee">موظف مبيعات</SelectItem>
                      <SelectItem value="warehouse">موظف مخزن</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Employee List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredUsers.map((user) => (
                  <Card 
                    key={user.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedEmployee?.id === user.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleSelectEmployee(user)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <User className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{user.full_name}</h3>
                          <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                          <div className="flex gap-2 mt-1">
                            {getRoleBadge(user.role)}
                            {user.status === 'active' ? (
                              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                <Power className="w-3 h-3 ml-1" />
                                نشط
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
                                <PowerOff className="w-3 h-3 ml-1" />
                                معطل
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Right Content - Employee Details */}
            <div className="lg:col-span-2">
              {selectedEmployee ? (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      تفاصيل الموظف: {selectedEmployee.full_name}
                    </CardTitle>
                    <Button
                      variant={isEditing ? "destructive" : "outline"}
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? <X className="w-4 h-4 ml-2" /> : <Edit3 className="w-4 h-4 ml-2" />}
                      {isEditing ? 'إلغاء' : 'تعديل'}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="basic" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
                        <TabsTrigger value="permissions">الصلاحيات</TabsTrigger>
                        <TabsTrigger value="analytics">الإحصائيات</TabsTrigger>
                      </TabsList>

                      <TabsContent value="basic" className="space-y-4 mt-6">
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
                              <p className="text-foreground font-medium p-2 bg-secondary/30 rounded">{employeeData.full_name}</p>
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
                              <p className="text-foreground font-medium p-2 bg-secondary/30 rounded">@{employeeData.username}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="email">البريد الإلكتروني</Label>
                            <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded">
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
                                <SelectContent>
                                  <SelectItem value="admin">مدير عام</SelectItem>
                                  <SelectItem value="deputy">نائب مدير</SelectItem>
                                  <SelectItem value="employee">موظف مبيعات</SelectItem>
                                  <SelectItem value="warehouse">موظف مخزن</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="p-2">
                                {getRoleBadge(employeeData.role)}
                              </div>
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
                                <SelectContent>
                                  <SelectItem value="active">نشط</SelectItem>
                                  <SelectItem value="pending">معلق</SelectItem>
                                  <SelectItem value="suspended">محظور</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="p-2">
                                {getStatusBadge(employeeData.status)}
                              </div>
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
                      </TabsContent>

                      <TabsContent value="permissions" className="space-y-4 mt-6">
                        <div className="space-y-4 max-h-[500px] overflow-y-auto">
                          {permissionsMap.map((category) => (
                            <Card key={category.category}>
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  {getCategoryIcon(category.category)}
                                  {category.categoryLabel}
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-1 gap-2">
                                  {category.permissions.map((permission) => (
                                    <div key={permission.id} className="flex items-center justify-between p-2 rounded border border-border bg-secondary/30">
                                      <Label htmlFor={permission.id} className="text-sm cursor-pointer flex-1">
                                        {permission.label}
                                      </Label>
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

                      <TabsContent value="analytics" className="space-y-4 mt-6">
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
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-[600px] flex items-center justify-center">
                  <div className="text-center">
                    <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-muted-foreground mb-2">اختر موظفاً</h3>
                    <p className="text-muted-foreground">اختر موظفاً من القائمة لعرض تفاصيله وإدارة صلاحياته</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ManageEmployeesPageFull;