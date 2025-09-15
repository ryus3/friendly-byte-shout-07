import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Power, Edit, PowerOff, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { RoleIconMap } from '@/components/ui/custom-icons';

const EmployeeCard = ({ user, onEdit, index }) => {
  const { hasPermission } = usePermissions();
  const isActive = user.status === 'active';

  // استخدام الأدوار الجديدة من user_roles
  const getUserRoleBadges = () => {
    console.log('EmployeeCard roles debug:', {
      user: user.full_name,
      userRoles: user.roles,
      userObject: user
    });
    
    if (!user.roles || user.roles.length === 0) {
      return <Badge variant='secondary' style={{ backgroundColor: 'hsl(var(--role-pending) / 0.2)', color: 'hsl(var(--role-pending))', borderColor: 'hsl(var(--role-pending) / 0.3)' }}>
        <User className="w-4 h-4 ml-2" />
        لا يوجد دور
      </Badge>;
    }

    return user.roles.map((role, index) => {
      const getRoleStyle = (roleName) => {
        switch(roleName) {
          case 'super_admin':
            return { backgroundColor: 'hsl(var(--role-super-admin) / 0.2)', color: 'hsl(var(--role-super-admin))', borderColor: 'hsl(var(--role-super-admin) / 0.3)' };
          case 'department_manager':
            return { backgroundColor: 'hsl(var(--role-department-manager) / 0.2)', color: 'hsl(var(--role-department-manager))', borderColor: 'hsl(var(--role-department-manager) / 0.3)' };
          case 'sales_employee':
            return { backgroundColor: 'hsl(var(--role-sales-employee) / 0.2)', color: 'hsl(var(--role-sales-employee))', borderColor: 'hsl(var(--role-sales-employee) / 0.3)' };
          case 'warehouse_employee':
            return { backgroundColor: 'hsl(var(--role-warehouse-employee) / 0.2)', color: 'hsl(var(--role-warehouse-employee))', borderColor: 'hsl(var(--role-warehouse-employee) / 0.3)' };
          case 'accountant':
            return { backgroundColor: 'hsl(var(--role-accountant) / 0.2)', color: 'hsl(var(--role-accountant))', borderColor: 'hsl(var(--role-accountant) / 0.3)' };
          case 'delivery_coordinator':
            return { backgroundColor: 'hsl(var(--role-department-manager) / 0.2)', color: 'hsl(var(--role-department-manager))', borderColor: 'hsl(var(--role-department-manager) / 0.3)' };
          case 'cashier':
            return { backgroundColor: 'hsl(var(--role-accountant) / 0.2)', color: 'hsl(var(--role-accountant))', borderColor: 'hsl(var(--role-accountant) / 0.3)' };
          default:
            return { backgroundColor: 'hsl(var(--role-pending) / 0.2)', color: 'hsl(var(--role-pending))', borderColor: 'hsl(var(--role-pending) / 0.3)' };
        }
      };
      const getRoleDisplayName = (roleName) => {
        switch(roleName) {
          case 'super_admin': return 'المدير العام';
          case 'department_manager': return 'مدير القسم';
          case 'sales_employee': return 'موظف مبيعات';
          case 'warehouse_employee': return 'موظف مخزن';
          case 'accountant': return 'محاسب';
          case 'delivery_coordinator': return 'منسق توصيل';
          case 'cashier': return 'كاشير';
          default: return roleName;
        }
      };

      const getRoleIcon = (roleName) => {
        const IconComponent = RoleIconMap[roleName];
        return IconComponent ? <IconComponent className="w-4 h-4 ml-2" /> : <User className="w-4 h-4 ml-2" />;
      };

      return (
        <Badge 
          key={index} 
          variant='default' 
          style={getRoleStyle(role)}
        >
          {getRoleIcon(role)}
          {getRoleDisplayName(role)}
        </Badge>
      );
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card rounded-xl p-4 border border-border"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">{user.full_name}</h3>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Mail className="w-4 h-4" />
              {user.email || 'لا يوجد بريد إلكتروني'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-wrap gap-1">
            {getUserRoleBadges()}
          </div>
          <Badge variant={isActive ? 'default' : 'destructive'} className={isActive ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' : 'bg-red-500/20 text-red-500 border-red-500/30'}>
            {isActive ? <Power className="w-4 h-4 ml-2" /> : <PowerOff className="w-4 h-4 ml-2" />}
            {isActive ? 'نشط' : 'معطل'}
          </Badge>
          <Button size="icon" variant="outline" onClick={() => onEdit(user)}>
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

const EmployeeList = ({ users, onEdit }) => {
  if (!users || users.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-muted-foreground mb-2">لا يوجد موظفين</h3>
        <p className="text-muted-foreground">لم يتم العثور على موظفين يطابقون بحثك.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {users.map((user, index) => (
          <EmployeeCard key={user.id} user={user} onEdit={onEdit} index={index} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeList;