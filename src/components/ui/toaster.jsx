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

// أيقونات SVG احترافية
const SuccessIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" className="fill-green-100 stroke-green-500" strokeWidth="1.5"/>
    <path d="M8 12l3 3 5-5" className="stroke-green-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WarningIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 22h20L12 2z" className="fill-yellow-100 stroke-yellow-500" strokeWidth="1.5"/>
    <path d="M12 8v4" className="stroke-yellow-600" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="16" r="1" className="fill-yellow-600"/>
  </svg>
);

const ErrorIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" className="fill-red-100 stroke-red-500" strokeWidth="1.5"/>
    <path d="M15 9l-6 6M9 9l6 6" className="stroke-red-600" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const InfoIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" className="fill-blue-100 stroke-blue-500" strokeWidth="1.5"/>
    <path d="M12 8v8" className="stroke-blue-600" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="8" r="1" className="fill-blue-600"/>
  </svg>
);

const StockIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="16" rx="2" className="fill-orange-100 stroke-orange-500" strokeWidth="1.5"/>
    <path d="M8 10v4M12 8v6M16 12v2" className="stroke-orange-600" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="19" cy="5" r="2" className="fill-red-500"/>
  </svg>
);

const OrderIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" className="fill-purple-100 stroke-purple-500" strokeWidth="1.5"/>
    <path d="M9 12l2 2 4-4" className="stroke-purple-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const NotificationIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" className="fill-gray-100 stroke-gray-500" strokeWidth="1.5"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" className="stroke-gray-500" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const iconMap = {
  success: <SuccessIcon />,
  destructive: <ErrorIcon />,
  warning: <WarningIcon />,
  info: <InfoIcon />,
  stock: <StockIcon />,
  order: <OrderIcon />,
  default: <NotificationIcon />,
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