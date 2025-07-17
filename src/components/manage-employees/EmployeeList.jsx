import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Shield, Power, Edit, PowerOff, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const EmployeeCard = ({ user, onEdit, index }) => {
  const { hasPermission } = useAuth();
  const isAdmin = user.role === 'admin';
  const isDeputy = user.role === 'deputy';
  const isWarehouse = user.role === 'warehouse';
  const isActive = user.status === 'active';

  const getRoleBadge = () => {
    if (isAdmin) return <Badge variant='default' className='bg-green-500/20 text-green-500 border-green-500/30'><Shield className="w-4 h-4 ml-2" />مدير</Badge>;
    if (isDeputy) return <Badge variant='default' className='bg-yellow-500/20 text-yellow-500 border-yellow-500/30'><Shield className="w-4 h-4 ml-2" />نائب مدير</Badge>;
    if (isWarehouse) return <Badge variant='secondary' className='bg-indigo-500/20 text-indigo-500 border-indigo-500/30'><Shield className="w-4 h-4 ml-2" />مخزن</Badge>;
    return <Badge variant='secondary'><Shield className="w-4 h-4 ml-2" />موظف</Badge>;
  }

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
          {getRoleBadge()}
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