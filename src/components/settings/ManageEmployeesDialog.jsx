import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmployeeList from '@/components/manage-employees/EmployeeList';
import EditEmployeeDialog from '@/components/manage-employees/EditEmployeeDialog';

const ManageEmployeesDialog = ({ open, onOpenChange }) => {
  const { allUsers } = useAuth();
  const [filters, setFilters] = useState({ searchTerm: '', status: 'all', role: 'all' });
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setIsEditModalOpen(true);
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-background border shadow-lg">
          <DialogHeader>
            <DialogTitle>إدارة الموظفين والصلاحيات</DialogTitle>
            <DialogDescription>
              عرض وتعديل حسابات الموظفين، أدوارهم، وصلاحيات الوصول للنظام.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b">
              <Input
                placeholder="ابحث بالاسم، الإيميل، أو اسم المستخدم..."
                name="searchTerm"
                value={filters.searchTerm}
                onChange={handleFilterChange}
              />
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
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="deputy">نائب مدير</SelectItem>
                  <SelectItem value="employee">موظف</SelectItem>
                  <SelectItem value="warehouse">مخزن</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <EmployeeList users={filteredUsers} onEdit={handleEdit} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {editingEmployee && (
        <EditEmployeeDialog 
          employee={editingEmployee}
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
        />
      )}
    </>
  );
};

export default ManageEmployeesDialog;