import React from 'react';
import { useStorefront } from '@/contexts/StorefrontContext';
import { Facebook, Instagram, MessageCircle } from 'lucide-react';

const StorefrontFooter = () => {
  const { settings } = useStorefront();
  
  const socialMedia = settings?.profiles?.social_media || {};
  const businessLinks = settings?.profiles?.business_links || {};

  return (
    <footer className="bg-muted border-t border-border mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* معلومات المتجر */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4">
              {settings?.business_name || settings?.profiles?.business_page_name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {settings?.meta_description || 'متجر إلكتروني متخصص في بيع المنتجات عالية الجودة'}
            </p>
          </div>

          {/* روابط سريعة */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4">روابط سريعة</h3>
            <ul className="space-y-2">
              <li>
                <a href={`/storefront/${settings?.storefront_slug}`} className="text-sm text-muted-foreground hover:text-foreground">
                  الرئيسية
                </a>
              </li>
              <li>
                <a href={`/storefront/${settings?.storefront_slug}/products`} className="text-sm text-muted-foreground hover:text-foreground">
                  المنتجات
                </a>
              </li>
            </ul>
          </div>

          {/* التواصل الاجتماعي */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4">تواصل معنا</h3>
            <div className="flex gap-4">
              {socialMedia.whatsapp && (
                <a 
                  href={socialMedia.whatsapp} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <MessageCircle className="h-6 w-6" />
                </a>
              )}
              {socialMedia.instagram && (
                <a 
                  href={socialMedia.instagram} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Instagram className="h-6 w-6" />
                </a>
              )}
              {socialMedia.facebook && (
                <a 
                  href={socialMedia.facebook} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Facebook className="h-6 w-6" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {settings?.business_name || settings?.profiles?.business_page_name}. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
