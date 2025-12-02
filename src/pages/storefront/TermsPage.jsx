import React from 'react';
import { useParams } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';

const TermsContent = () => {
  const { settings, settingsLoading } = useStorefront();

  if (settingsLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const businessName = settings?.profile?.business_page_name || settings?.business_name || 'متجرنا';

  const termsContent = settings?.terms_conditions || `باستخدامك لمتجر ${businessName}، فإنك توافق على الشروط التالية:

## 1. الطلبات والأسعار
• جميع الطلبات خاضعة لتوافر المخزون
• الأسعار قابلة للتغيير دون إشعار مسبق
• نحتفظ بالحق في رفض أو إلغاء أي طلب

## 2. الدفع والتوصيل
• الدفع عند الاستلام (نقداً)
• مدة التوصيل: 2-5 أيام عمل
• رسوم التوصيل تُحسب حسب المحافظة

## 3. المسؤولية
• يجب فحص المنتج قبل استلامه
• نحن غير مسؤولين عن أي ضرر بعد الاستلام`;

  const renderContent = (text) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-xl font-bold mt-6 mb-3">{line.substring(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-2xl font-bold mt-8 mb-4">{line.substring(3)}</h2>;
      }
      if (line.trim().startsWith('• ') || line.trim().startsWith('- ')) {
        return <li key={i} className="mr-6">{line.trim().substring(2)}</li>;
      }
      if (!line.trim()) {
        return <div key={i} className="h-4" />;
      }
      
      let processedLine = line;
      processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      processedLine = processedLine.replace(/\*(.+?)\*/g, '<em>$1</em>');
      
      return <p key={i} className="mb-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: processedLine }} />;
    });
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="h-10 w-10 text-purple-600" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            الشروط والأحكام
          </h1>
        </div>
        
        <div className="prose prose-lg max-w-none">
          {renderContent(termsContent)}
        </div>
      </div>
    </div>
  );
};

const TermsPage = () => {
  const { slug } = useParams();

  return (
    <StorefrontProvider slug={slug}>
      <StorefrontLayout>
        <TermsContent />
      </StorefrontLayout>
    </StorefrontProvider>
  );
};

export default TermsPage;
