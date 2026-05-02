// أدوات تمرير لأعلى الصفحة — تغطي window و containers الداخلية (مثل main scroll في Layout).
// النمط العالمي: عند أي انتقال صفحة، يتمرر المحتوى لأعلاه فوراً (iOS/Material).

const scrollContainers = () => {
  if (typeof document === 'undefined') return;
  // أي عنصر معلَّم بـ data-scroll-container (نضعه على main في Layout)
  document.querySelectorAll('[data-scroll-container]').forEach((el) => {
    try { el.scrollTop = 0; el.scrollLeft = 0; } catch (_) {}
  });
  // <main> الافتراضي إن وُجد ولم يحمل علامة
  const mainEl = document.querySelector('main');
  if (mainEl) {
    try { mainEl.scrollTop = 0; mainEl.scrollLeft = 0; } catch (_) {}
  }
  // عناصر overflow-auto/scroll معروفة (احتياط)
  const scrollableSelectors = ['[data-page-scroll]', '.app-scroll', '#app-main-scroll'];
  scrollableSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      try { el.scrollTop = 0; el.scrollLeft = 0; } catch (_) {}
    });
  });
};

// تمرير سلس
export const scrollToTop = () => {
  if (typeof window === 'undefined') return;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  } catch (_) {
    window.scrollTo(0, 0);
  }
  scrollContainers();
};

// تمرير فوري (يُستخدم عند تغيير الـ route)
export const scrollToTopInstant = () => {
  if (typeof window === 'undefined') return;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch (_) {
    window.scrollTo(0, 0);
  }
  if (typeof document !== 'undefined') {
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }
  scrollContainers();
};
