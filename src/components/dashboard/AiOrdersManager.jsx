import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Bot, 
  MessageSquare, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  X,
  Brain,
  Zap,
  Smartphone,
  Users,
  TrendingUp,
  Activity,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSuper } from '@/contexts/SuperProvider';
import AiOrderCard from './AiOrderCard';

const AiOrdersManager = ({ onClose }) => {
  const { aiOrders = [], loading } = useSuper();
  const ordersFromContext = Array.isArray(aiOrders) ? aiOrders : [];
  const [orders, setOrders] = useState(ordersFromContext);
  const [selectedOrders, setSelectedOrders] = useState([]);

  useEffect(() => {
    setOrders(ordersFromContext);
  }, [ordersFromContext]);

  useEffect(() => {
    const handleDeleted = (e) => {
      const id = e?.detail?.id;
      if (id) setOrders(prev => prev.filter(o => o.id !== id));
    };
    const handleApproved = (e) => {
      const id = e?.detail?.id;
      if (id) setOrders(prev => prev.filter(o => o.id !== id));
    };
    window.addEventListener('aiOrderDeleted', handleDeleted);
    window.addEventListener('aiOrderApproved', handleApproved);
    return () => {
      window.removeEventListener('aiOrderDeleted', handleDeleted);
      window.removeEventListener('aiOrderApproved', handleApproved);
    };
  }, []);

  const totalCount = orders.length;
  const pendingCount = orders.filter(order => order.status === 'pending').length;
  const needsReviewStatuses = ['pending','needs_review','review','error','failed'];
  const needsReviewCount = orders.filter(order => needsReviewStatuses.includes(order.status)).length;
  const telegramCount = orders.filter(order => order.source === 'telegram').length;
  const aiChatCount = orders.filter(order => order.source === 'ai_chat').length;

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrders(orders.map(order => order.id));
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

  const handleBulkAction = (action) => {
    if (selectedOrders.length === 0) return;
    
    console.log(`Bulk ${action} for orders:`, selectedOrders);
    // Here you would implement the bulk action logic
    setSelectedOrders([]);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-lg z-[1200] flex items-center justify-center p-4" onClick={onClose}>
      <ScrollArea className="h-full w-full max-w-5xl mx-auto" onClick={(e) => e.stopPropagation()}>
        <div 
          className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-indigo-900/20 rounded-lg shadow-2xl min-h-[90vh] overflow-hidden mx-4 my-8"
          onClick={e => e.stopPropagation()}
          dir="rtl"
        >
          {/* Header */}
          <div className="relative p-4 pb-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-t-lg overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/20 rounded-full -translate-x-16 -translate-y-16"></div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-12 translate-y-12"></div>
              <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-white/15 rounded-full"></div>
            </div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 rounded-lg p-2 h-auto"
                >
                  <X className="w-4 h-4" />
                </Button>
                
                <div className="relative">
                  <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-0.5">إدارة الطلبات الذكية</h2>
                  <p className="text-blue-100 text-xs">نظام ذكي متطور لإدارة طلبات التليغرام والذكاء الاصطناعي</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-4 gap-3 mb-4" dir="ltr">
              {/* Needs Review Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-red-500 to-red-700 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">تحتاج مراجعة</h4>
                      <p className="text-red-100 text-xs">مراجعة عاجلة</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{needsReviewCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-1 right-3 w-3 h-3 bg-white/10 rounded-full"></div>
                  <div className="absolute top-3 left-1 w-2 h-2 bg-white/15 rounded-full"></div>
                </CardContent>
              </Card>

              {/* AI Chat Orders Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <Brain className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">الذكاء الاصطناعي</h4>
                      <p className="text-purple-100 text-xs">مساعد ذكي</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{aiChatCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-2 left-1 w-5 h-5 bg-white/8 rounded-full"></div>
                  <div className="absolute top-1 right-2 w-2 h-2 bg-white/15 rounded-full"></div>
                </CardContent>
              </Card>

              {/* Telegram Orders Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <Smartphone className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">من التليغرام</h4>
                      <p className="text-cyan-100 text-xs">تليغرام بوت</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{telegramCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-1 left-3 w-3 h-3 bg-white/12 rounded-full"></div>
                  <div className="absolute top-4 right-1 w-2 h-2 bg-white/20 rounded-full"></div>
                </CardContent>
              </Card>

              {/* Total Orders Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-700 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">إجمالي الطلبات</h4>
                      <p className="text-emerald-100 text-xs">طلبات واردة</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{totalCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-2 left-2 w-6 h-6 bg-white/10 rounded-full"></div>
                  <div className="absolute top-1 right-1 w-3 h-3 bg-white/15 rounded-full"></div>
                </CardContent>
              </Card>
            </div>

            {/* Needs Review Alert */}
            {needsReviewCount > 0 && (
              <div className="mb-4 p-3 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div>
                    <h4 className="font-bold text-sm text-red-800 dark:text-red-200">
                      لديك {needsReviewCount} طلب يحتاج مراجعة عاجلة!
                    </h4>
                    <p className="text-xs text-red-700 dark:text-red-300">
                      هذه الطلبات تحتاج إلى اهتمام فوري ومراجعة يدوية
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Orders List */}
            <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
              <CardHeader className="p-3 border-b border-slate-200 dark:border-slate-700">
                <div dir="rtl">
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    قائمة الطلبات الذكية ({orders.length})
                  </CardTitle>
                  
                  {orders.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedOrders.length === orders.length}
                          onCheckedChange={handleSelectAll}
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">تحديد الكل</span>
                      </div>
                      
                      {selectedOrders.length > 0 && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleBulkAction('approve')}
                            className="h-7 text-xs bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                          >
                            <CheckCircle2 className="w-3 h-3 ml-1" />
                            موافقة على المحدد ({selectedOrders.length})
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleBulkAction('delete')}
                            className="h-7 text-xs bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                          >
                            <Trash2 className="w-3 h-3 ml-1" />
                            حذف المحدد ({selectedOrders.length})
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-3 space-y-3">
                {orders.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                      <Bot className="w-6 h-6 text-slate-400" />
                    </div>
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                      لا توجد طلبات ذكية
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      سيتم عرض الطلبات الواردة من التليغرام والذكاء الاصطناعي هنا
                    </p>
                  </div>
                ) : (
                  [...orders].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map((order) => (
                    <AiOrderCard 
                      key={order.id} 
                      order={order}
                      isSelected={selectedOrders.includes(order.id)}
                      onSelect={(checked) => handleSelectOrder(order.id, checked)}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default AiOrdersManager;