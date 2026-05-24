import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * IRAQ_PROVINCES — coords projected from real (lat, lng) onto a 0-100 grid
 * matching Iraq's bounding box: lng 38.79 → 48.57, lat 29.06 → 37.38.
 * x = (lng - 38.79) / 9.78 * 100
 * y = (37.38 - lat) / 8.32 * 100
 *
 * Then mapped into the visible Iraq silhouette area inside the background SVG.
 */
const IRAQ_PROVINCES = [
  { key: 'dahuk',        name: 'دهوك',         x: 42.9, y: 6.1  },
  { key: 'nineveh',      name: 'نينوى',        x: 44.4, y: 12.5 },
  { key: 'erbil',        name: 'أربيل',        x: 53.4, y: 14.3 },
  { key: 'sulaymaniyah', name: 'السليمانية',   x: 68.0, y: 21.9 },
  { key: 'kirkuk',       name: 'كركوك',        x: 57.3, y: 23.0 },
  { key: 'salahuddin',   name: 'صلاح الدين',   x: 50.0, y: 33.3 },
  { key: 'anbar',        name: 'الأنبار',      x: 30.0, y: 45.0 },
  { key: 'diyala',       name: 'ديالى',        x: 59.8, y: 43.6 },
  { key: 'baghdad',      name: 'بغداد',        x: 57.0, y: 48.9 },
  { key: 'karbala',      name: 'كربلاء',       x: 53.5, y: 57.2 },
  { key: 'babil',        name: 'بابل',         x: 57.6, y: 59.0 },
  { key: 'wasit',        name: 'واسط',         x: 71.9, y: 58.5 },
  { key: 'najaf',        name: 'النجف',        x: 52.0, y: 66.5 },
  { key: 'qadisiyyah',   name: 'القادسية',     x: 62.7, y: 64.8 },
  { key: 'maysan',       name: 'ميسان',        x: 80.4, y: 66.7 },
  { key: 'dhiqar',       name: 'ذي قار',       x: 70.4, y: 76.2 },
  { key: 'muthanna',     name: 'المثنى',       x: 60.4, y: 78.0 },
  { key: 'basra',        name: 'البصرة',       x: 86.0, y: 84.7 },
];

const NAME_ALIASES = {
  'بغداد': 'baghdad',
  'البصرة': 'basra', 'بصرة': 'basra',
  'نينوى': 'nineveh', 'الموصل': 'nineveh',
  'اربيل': 'erbil', 'أربيل': 'erbil',
  'السليمانية': 'sulaymaniyah', 'سليمانية': 'sulaymaniyah',
  'دهوك': 'dahuk',
  'كركوك': 'kirkuk',
  'الأنبار': 'anbar', 'الانبار': 'anbar', 'انبار': 'anbar',
  'صلاح الدين': 'salahuddin',
  'ديالى': 'diyala', 'ديالي': 'diyala',
  'بابل': 'babil',
  'كربلاء': 'karbala',
  'النجف': 'najaf', 'نجف': 'najaf',
  'واسط': 'wasit',
  'القادسية': 'qadisiyyah', 'الديوانية': 'qadisiyyah',
  'ميسان': 'maysan', 'العمارة': 'maysan',
  'المثنى': 'muthanna', 'السماوة': 'muthanna',
  'ذي قار': 'dhiqar', 'ذيقار': 'dhiqar', 'الناصرية': 'dhiqar',
};

const normalize = (s) => String(s || '').trim().replace(/\s+/g, ' ');

const ProvincesHeatmapCard = ({ items = [], onViewAll }) => {
  const [hover, setHover] = useState(null);

  const heatMap = useMemo(() => {
    const m = new Map();
    (items || []).forEach((it) => {
      const label = normalize(it.label || it.name || it.province);
      const key = NAME_ALIASES[label] || IRAQ_PROVINCES.find(p => p.name === label)?.key;
      if (!key) return;
      const raw = it.count ?? it.total ?? it.value;
      const n = typeof raw === 'number' ? raw : parseInt(String(raw || '').replace(/[^\d.-]/g, ''), 10) || 0;
      m.set(key, (m.get(key) || 0) + n);
    });
    return m;
  }, [items]);

  const maxCount = useMemo(() => {
    const vals = Array.from(heatMap.values());
    return vals.length ? Math.max(...vals) : 0;
  }, [heatMap]);

  const totalOrders = useMemo(
    () => Array.from(heatMap.values()).reduce((a, b) => a + b, 0),
    [heatMap]
  );

  const getHeat = (key) => {
    const c = heatMap.get(key) || 0;
    if (!c || !maxCount) return 0;
    return c / maxCount;
  };

  const hovered = hover ? IRAQ_PROVINCES.find(p => p.key === hover) : null;
  const hoveredCount = hover ? (heatMap.get(hover) || 0) : 0;

  return (
    <Card className="glass-effect h-full border-border/60 flex flex-col overflow-hidden relative">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <CardHeader className="relative">
        <CardTitle className="flex items-center justify-between gap-3 text-lg text-foreground">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold">المحافظات الأكثر طلباً</span>
          </div>
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
            خريطة العراق
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 pt-0 relative">
        {/* Real Iraq map outline — subtle glass with luminous borders */}
        <div className="relative w-full max-w-[300px] mx-auto aspect-square">
          {/* Soft ambient glow behind the country (very subtle) */}
          <div className="pointer-events-none absolute inset-0 opacity-50">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(60% 55% at 50% 55%, hsl(var(--primary) / 0.12), transparent 70%)',
                filter: 'blur(20px)',
              }}
            />
          </div>

          {/* Glass-filled country shape — very transparent, neutral */}
          <div
            className="absolute inset-0"
            style={{
              WebkitMaskImage: "url('/iraq-map.svg')",
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              WebkitMaskSize: 'contain',
              maskImage: "url('/iraq-map.svg')",
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              maskSize: 'contain',
              background:
                'linear-gradient(160deg, hsl(var(--foreground) / 0.04) 0%, hsl(var(--foreground) / 0.02) 50%, hsl(var(--primary) / 0.04) 100%)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              boxShadow: 'inset 0 0 24px hsl(var(--foreground) / 0.06)',
            }}
          />

          {/* Luminous border outline only — no fill */}
          <img
            src="/iraq-map.svg"
            alt="خريطة العراق"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{
              filter:
                'brightness(0) saturate(100%) invert(64%) sepia(94%) saturate(2200%) hue-rotate(190deg) brightness(105%) drop-shadow(0 0 3px hsl(var(--primary) / 0.7)) drop-shadow(0 0 8px hsl(var(--primary) / 0.35))',
              opacity: 0.75,
              mixBlendMode: 'screen',
            }}
          />



          {/* Markers overlay */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Connection lines from Baghdad */}
            {IRAQ_PROVINCES.filter(p => p.key !== 'baghdad').map(p => {
              const b = IRAQ_PROVINCES.find(x => x.key === 'baghdad');
              const heat = getHeat(p.key);
              if (heat < 0.15) return null;
              return (
                <line
                  key={`line-${p.key}`}
                  x1={b.x} y1={b.y} x2={p.x} y2={p.y}
                  stroke="hsl(var(--primary))"
                  strokeOpacity={heat * 0.3}
                  strokeWidth="0.25"
                  strokeDasharray="0.6,0.6"
                />
              );
            })}

            {IRAQ_PROVINCES.map((p) => {
              const heat = getHeat(p.key);
              const isHover = hover === p.key;
              const baseR = 1.6;
              const r = baseR + heat * 3.6 + (isHover ? 0.8 : 0);
              const fillOpacity = 0.25 + heat * 0.75;
              return (
                <g key={p.key}>
                  {heat > 0 && (
                    <motion.circle
                      cx={p.x} cy={p.y}
                      initial={{ r: 0, opacity: 0 }}
                      animate={{ r: r + 2.2, opacity: heat * 0.3 }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                      fill="hsl(var(--primary))"
                    />
                  )}
                  <motion.circle
                    cx={p.x} cy={p.y}
                    initial={{ r: 0 }}
                    animate={{ r }}
                    transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.05 }}
                    fill={heat > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                    fillOpacity={heat > 0 ? fillOpacity : 0.4}
                    stroke={isHover ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.4)'}
                    strokeWidth="0.3"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(p.key)}
                    onMouseLeave={() => setHover(null)}
                    onTouchStart={() => setHover(p.key)}
                  />
                </g>
              );
            })}
          </svg>

          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-2 right-2 bg-popover/95 backdrop-blur-md border border-border/60 rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none"
            >
              <div className="text-xs text-muted-foreground">المحافظة</div>
              <div className="text-sm font-bold text-foreground">{hovered.name}</div>
              <div className="text-xs text-primary font-semibold mt-0.5">
                {hoveredCount.toLocaleString()} طلب
              </div>
            </motion.div>
          )}
        </div>

        {/* Top 3 mini chips */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(items || []).slice(0, 3).map((it, i) => {
            const colors = [
              'from-amber-400/20 to-yellow-600/10 border-amber-400/40',
              'from-slate-300/20 to-slate-500/10 border-slate-300/40',
              'from-orange-400/20 to-amber-700/10 border-orange-400/40',
            ];
            return (
              <div
                key={i}
                className={cn(
                  'rounded-lg border bg-gradient-to-br p-2 text-center',
                  colors[i]
                )}
              >
                <div className="text-[10px] text-muted-foreground">#{i + 1}</div>
                <div className="text-xs font-bold text-foreground truncate">{it.label || it.name}</div>
                <div className="text-[11px] text-primary font-semibold">{it.value ?? it.count ?? 0}</div>
              </div>
            );
          })}
        </div>

        {totalOrders > 0 && (
          <div className="mt-3 text-center text-xs text-muted-foreground">
            إجمالي الطلبات الموزعة: <span className="text-primary font-bold">{totalOrders.toLocaleString()}</span>
          </div>
        )}

        <Button
          variant="ghost"
          className="mt-3 w-full text-primary hover:bg-primary/10 group"
          onClick={onViewAll}
        >
          مشاهدة التفاصيل
          <ArrowUpRight className="w-4 h-4 mr-1 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProvincesHeatmapCard;
