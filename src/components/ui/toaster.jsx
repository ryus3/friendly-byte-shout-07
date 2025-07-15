import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from '@/components/ui/toast.jsx';
import { useToast } from '@/components/ui/use-toast.js';
import React from 'react';

// أيقونات احترافية مخصصة مع ألوان التطبيق
const StockWarningIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="16" rx="2" className="fill-orange-50 stroke-orange-500" strokeWidth="1.5"/>
    <path d="M8 10v4M12 8v6M16 12v2" className="stroke-orange-600" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="19" cy="5" r="2" className="fill-red-500"/>
    <path d="M18 4l2 2M20 4l-2 2" className="stroke-white" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const OrderSuccessIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" className="fill-green-50 stroke-green-500" strokeWidth="1.5"/>
    <path d="M9 12l2 2 4-4" className="stroke-green-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="4" className="fill-green-100"/>
  </svg>
);

const UserRegistrationIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3" className="fill-purple-50 stroke-purple-500" strokeWidth="1.5"/>
    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" className="fill-purple-50 stroke-purple-500" strokeWidth="1.5"/>
    <circle cx="18" cy="6" r="3" className="fill-blue-500"/>
    <path d="M17 5l2 2M19 5l-2 2" className="stroke-white" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const OrderPendingIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" className="fill-blue-50 stroke-blue-500" strokeWidth="1.5"/>
    <circle cx="9" cy="9" r="2" className="fill-blue-200"/>
    <path d="m21 15-3-3H12l-1 3" className="stroke-blue-600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="16" cy="19" r="2" className="fill-blue-600"/>
    <circle cx="7" cy="19" r="2" className="fill-blue-600"/>
  </svg>
);

const SystemNotificationIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" className="fill-primary/10 stroke-primary" strokeWidth="1.5"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" className="stroke-primary" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="18" cy="6" r="3" className="fill-primary"/>
    <path d="M17 6h2M18 5v2" className="stroke-white" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const ProfitIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" className="fill-yellow-100 stroke-yellow-500" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="3" className="fill-yellow-300"/>
    <path d="M10 12h4M12 10v4" className="stroke-yellow-700" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const iconMap = {
  success: <OrderSuccessIcon />,
  destructive: <StockWarningIcon />,
  warning: <StockWarningIcon />,
  info: <SystemNotificationIcon />,
  stock: <StockWarningIcon />,
  order: <OrderPendingIcon />,
  user: <UserRegistrationIcon />,
  profit: <ProfitIcon />,
  default: <SystemNotificationIcon />,
};

export function Toaster() {
	const { toasts } = useToast();

	return (
		<ToastProvider>
			{toasts.map(({ id, title, description, action, variant, ...props }) => {
				const Icon = iconMap[variant] || iconMap.default;
				return (
					<Toast key={id} variant={variant} {...props}>
						<div className="flex items-start gap-3">
              <div className="mt-0.5">{Icon}</div>
  						<div className="grid gap-1">
  							{title && <ToastTitle>{title}</ToastTitle>}
  							{description && (
  								<ToastDescription>{description}</ToastDescription>
  							)}
  						</div>
            </div>
						{action}
						<ToastClose />
					</Toast>
				);
			})}
			<ToastViewport />
		</ToastProvider>
	);
}