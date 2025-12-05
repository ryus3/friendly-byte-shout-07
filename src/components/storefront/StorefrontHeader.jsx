import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingCart, Search, Menu, Phone } from 'lucide-react';
import { useStorefront } from '@/contexts/StorefrontContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  extractSocialLinks, 
  formatWhatsAppUrl, 
  formatInstagramUrl, 
  formatFacebookUrl, 
  formatTelegramUrl 
} from '@/utils/extractSocialLinks';

// أيقونات التواصل الاجتماعي
const SocialIcon = ({ type, className = "h-5 w-5" }) => {
  switch (type) {
    case 'whatsapp':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      );
    case 'facebook':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    case 'telegram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      );
    default:
      return null;
  }
};

const StorefrontHeader = () => {
  const { settings, itemCount, updateFilters } = useStorefront();
  const { slug: urlSlug } = useParams();
  
  const slug = settings?.slug || urlSlug;
  const profile = settings?.profile;
  
  // استخراج روابط التواصل من business_links array و social_media
  const socialLinks = extractSocialLinks(
    profile?.business_links,
    profile?.social_media
  );

  if (!settings) return null;

  const hasSocialLinks = socialLinks.whatsapp || socialLinks.phone || socialLinks.instagram;

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      {/* شريط التواصل السريع */}
      {hasSocialLinks && (
        <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-1.5 px-4">
          <div className="container mx-auto flex items-center justify-center gap-4 text-sm">
            {socialLinks.whatsapp && (
              <a 
                href={formatWhatsAppUrl(socialLinks.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <SocialIcon type="whatsapp" className="h-4 w-4" />
                <span className="hidden sm:inline">واتساب</span>
              </a>
            )}
            {socialLinks.phone && (
              <a 
                href={`tel:${socialLinks.phone}`}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">{socialLinks.phone}</span>
              </a>
            )}
            {socialLinks.instagram && (
              <a 
                href={formatInstagramUrl(socialLinks.instagram)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <SocialIcon type="instagram" className="h-4 w-4" />
                <span className="hidden sm:inline">إنستغرام</span>
              </a>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to={`/storefront/${slug}`} className="flex items-center gap-3">
            {settings.logo_url && (
              <img 
                src={settings.logo_url} 
                alt={settings.business_name}
                className="h-10 w-10 object-contain rounded-lg"
              />
            )}
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-bold text-foreground">
                {settings.business_name || profile?.business_page_name || 'متجرنا'}
              </span>
              {settings.tagline && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {settings.tagline}
                </span>
              )}
            </div>
          </Link>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="ابحث عن المنتجات..."
                className="pr-10 border-2 focus:border-primary"
                onChange={(e) => updateFilters?.({ search: e.target.value })}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Social Links - Desktop */}
            <div className="hidden lg:flex items-center gap-2">
              {socialLinks.whatsapp && (
                <a 
                  href={formatWhatsAppUrl(socialLinks.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 transition-colors"
                >
                  <SocialIcon type="whatsapp" className="h-5 w-5" />
                </a>
              )}
              {socialLinks.instagram && (
                <a 
                  href={formatInstagramUrl(socialLinks.instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full hover:bg-pink-100 dark:hover:bg-pink-900/30 text-pink-600 transition-colors"
                >
                  <SocialIcon type="instagram" className="h-5 w-5" />
                </a>
              )}
              {socialLinks.facebook && (
                <a 
                  href={formatFacebookUrl(socialLinks.facebook)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 transition-colors"
                >
                  <SocialIcon type="facebook" className="h-5 w-5" />
                </a>
              )}
              {socialLinks.telegram && (
                <a 
                  href={formatTelegramUrl(socialLinks.telegram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full hover:bg-sky-100 dark:hover:bg-sky-900/30 text-sky-600 transition-colors"
                >
                  <SocialIcon type="telegram" className="h-5 w-5" />
                </a>
              )}
            </div>

            {/* Cart */}
            <Link to={`/storefront/${slug}/cart`}>
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col gap-4 mt-8">
                  {/* Store Info */}
                  <div className="text-center pb-4 border-b">
                    {settings.logo_url && (
                      <img 
                        src={settings.logo_url} 
                        alt={settings.business_name}
                        className="h-16 w-16 object-contain mx-auto mb-2 rounded-xl"
                      />
                    )}
                    <h3 className="font-bold text-lg">{settings.business_name || profile?.business_page_name}</h3>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="ابحث..."
                      className="pr-10"
                      onChange={(e) => updateFilters?.({ search: e.target.value })}
                    />
                  </div>

                  {/* Navigation */}
                  <nav className="flex flex-col gap-2">
                    <Link to={`/storefront/${slug}`}>
                      <Button variant="ghost" className="w-full justify-start">
                        الرئيسية
                      </Button>
                    </Link>
                    <Link to={`/storefront/${slug}/products`}>
                      <Button variant="ghost" className="w-full justify-start">
                        المنتجات
                      </Button>
                    </Link>
                    <Link to={`/storefront/${slug}/about`}>
                      <Button variant="ghost" className="w-full justify-start">
                        من نحن
                      </Button>
                    </Link>
                    <Link to={`/storefront/${slug}/contact`}>
                      <Button variant="ghost" className="w-full justify-start">
                        اتصل بنا
                      </Button>
                    </Link>
                  </nav>

                  {/* Social Links */}
                  {(socialLinks.whatsapp || socialLinks.instagram || socialLinks.facebook || socialLinks.telegram) && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-3">تواصل معنا</p>
                      <div className="flex items-center justify-center gap-3">
                        {socialLinks.whatsapp && (
                          <a 
                            href={formatWhatsAppUrl(socialLinks.whatsapp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600"
                          >
                            <SocialIcon type="whatsapp" />
                          </a>
                        )}
                        {socialLinks.instagram && (
                          <a 
                            href={formatInstagramUrl(socialLinks.instagram)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600"
                          >
                            <SocialIcon type="instagram" />
                          </a>
                        )}
                        {socialLinks.facebook && (
                          <a 
                            href={formatFacebookUrl(socialLinks.facebook)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                          >
                            <SocialIcon type="facebook" />
                          </a>
                        )}
                        {socialLinks.telegram && (
                          <a 
                            href={formatTelegramUrl(socialLinks.telegram)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-600"
                          >
                            <SocialIcon type="telegram" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Navigation - Desktop */}
        <nav className="hidden md:flex items-center gap-6 py-3 border-t border-border">
          <Link to={`/storefront/${slug}`}>
            <Button variant="ghost">الرئيسية</Button>
          </Link>
          <Link to={`/storefront/${slug}/products`}>
            <Button variant="ghost">جميع المنتجات</Button>
          </Link>
          <Link to={`/storefront/${slug}/about`}>
            <Button variant="ghost">من نحن</Button>
          </Link>
          <Link to={`/storefront/${slug}/contact`}>
            <Button variant="ghost">اتصل بنا</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default StorefrontHeader;
