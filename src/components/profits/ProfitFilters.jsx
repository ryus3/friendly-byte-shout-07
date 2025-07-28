import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProfitFilters = ({
  filters,
  onFilterChange,
  canViewAll,
  employees,
  user,
  allUsers,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-4 p-4 bg-secondary/50 rounded-lg border">
      {canViewAll && (
        <Select value={filters.employeeId} onValueChange={(v) => onFilterChange('employeeId', v)}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="فلترة حسب الموظف" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value={user.id}>{user.full_name} (أرباح المدير)</SelectItem>
            <SelectItem value="employees">كل الموظفين</SelectItem>
            {employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={filters.profitStatus} onValueChange={(v) => onFilterChange('profitStatus', v)}>
        <SelectTrigger className="flex-1"><SelectValue placeholder="فلترة حسب حالة الربح" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">الكل</SelectItem>
          <SelectItem value="pending">معلق</SelectItem>
          <SelectItem value="settled">مدفوع</SelectItem>
        </SelectContent>
      </Select>
      {canViewAll && filters.employeeId !== 'all' && filters.employeeId !== user.id && filters.employeeId !== 'employees' && (
        <Button onClick={() => navigate(`/employee-follow-up?employee=${filters.employeeId}&highlight=settlement`)}>
          <UserCheck className="w-4 h-4 ml-2" />
          محاسبة {allUsers.find(u => u.id === filters.employeeId)?.full_name}
        </Button>
      )}
    </div>
  );
};

export default ProfitFilters;