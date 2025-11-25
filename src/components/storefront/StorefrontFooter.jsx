import React from 'react';
import { Link } from 'react-router-dom';
import { useStorefront } from '@/contexts/StorefrontContext';
import { Facebook, Instagram, MessageCircle, Send } from 'lucide-react';
import { formatWhatsAppLink } from '@/utils/phoneUtils';

const StorefrontFooter = () => {
  const { settings } = useStorefront();
  
  if (!settings) return null;

  const slug = settings.slug;
  const businessName = settings.profile?.business_page_name || settings.business_name || 'متجرنا';
  const businessLinks = settings.profile?.business_links || {};
  const socialMedia = settings.profile?.social_media || {};

  // استخراج روابط التواصل
  const whatsappLink = businessLinks.whatsapp || socialMedia.whatsapp;
  const telegramLink = businessLinks.telegram || socialMedia.telegram;
  const instagramLink = businessLinks.instagram || socialMedia.instagram;
  const facebookLink = businessLinks.facebook || socialMedia.facebook;

  return (
    <footer className="bg-muted/50 border-t border-border mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* معلومات المتجر */}
          <div className="col-span-1">
            <h3 className="text-lg font-bold mb-4">{businessName}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {settings.meta_description || 'متجر إلكتروني متخصص في توفير أفضل المنتجات عالية الجودة'}
            </p>
          </div>

          {/* روابط سريعة */}
          <div className="col-span-1">
            <h4 className="font-semibold mb-4">روابط سريعة</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to={`/storefront/${slug}`} className="text-muted-foreground hover:text-foreground transition-colors">
                  الرئيسية
                </Link>
              </li>
              <li>
                <Link to={`/storefront/${slug}/products`} className="text-muted-foreground hover:text-foreground transition-colors">
                  جميع المنتجات
                </Link>
              </li>
              <li>
                <Link to={`/storefront/${slug}/about`} className="text-muted-foreground hover:text-foreground transition-colors">
                  من نحن
                </Link>
              </li>
              <li>
                <Link to={`/storefront/${slug}/contact`} className="text-muted-foreground hover:text-foreground transition-colors">
                  اتصل بنا
                </Link>
              </li>
            </ul>
          </div>

          {/* سياسات المتجر */}
          <div className="col-span-1">
            <h4 className="font-semibold mb-4">سياسات المتجر</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to={`/storefront/${slug}/privacy`} className="text-muted-foreground hover:text-foreground transition-colors">
                  سياسة الخصوصية
                </Link>
              </li>
              <li>
                <Link to={`/storefront/${slug}/terms`} className="text-muted-foreground hover:text-foreground transition-colors">
                  الشروط والأحكام
                </Link>
              </li>
              <li>
                <Link to={`/storefront/${slug}/return-policy`} className="text-muted-foreground hover:text-foreground transition-colors">
                  سياسة الاسترجاع
                </Link>
              </li>
            </ul>
          </div>

          {/* تواصل معنا */}
          <div className="col-span-1">
            <h4 className="font-semibold mb-4">تواصل معنا</h4>
            <div className="flex gap-3">
              {whatsappLink && (
                <a 
                  href={formatWhatsAppLink(whatsappLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-full bg-green-600 hover:bg-green-700 transition-colors flex items-center justify-center text-white"
                  title="واتساب"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              )}
              {telegramLink && (
                <a 
                  href={telegramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors flex items-center justify-center text-white"
                  title="تليغرام"
                >
                  <Send className="h-5 w-5" />
                </a>
              )}
              {instagramLink && (
                <a 
                  href={instagramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-colors flex items-center justify-center text-white"
                  title="انستغرام"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {facebookLink && (
                <a 
                  href={facebookLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center text-white"
                  title="فيسبوك"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {businessName}. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
