import React from 'react';

// أيقونة المدير العام
export const SuperAdminIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" {...props}>
    <path 
      d="M12 2L15.09 8.26L22 9L17 14.74L18.18 22L12 18.27L5.82 22L7 14.74L2 9L8.91 8.26L12 2Z" 
      fill="currentColor" 
      opacity="0.8"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <path 
      d="M12 7V5M17 12H19M12 17V19M5 12H7" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
    />
  </svg>
);

// أيقونة مدير القسم
export const DepartmentManagerIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="3" y="6" width="18" height="12" rx="2" fill="currentColor" opacity="0.2" />
    <path 
      d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M8 6H16M8 6H6C4.89543 6 4 6.89543 4 8V16C4 17.1046 4.89543 18 6 18H18C19.1046 18 20 17.1046 20 16V8C20 6.89543 19.1046 6 18 6H16" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M9 15L15 9" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

// أيقونة موظف المبيعات
export const SalesEmployeeIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" {...props}>
    <path 
      d="M3 13C6.6 5 17.4 5 21 13" 
      stroke="currentColor" 
      strokeWidth="2" 
      fill="none"
    />
    <path 
      d="M8 13L12 17L16 13" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="12" cy="8" r="3" fill="currentColor" opacity="0.3" />
    <path 
      d="M12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5Z" 
      stroke="currentColor" 
      strokeWidth="1.5"
    />
  </svg>
);

// أيقونة موظف المستودع
export const WarehouseEmployeeIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" {...props}>
    <path 
      d="M3 9L12 2L21 9V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9Z" 
      fill="currentColor" 
      opacity="0.2"
    />
    <path 
      d="M3 9L12 2L21 9V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9Z" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <path 
      d="M9 12H15M9 16H15" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
    />
    <circle cx="7" cy="14" r="1" fill="currentColor" />
    <circle cx="17" cy="14" r="1" fill="currentColor" />
  </svg>
);

// أيقونة المحاسب
export const AccountantIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" opacity="0.1" />
    <path 
      d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <path 
      d="M8 8H16M8 12H16M8 16H12" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
    />
    <circle cx="6" cy="8" r="1" fill="currentColor" />
    <circle cx="6" cy="12" r="1" fill="currentColor" />
    <circle cx="6" cy="16" r="1" fill="currentColor" />
    <path 
      d="M16 14L18 16L16 18" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// أيقونة التليغرام المخصصة
export const TelegramIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" />
    <path 
      d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2Z" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <path 
      d="M16.6 7.4L9.4 10.6L7.4 16.6L14.6 13.4L16.6 7.4Z" 
      fill="currentColor" 
      opacity="0.8"
    />
    <path 
      d="M9.4 10.6L11.8 11.8L14.6 13.4" 
      stroke="white" 
      strokeWidth="1" 
      strokeLinecap="round"
    />
  </svg>
);

// أيقونة كود التليغرام
export const TelegramCodeIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="3" y="5" width="18" height="14" rx="3" fill="currentColor" opacity="0.1" />
    <path 
      d="M3 8C3 6.34315 4.34315 5 6 5H18C19.6569 5 21 6.34315 21 8V16C21 17.6569 19.6569 19 18 19H6C4.34315 19 3 17.6569 3 16V8Z" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <circle cx="8" cy="12" r="2" fill="currentColor" opacity="0.6" />
    <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.6" />
    <circle cx="16" cy="12" r="2" fill="currentColor" opacity="0.6" />
    <path 
      d="M6 15L9 12L6 9" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// أيقونة الصلاحيات
export const PermissionsIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" {...props}>
    <path 
      d="M12 2L15.09 5.26L20 6L17 11L18.18 16L12 13.27L5.82 16L7 11L2 6L8.91 5.26L12 2Z" 
      fill="currentColor" 
      opacity="0.2"
    />
    <path 
      d="M12 2L15.09 5.26L20 6L17 11L18.18 16L12 13.27L5.82 16L7 11L2 6L8.91 5.26L12 2Z" 
      stroke="currentColor" 
      strokeWidth="2"
    />
    <path 
      d="M9 11L11 13L15 9" 
      stroke="white" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// أيقونة إعدادات النظام
export const SystemSettingsIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
    <path 
      d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
    <path 
      d="M12 8V12L14.5 14.5" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// خريطة الأيقونات للأدوار
export const RoleIconMap = {
  super_admin: SuperAdminIcon,
  department_manager: DepartmentManagerIcon,
  sales_employee: SalesEmployeeIcon,
  warehouse_employee: WarehouseEmployeeIcon,
  accountant: AccountantIcon,
};

export default {
  SuperAdminIcon,
  DepartmentManagerIcon,
  SalesEmployeeIcon,
  WarehouseEmployeeIcon,
  AccountantIcon,
  TelegramIcon,
  TelegramCodeIcon,
  PermissionsIcon,
  SystemSettingsIcon,
  RoleIconMap,
};