import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

// دالة تنسيق العملة العراقية
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 د.ع';
  
  const number = Number(amount);
  if (isNaN(number)) return '0 د.ع';
  
  return new Intl.NumberFormat('ar-IQ', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number) + ' د.ع';
}