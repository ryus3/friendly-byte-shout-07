import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Aurora = () => (
  <>
    <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] max-w-[600px] h-[400px] bg-fuchsia-500/20 rounded-full blur-[100px]" />
    <div className="pointer-events-none absolute bottom-0 right-0 w-[50vw] max-w-[500px] h-[400px] bg-blue-500/20 rounded-full blur-[100px]" />
    <div className="pointer-events-none absolute top-1/3 left-0 w-[40vw] max-w-[400px] h-[300px] bg-purple-500/15 rounded-full blur-[100px]" />
  </>
);

/**
 * هيكل صفحة موحّد لجميع صفحات إعدادات المتجر — تصميم زجاجي عالمي
 */
const StorefrontPageShell = ({ title, subtitle, icon: Icon, accent = 'from-fuchsia-500 to-purple-600', children, headerExtra }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen relative overflow-x-clip bg-slate-950 w-full max-w-[100vw]" dir="rtl">
      <Aurora />
      <div className="relative z-10 p-3 sm:p-6 md:p-8 space-y-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/storefront')}
              className="text-white/70 hover:text-white hover:bg-white/10 shrink-0"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
            {Icon && (
              <div className="relative shrink-0">
                <div className={`absolute inset-0 bg-gradient-to-r ${accent} blur-2xl opacity-40`} />
                <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-2xl`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black bg-gradient-to-br from-white via-fuchsia-200 to-blue-200 bg-clip-text text-transparent leading-tight truncate">
                {title}
              </h1>
              {subtitle && <p className="text-xs sm:text-sm text-white/60 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {headerExtra}
        </div>

        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
};

export const GlassCard = ({ children, className = '' }) => (
  <div className={`backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl ${className}`}>
    {children}
  </div>
);

export default StorefrontPageShell;
