/**
 * Storefront Themes Registry
 * 8 professional glassmorphism themes for employee storefronts.
 * Each theme id MUST match the DB CHECK constraint on employee_storefront_settings.theme_name.
 */

export const STOREFRONT_THEMES = [
  {
    id: 'glass-luxury',
    name: 'فاخر زجاجي',
    description: 'بيج وذهبي زجاجي ناعم — مثالي للأزياء الراقية',
    gradient: 'from-amber-200 via-rose-100 to-yellow-100',
    preview: 'linear-gradient(135deg,#f5e6d3 0%,#e8c9a0 50%,#d4a574 100%)',
    colors: { primary: '#B8935A', secondary: '#E8C9A0', accent: '#F5E6D3' },
    tokens: {
      '--sf-bg': '36 25% 96%',
      '--sf-surface': '36 30% 92%',
      '--sf-glass': '36 40% 98% / 0.55',
      '--sf-border': '36 30% 75% / 0.4',
      '--sf-text': '30 20% 18%',
      '--sf-primary': '32 35% 54%',
      '--sf-accent': '40 70% 65%',
      '--sf-blur': '24px',
    },
  },
  {
    id: 'glass-noir',
    name: 'نوار زجاجي',
    description: 'أسود مع نيون أزرق-بنفسجي — للفخامة الليلية',
    gradient: 'from-slate-900 via-purple-900 to-cyan-900',
    preview: 'linear-gradient(135deg,#0a0a1a 0%,#1e0a3a 50%,#0a2a3a 100%)',
    colors: { primary: '#8B5CF6', secondary: '#06B6D4', accent: '#EC4899' },
    tokens: {
      '--sf-bg': '240 30% 6%',
      '--sf-surface': '250 30% 10%',
      '--sf-glass': '260 50% 20% / 0.45',
      '--sf-border': '270 80% 70% / 0.35',
      '--sf-text': '210 40% 96%',
      '--sf-primary': '262 83% 65%',
      '--sf-accent': '189 94% 55%',
      '--sf-blur': '28px',
    },
  },
  {
    id: 'glass-aurora',
    name: 'أورورا زجاجي',
    description: 'تدرج بنفسجي–أزرق زجاجي — عصري وشبابي',
    gradient: 'from-violet-500 via-purple-500 to-blue-500',
    preview: 'linear-gradient(135deg,#a78bfa 0%,#818cf8 50%,#60a5fa 100%)',
    colors: { primary: '#8B5CF6', secondary: '#6366F1', accent: '#3B82F6' },
    tokens: {
      '--sf-bg': '230 60% 97%',
      '--sf-surface': '240 50% 95%',
      '--sf-glass': '250 70% 96% / 0.5',
      '--sf-border': '260 80% 80% / 0.4',
      '--sf-text': '240 30% 18%',
      '--sf-primary': '258 90% 66%',
      '--sf-accent': '217 91% 60%',
      '--sf-blur': '24px',
    },
  },
  {
    id: 'glass-minimal',
    name: 'مينيمال زجاجي',
    description: 'أبيض وأزرق فاتح زجاجي — أنيق ونظيف',
    gradient: 'from-white via-sky-50 to-blue-100',
    preview: 'linear-gradient(135deg,#ffffff 0%,#e0f2fe 50%,#bfdbfe 100%)',
    colors: { primary: '#3B82F6', secondary: '#06B6D4', accent: '#8B5CF6' },
    tokens: {
      '--sf-bg': '210 40% 98%',
      '--sf-surface': '210 50% 96%',
      '--sf-glass': '210 60% 99% / 0.6',
      '--sf-border': '215 40% 75% / 0.35',
      '--sf-text': '215 30% 18%',
      '--sf-primary': '217 91% 60%',
      '--sf-accent': '262 83% 65%',
      '--sf-blur': '20px',
    },
  },
  {
    id: 'neon-cyber',
    name: 'نيون سايبر',
    description: 'أسود مع نيون سماوي وأخضر — لعالم التكنولوجيا',
    gradient: 'from-black via-cyan-900 to-emerald-900',
    preview: 'linear-gradient(135deg,#000000 0%,#0e7490 50%,#065f46 100%)',
    colors: { primary: '#22D3EE', secondary: '#10B981', accent: '#A855F7' },
    tokens: {
      '--sf-bg': '220 50% 4%',
      '--sf-surface': '200 60% 8%',
      '--sf-glass': '190 80% 18% / 0.4',
      '--sf-border': '180 100% 60% / 0.45',
      '--sf-text': '180 30% 95%',
      '--sf-primary': '187 92% 53%',
      '--sf-accent': '160 84% 45%',
      '--sf-blur': '20px',
    },
  },
  {
    id: 'editorial-soft',
    name: 'تحريري ناعم',
    description: 'بيج وكريمي على طراز المجلات الراقية',
    gradient: 'from-stone-100 via-amber-50 to-rose-50',
    preview: 'linear-gradient(135deg,#f5f5f4 0%,#fef3c7 50%,#ffe4e6 100%)',
    colors: { primary: '#78716C', secondary: '#A8A29E', accent: '#D6B370' },
    tokens: {
      '--sf-bg': '30 20% 96%',
      '--sf-surface': '30 25% 92%',
      '--sf-glass': '40 30% 97% / 0.65',
      '--sf-border': '30 20% 70% / 0.35',
      '--sf-text': '25 15% 18%',
      '--sf-primary': '25 10% 40%',
      '--sf-accent': '38 50% 55%',
      '--sf-blur': '18px',
    },
  },
  {
    id: 'vibrant-pop',
    name: 'فايبرنت بوب',
    description: 'برتقالي ووردي حيوي — للموضة السريعة والشباب',
    gradient: 'from-orange-400 via-pink-500 to-fuchsia-600',
    preview: 'linear-gradient(135deg,#fb923c 0%,#ec4899 50%,#c026d3 100%)',
    colors: { primary: '#F97316', secondary: '#EC4899', accent: '#A855F7' },
    tokens: {
      '--sf-bg': '20 100% 97%',
      '--sf-surface': '340 80% 96%',
      '--sf-glass': '330 90% 98% / 0.55',
      '--sf-border': '320 80% 70% / 0.4',
      '--sf-text': '340 30% 18%',
      '--sf-primary': '24 95% 53%',
      '--sf-accent': '292 84% 60%',
      '--sf-blur': '22px',
    },
  },
  {
    id: 'nature-calm',
    name: 'طبيعي هادئ',
    description: 'أخضر وزيتي — للمنتجات العضوية والطبيعية',
    gradient: 'from-emerald-200 via-teal-100 to-lime-100',
    preview: 'linear-gradient(135deg,#a7f3d0 0%,#ccfbf1 50%,#ecfccb 100%)',
    colors: { primary: '#059669', secondary: '#0D9488', accent: '#84CC16' },
    tokens: {
      '--sf-bg': '150 35% 96%',
      '--sf-surface': '155 30% 92%',
      '--sf-glass': '160 50% 96% / 0.55',
      '--sf-border': '150 30% 60% / 0.35',
      '--sf-text': '160 25% 16%',
      '--sf-primary': '160 84% 32%',
      '--sf-accent': '83 78% 44%',
      '--sf-blur': '20px',
    },
  },
];

export const DEFAULT_THEME_ID = 'glass-luxury';

export const getThemeById = (id) =>
  STOREFRONT_THEMES.find((t) => t.id === id) || STOREFRONT_THEMES[0];

/**
 * Apply theme tokens as CSS variables on a target element (or document root).
 */
export const applyThemeTokens = (themeId, target) => {
  const theme = getThemeById(themeId);
  const root = target || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!root || !theme?.tokens) return;
  Object.entries(theme.tokens).forEach(([k, v]) => root.style.setProperty(k, v));
};
