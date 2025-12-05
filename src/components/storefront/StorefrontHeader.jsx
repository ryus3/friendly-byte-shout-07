import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingCart, Search, Menu, Heart, Camera, User, Home, X } from 'lucide-react';
import { useStorefront } from '@/contexts/StorefrontContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  extractSocialLinks, 
  formatWhatsAppUrl, 
  formatInstagramUrl 
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
    default:
      return null;
  }
};

// الفئات الافتراضية
const defaultCategories = [
  { id: 'home', name: 'الرئيسية', icon: Home },
  { id: 'men', name: 'رجال', emoji: '👔' },
  { id: 'women', name: 'نساء', emoji: '👗' },
  { id: 'kids', name: 'أطفال', emoji: '🧸' },
  { id: 'sports', name: 'رياضة', emoji: '⚽' },
  { id: 'accessories', name: 'إكسسوارات', emoji: '👜' },
  { id: 'shoes', name: 'أحذية', emoji: '👟' },
  { id: 'all', name: 'الكل', emoji: '🛍️' },
];

const StorefrontHeader = () => {
  const { settings, itemCount, updateFilters } = useStorefront();
  const { slug: urlSlug } = useParams();
  const [searchOpen, setSearchOpen] = useState(false);
  
  const slug = settings?.slug || urlSlug;
  const profile = settings?.profile;
  
  // استخراج روابط التواصل
  const socialLinks = extractSocialLinks(
    profile?.business_links,
    profile?.social_media
  );

  // اسم المتجر الحقيقي
  const storeName = settings?.meta_title || profile?.business_page_name || settings?.business_name || 'متجرنا';

  if (!settings) return null;

  return (
    <header className="sticky top-0 z-50 bg-background shadow-sm">
      {/* شريط العروض العلوي */}
      <div className="bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 text-white py-1.5 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-8">
          <span className="flex items-center gap-2 text-sm font-medium">
            🔥 خصم 50% على جميع المنتجات
          </span>
          <span className="flex items-center gap-2 text-sm font-medium">
            🚚 شحن مجاني للطلبات فوق 50,000 د.ع
          </span>
          <span className="flex items-center gap-2 text-sm font-medium">
            ⭐ منتجات أصلية 100%
          </span>
          <span className="flex items-center gap-2 text-sm font-medium">
            🔥 خصم 50% على جميع المنتجات
          </span>
          <span className="flex items-center gap-2 text-sm font-medium">
            🚚 شحن مجاني للطلبات فوق 50,000 د.ع
          </span>
        </div>
      </div>

      {/* الهيدر الرئيسي */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Logo و اسم المتجر */}
          <Link to={`/storefront/${slug}`} className="flex items-center gap-2 shrink-0">
            {settings.logo_url ? (
              <img 
                src={settings.logo_url} 
                alt={storeName}
                className="h-8 w-8 object-contain rounded-lg"
              />
            ) : (
              <div className="h-8 w-8 bg-gradient-to-br from-pink-500 to-orange-500 rounded-lg flex items-center justify-center text-white font-black text-lg">
                {storeName.charAt(0)}
              </div>
            )}
            <span className="text-lg font-black bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent hidden sm:block">
              {storeName}
            </span>
          </Link>

          {/* شريط البحث - Desktop */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <div className="relative w-full">
              <Input
                type="search"
                placeholder="ابحث عن المنتجات..."
                className="w-full pr-10 pl-12 h-10 rounded-full border-2 border-muted bg-muted/50 focus:border-pink-500 focus:bg-background transition-all"
                onChange={(e) => updateFilters?.({ search: e.target.value })}
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <button className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* الأزرار */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* بحث للموبايل */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>

            {/* المفضلة */}
            <Button variant="ghost" size="icon" className="relative">
              <Heart className="h-5 w-5" />
            </Button>

            {/* السلة */}
            <Link to={`/storefront/${slug}/cart`}>
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* حسابي */}
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <User className="h-5 w-5" />
            </Button>

            {/* القائمة الجانبية */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0">
                <div className="flex flex-col h-full">
                  {/* معلومات المتجر */}
                  <div className="bg-gradient-to-br from-pink-500 to-orange-500 p-6 text-white">
                    <div className="flex items-center gap-3">
                      {settings.logo_url ? (
                        <img 
                          src={settings.logo_url} 
                          alt={storeName}
                          className="h-14 w-14 object-contain rounded-xl bg-white/20 p-1"
                        />
                      ) : (
                        <div className="h-14 w-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl font-black">
                          {storeName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-black text-lg">{storeName}</h3>
                        {settings.tagline && (
                          <p className="text-sm text-white/80">{settings.tagline}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* التنقل */}
                  <nav className="flex-1 p-4 space-y-1">
                    <Link to={`/storefront/${slug}`}>
                      <Button variant="ghost" className="w-full justify-start gap-3 h-12">
                        <Home className="h-5 w-5" />
                        الرئيسية
                      </Button>
                    </Link>
                    <Link to={`/storefront/${slug}/products`}>
                      <Button variant="ghost" className="w-full justify-start gap-3 h-12">
                        <span className="text-lg">🛍️</span>
                        جميع المنتجات
                      </Button>
                    </Link>
                    <Link to={`/storefront/${slug}/products?category=رجال`}>
                      <Button variant="ghost" className="w-full justify-start gap-3 h-12">
                        <span className="text-lg">👔</span>
                        رجال
                      </Button>
                    </Link>
                    <Link to={`/storefront/${slug}/products?category=نساء`}>
                      <Button variant="ghost" className="w-full justify-start gap-3 h-12">
                        <span className="text-lg">👗</span>
                        نساء
                      </Button>
                    </Link>
                    <Link to={`/storefront/${slug}/products?category=أطفال`}>
                      <Button variant="ghost" className="w-full justify-start gap-3 h-12">
                        <span className="text-lg">🧸</span>
                        أطفال
                      </Button>
                    </Link>
                  </nav>

                  {/* روابط التواصل */}
                  {(socialLinks.whatsapp || socialLinks.instagram) && (
                    <div className="border-t p-4">
                      <p className="text-sm text-muted-foreground mb-3">تواصل معنا</p>
                      <div className="flex items-center gap-3">
                        {socialLinks.whatsapp && (
                          <a 
                            href={formatWhatsAppUrl(socialLinks.whatsapp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 transition-colors"
                          >
                            <SocialIcon type="whatsapp" />
                            <span className="font-medium">واتساب</span>
                          </a>
                        )}
                        {socialLinks.instagram && (
                          <a 
                            href={formatInstagramUrl(socialLinks.instagram)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-pink-100 dark:bg-pink-900/30 text-pink-600 hover:bg-pink-200 transition-colors"
                          >
                            <SocialIcon type="instagram" />
                            <span className="font-medium">إنستغرام</span>
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

        {/* شريط البحث للموبايل */}
        {searchOpen && (
          <div className="md:hidden pb-3">
            <div className="relative">
              <Input
                type="search"
                placeholder="ابحث عن المنتجات..."
                className="w-full pr-10 pl-12 h-10 rounded-full border-2 border-muted bg-muted/50 focus:border-pink-500"
                onChange={(e) => updateFilters?.({ search: e.target.value })}
                autoFocus
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <button className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center text-white">
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* شريط الفئات */}
      <div className="border-t bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">
            {defaultCategories.map((cat) => (
              <Link
                key={cat.id}
                to={cat.id === 'home' ? `/storefront/${slug}` : cat.id === 'all' ? `/storefront/${slug}/products` : `/storefront/${slug}/products?category=${cat.name}`}
                className="shrink-0"
              >
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-3 rounded-full text-sm font-medium hover:bg-pink-100 hover:text-pink-600 dark:hover:bg-pink-900/30 transition-colors"
                >
                  {cat.icon ? (
                    <cat.icon className="h-4 w-4 ml-1" />
                  ) : (
                    <span className="ml-1">{cat.emoji}</span>
                  )}
                  {cat.name}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* CSS للتمرير */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </header>
  );
};

export default StorefrontHeader;
