import React from 'react';
import { useParams } from 'react-router-dom';
import { useStorefront } from '@/contexts/StorefrontContext';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, Send, Instagram, Facebook, Mail, Phone } from 'lucide-react';
import { formatWhatsAppLink } from '@/utils/phoneUtils';
import { Button } from '@/components/ui/button';

const ContactPage = () => {
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

  const businessName = settings?.profile?.business_page_name || settings?.business_name || 'متجرنا';
  const businessLinks = settings?.profile?.business_links || {};
  const socialMedia = settings?.profile?.social_media || {};

  const whatsappLink = businessLinks.whatsapp || socialMedia.whatsapp;
  const telegramLink = businessLinks.telegram || socialMedia.telegram;
  const instagramLink = businessLinks.instagram || socialMedia.instagram;
  const facebookLink = businessLinks.facebook || socialMedia.facebook;

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent text-center">
          تواصل معنا
        </h1>
        
        <p className="text-center text-lg text-muted-foreground mb-12">
          نحن هنا لمساعدتك! تواصل معنا عبر أي من القنوات التالية
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {whatsappLink && (
            <a 
              href={formatWhatsAppLink(whatsappLink)}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <div className="p-6 border border-border rounded-xl hover:border-green-500 transition-all hover:shadow-lg hover:shadow-green-500/10">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-green-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <MessageCircle className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">واتساب</h3>
                    <p className="text-sm text-muted-foreground">تواصل معنا عبر الواتساب</p>
                  </div>
                </div>
              </div>
            </a>
          )}

          {telegramLink && (
            <a 
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <div className="p-6 border border-border rounded-xl hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/10">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-blue-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <Send className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">تليغرام</h3>
                    <p className="text-sm text-muted-foreground">راسلنا عبر تليغرام</p>
                  </div>
                </div>
              </div>
            </a>
          )}

          {instagramLink && (
            <a 
              href={instagramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <div className="p-6 border border-border rounded-xl hover:border-pink-500 transition-all hover:shadow-lg hover:shadow-pink-500/10">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <Instagram className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">انستغرام</h3>
                    <p className="text-sm text-muted-foreground">تابعنا على انستغرام</p>
                  </div>
                </div>
              </div>
            </a>
          )}

          {facebookLink && (
            <a 
              href={facebookLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <div className="p-6 border border-border rounded-xl hover:border-blue-600 transition-all hover:shadow-lg hover:shadow-blue-600/10">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <Facebook className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">فيسبوك</h3>
                    <p className="text-sm text-muted-foreground">زوروا صفحتنا على فيسبوك</p>
                  </div>
                </div>
              </div>
            </a>
          )}
        </div>

        <div className="mt-12 p-8 bg-muted/30 rounded-xl text-center">
          <h3 className="text-2xl font-bold mb-4">{businessName}</h3>
          <p className="text-muted-foreground">
            نسعد بخدمتكم ونتطلع للتواصل معكم
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
