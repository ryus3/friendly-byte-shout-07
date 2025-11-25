import React from 'react';
import { useParams } from 'react-router-dom';
import { useStorefront } from '@/contexts/StorefrontContext';
import { Skeleton } from '@/components/ui/skeleton';

const AboutPage = () => {
  const { slug } = useParams();
  const { settings, settingsLoading } = useStorefront();

  if (settingsLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const aboutContent = settings?.about_us || `مرحباً بك في متجر ${settings?.profile?.business_page_name || 'متجرنا'}

نحن متجر متخصص في توفير أفضل المنتجات عالية الجودة لعملائنا الكرام.
نفخر بتقديم تجربة تسوق مميزة ومنتجات منتقاة بعناية.

رؤيتنا: أن نكون الخيار الأول لعملائنا
رسالتنا: تقديم منتجات عالية الجودة بأسعار تنافسية وخدمة متميزة

تسوق معنا وستجد:
✓ منتجات أصلية 100%
✓ أسعار تنافسية
✓ توصيل سريع
✓ خدمة عملاء متميزة`;

  const renderContent = (text) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-xl font-bold mt-6 mb-3">{line.substring(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-2xl font-bold mt-8 mb-4">{line.substring(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={i} className="text-3xl font-bold mt-10 mb-5">{line.substring(2)}</h1>;
      }
      if (line.trim().startsWith('✓ ')) {
        return <li key={i} className="mr-6 text-green-600 font-medium">✓ {line.trim().substring(2)}</li>;
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
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          من نحن
        </h1>
        
        <div className="prose prose-lg max-w-none">
          {renderContent(aboutContent)}
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
