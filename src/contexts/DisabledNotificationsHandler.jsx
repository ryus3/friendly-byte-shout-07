/**
 * معطل - تم دمجه في النظام الموحد للإشعارات
 * هذا الملف معطل لتجنب الإشعارات المكررة
 * يتم الاعتماد فقط على triggers قاعدة البيانات للحصول على إشعارات دقيقة
 */

import React from 'react';

const NotificationsHandler = () => {
  // معطل - لا نحتاج إلى معالج frontend للإشعارات
  // جميع الإشعارات تأتي من قاعدة البيانات عبر triggers
  return null;
};

export default NotificationsHandler;