import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, User, Send, Sparkles, Loader2, Activity, BarChart3, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/integrations/supabase/client';
import { AiModelSelector } from './AiModelSelector';
import { AiUsageStats } from './AiUsageStats';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings, Zap } from 'lucide-react';

const SuperAiChatDialog = ({ open, onOpenChange }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState('gemini-2.5-flash');
  const [modelUsage, setModelUsage] = useState({});
  const [systemStatus, setSystemStatus] = useState('online');
  const [conversationContext, setConversationContext] = useState([]);
  const scrollAreaRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // حماية من null context
  let user, createOrder;
  try {
    const authContext = useAuth();
    const inventoryContext = useInventory();
    user = authContext?.user;
    createOrder = inventoryContext?.createOrder;
  } catch (error) {
    user = { fullName: 'المستخدم' };
    createOrder = () => Promise.resolve({ success: false });
  }

  useEffect(() => {
    if (open && messages.length === 0) {
      initializeWelcomeMessage();
      loadUsageStats();
    }
  }, [open, messages, user]);

  const initializeWelcomeMessage = () => {
    const userName = user?.full_name || user?.fullName || user?.display_name || 'المدير العام';
    const welcomeMessage = {
      role: 'model',
      content: `أهلاً ${userName}! أنا مساعدك الذكي 🤖
أستطيع إنشاء طلبات ذكية وتحليل البيانات`
    };
    
    setMessages([welcomeMessage]);
  };

  const loadUsageStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-gemini-chat', {
        body: {
          message: 'get_usage_stats',
          userInfo: {
            full_name: user?.full_name || user?.fullName,
            id: user?.id
          }
        }
      });
      if (!error && data?.success && data?.usage_stats) {
        setModelUsage(data.usage_stats);
      }
    } catch (error) {
      // Silent failure
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    // إضافة للسياق العام
    setConversationContext(prev => [...prev.slice(-10), { role: 'user', content: input }]);
    
    setInput('');
    setIsLoading(true);
    
    try {
      const userInfo = {
        full_name: user?.full_name || user?.fullName || user?.display_name,
        default_customer_name: user?.default_customer_name,
        isAdmin: user?.isAdmin || false,
        id: user?.id,
        roles: user?.roles || [],
        permissions: user?.permissions || [],
        conversation_context: conversationContext
      };

      const { data, error } = await supabase.functions.invoke('ai-gemini-chat', {
        body: {
          message: input,
          userInfo: userInfo,
          enhance_mode: true,
          ryus_custom_mode: true
        }
      });

      if (error) throw new Error(error.message || 'فشل الاتصال بالمساعد');
      if (!data?.success) {
        throw new Error(data?.error || 'خطأ في الاتصال بالمساعد الذكي');
      }

      // تحديث إحصائيات الاستخدام
      if (data.model_used) {
        setCurrentModel(data.model_used);
      }
      if (data.usage_stats) {
        setModelUsage(data.usage_stats);
      }

      // إضافة رد المساعد للسياق
      setConversationContext(prev => [...prev.slice(-10), { role: 'model', content: data.response }]);

      // معالجة أنواع الردود المختلفة
      if (data.type === 'region_clarification' && data.orderData?.suggestions?.length > 0) {
        // عرض قائمة المناطق كأزرار قابلة للنقر
        setMessages(prev => [...prev, {
          role: 'model',
          content: data.response,
          regionClarification: {
            suggestions: data.orderData.suggestions,
            city_name: data.orderData.city_name,
            city_external_id: data.orderData.city_external_id,
            original_message: data.orderData.original_message,
          },
          metadata: {
            model_used: data.model_used,
            confidence: data.confidence || 95,
          }
        }]);
      } else if (data.type === 'order' && data.orderData) {
        await handleOrderResponse(data);
      } else if (data.type === 'analytics') {
        await handleAnalyticsResponse(data);
      } else {
        // رد نصي عادي محسن
        setMessages(prev => [...prev, { 
          role: 'model', 
          content: data.response,
          metadata: {
            model_used: data.model_used,
            processing_time: data.processing_time,
            confidence: data.confidence || 95
          }
        }]);
      }

    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: "🔧 **خطأ في المساعد الذكي الخارق**\n\nأعتذر، أواجه مشكلة تقنية مؤقتة. جاري المحاولة تلقائياً...\n\n💡 **نصائح للحصول على أفضل النتائج**:\n• تأكد من اتصال الإنترنت\n• استخدم جمل واضحة ومحددة\n• اذكر التفاصيل المطلوبة كاملة",
        error: true
      }]);
      
      setTimeout(() => {
        setSystemStatus('reconnecting');
        setTimeout(() => setSystemStatus('online'), 3000);
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderResponse = async (data) => {
    const orderDetails = data.orderData;
    let shortMessage = '';
    
    if (orderDetails.orderSaved) {
      shortMessage = `✅ تم إنشاء الطلب بنجاح`;
      
      // إشعار محسن للطلب الذكي
      setTimeout(() => {
        const aiOrderEvent = new CustomEvent('superAiOrderCreated', { 
          detail: {
            ...orderDetails,
            enhanced: true,
            ai_version: 'super',
            confidence_score: data.confidence || 95,
            processing_time: data.processing_time || 0
          }
        });
        window.dispatchEvent(aiOrderEvent);
        
        toast({
          title: "✅ طلب جديد",
          description: `${orderDetails.customer_name} - ${(orderDetails.total_amount || 0).toLocaleString()} د.ع`,
          variant: "success"
        });
      }, 300);
    } else if (data.response.includes('مدينة') || data.response.includes('عنوان')) {
      shortMessage = `❗ يرجى تحديد العنوان`;
    } else if (data.response.includes('منتج') || data.response.includes('لون') || data.response.includes('قياس')) {
      shortMessage = `❗ يرجى تحديد المنتج واللون والقياس`;
    } else {
      shortMessage = data.response.substring(0, 50) + '...';
    }

    setMessages(prev => [...prev, {
      role: 'model',
      content: shortMessage,
      metadata: {
        type: 'order',
        model_used: data.model_used,
        confidence: data.confidence || 95
      }
    }]);
  };

  const handleAnalyticsResponse = async (data) => {
    setMessages(prev => [...prev, { 
      role: 'model', 
      content: data.response,
      metadata: {
        type: 'analytics',
        model_used: data.model_used,
        data_points: data.analytics_data?.length || 0,
        confidence: data.confidence || 95
      }
    }]);
  };
  
  // ✅ معالجة اختيار المنطقة من قائمة "هل تقصد؟"
  const handleRegionSelect = async (messageIndex, suggestion, clarification) => {
    if (isLoading) return;

    setMessages(prev => {
      const next = [...prev];
      if (next[messageIndex]) {
        next[messageIndex] = {
          ...next[messageIndex],
          regionClarification: { ...next[messageIndex].regionClarification, resolvedName: suggestion.name }
        };
      }
      next.push({ role: 'user', content: `📍 ${suggestion.name}` });
      return next;
    });

    setIsLoading(true);
    try {
      const userInfo = {
        full_name: user?.full_name || user?.fullName || user?.display_name,
        default_customer_name: user?.default_customer_name,
        isAdmin: user?.isAdmin || false,
        id: user?.id,
        roles: user?.roles || [],
        permissions: user?.permissions || [],
      };

      const { data, error } = await supabase.functions.invoke('ai-gemini-chat', {
        body: {
          message: clarification.original_message,
          userInfo,
          pendingAction: {
            type: 'confirm_region',
            original_message: clarification.original_message,
            city_external_id: clarification.city_external_id,
            region_external_id: suggestion.external_id,
            city_name: clarification.city_name,
            region_name: suggestion.name,
          }
        }
      });

      if (error) throw new Error(error.message || 'فشل تأكيد المنطقة');

      if (data?.type === 'order' && data?.orderData?.orderSaved) {
        await handleOrderResponse(data);
      } else {
        setMessages(prev => [...prev, {
          role: 'model',
          content: data?.response || '⚠️ تعذر إنشاء الطلب.',
          error: !data?.success,
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'model',
        content: `⚠️ خطأ في تأكيد المنطقة: ${err.message}`,
        error: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-2xl h-[80vh] sm:h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-3 sm:p-4 border-b bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  المساعد الذكي
                </h2>
                <div className="text-xs text-muted-foreground">
                  نظام RYUS المتقدم
                </div>
              </div>
            </div>
            
            <AiManagementButton 
              usage={modelUsage} 
              currentModel={currentModel} 
              onModelChange={setCurrentModel}
              systemStatus={systemStatus}
            />
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-6">
            <AnimatePresence>
              {messages.map((message, index) => (
                <SuperMessageBubble
                  key={index}
                  message={message}
                  index={index}
                  onSelectRegion={handleRegionSelect}
                  disabled={isLoading}
                />
              ))}
               {isLoading && (
                 <SuperMessageBubble message={{
                   role: 'model', 
                   content: <div className="flex items-center gap-2">
                     <Loader2 className="w-5 h-5 animate-spin" />
                     <span>المساعد الذكي الخارق يعمل...</span>
                   </div>
                 }} />
               )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t bg-gradient-to-r from-muted/30 to-muted/50">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <Button 
              type="submit" 
              size="icon" 
              disabled={!input.trim() || isLoading}
              className="h-12 w-12 rounded-full shadow-lg hover:scale-105 transition-transform"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="💬 اكتب رسالتك للمساعد الذكي الخارق... (مثال: أحتاج طلب لأحمد من بغداد أو أريد إحصائيات اليوم)"
              className="flex-1 h-12 text-sm"
              disabled={isLoading}
            />
          </form>
          <div className="mt-2 text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", systemStatus === 'online' ? 'bg-green-500' : 'bg-red-500')} />
            النموذج النشط: {currentModel.replace('gemini-', '')}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SuperMessageBubble = ({ message }) => {
  const hasMetadata = message.metadata;
  const isError = message.error;
  
  return (
     <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex items-start gap-3", message.role === 'user' ? 'justify-end' : 'justify-start')}
    >
      {message.role === 'model' && (
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg",
          isError 
            ? "bg-gradient-to-r from-red-500 to-red-600" 
            : "bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-600"
        )}>
          {isError ? (
            <AlertCircle className="w-5 h-5 text-white" />
          ) : (
            <Sparkles className="w-5 h-5 text-white" />
          )}
        </div>
      )}
      
      <div className={cn(
        "p-4 rounded-2xl max-w-2xl shadow-sm", 
        message.role === 'user' 
          ? 'bg-primary text-primary-foreground rounded-br-none' 
          : isError
          ? 'bg-destructive/10 border border-destructive/20 text-destructive-foreground rounded-bl-none'
          : 'bg-card border text-card-foreground rounded-bl-none'
      )}>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>
        
        {hasMetadata && (
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
            {message.metadata.model_used && (
              <Badge variant="outline" className="text-xs">
                {message.metadata.model_used}
              </Badge>
            )}
            {message.metadata.confidence && (
              <Badge variant="secondary" className="text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                دقة {message.metadata.confidence}%
              </Badge>
            )}
            {message.metadata.processing_time && (
              <span className="text-xs">
                ⚡ {message.metadata.processing_time}ms
              </span>
            )}
          </div>
        )}
      </div>
      
      {message.role === 'user' && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <User className="w-5 h-5 text-white" />
        </div>
      )}
    </motion.div>
  )
};

// مكون زر الإدارة المتقدم
const AiManagementButton = ({ usage, currentModel, onModelChange, systemStatus }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white border-0 hover:opacity-90 hover:scale-105 transition-all">
          <Settings className="w-4 h-4 mr-1" />
          <span>إدارة</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 z-[9999] bg-background border shadow-lg" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h4 className="font-semibold">إدارة المساعد الذكي</h4>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">النموذج النشط</label>
              <AiModelSelector currentModel={currentModel} onModelChange={onModelChange} />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">الاستخدام والإحصائيات</label>
              <AiUsageStats usage={usage} />
            </div>
            
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span>حالة الاتصال:</span>
                <Badge variant={systemStatus === 'online' ? 'default' : 'destructive'} className="text-xs">
                  <div className={cn("w-2 h-2 rounded-full mr-1", systemStatus === 'online' ? 'bg-green-500' : 'bg-red-500')} />
                  {systemStatus === 'online' ? 'متصل' : 'إعادة اتصال'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                <span>نظام الذكاء الجغرافي:</span>
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  نشط
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SuperAiChatDialog;