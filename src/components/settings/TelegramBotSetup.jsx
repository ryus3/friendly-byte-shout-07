import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { 
import devLog from '@/lib/devLogger';
  MessageCircle, Bot, CheckCircle, AlertTriangle, ExternalLink, Copy,
  Settings, Zap, Shield, Smartphone
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const TelegramBotSetup = ({ open, onOpenChange }) => {
  const [botToken, setBotToken] = useState('');
  const [webhookStatus, setWebhookStatus] = useState('unknown');
  const [isLoading, setIsLoading] = useState(false);
  const [botInfo, setBotInfo] = useState(null);

  const BOT_FUNCTION_URL = `https://tkheostkubborwkwzugl.supabase.co/functions/v1/telegram-bot`;

  useEffect(() => {
    if (open) {
      checkBotStatus();
    }
  }, [open]);

  const checkBotStatus = async () => {
    setIsLoading(true);
    try {
      // فحص حالة البوت من قاعدة البيانات
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'telegram_bot_config')
        .single();

      if (settings?.value?.bot_token) {
        setBotToken(settings.value.bot_token);
        await verifyBotToken(settings.value.bot_token, false);
      }
    } catch (error) {
      console.error('Error checking bot status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyBotToken = async (token, showToast = true) => {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json();
      
      if (data.ok && data.result) {
        setBotInfo(data.result);
        setWebhookStatus('configured');
        
        if (showToast) {
          toast({
            title: "تم التحقق من البوت",
            description: `البوت @${data.result.username} جاهز للعمل`,
            variant: "success"
          });
        }
        return true;
      } else {
        setBotInfo(null);
        setWebhookStatus('error');
        
        if (showToast) {
          toast({
            title: "خطأ في مفتاح البوت",
            description: "المفتاح المدخل غير صحيح",
            variant: "destructive"
          });
        }
        return false;
      }
    } catch (error) {
      console.error('Error verifying bot token:', error);
      setWebhookStatus('error');
      
      if (showToast) {
        toast({
          title: "خطأ في الاتصال",
          description: "تعذر التحقق من البوت",
          variant: "destructive"
        });
      }
      return false;
    }
  };

  const setupWebhook = async () => {
    if (!botToken) {
      toast({
        title: "مطلوب مفتاح البوت",
        description: "يرجى إدخال مفتاح البوت أولاً",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // 1. التحقق من صحة المفتاح
      const isValid = await verifyBotToken(botToken, false);
      if (!isValid) {
        toast({
          title: "خطأ في المفتاح",
          description: "مفتاح البوت غير صحيح",
          variant: "destructive"
        });
        return;
      }

      // 2. إعداد الـ webhook
      const webhookResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: BOT_FUNCTION_URL,
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: true
          })
        }
      );

      const webhookData = await webhookResponse.json();
      
      if (webhookData.ok) {
        // 3. حفظ الإعدادات في قاعدة البيانات
        const { error } = await supabase
          .from('settings')
          .upsert({
            key: 'telegram_bot_config',
            value: {
              bot_token: botToken,
              webhook_url: BOT_FUNCTION_URL,
              setup_date: new Date().toISOString(),
              bot_info: botInfo
            },
            description: 'إعدادات بوت التليغرام'
          });

        if (error) throw error;

        setWebhookStatus('configured');
        
        toast({
          title: "تم إعداد البوت بنجاح! 🎉",
          description: `البوت @${botInfo.username} جاهز لاستقبال الطلبات`,
          variant: "success"
        });

        // إرسال رسالة تجريبية
        await sendTestMessage();
        
      } else {
        throw new Error(webhookData.description || 'فشل في إعداد webhook');
      }
      
    } catch (error) {
      console.error('Error setting up webhook:', error);
      toast({
        title: "خطأ في الإعداد",
        description: error.message || "تعذر إعداد البوت",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!botToken || !botInfo) return;

    try {
      // إرسال رسالة للقناة أو المطور
      const testMessage = `🤖 تم تفعيل بوت ${botInfo.first_name} بنجاح!

✅ الآن يمكن للموظفين:
• ربط حساباتهم باستخدام أرقامهم الخاصة
• إرسال الطلبات مباشرة عبر التليغرام  
• استلام إشعارات الطلبات

🚀 البوت جاهز للعمل!`;

      devLog.log('Bot setup completed:', testMessage);
      
    } catch (error) {
      console.error('Error sending test message:', error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ!",
      description: "تم نسخ النص إلى الحافظة",
      variant: "success"
    });
  };

  const getStatusColor = () => {
    switch (webhookStatus) {
      case 'configured': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const getStatusText = () => {
    switch (webhookStatus) {
      case 'configured': return 'مُعدّ ويعمل';
      case 'error': return 'خطأ في الإعداد';
      default: return 'غير مُعدّ';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-500" />
            إعداد بوت التليغرام
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <Card className={`border-2 ${webhookStatus === 'configured' ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  حالة البوت
                </div>
                <Badge variant={webhookStatus === 'configured' ? 'default' : 'secondary'} className={getStatusColor()}>
                  {getStatusText()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {botInfo ? (
                <div className="space-y-2">
                  <p className="text-sm"><strong>اسم البوت:</strong> {botInfo.first_name}</p>
                  <p className="text-sm"><strong>اسم المستخدم:</strong> @{botInfo.username}</p>
                  <p className="text-sm"><strong>معرف البوت:</strong> {botInfo.id}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لم يتم إعداد البوت بعد</p>
              )}
            </CardContent>
          </Card>

          {/* Bot Token Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                مفتاح البوت
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="botToken">مفتاح البوت (Bot Token)</Label>
                <div className="flex gap-2">
                  <Input
                    id="botToken"
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="1234567890:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => verifyBotToken(botToken)}
                    disabled={!botToken || isLoading}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  احصل على مفتاح البوت من <strong>@BotFather</strong> في التليغرام
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Webhook URL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                رابط الـ Webhook
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>رابط استقبال الرسائل</Label>
                <div className="flex gap-2">
                  <Input
                    value={BOT_FUNCTION_URL}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(BOT_FUNCTION_URL)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Setup Instructions */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Smartphone className="w-5 h-5" />
                خطوات الإعداد
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-blue-700">
                <div className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <div>
                    <p>تحدث مع <strong>@BotFather</strong> في التليغرام</p>
                    <p className="text-xs text-blue-600">أرسل /newbot واتبع التعليمات</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <p>انسخ مفتاح البوت والصقه أعلاه</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <p>اضغط "إعداد البوت" لتفعيله</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <p>سيتمكن الموظفون من استخدام البوت فوراً</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={setupWebhook} 
              disabled={!botToken || isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  جاري الإعداد...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 mr-2" />
                  إعداد البوت
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramBotSetup;