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
  // نستخدم toast مباشرة

  const handleDirectApprove = async () => {
    try {
      await onApprove(user.user_id, { 
        useCompleteApproval: true,
        full_name: user.full_name 
      });
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
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-3 space-x-reverse">
              <Avatar className="h-12 w-12 md:h-10 md:w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user.full_name?.charAt(0) || user.username?.charAt(0) || 'م'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                  <h3 className="font-medium text-sm truncate">{user.full_name}</h3>
                  <Badge variant="secondary" className="text-xs w-fit">
                    {user.role}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="truncate">المستخدم: {user.username}</p>
                  <p className="truncate">الإيميل: {user.email}</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDetailedReview(user)}
                className="text-xs w-full md:w-auto"
              >
                <Settings className="w-3 h-3 ml-1" />
                مراجعة تفصيلية
              </Button>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleDirectApprove}
                  className="text-xs bg-green-600 hover:bg-green-700 flex-1 md:flex-none"
                >
                  <UserCheck className="w-3 h-3 ml-1" />
                  موافقة سريعة
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDirectReject}
                  className="text-xs flex-1 md:flex-none"
                >
                  <UserX className="w-3 h-3 ml-1" />
                  رفض
                </Button>
              </div>
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

  const handleDetailedReview = (user) => {
    setSelectedEmployee(user);
    setShowUnifiedDialog(true);
  };

  const handleApprove = async (userId, data) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      const result = await updateUser(userId, data);
      
      if (result?.success !== false) {
        toast({
          title: "تمت الموافقة ✅",
          description: "تم تفعيل حساب الموظف بنجاح",
          variant: "default"
        });
        
        await refetchAdminData();
        setShowUnifiedDialog(false);
        setSelectedEmployee(null);
      } else {
        throw new Error(result?.error?.message || 'خطأ في الموافقة');
      }
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
      const result = await updateUser(userId, { 
        status: 'rejected', 
        permissions: JSON.stringify([]) 
      });
      
      if (result?.success !== false) {
        toast({
          title: "تم الرفض ❌",
          description: "تم رفض طلب التسجيل",
          variant: "default"
        });
        
        await refetchAdminData();
        setShowUnifiedDialog(false);
        setSelectedEmployee(null);
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
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-background rounded-lg shadow-xl max-w-md w-full"
        >
          <Card className="border-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">طلبات التسجيل</CardTitle>
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
            <CardContent className="text-center py-8">
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] md:max-h-[80vh] overflow-hidden mx-4"
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
          <CardContent className="space-y-4 max-h-[70vh] md:max-h-[60vh] overflow-y-auto px-4 md:px-6">
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