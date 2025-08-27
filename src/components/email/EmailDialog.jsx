import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Send, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const EmailDialog = ({ pdfDocument, fileName, triggerButton }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    to: '',
    subject: `تقرير: ${fileName}`,
    message: 'يرجى العثور على التقرير المرفق.'
  });

  const handleSendEmail = async () => {
    if (!formData.to || !formData.subject) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // هنا سيتم إضافة منطق إرسال الإيميل لاحقاً
      toast({
        title: "تم الإرسال",
        description: `تم إرسال التقرير إلى ${formData.to}`,
      });
      setOpen(false);
      setFormData({
        to: '',
        subject: `تقرير: ${fileName}`,
        message: 'يرجى العثور على التقرير المرفق.'
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في إرسال الإيميل. حاول مرة أخرى.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm">
            <Mail className="w-4 h-4 ml-1" />
            إرسال بالإيميل
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            إرسال التقرير بالإيميل
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="email-to">إلى *</Label>
            <Input
              id="email-to"
              type="email"
              placeholder="example@domain.com"
              value={formData.to}
              onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
            />
          </div>
          
          <div>
            <Label htmlFor="email-subject">الموضوع *</Label>
            <Input
              id="email-subject"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
            />
          </div>
          
          <div>
            <Label htmlFor="email-message">الرسالة</Label>
            <Textarea
              id="email-message"
              rows={3}
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
            />
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSendEmail} disabled={loading} className="flex-1">
              {loading ? (
                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
              ) : (
                <Send className="w-4 h-4 ml-1" />
              )}
              {loading ? 'جاري الإرسال...' : 'إرسال'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailDialog;