import React from 'react';
import { useParams } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield } from 'lucide-react';

const PrivacyContent = () => {
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

  const privacyContent = settings?.privacy_policy || `في ${businessName}، نحترم خصوصيتك ونلتزم بحماية معلوماتك الشخصية.

## المعلومات التي نجمعها:
• الاسم الكامل
• رقم الهاتف
• عنوان التوصيل
• سجل الطلبات

## كيف نستخدم معلوماتك:
• معالجة وتوصيل طلباتك
• التواصل معك بشأن الطلبات
• تحسين خدماتنا

## حماية البيانات:
نستخدم بروتوكولات أمان متقدمة لحماية معلوماتك.
لن نشارك بياناتك مع أطراف ثالثة بدون موافقتك.`;

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
          <Shield className="h-10 w-10 text-blue-600" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            سياسة الخصوصية
          </h1>
        </div>
        
        <div className="prose prose-lg max-w-none">
          {renderContent(privacyContent)}
        </div>
      </div>
    </div>
  );
};

const PrivacyPolicyPage = () => {
  const { slug } = useParams();

  return (
    <StorefrontProvider slug={slug}>
      <StorefrontLayout>
        <PrivacyContent />
      </StorefrontLayout>
    </StorefrontProvider>
  );
};

export default PrivacyPolicyPage;
