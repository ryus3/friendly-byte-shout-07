import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

export const formatCurrency = (amount) => {
	return new Intl.NumberFormat('ar-IQ', {
		style: 'currency',
		currency: 'IQD',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount || 0).replace('IQD', 'د.ع');
};