import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Search, Menu } from 'lucide-react';
import { useStorefront } from '@/contexts/StorefrontContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const StorefrontHeader = () => {
  const { settings, itemCount, updateFilters } = useStorefront();

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to={`/storefront/${settings.storefront_slug}`} className="flex items-center gap-3">
            {settings.logo_url && (
              <img 
                src={settings.logo_url} 
                alt={settings.business_name}
                className="h-10 w-10 object-contain"
              />
            )}
            <span className="text-xl font-bold text-foreground">
              {settings.business_name || settings.profiles?.business_page_name}
            </span>
          </Link>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="ابحث عن المنتجات..."
                className="pr-10"
                onChange={(e) => updateFilters({ search: e.target.value })}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* Cart */}
            <Link to={`/storefront/${settings.storefront_slug}/cart`}>
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
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
                <nav className="flex flex-col gap-4 mt-8">
                  <Link to={`/storefront/${settings.storefront_slug}`}>
                    <Button variant="ghost" className="w-full justify-start">
                      الرئيسية
                    </Button>
                  </Link>
                  <Link to={`/storefront/${settings.storefront_slug}/products`}>
                    <Button variant="ghost" className="w-full justify-start">
                      المنتجات
                    </Button>
                  </Link>
                  <div className="mt-4">
                    <Input
                      type="search"
                      placeholder="ابحث..."
                      onChange={(e) => updateFilters({ search: e.target.value })}
                    />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Navigation - Desktop */}
        <nav className="hidden md:flex items-center gap-6 py-3 border-t border-border">
          <Link to={`/storefront/${settings.storefront_slug}`}>
            <Button variant="ghost">الرئيسية</Button>
          </Link>
          <Link to={`/storefront/${settings.storefront_slug}/products`}>
            <Button variant="ghost">جميع المنتجات</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default StorefrontHeader;
