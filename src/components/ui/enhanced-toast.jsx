import React from 'react';
import { cn } from '@/lib/utils';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Bell,
  Zap,
  Heart,
  Star,
  Gift,
  Trophy
} from 'lucide-react';

export const EnhancedToast = ({ 
  title, 
  description, 
  variant = 'default',
  icon: CustomIcon,
  className,
  ...props 
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          className: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800',
          icon: CheckCircle,
          iconColor: 'text-green-600 dark:text-green-400'
        };
      case 'error':
      case 'destructive':
        return {
          className: 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800',
          icon: XCircle,
          iconColor: 'text-red-600 dark:text-red-400'
        };
      case 'warning':
        return {
          className: 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200 dark:border-yellow-800',
          icon: AlertTriangle,
          iconColor: 'text-yellow-600 dark:text-yellow-400'
        };
      case 'info':
        return {
          className: 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800',
          icon: Info,
          iconColor: 'text-blue-600 dark:text-blue-400'
        };
      case 'premium':
        return {
          className: 'bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-800',
          icon: Star,
          iconColor: 'text-purple-600 dark:text-purple-400'
        };
      case 'celebration':
        return {
          className: 'bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border-pink-200 dark:border-pink-800',
          icon: Trophy,
          iconColor: 'text-pink-600 dark:text-pink-400'
        };
      default:
        return {
          className: 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-800',
          icon: Bell,
          iconColor: 'text-gray-600 dark:text-gray-400'
        };
    }
  };

  const variantConfig = getVariantStyles();
  const IconComponent = CustomIcon || variantConfig.icon;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-4 shadow-lg backdrop-blur-sm',
        'animate-in slide-in-from-top-full duration-300',
        variantConfig.className,
        className
      )}
      {...props}
    >
      {/* Background animation */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 animate-pulse" />
      
      <div className="flex items-start gap-3">
        {IconComponent && (
          <div className={cn('mt-0.5', variantConfig.iconColor)}>
            <IconComponent className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 space-y-1">
          {title && (
            <div className="font-semibold text-sm text-foreground">
              {title}
            </div>
          )}
          {description && (
            <div className="text-sm text-muted-foreground opacity-90">
              {description}
            </div>
          )}
        </div>
      </div>
      
      {/* Accent line */}
      <div className={cn(
        'absolute bottom-0 left-0 h-1 w-full rounded-b-xl',
        variant === 'success' && 'bg-gradient-to-r from-green-500 to-emerald-500',
        variant === 'error' && 'bg-gradient-to-r from-red-500 to-rose-500',
        variant === 'warning' && 'bg-gradient-to-r from-yellow-500 to-orange-500',
        variant === 'info' && 'bg-gradient-to-r from-blue-500 to-cyan-500',
        variant === 'premium' && 'bg-gradient-to-r from-purple-500 to-violet-500',
        variant === 'celebration' && 'bg-gradient-to-r from-pink-500 to-rose-500',
        variant === 'default' && 'bg-gradient-to-r from-gray-500 to-slate-500'
      )} />
    </div>
  );
};

export default EnhancedToast;