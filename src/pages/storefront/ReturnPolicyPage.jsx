import React from 'react';
import { useParams } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { RotateCcw } from 'lucide-react';

const ReturnContent = () => {
  const { settings, settingsLoading } = useStorefront();

  if (settingsLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const returnContent = settings?.return_policy || `نوفر ضمان الاسترجاع خلال 7 أيام من تاريخ الاستلام

## شروط الاسترجاع:
✓ المنتج في حالته الأصلية مع العبوة
✓ عدم استخدام أو غسل المنتج
✓ وجود الفاتورة الأصلية

## الاستثناءات (لا يمكن استرجاعها):
✗ الملابس الداخلية
✗ المنتجات المخصصة
✗ المنتجات المخفضة

## خطوات الاسترجاع:
1. اتصل بنا عبر واتساب أو تليغرام
2. أرسل المنتج مع الفاتورة
3. سنفحص المنتج
4. استرداد المبلغ خلال 3-5 أيام عمل

**ملاحظة:** العميل يتحمل تكلفة الإرجاع`;

  const renderContent = (text) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-xl font-bold mt-6 mb-3">{line.substring(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-2xl font-bold mt-8 mb-4">{line.substring(3)}</h2>;
      }
      if (line.trim().startsWith('✓ ')) {
        return <li key={i} className="mr-6 text-green-600 font-medium">✓ {line.trim().substring(2)}</li>;
      }
      if (line.trim().startsWith('✗ ')) {
        return <li key={i} className="mr-6 text-red-600 font-medium">✗ {line.trim().substring(2)}</li>;
      }
      if (line.trim().match(/^\d+\./)) {
        return <li key={i} className="mr-6 font-medium">{line.trim()}</li>;
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
          <RotateCcw className="h-10 w-10 text-emerald-600" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            سياسة الاسترجاع
          </h1>
        </div>
        
        <div className="prose prose-lg max-w-none">
          {renderContent(returnContent)}
        </div>
      </div>
    </div>
  );
};

const ReturnPolicyPage = () => {
  const { slug } = useParams();

  return (
    <StorefrontProvider slug={slug}>
      <StorefrontLayout>
        <ReturnContent />
      </StorefrontLayout>
    </StorefrontProvider>
  );
};

export default ReturnPolicyPage;
