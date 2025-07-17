import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, Settings, Shield, Copy, Eye, EyeOff, 
  Crown, UserCheck, UserX, AlertCircle, 
  FileText, Database, Package, ShoppingCart,
  BarChart3, Calculator, UserPlus, Search,
  Filter, Download, Upload, Lock, Unlock, Plus
} from 'lucide-react';
import UnifiedEmployeeDialog from './UnifiedEmployeeDialog';

const EmployeeManagementDialog = ({ open, onOpenChange }) => {
  const { allUsers, updateUser } = useAuth();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  // جلب الموظفين
  useEffect(() => {
    if (allUsers && Array.isArray(allUsers)) {
      // عرض جميع المستخدمين - النظام الهرمي يتولى التصفية
      setEmployees(allUsers);
    }
  }, [allUsers]);

  // فلترة الموظفين
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           emp.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, searchTerm, roleFilter, statusFilter]);

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'admin': return 'default';
      case 'deputy': return 'secondary';
      case 'manager': return 'outline';
      default: return 'destructive';
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'مدير',
      deputy: 'نائب مدير',
      manager: 'مدير قسم',
      employee: 'موظف',
      warehouse: 'مخزن',
      cashier: 'كاشير'
    };
    return labels[role] || role;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col z-50">
          <DialogHeader className="flex-shrink-0 border-b pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Users className="h-6 w-6" />
              إدارة الموظفين
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              نظام شامل لإدارة أدوار وصلاحيات الموظفين في النظام
            </DialogDescription>
          </DialogHeader>

          {/* أدوات البحث والفلترة */}
          <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث في الموظفين..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="جميع الأدوار" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأدوار</SelectItem>
                <SelectItem value="admin">مدير</SelectItem>
                <SelectItem value="deputy">نائب مدير</SelectItem>
                <SelectItem value="manager">مدير قسم</SelectItem>
                <SelectItem value="employee">موظف</SelectItem>
                <SelectItem value="warehouse">مخزن</SelectItem>
                <SelectItem value="cashier">كاشير</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="جميع الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="pending">معلق</SelectItem>
                <SelectItem value="inactive">معطل</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              تصدير التقرير
            </Button>
          </div>

          {/* قائمة الموظفين */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
              {filteredEmployees.map((employee) => (
                <Card key={employee.user_id} className="hover:shadow-lg transition-all duration-200 hover:border-primary/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-white font-bold text-sm">
                          {employee.full_name?.charAt(0).toUpperCase() || employee.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{employee.full_name || employee.username}</div>
                          <div className="text-xs text-muted-foreground">{employee.email}</div>
                        </div>
                      </div>
                      <Badge variant={getRoleBadgeVariant(employee.role)} className="text-xs">
                        {getRoleLabel(employee.role)}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs">
                        <span>الحالة:</span>
                        <Badge variant={employee.status === 'active' ? 'default' : 'destructive'} className="text-xs">
                          {employee.status === 'active' ? 'نشط' : 'معطل'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>الصلاحيات:</span>
                        <span className="font-medium">
                          {employee.permissions?.length || 0} صلاحية
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1 text-xs"
                        onClick={() => setSelectedEmployee(employee)}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        إدارة
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredEmployees.length === 0 && (
              <div className="text-center py-8">
                <UserX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">لا توجد موظفين</h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || roleFilter !== 'all' || statusFilter !== 'all' 
                    ? 'لا توجد نتائج تطابق معايير البحث'
                    : 'لم يتم العثور على موظفين في النظام'}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* نافذة تفاصيل الموظف */}
      {selectedEmployee && (
        <UnifiedEmployeeDialog
          employee={selectedEmployee}
          open={!!selectedEmployee}
          onOpenChange={(open) => !open && setSelectedEmployee(null)}
        />
      )}
    </>
  );
};

export default EmployeeManagementDialog;