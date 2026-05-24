import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Save, Info } from 'lucide-react';

const NotificationTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .order('type');
      
      if (!error && data) {
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTemplate = (id, field, value) => {
    setTemplates(prev => 
      prev.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  };

  const saveTemplate = async (template) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('notification_templates')
        .update({
          title_template: template.title_template,
          body_template: template.body_template
        })
        .eq('id', template.id);

      if (!error) {
        toast({
          title: "✅ تم الحفظ",
          description: `تم تحديث نموذج: ${getTypeLabel(template.type)}`,
        });
      } else {
        toast({
          title: "❌ فشل الحفظ",
          description: error.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      ai_order: 'طلب تليجرام جديد',
      delivery_update: '📦 تحديث حالة التوصيل',
      new_registration: '👥 موظف جديد',
      order_created: '📦 طلب جديد'
    };
    return labels[type] || type;
  };

  const getPlaceholders = (type) => {
    const placeholders = {
      ai_order: ['{order_id}', '{customer_name}', '{total_amount}', '{source}'],
      delivery_update: ['{order_number}', '{status_text}', '{customer_name}'],
      new_registration: ['{employee_name}', '{role}'],
      order_created: ['{order_number}', '{customer_name}', '{total_amount}']
    };
    return placeholders[type] || [];
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-12">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            تخصيص نصوص الإشعارات
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* معلومات */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">استخدم المتغيرات التالية في النصوص:</p>
                <p className="text-xs opacity-80">
                  سيتم استبدال المتغيرات تلقائياً بالقيم الحقيقية عند إرسال الإشعار
                </p>
              </div>
            </div>
          </div>

          {/* النماذج */}
          {templates.map((template) => (
            <Card key={template.id} className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{getTypeLabel(template.type)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* المتغيرات المتاحة */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium">المتغيرات المتاحة:</span>
                  {getPlaceholders(template.type).map(placeholder => (
                    <code 
                      key={placeholder}
                      className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs font-mono cursor-pointer hover:bg-secondary/80"
                      onClick={() => {
                        navigator.clipboard.writeText(placeholder);
                        toast({ title: "📋 تم النسخ", description: placeholder });
                      }}
                    >
                      {placeholder}
                    </code>
                  ))}
                </div>

                {/* العنوان */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">عنوان الإشعار:</label>
                  <input
                    type="text"
                    value={template.title_template}
                    onChange={(e) => updateTemplate(template.id, 'title_template', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="مثال: طلب جديد #{order_id}"
                  />
                </div>

                {/* المحتوى */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">محتوى الإشعار:</label>
                  <textarea
                    value={template.body_template}
                    onChange={(e) => updateTemplate(template.id, 'body_template', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                    placeholder="مثال: طلب من {customer_name} بقيمة {total_amount} دينار"
                  />
                </div>

                {/* معاينة */}
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">معاينة:</p>
                  <p className="font-semibold">{template.title_template}</p>
                  <p className="text-sm text-muted-foreground">{template.body_template}</p>
                </div>

                {/* زر الحفظ */}
                <Button 
                  onClick={() => saveTemplate(template)}
                  disabled={saving}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  حفظ التغييرات
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationTemplates;
