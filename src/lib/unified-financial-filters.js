/**
 * 📅 نظام الفلاتر الزمنية الموحد
 * فلاتر موحدة لجميع الصفحات المالية
 */

import { startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays, startOfDay, endOfDay } from 'date-fns';

// الفترات الزمنية المتاحة
export const TIME_PERIODS = {
  TODAY: 'today',
  WEEK: 'week', 
  MONTH: 'month',
  YEAR: 'year',
  ALL: 'all'
};

// تسميات الفترات بالعربية
export const TIME_PERIOD_LABELS = {
  [TIME_PERIODS.TODAY]: 'اليوم',
  [TIME_PERIODS.WEEK]: 'هذا الأسبوع',
  [TIME_PERIODS.MONTH]: 'هذا الشهر',
  [TIME_PERIODS.YEAR]: 'هذا العام',
  [TIME_PERIODS.ALL]: 'كل الفترات'
};

/**
 * حساب نطاق التاريخ بناءً على الفترة المحددة
 */
export const calculateDateRange = (timePeriod) => {
  const now = new Date();
  
  switch (timePeriod) {
    case TIME_PERIODS.TODAY:
      return {
        from: startOfDay(now),
        to: endOfDay(now),
        label: TIME_PERIOD_LABELS[TIME_PERIODS.TODAY]
      };
      
    case TIME_PERIODS.WEEK:
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }), // البداية من الإثنين
        to: now,
        label: TIME_PERIOD_LABELS[TIME_PERIODS.WEEK]
      };
      
    case TIME_PERIODS.MONTH:
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
        label: TIME_PERIOD_LABELS[TIME_PERIODS.MONTH]
      };
      
    case TIME_PERIODS.YEAR:
      return {
        from: startOfYear(now),
        to: now,
        label: TIME_PERIOD_LABELS[TIME_PERIODS.YEAR]
      };
      
    case TIME_PERIODS.ALL:
    default:
      return {
        from: null,
        to: null,
        label: TIME_PERIOD_LABELS[TIME_PERIODS.ALL]
      };
  }
};

/**
 * فلترة البيانات حسب النطاق الزمني
 */
export const filterDataByDateRange = (data, dateRange, dateField = 'created_at') => {
  if (!dateRange || !dateRange.from || !dateRange.to || !Array.isArray(data)) {
    return data;
  }

  return data.filter(item => {
    const itemDate = new Date(item[dateField] || item.created_at);
    return itemDate >= dateRange.from && itemDate <= dateRange.to;
  });
};

/**
 * فحص ما إذا كانت الفترة نشطة (بها بيانات)
 */
export const isPeriodActive = (data, timePeriod, dateField = 'created_at') => {
  const dateRange = calculateDateRange(timePeriod);
  const filteredData = filterDataByDateRange(data, dateRange, dateField);
  return filteredData.length > 0;
};

/**
 * الحصول على إحصائيات الفترة
 */
export const getPeriodStats = (data, timePeriod, dateField = 'created_at') => {
  const dateRange = calculateDateRange(timePeriod);
  const filteredData = filterDataByDateRange(data, dateRange, dateField);
  
  return {
    count: filteredData.length,
    hasData: filteredData.length > 0,
    dateRange,
    period: timePeriod,
    label: TIME_PERIOD_LABELS[timePeriod]
  };
};