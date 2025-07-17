import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Shield, Power, Edit, PowerOff, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth, usePermissions } from '@/contexts/UnifiedAuthContext';

const EmployeeCard = ({ user, onEdit, index }) => {
  const { hasPermission } = usePermissions();
  const isActive = user.status === 'active';

  // استخدام الأدوار الجديدة من user_roles
  const getUserRoleBadges = () => {
    if (!user.roles || user.roles.length === 0) {
      return <Badge variant='secondary' className='bg-gray-500/20 text-gray-500 border-gray-500/30'>
        <Shield className="w-4 h-4 ml-2" />
        لا يوجد دور
      </Badge>;
    }

    return user.roles.map((role, index) => {
      const getRoleStyle = (roleName) => {
        switch(roleName) {
          case 'super_admin':
            return 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-600 border-purple-500/30';
          case 'department_manager':
            return 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-600 border-blue-500/30';
          case 'sales_employee':
            return 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-600 border-green-500/30';
          case 'warehouse_employee':
            return 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-600 border-orange-500/30';
          case 'cashier':
            return 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-600 border-teal-500/30';
          case 'delivery_coordinator':
            return 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-600 border-red-500/30';
          default:
            return 'bg-gray-500/20 text-gray-600 border-gray-500/30';
        }
      };

      const getRoleDisplayName = (roleName) => {
        switch(roleName) {
          case 'super_admin': return 'المدير العام';
          case 'department_manager': return 'مدير القسم';
          case 'sales_employee': return 'موظف مبيعات';
          case 'warehouse_employee': return 'موظف مخزن';
          case 'cashier': return 'كاشير';
          case 'delivery_coordinator': return 'منسق توصيل';
          default: return role;
        }
      };

      return (
        <Badge 
          key={index} 
          variant='default' 
          className={`${getRoleStyle(role)} font-medium`}
        >
          <Shield className="w-4 h-4 ml-2" />
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