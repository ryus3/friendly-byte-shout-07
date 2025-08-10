import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AiOrderCard from './AiOrderCard';

const AiOrdersManager = ({ onClose }) => {
  const [aiOrders] = useState([
    {
      id: 1,
      customer_name: "أحمد محمد",
      customer_phone: "07901234567",
      message: "أريد فستان أزرق مقاس M وحقيبة سوداء",
      source: "telegram",
      status: "needs_review",
      created_at: new Date(),
      updated_at: new Date(),
      ai_response: "تم العثور على فستان أزرق وحقيبة سوداء متاحين"
    },
    {
      id: 2,
      customer_name: "فاطمة علي",
      customer_phone: "07912345678",
      message: "بحاجة لحذاء رياضي مقاس 40",
      source: "ai_chat",
      status: "pending",
      created_at: new Date(),
      updated_at: new Date(),
      ai_response: "جاري البحث عن الأحذية الرياضية المتاحة"
    },
    {
      id: 3,
      customer_name: "محمد عباس",
      customer_phone: "07923456789",
      message: "أحتاج قميص أبيض مقاس L",
      source: "telegram",
      status: "completed",
      created_at: new Date(Date.now() - 86400000),
      updated_at: new Date(),
      ai_response: "تم إرسال تفاصيل القمصان المتاحة"
    },
    {
      id: 4,
      customer_name: "سارة أحمد",
      customer_phone: "07934567890",
      message: "أريد فستان سهرة أسود",
      source: "ai_chat",
      status: "needs_review",
      created_at: new Date(),
      updated_at: new Date(),
      ai_response: "عذراً، لا توجد فساتين سهرة متاحة حالياً"
    },
    {
      id: 5,
      customer_name: "خالد مصطفى",
      customer_phone: "07945678901",
      message: "بحاجة لجاكيت شتوي مقاس XL",
      source: "telegram",
      status: "pending",
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const totalCount = aiOrders.length;
  const pendingCount = aiOrders.filter(order => order.status === 'pending').length;
  const needsReviewCount = aiOrders.filter(order => order.status === 'needs_review').length;
  const telegramCount = aiOrders.filter(order => order.source === 'telegram').length;
  const aiChatCount = aiOrders.filter(order => order.source === 'ai_chat').length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-lg z-[1200] flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-indigo-900/20 rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
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
            
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 rounded-lg p-2 h-auto ml-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="p-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              {/* Total Orders Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">إجمالي الطلبات</h4>
                      <p className="text-blue-100 text-xs">طلبات واردة</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{totalCount}</p>
                      <p className="text-white/80 text-xs">طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                </CardContent>
              </Card>

              {/* Pending Orders Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">في الانتظار</h4>
                      <p className="text-orange-100 text-xs">قيد المعالجة</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{pendingCount}</p>
                      <p className="text-white/80 text-xs">طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                </CardContent>
              </Card>

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
                      <p className="text-lg font-bold">{needsReviewCount}</p>
                      <p className="text-white/80 text-xs">طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
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
                      <p className="text-lg font-bold">{telegramCount}</p>
                      <p className="text-white/80 text-xs">طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
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
                      <p className="text-lg font-bold">{aiChatCount}</p>
                      <p className="text-white/80 text-xs">طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
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
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  قائمة الطلبات الذكية ({aiOrders.length})
                </CardTitle>
              </CardHeader>
              
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="p-3 space-y-3">
                    {aiOrders.length === 0 ? (
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
                      aiOrders.map((order) => (
                        <AiOrderCard key={order.id} order={order} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AiOrdersManager;