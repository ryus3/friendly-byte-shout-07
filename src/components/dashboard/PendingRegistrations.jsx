import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, X, User, UserPlus } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import { toast } from '@/components/ui/use-toast';
import UnifiedEmployeePermissionsDialog from '@/components/manage-employees/UnifiedEmployeePermissionsDialog';

const UserCard = ({ user, onApprove, onReject, onDetailedReview }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDirectApprove = async () => {
    setIsProcessing(true);
    try {
      // موافقة سريعة بصلاحيات افتراضية
      const defaultData = {
        role: 'employee',
        status: 'active',
        permissions: JSON.stringify(['view_products', 'create_orders', 'view_orders', 'edit_orders', 'view_inventory', 'view_customers', 'create_customers', 'edit_customers', 'view_profits']),
        default_page: '/',
        order_creation_mode: 'choice',
        category_permissions: JSON.stringify(['all']),
        color_permissions: JSON.stringify(['all']),
        size_permissions: JSON.stringify(['all']),
        department_permissions: JSON.stringify(['all']),
        product_type_permissions: JSON.stringify(['all']),
        season_occasion_permissions: JSON.stringify(['all'])
      };
      
      await onApprove(user.user_id, defaultData);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDirectReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(user.user_id);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border border-warning/30 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <UserPlus className="w-5 h-5" />
            طلب تسجيل جديد
          </CardTitle>
          <CardDescription>في انتظار مراجعة وموافقة المدير</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium">الاسم:</span> {user.full_name}</div>
            <div><span className="font-medium">اسم المستخدم:</span> @{user.username}</div>
            <div><span className="font-medium">البريد الإلكتروني:</span> {user.email}</div>
            <div><span className="font-medium">الحالة:</span> 
              <span className="ml-2 px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">
                قيد المراجعة
              </span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              onClick={handleDirectApprove}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 flex-1"
            >
              <Check className="w-4 h-4 ml-2" />
              موافقة سريعة
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDirectReject}
              disabled={isProcessing}
              className="text-red-500 border-red-500 hover:bg-red-500/10"
            >
              <X className="w-4 h-4 ml-2" />
              رفض
            </Button>
          </div>
          <div className="pt-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onDetailedReview(user)}
              className="w-full"
              disabled={isProcessing}
            >
              مراجعة تفصيلية وتحديد الصلاحيات
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const PendingRegistrations = () => {
  const { pendingRegistrations, updateUser, refetchAdminData } = useAuth();
  const { addNotification } = useNotifications();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showUnifiedDialog, setShowUnifiedDialog] = useState(false);

  const handleDetailedReview = (user) => {
    setSelectedEmployee(user);
    setShowUnifiedDialog(true);
  };

  const handleApprove = async (userId, data) => {
    try {
      console.log('Approving user in PendingRegistrations:', userId, 'with data:', data);
      
      const result = await updateUser(userId, data);
      
      if (result?.success !== false) {
        await refetchAdminData();
        
        addNotification({
          type: 'user_approved',
          title: 'تمت الموافقة على التسجيل',
          message: `تم قبول طلب التسجيل وتفعيل الحساب`,
          user_id: userId,
          color: 'green',
          icon: 'UserCheck'
        });
        
        toast({
          title: "تمت الموافقة",
          description: "تم تفعيل حساب الموظف بنجاح",
          variant: "default"
        });
        
        // إغلاق النافذة إذا كانت مفتوحة
        setShowUnifiedDialog(false);
        setSelectedEmployee(null);
      } else {
        throw new Error(result.error?.message || 'خطأ في الموافقة');
      }
    } catch (error) {
      console.error('Error in handleApprove:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الموافقة على الحساب",
        variant: "destructive"
      });
    }
  };

  const handleReject = async (userId) => {
    try {
      const result = await updateUser(userId, { status: 'rejected', permissions: JSON.stringify([]) });
      
      if (result?.success !== false) {
        await refetchAdminData();
        
        toast({
          title: "تم الرفض",
          description: "تم رفض طلب التسجيل",
          variant: "default"
        });
        
        // إغلاق النافذة إذا كانت مفتوحة
        setShowUnifiedDialog(false);
        setSelectedEmployee(null);
      } else {
        throw new Error(result.error?.message || 'خطأ في الرفض');
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء رفض الطلب",
        variant: "destructive"
      });
    }
  };

  if (!pendingRegistrations?.length) {
    return (
      <Card className="border border-muted">
        <CardContent className="p-6 text-center">
          <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">لا توجد طلبات تسجيل جديدة</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {pendingRegistrations.map(user => (
          <UserCard
            key={user.id || user.user_id}
            user={user}
            onApprove={handleApprove}
            onReject={handleReject}
            onDetailedReview={handleDetailedReview}
          />
        ))}
      </AnimatePresence>
      
      {selectedEmployee && (
        <UnifiedEmployeePermissionsDialog
          employee={selectedEmployee}
          open={showUnifiedDialog}
          onOpenChange={setShowUnifiedDialog}
          mode="approve"
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
};

export default PendingRegistrations;