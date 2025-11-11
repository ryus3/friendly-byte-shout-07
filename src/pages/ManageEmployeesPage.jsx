import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, UserPlus, ArrowRight, Shield, LayoutGrid, List, 
  Eye, Edit2, Hash, MessageCircle, Mail, User, TrendingUp, Target, ShoppingCart
} from 'lucide-react';
import UnifiedEmployeeDialog from '@/components/manage-employees/UnifiedEmployeeDialog';
import UpdateRolePermissionsDialog from '@/components/manage-employees/UpdateRolePermissionsDialog';
import { motion } from 'framer-motion';

const ManageEmployeesPage = () => {
  const { allUsers } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ searchTerm: '', status: 'all', role: 'all' });
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [employeeStats, setEmployeeStats] = useState({});

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
                              (user.username?.toLowerCase() || '').includes(filters.searchTerm.toLowerCase()) ||
                              (user.employee_code?.toLowerCase() || '').includes(filters.searchTerm.toLowerCase());
      const statusMatch = filters.status === 'all' || user.status === filters.status;
      const roleMatch = filters.role === 'all' || (user.roles && user.roles.includes(filters.role));
      
      return searchTermMatch && statusMatch && roleMatch;
    }).sort((a, b) => {
      // ترتيب حسب employee_code أو تاريخ الإنشاء أو الاسم
      if (a.employee_code && b.employee_code) {
        return a.employee_code.localeCompare(b.employee_code);
      }
      if (a.created_at && b.created_at) {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  }, [allUsers, filters]);

  // ✅ تم إلغاء الإحصائيات لتحسين الأداء وتقليل استهلاك البيانات

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setIsEditModalOpen(true);
  };

  const handleViewProfile = (employeeId) => {
    navigate(`/profile/${employeeId}`);
  };

  const handleAddNew = () => {
    toast({
      title: "لإضافة موظف جديد",
      description: "اطلب منه التسجيل في النظام ثم قم بالموافقة عليه من لوحة التحكم.",
    });
  };

  const getInitials = (name) => {
    if (!name) return 'م';
    const parts = name.trim().split(' ');
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  };

  const getRoleName = (roles) => {
    if (!roles || roles.length === 0) return 'موظف';
    const roleMapping = {
      'super_admin': 'المدير العام',
      'admin': 'مدير',
      'department_manager': 'مدير قسم',
      'sales_employee': 'موظف مبيعات',
      'warehouse_employee': 'موظف مخزن',
      'cashier': 'أمين صندوق'
    };
    
    const priorities = ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'];
    for (const role of priorities) {
      if (roles.includes(role)) {
        return roleMapping[role] || 'موظف';
      }
    }
    return 'موظف';
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-500',
      pending: 'bg-yellow-500',
      suspended: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const formatShortCurrency = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}م`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}ألف`;
    }
    return value.toString();
  };

  return (
    <>
      <Helmet>
        <title>إدارة الموظفين - RYUS</title>
        <meta name="description" content="إدارة صلاحيات وحسابات الموظفين" />
      </Helmet>

      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/settings')} size="lg">
              <ArrowRight className="h-4 w-4 ml-2" />
              رجوع
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 dark:from-primary dark:to-purple-400 bg-clip-text text-transparent">
                إدارة الموظفين
              </h1>
              <p className="text-muted-foreground mt-1">عرض وتعديل صلاحيات وحسابات الموظفين</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsBulkUpdateOpen(true)}>
              <Shield className="w-4 h-4 ml-2" />
              تعديل صلاحيات جماعي
            </Button>
            <Button onClick={handleAddNew}>
              <UserPlus className="w-4 h-4 ml-2" />
              إضافة موظف جديد
            </Button>
          </div>
        </div>

        {/* Filters & View Toggle */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="relative lg:col-span-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="البحث بالاسم، المستخدم، معرف الموظف..." 
                  name="searchTerm"
                  value={filters.searchTerm} 
                  onChange={handleFilterChange} 
                  className="pr-10" 
                />
              </div>
              
              <Select name="status" value={filters.status} onValueChange={(v) => handleSelectFilterChange('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="pending">قيد المراجعة</SelectItem>
                  <SelectItem value="suspended">معلق</SelectItem>
                </SelectContent>
              </Select>
              
              <Select name="role" value={filters.role} onValueChange={(v) => handleSelectFilterChange('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأدوار</SelectItem>
                  <SelectItem value="super_admin">المدير العام</SelectItem>
                  <SelectItem value="department_manager">مدير القسم</SelectItem>
                  <SelectItem value="sales_employee">موظف مبيعات</SelectItem>
                  <SelectItem value="warehouse_employee">موظف مخزن</SelectItem>
                  <SelectItem value="cashier">كاشير</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="flex-1"
                >
                  <LayoutGrid className="w-4 h-4 ml-2" />
                  بطاقات
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="flex-1"
                >
                  <List className="w-4 h-4 ml-2" />
                  جدول
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content - Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((employee, index) => (
              <motion.div
                key={employee.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="group hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-primary/30">
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="relative">
                        <Avatar className="w-16 h-16 border-2 border-primary/20 shadow-md">
                          <AvatarImage src={employee.avatar_url} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-primary-foreground font-bold">
                            {getInitials(employee.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card ${getStatusColor(employee.status)}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                          {employee.full_name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          @{employee.username}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {getRoleName(employee.roles)}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                      <div className="flex items-center gap-2 p-2 bg-secondary/20 rounded-md">
                        <Hash className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="truncate font-mono text-xs">
                          {employee.employee_code || (
                            <span className="text-muted-foreground italic">غير محدد</span>
                          )}
                        </span>
                      </div>
                      
                      {/* Telegram Status - احترافي جداً */}
                      <div className={`flex items-center gap-2 p-2 rounded-md border transition-all ${
                        employee.telegram_linked 
                          ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border-green-200/30 dark:border-green-800/30' 
                          : 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/20 border-gray-200/30 dark:border-gray-800/30'
                      }`}>
                        <MessageCircle className={`w-4 h-4 flex-shrink-0 ${
                          employee.telegram_linked 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-400 dark:text-gray-600'
                        }`} />
                        <div className="flex-1 min-w-0">
                          {employee.telegram_code ? (
                            <div className="flex items-center gap-2">
                              <span className="truncate font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                                {employee.telegram_code}
                              </span>
                              <Badge 
                                variant={employee.telegram_linked ? "success" : "outline"} 
                                className={`text-[10px] px-1.5 py-0 ${
                                  employee.telegram_linked 
                                    ? 'bg-green-500/90 text-white border-green-600' 
                                    : 'text-gray-500'
                                }`}
                              >
                                {employee.telegram_linked ? 'متصل' : 'غير متصل'}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">لم يُضف بعد</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleViewProfile(employee.id)}
                      >
                        <Eye className="w-4 h-4 ml-2" />
                        عرض
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleEdit(employee)}
                      >
                        <Edit2 className="w-4 h-4 ml-2" />
                        تعديل
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Content - Table View */}
        {viewMode === 'table' && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-right p-4 font-semibold">الموظف</th>
                      <th className="text-right p-4 font-semibold">معرف الموظف</th>
                      <th className="text-right p-4 font-semibold">التليغرام</th>
                      <th className="text-right p-4 font-semibold">الدور</th>
                      <th className="text-right p-4 font-semibold">الحالة</th>
                      <th className="text-right p-4 font-semibold">الطلبات</th>
                      <th className="text-right p-4 font-semibold">الأرباح</th>
                      <th className="text-center p-4 font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((employee, index) => (
                      <motion.tr
                        key={employee.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-border hover:bg-secondary/20 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={employee.avatar_url} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-primary-foreground text-sm font-bold">
                                {getInitials(employee.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{employee.full_name}</p>
                              <p className="text-xs text-muted-foreground">@{employee.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm">{employee.employee_code || '-'}</td>
                        <td className="p-4 text-sm">{employee.telegram_code || '-'}</td>
                        <td className="p-4">
                          <Badge variant="outline">{getRoleName(employee.roles)}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(employee.status)}`} />
                            <span className="text-sm">{employee.status === 'active' ? 'نشط' : employee.status === 'pending' ? 'قيد المراجعة' : 'معلق'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm font-medium">{employeeStats[employee.id]?.orders || 0}</td>
                        <td className="p-4 text-sm font-medium text-primary">{formatShortCurrency(employeeStats[employee.id]?.profits || 0)}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleViewProfile(employee.id)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(employee)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {filteredUsers.length === 0 && (
          <Card className="p-12 text-center">
            <User className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">لم يتم العثور على موظفين</h3>
            <p className="text-muted-foreground">جرب تغيير معايير البحث أو الفلترة</p>
          </Card>
        )}

        {/* Dialogs */}
        {editingEmployee && (
          <UnifiedEmployeeDialog
            employee={editingEmployee}
            open={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
          />
        )}
        <UpdateRolePermissionsDialog 
          open={isBulkUpdateOpen}
          onOpenChange={setIsBulkUpdateOpen}
        />
      </div>
    </>
  );
};

export default ManageEmployeesPage;