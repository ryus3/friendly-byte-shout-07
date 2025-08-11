import { useEffect, useMemo, useState } from 'react';

// Hook موحد لفلترة فترة "أرباحي المستلمة" مع حفظ الخيار والربط بين الكارت والنافذة
export function useEmployeeReceivedPeriod() {
  const STORAGE_KEY = 'employeeReceivedProfitsPeriodFilter';

  // افتراضي: كل الفترات
  const [period, setPeriodState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'all';
  });

  // تحديث الحالة مع بث حدث مخصص للتزامن داخل نفس الصفحة
  const setPeriod = (value) => {
    setPeriodState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {}
    window.dispatchEvent(new CustomEvent('employeeReceivedPeriodChange', { detail: { period: value } }));
  };

  // الاستماع لأي تغييرات من مكونات أخرى أو تبويب آخر
  useEffect(() => {
    const handleCustom = (e) => {
      if (e?.detail?.period) setPeriodState(e.detail.period);
    };
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) setPeriodState(e.newValue);
    };
    window.addEventListener('employeeReceivedPeriodChange', handleCustom);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('employeeReceivedPeriodChange', handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // حساب نطاق التاريخ حسب الفترة
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'day':
        return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0), to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) };
      case 'week': {
        const day = now.getDay();
        // اعتبار السبت بداية الأسبوع (6)
        const diffToSat = (day === 6 ? 0 : (day + 1));
        const from = new Date(now);
        from.setDate(now.getDate() - diffToSat);
        from.setHours(0, 0, 0, 0);
        const to = new Date(from);
        to.setDate(from.getDate() + 6);
        to.setHours(23, 59, 59, 999);
        return { from, to };
      }
      case 'month': {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { from, to };
      }
      case 'year': {
        const from = new Date(now.getFullYear(), 0, 1);
        const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { from, to };
      }
      case 'all':
      default:
        return { from: new Date('2020-01-01'), to: new Date('2030-12-31') };
    }
  }, [period]);

  // خريطة التسميات العربية للاستخدام في الكروت
  const periodLabels = {
    day: 'يوم',
    week: 'أسبوع',
    month: 'شهر',
    year: 'سنة',
    all: 'الكل',
  };

  return { period, setPeriod, dateRange, periodLabels };
}
