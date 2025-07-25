import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { X, Bot, FileDown, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import AiOrderCard from './AiOrderCard';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';
import { useNotifications } from '@/contexts/NotificationsContext';
import { supabase } from '@/lib/customSupabaseClient';

const AiOrdersManager = ({ onClose }) => {
  const { user, hasPermission } = useAuth();
  const { aiOrders, approveAiOrder, deleteOrders } = useInventory();
  const { deleteNotificationByTypeAndData } = useNotifications();
  const [selectedOrders, setSelectedOrders] = React.useState([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [editingOrder, setEditingOrder] = React.useState(null);
  const [quickOrderDialogOpen, setQuickOrderDialogOpen] = React.useState(false);
  const [userEmployeeCode, setUserEmployeeCode] = React.useState(null);

  // جلب رمز الموظف للمستخدم الحالي
  React.useEffect(() => {
    const fetchEmployeeCode = async () => {
      if (!user?.user_id) return;
      
      try {
        const { data, error } = await supabase
          .from('telegram_employee_codes')
          .select('employee_code')
          .eq('user_id', user.user_id)
          .single();
        
        if (!error && data) {
          setUserEmployeeCode(data.employee_code);
        }
      } catch (err) {
        console.error('Error fetching employee code:', err);
      }
    };
    
    fetchEmployeeCode();
  }, [user?.user_id]);

  const userAiOrders = React.useMemo(() => {
    if (!Array.isArray(aiOrders)) return [];
    
    // للمدير - عرض كل الطلبات
    if (hasPermission('view_all_data')) return aiOrders;
    
    // للموظفين - فلترة حسب رمز الموظف
    if (!userEmployeeCode) return [];
    
    return aiOrders.filter(order => {
      return order.created_by === userEmployeeCode;
    });
  }, [aiOrders, userEmployeeCode, hasPermission]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrders(userAiOrders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId, checked) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleBulkApprove = async () => {
    if (!hasPermission('approve_orders')) {
      toast({ 
        title: "ليس لديك صلاحية", 
        description: "ليس لديك صلاحية للموافقة على الطلبات", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsProcessing(true);
    for (const orderId of selectedOrders) {
      await approveAiOrder(orderId);
    }
    setSelectedOrders([]);
    setIsProcessing(false);
    toast({ title: "نجاح", description: `تمت الموافقة على ${selectedOrders.length} طلبات ذكية.` });
  };

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    await deleteOrders(selectedOrders, true);
    setSelectedOrders([]);
    setIsProcessing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <Card className="border-0 h-full">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="w-6 h-6 text-primary" />
                <div>
                  <CardTitle>إدارة الطلبات الذكية</CardTitle>
                  <CardDescription>
                    {userAiOrders.length} طلبات ذكية في انتظار المراجعة
                  </CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="rounded-lg w-8 h-8 bg-background/90 backdrop-blur-sm border border-border/60 text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl group hover:border-primary/50"
              >
                <X className="w-4 h-4 transition-all duration-300 group-hover:rotate-90 group-hover:scale-110" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex flex-col h-[calc(90vh-100px)]">
            {userAiOrders.length > 0 && (
              <div className="p-4 border-b bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedOrders.length === userAiOrders.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm font-medium">
                      تحديد الكل ({selectedOrders.length}/{userAiOrders.length})
                    </span>
                  </div>
                  
                  {selectedOrders.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleBulkApprove}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ShieldCheck className="w-4 h-4 ml-2" />}
                        موافقة على المحدد
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={handleBulkDelete}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Trash2 className="w-4 h-4 ml-2" />}
                        حذف المحدد
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {userAiOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Bot className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">لا توجد طلبات ذكية</h3>
                  <p className="text-muted-foreground">
                    عندما تصل طلبات ذكية جديدة، ستظهر هنا للمراجعة والموافقة.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userAiOrders.map(order => (
                    <AiOrderCard
                      key={order.id}
                      order={order}
                      isSelected={selectedOrders.includes(order.id)}
                      onSelect={(checked) => handleSelectOrder(order.id, checked)}
                      onEdit={() => {
                        setEditingOrder(order);
                        setQuickOrderDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* استخدام QuickOrderContent بدلاً من EditAiOrderDialog */}
        {quickOrderDialogOpen && editingOrder && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">تعديل الطلب الذكي</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setQuickOrderDialogOpen(false);
                    setEditingOrder(null);
                  }}
                  className="rounded-lg w-8 h-8 bg-background/90 backdrop-blur-sm border border-border/60 text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl group hover:border-primary/50"
                >
                  <X className="w-4 h-4 transition-all duration-300 group-hover:rotate-90 group-hover:scale-110" />
                </Button>
              </div>
              <div className="p-4 max-h-[calc(90vh-80px)] overflow-y-auto">
                <QuickOrderContent 
                  isDialog={true}
                  aiOrderData={editingOrder}
                  onOrderCreated={() => {
                    setQuickOrderDialogOpen(false);
                    setEditingOrder(null);
                    toast({ title: "نجاح", description: "تم تحديث الطلب بنجاح" });
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AiOrdersManager;