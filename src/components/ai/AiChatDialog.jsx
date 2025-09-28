import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, User, Send, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/integrations/supabase/client';

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
    console.warn('AiChatDialog: Context not available');
    user = { fullName: 'المستخدم' };
    createOrder = () => Promise.resolve({ success: false });
  }

  useEffect(() => {
    if (open && messages.length === 0) {
      const userName = user?.full_name || user?.fullName || user?.display_name || 'المستخدم';
      setMessages([
        { 
          role: 'model', 
          content: `🌟 أهلاً وسهلاً بك يا ${userName}!\n\nأنا المساعد الذكي RYUS، مساعدك الشخصي في إدارة المتجر.\n\n💼 يمكنني مساعدتك في:\n• إنشاء طلبات جديدة للعملاء\n• متابعة الطلبات الحالية\n• إدارة المخزون\n• تحليل المبيعات\n\nفقط أخبرني ما تحتاجه وسأكون في خدمتك! 🚀` 
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

        // إذا كان الرد يحتوي على طلب
        if (data.type === 'order' && data.orderData) {
          try {
            const { success, trackingNumber } = await createOrder(
              data.orderData.customerInfo,
              data.orderData.items,
              null,
              0,
              'ai_pending' 
            );

            if (success) {
              setMessages(prev => [...prev, {
                role: 'model',
                content: `✅ ${data.response}\n\n🎯 تم إنشاء طلب جديد برقم تتبع **${trackingNumber}**\nيمكنك مراجعته في قائمة الطلبات.`
              }]);
            } else {
              setMessages(prev => [...prev, { 
                role: 'model', 
                content: `${data.response}\n\n⚠️ لم أتمكن من إنشاء الطلب تلقائياً. يرجى إنشاؤه يدوياً.` 
              }]);
            }
          } catch (orderError) {
            setMessages(prev => [...prev, { 
              role: 'model', 
              content: `${data.response}\n\n⚠️ حدث خطأ في إنشاء الطلب. يرجى المحاولة مرة أخرى.` 
            }]);
          }
        } else {
          // رد نصي عادي
          setMessages(prev => [...prev, { 
            role: 'model', 
            content: data.response 
          }]);
        }

    } catch (error) {
      console.error('AI Chat Error:', error);
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
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              المساعد الذكي RYUS
            </span>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
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
        <div className="p-4 border-t bg-muted/30">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3 flex-row-reverse">
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
            🤖 مدعوم بالذكاء الاصطناعي Gemini 2.0
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
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Sparkles className="w-5 h-5 text-white" />
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
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <User className="w-5 h-5 text-white" />
        </div>
      )}
    </motion.div>
  )
}

export default AiChatDialog;