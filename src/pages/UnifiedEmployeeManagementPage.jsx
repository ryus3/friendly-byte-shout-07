import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import UnifiedEmployeeDialog from '@/components/manage-employees/UnifiedEmployeeDialog';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Shield, 
  Settings,
  Eye,
  Clock,
  CheckCircle,
  XCircle 
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const UnifiedEmployeeManagementPage = () => {
  const { allUsers } = useAuth();
  const { isAdmin, canManageEmployees } = usePermissionBasedData();
  const [filters, setFilters] = useState({ searchTerm: '', status: 'all', role: 'all' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // التحقق من الصلاحيات
  if (!isAdmin && !canManageEmployees) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">لا توجد صلاحية</h2>
          <p className="text-muted-foreground">ليس لديك صلاحية لإدارة الموظفين</p>
        </div>
      </div>
    );
  }

  // تحديث الفلاتر
  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };
  
  const handleSelectFilterChange = (name, value) => {
    setFilters({ ...filters, [name]: value });
  };

  // فلترة المستخدمين
  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(user => {
      const searchTermMatch = (user.full_name?.toLowerCase() || '').includes(filters.searchTerm.toLowerCase()) ||
                              (user.email?.toLowerCase() || '').includes(filters.searchTerm.toLowerCase()) ||
                              (user.username?.toLowerCase() || '').includes(filters.searchTerm.toLowerCase());
      const statusMatch = filters.status === 'all' || user.status === filters.status;
      return searchTermMatch && statusMatch;
    }).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [allUsers, filters]);

  // فتح حوار الموظف
  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setIsDialogOpen(true);
  };

  // إضافة موظف جديد
  const handleAddNew = () => {
    toast({
      title: "إضافة موظف جديد",
      description: "الموظفون الجدد يسجلون بأنفسهم عبر صفحة التسجيل، ثم تقوم بمراجعة طلباتهم هنا.",
      duration: 5000
    });
  };

  // الحصول على لون الحالة
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'suspended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // الحصول على أيقونة الحالة
  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'suspended': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // إحصائيات سريعة
  const stats = useMemo(() => {
    if (!allUsers) return { total: 0, active: 0, pending: 0, suspended: 0 };
    
    return {
      total: allUsers.length,
      active: allUsers.filter(u => u.status === 'active').length,
      pending: allUsers.filter(u => u.status === 'pending').length,
      suspended: allUsers.filter(u => u.status === 'suspended').length
    };
  }, [allUsers]);

  return (
    <>
      <Helmet>
        <title>إدارة الموظفين المتقدمة - النظام الهرمي</title>
        <meta name="description" content="إدارة شاملة للموظفين مع النظام الهرمي للأدوار والصلاحيات" />
      </Helmet>

      <div className="container mx-auto p-4 space-y-6">
        {/* العنوان والإحصائيات */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              إدارة الموظفين المتقدمة
            </h1>
            <p className="text-muted-foreground mt-1">
              النظام الهرمي للأدوار والصلاحيات مع إدارة صلاحيات المنتجات
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button onClick={handleAddNew} variant="outline" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              إضافة موظف جديد
            </Button>
          </div>
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">إجمالي الموظفين</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">نشط</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">قيد المراجعة</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">معلق</p>
                  <p className="text-2xl font-bold text-red-600">{stats.suspended}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* أدوات التصفية */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              البحث والتصفية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالاسم، الإيميل، أو اسم المستخدم..."
                  name="searchTerm"
                  value={filters.searchTerm}
                  onChange={handleFilterChange}
                  className="pl-10"
                />
              </div>
              
              <Select name="status" value={filters.status} onValueChange={(v) => handleSelectFilterChange('status', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="فلترة حسب الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="pending">قيد المراجعة</SelectItem>
                  <SelectItem value="suspended">معلق</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {filteredUsers.length} موظف من {stats.total}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* قائمة الموظفين */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة الموظفين</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">لا توجد نتائج</h3>
                <p className="text-muted-foreground">لم يتم العثور على موظفين مطابقين لمعايير البحث</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map(user => (
                  <Card key={user.user_id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{user.full_name}</h3>
                          <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(user.status)}`} />
                      </div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getStatusIcon(user.status)}
                          <span className="text-xs">
                            {user.status === 'active' ? 'نشط' : 
                             user.status === 'pending' ? 'قيد المراجعة' : 'معلق'}
                          </span>
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                      
                      <Button 
                        onClick={() => handleViewEmployee(user)} 
                        variant="outline" 
                        size="sm" 
                        className="w-full flex items-center gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        إدارة الموظف
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* حوار إدارة الموظف */}
      {selectedEmployee && (
        <UnifiedEmployeeDialog 
          employee={selectedEmployee}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </>
  );
};

export default UnifiedEmployeeManagementPage;