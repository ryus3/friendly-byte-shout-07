import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { User, UserCheck, UserX, Settings, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import UnifiedEmployeePermissionsDialog from '../manage-employees/UnifiedEmployeePermissionsDialog';

const UserCard = ({ user, onApprove, onReject, onDetailedReview }) => {
  const handleDirectApprove = async () => {
    try {
      // بيانات الموافقة المصححة - بدون عمود permissions
      const approvalData = {
        status: 'active'
      };
      
      console.log('=== DIRECT APPROVAL START ===');
      console.log('Target user:', user);
      console.log('User ID being approved:', user.user_id);
      console.log('Approval data being sent:', approvalData);
      
      await onApprove(user.user_id, approvalData);
    } catch (error) {
      console.error('Direct approval error:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الموافقة المباشرة",
        variant: "destructive"
      });
    }
  };

  const handleDirectReject = async () => {
    try {
      console.log('Direct rejection for user:', user.user_id);
      await onReject(user.user_id);
    } catch (error) {
      console.error('Direct rejection error:', error);
      toast({
        title: "خطأ", 
        description: "حدث خطأ أثناء الرفض",
        variant: "destructive"
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full"
    >
      <Card className="border border-muted hover:border-primary/20 transition-colors">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 space-x-reverse">
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                  {user.full_name?.charAt(0) || user.username?.charAt(0) || 'م'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <h3 className="font-medium text-sm truncate">{user.full_name}</h3>
                  <Badge variant="secondary" className="text-xs w-fit">
                    موظف
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="truncate">المستخدم: {user.username}</p>
                  <p className="truncate">الإيميل: {user.email}</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDetailedReview(user)}
                className="text-xs h-8"
              >
                <Settings className="w-3 h-3 sm:ml-1" />
                <span className="hidden sm:inline">مراجعة تفصيلية</span>
                <span className="sm:hidden">مراجعة</span>
              </Button>
              <Button
                size="sm"
                onClick={handleDirectApprove}
                className="text-xs h-8 bg-green-600 hover:bg-green-700"
              >
                <UserCheck className="w-3 h-3 sm:ml-1" />
                <span className="hidden sm:inline">موافقة سريعة</span>
                <span className="sm:hidden">موافقة</span>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDirectReject}
                className="text-xs h-8"
              >
                <UserX className="w-3 h-3 sm:ml-1" />
                رفض
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const PendingRegistrations = ({ onClose }) => {
  const { pendingRegistrations, updateUser, refetchAdminData } = useAuth();
  const { addNotification } = useNotifications();
  // نستخدم toast مباشرة
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showUnifiedDialog, setShowUnifiedDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  console.log('PendingRegistrations rendered with:', pendingRegistrations);

  const handleDetailedReview = (user) => {
    console.log('Opening detailed review for:', user);
    setSelectedEmployee(user);
    setShowUnifiedDialog(true);
  };

  const handleApprove = async (userId, data) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      console.log('=== APPROVAL PROCESS START ===');
      console.log('User ID:', userId);
      console.log('Approval data:', data);
      
      // استخدام الدالة الجديدة لتفعيل الموظف وتعيين الدور وإنشاء رمز التليغرام
      const { data: result, error } = await supabase.rpc('activate_employee_and_assign_role', {
        p_user_id: userId,
        p_role_name: 'sales_employee' // الدور الافتراضي
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (!result?.success) {
        throw new Error(result?.error || 'خطأ في تفعيل الموظف');
      }
      
      console.log('Employee activated successfully:', result);
      
      toast({
        title: "تمت الموافقة ✅",
        description: `تم تفعيل حساب الموظف وإنشاء رمز التليغرام: ${result.employee_code}`,
        variant: "default"
      });
      
      // تحديث فوري للقوائم
      console.log('Refreshing admin data...');
      await refetchAdminData();
      
      // إغلاق النوافذ
      setShowUnifiedDialog(false);
      setSelectedEmployee(null);
      
      console.log('=== APPROVAL PROCESS SUCCESS ===');
    } catch (error) {
      console.error('=== APPROVAL PROCESS ERROR ===', error);
      toast({
        title: "خطأ في الموافقة",
        description: error.message || "حدث خطأ أثناء الموافقة على الحساب",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (userId) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      console.log('=== REJECTION PROCESS START ===');
      console.log('Rejecting user:', userId);
      
      const result = await updateUser(userId, { 
        status: 'rejected'
      });
      
      console.log('Rejection result:', result);
      
      if (result?.success !== false) {
        console.log('Rejection successful');
        
        toast({
          title: "تم الرفض ❌",
          description: "تم رفض طلب التسجيل",
          variant: "default"
        });
        
        // تحديث فوري للقوائم
        console.log('Refreshing admin data...');
        await refetchAdminData();
        
        // إغلاق النوافذ
        setShowUnifiedDialog(false);
        setSelectedEmployee(null);
        
        console.log('=== REJECTION PROCESS SUCCESS ===');
      } else {
        throw new Error(result?.error?.message || 'خطأ في الرفض');
      }
    } catch (error) {
      console.error('=== REJECTION PROCESS ERROR ===', error);
      toast({
        title: "خطأ في الرفض",
        description: error.message || "حدث خطأ أثناء رفض الطلب",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!pendingRegistrations?.length) {
    return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background rounded-lg shadow-xl w-full max-w-xs sm:max-w-md"
      >
        <Card className="border-0">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg font-medium">طلبات التسجيل</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-center py-6 sm:py-8">
              <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">لا توجد طلبات تسجيل جديدة</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background rounded-lg shadow-xl w-full max-w-xs sm:max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-hidden"
      >
        <Card className="border-0">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">
                طلبات التسجيل الجديدة ({pendingRegistrations.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto px-3 sm:px-6">
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
          </CardContent>
        </Card>
      </motion.div>
      
      {selectedEmployee && (
        <UnifiedEmployeePermissionsDialog
          employee={selectedEmployee}
          open={showUnifiedDialog}
          onOpenChange={setShowUnifiedDialog}
          onSave={handleApprove}
        />
      )}
    </motion.div>
  );
};

export default PendingRegistrations;