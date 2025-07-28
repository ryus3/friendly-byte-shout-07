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

const AiChatDialog = ({ open, onOpenChange }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef(null);
  
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
      setMessages([
        { role: 'model', content: `أهلاً بك يا ${user.fullName}! كيف يمكنني مساعدتك اليوم؟\nيمكنني مساعدتك في إنشاء طلبات. فقط أخبرني بالتفاصيل.` }
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
    
    // This is a mock response. In a real scenario, this would call a Gemini/AI API
    try {
        const aiResponse = await mockProcessOrder(input);
        
        if (aiResponse.type === 'order') {
            const { success, trackingNumber } = await createOrder(
                aiResponse.data.customerInfo,
                aiResponse.data.items,
                null,
                0,
                'ai_pending' 
            );

            if (success) {
                setMessages(prev => [...prev, {
                    role: 'model',
                    content: `تم إنشاء طلب جديد للزبون **${aiResponse.data.customerInfo.name}** برقم تتبع **${trackingNumber}**. سيظهر في قائمة طلبات الذكاء الاصطناعي للمراجعة والموافقة.`
                }]);
            } else {
                 setMessages(prev => [...prev, { role: 'model', content: 'حدث خطأ أثناء محاولة إنشاء الطلب. يرجى المحاولة مرة أخرى.' }]);
            }

        } else {
            setMessages(prev => [...prev, { role: 'model', content: aiResponse.data }]);
        }

    } catch (error) {
        setMessages(prev => [...prev, { role: 'model', content: "عذراً، لم أتمكن من فهم طلبك. هل يمكنك إعادة صياغته؟" }]);
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
    if(scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({
            top: scrollAreaRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }
  }, [messages])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2 gradient-text">
            <Sparkles />
            المساعد الذكي
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
          </div>
        </ScrollArea>
        <div className="p-4 border-t">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب طلبك هنا..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
              <Send className="w-5 h-5" />
            </Button>
          </form>
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      <div className={cn("p-3 rounded-2xl max-w-md", message.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-secondary text-secondary-foreground rounded-bl-none')}>
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
      </div>
      {message.role === 'user' && (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  )
}

export default AiChatDialog;