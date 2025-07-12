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
import { CheckCircle, AlertTriangle, Info, Bell } from 'lucide-react';

const iconMap = {
  success: <CheckCircle className="h-5 w-5 text-green-400" />,
  destructive: <AlertTriangle className="h-5 w-5 text-red-400" />,
  info: <Info className="h-5 w-5 text-blue-400" />,
  default: <Bell className="h-5 w-5 text-primary" />,
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