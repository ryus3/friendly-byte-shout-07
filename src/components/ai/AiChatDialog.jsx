import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, User, Send, Sparkles, Loader2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const AiChatDialog = ({ open, onOpenChange }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
      const userName = user?.full_name || user?.fullName || user?.display_name || 'المستخدم';
      setMessages([
        { 
          role: 'model', 
          content: `أهلاً! أنا مساعدك الذكي 🤖\nأستطيع إنشاء طلبات ذكية وتحليل البيانات` 
        }
      ]);
    }
  }, [open, messages, user]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // تكامل مع Gemini AI الحقيقي
    try {
        // الحصول على session token للمستخدم المصادق عليه
        const { data: { session } } = await supabase.auth.getSession();
        const userToken = session?.access_token;

        if (!userToken) {
          throw new Error('لم يتم العثور على رمز المصادقة. يرجى تسجيل الدخول مرة أخرى.');
        }

        const userInfo = {
          full_name: user?.full_name || user?.fullName || user?.display_name,
          default_customer_name: user?.default_customer_name,
          isAdmin: user?.isAdmin || false,
          id: user?.id,
          permissions: user?.permissions || []
        };

        const response = await fetch('https://tkheostkubborwkwzugl.functions.supabase.co/functions/v1/ai-gemini-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA'
          },
          body: JSON.stringify({
            message: input,
            userInfo: userInfo
          })
        });

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'خطأ في الاتصال بالمساعد الذكي');
        }

        // إذا كان الرد يحتوي على طلب ذكي
        if (data.type === 'order' && data.orderData) {
          const orderDetails = data.orderData;
          
          // رد مختصر من المساعد الذكي
          const orderMessage = {
            role: 'model',
            content: data.response, // الرد المختصر من المساعد
            source: 'المساعد الذكي',
            metadata: {
              type: 'order',
              model_used: data.model_used,
              confidence: data.confidence || 95
            }
          };
          
          setMessages(prev => [...prev, orderMessage]);
          
          if (orderDetails.orderSaved) {
            // إشعار فوري لإدارة الطلبات الذكية مع تفاصيل كاملة
            setTimeout(() => {
              const aiOrderEvent = new CustomEvent('aiOrderCreated', { 
                detail: {
                  id: orderDetails.aiOrderId,
                  customer_name: orderDetails.customer_name,
                  customer_phone: orderDetails.customer_phone,
                  customer_city: orderDetails.customer_city,
                  customer_province: orderDetails.customer_province,
                  customer_address: orderDetails.customer_address,
                  city_id: orderDetails.city_id,
                  region_id: orderDetails.region_id,
                  source: 'المساعد الذكي', // تحديد المصدر بوضوح
                  status: 'pending',
                  created_at: new Date().toISOString(),
                  items: orderDetails.items,
                  total_amount: orderDetails.total_amount,
                  order_data: orderDetails,
                  original_text: input,
                  created_by: userInfo?.id
                }
              });
              window.dispatchEvent(aiOrderEvent);
              
              toast({
                title: "🤖 طلب ذكي جديد",
                description: `${orderDetails.customer_name} - ${(orderDetails.total_amount || 0).toLocaleString()} د.ع`,
                variant: "success"
              });
            }, 100);
          }
        } else {
          // رد نصي عادي
          setMessages(prev => [...prev, { 
            role: 'model', 
            content: data.response 
          }]);
        }

    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: "🔧 عذراً، أواجه مشكلة تقنية حالياً. يرجى المحاولة مرة أخرى أو التواصل مع الدعم التقني." 
      }]);
    } finally {
        setIsLoading(false);
    }
  };

  const mockProcessOrder = async (text) => {
    // Basic mock NLP to extract info
    const nameMatch = text.match(/(?:للزبون|اسم)\s*([^\s,،]+)/);
    const phoneMatch = text.match(/(?:هاتف|رقم)\s*([0-9]+)/);
    const addressMatch = text.match(/عنوان\s*([^,،]+)/);
    
    if (nameMatch && phoneMatch && addressMatch) {
      return {
        type: 'order',
        data: {
          customerInfo: {
            name: nameMatch[1],
            phone: phoneMatch[1],
            address: addressMatch[1],
            city: "بغداد"
          },
          items: [
            // Dummy items for now
            { productId: 'prod_1', productName: "حذاء رياضي", sku: 'SKU-001-BLK-42', color: 'أسود', size: '42', quantity: 1, price: 25000, costPrice: 15000, total: 25000 },
          ]
        }
      }
    }
    
    return { type: 'text', data: "لم أتمكن من العثور على معلومات كافية لإنشاء طلب. يرجى التأكد من ذكر اسم الزبون، رقم الهاتف، والعنوان." };
  };
  
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs sm:max-w-lg h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-2 sm:p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  المساعد الذكي
                </h2>
                <div className="text-xs text-muted-foreground">
                  مدعوم بـ Gemini AI
                </div>
              </div>
            </div>
            
            <AiManagementButton />
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 p-2 sm:p-4" ref={scrollAreaRef}>
          <div className="space-y-6">
            <AnimatePresence>
              {messages.map((message, index) => (
                <MessageBubble key={index} message={message} />
              ))}
               {isLoading && (
                  <MessageBubble message={{role: 'model', content: <Loader2 className="w-5 h-5 animate-spin" />}} />
               )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <div className="p-2 sm:p-4 border-t bg-muted/30">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <Button 
              type="submit" 
              size="icon" 
              disabled={!input.trim() || isLoading}
              className="h-12 w-12 rounded-full shadow-lg"
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
              placeholder="💬 اكتب رسالتك هنا... (مثال: أريد إنشاء طلب لأحمد العراقي)"
              className="flex-1 h-12 text-sm"
              disabled={isLoading}
            />
          </form>
          <div className="mt-2 text-xs text-muted-foreground text-center">
            🤖 مدعوم بـ Gemini AI
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MessageBubble = ({ message }) => {
  return (
     <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex items-start gap-3", message.role === 'user' ? 'justify-end' : 'justify-start')}
    >
      {message.role === 'model' && (
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
      )}
      <div className={cn(
        "p-4 rounded-2xl max-w-lg shadow-sm", 
        message.role === 'user' 
          ? 'bg-primary text-primary-foreground rounded-br-none' 
          : 'bg-card border text-card-foreground rounded-bl-none'
      )}>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>
      </div>
      {message.role === 'user' && (
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
      )}
    </motion.div>
  )
}

// مكون زر الإدارة بتدرج لوني أنيق
const AiManagementButton = () => {
  const handleManagementClick = () => {
    // إرسال حدث لفتح نافذة إدارة المساعد الذكي
    const openManagerEvent = new CustomEvent('openAiManager');
    window.dispatchEvent(openManagerEvent);
  };

  return (
    <Button 
      onClick={handleManagementClick}
      className="h-7 px-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 text-xs font-medium"
    >
      إدارة
    </Button>
  );
};

export default AiChatDialog;