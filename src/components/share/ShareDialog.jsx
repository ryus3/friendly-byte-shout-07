import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share2, Mail, MessageCircle, Copy, Check } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import EmailDialog from '@/components/email/EmailDialog';

const ShareDialog = ({ pdfDocument, fileName, triggerButton }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = window.location.href;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "تم النسخ",
        description: "تم نسخ الرابط إلى الحافظة",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في نسخ الرابط",
        variant: "destructive"
      });
    }
  };

  const handleWhatsAppShare = () => {
    const text = `تقرير ${fileName}\n${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleTelegramShare = () => {
    const text = `تقرير ${fileName}\n${shareUrl}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
    window.open(telegramUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 ml-1" />
            مشاركة
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            مشاركة التقرير
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* إرسال بالإيميل */}
          <EmailDialog 
            pdfDocument={pdfDocument} 
            fileName={fileName}
            triggerButton={
              <Button variant="outline" className="w-full justify-start">
                <Mail className="w-4 h-4 ml-2" />
                إرسال بالإيميل
              </Button>
            }
          />
          
          {/* مشاركة عبر واتساب */}
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={handleWhatsAppShare}
          >
            <MessageCircle className="w-4 h-4 ml-2" />
            مشاركة عبر واتساب
          </Button>
          
          {/* مشاركة عبر تليغرام */}
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={handleTelegramShare}
          >
            <MessageCircle className="w-4 h-4 ml-2" />
            مشاركة عبر تليغرام
          </Button>
          
          {/* نسخ الرابط */}
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={handleCopyLink}
          >
            {copied ? (
              <Check className="w-4 h-4 ml-2 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 ml-2" />
            )}
            {copied ? 'تم النسخ' : 'نسخ الرابط'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;