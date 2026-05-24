import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * IRAQ_PROVINCES — approximate centroids on a 0-100 / 0-100 canvas.
 * Manually tuned for a clean schematic map (not geographically exact).
 */
const IRAQ_PROVINCES = [
  { key: 'dahuk',       name: 'دهوك',         x: 38, y: 8  },
  { key: 'nineveh',     name: 'نينوى',        x: 28, y: 18 },
  { key: 'erbil',       name: 'أربيل',        x: 48, y: 14 },
  { key: 'kirkuk',      name: 'كركوك',        x: 50, y: 26 },
  { key: 'sulaymaniyah',name: 'السليمانية',   x: 64, y: 22 },
  { key: 'salahuddin',  name: 'صلاح الدين',   x: 42, y: 34 },
  { key: 'diyala',      name: 'ديالى',        x: 58, y: 38 },
  { key: 'anbar',       name: 'الأنبار',      x: 22, y: 42 },
  { key: 'baghdad',     name: 'بغداد',        x: 48, y: 46 },
  { key: 'babil',       name: 'بابل',         x: 46, y: 56 },
  { key: 'karbala',     name: 'كربلاء',       x: 36, y: 58 },
  { key: 'najaf',       name: 'النجف',        x: 32, y: 68 },
  { key: 'wasit',       name: 'واسط',         x: 60, y: 56 },
  { key: 'qadisiyyah',  name: 'القادسية',     x: 46, y: 68 },
  { key: 'maysan',      name: 'ميسان',        x: 66, y: 70 },
  { key: 'muthanna',    name: 'المثنى',       x: 40, y: 80 },
  { key: 'dhiqar',      name: 'ذي قار',       x: 54, y: 78 },
  { key: 'basra',       name: 'البصرة',       x: 68, y: 86 },
];

// Map common Arabic name variations → canonical key
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

  // Build {key: count} from incoming items
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
      {/* Background aurora */}
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
        {/* Map */}
        <div className="relative w-full aspect-[3/4] max-w-[280px] mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Faint outline frame */}
            <defs>
              <radialGradient id="iraq-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="100" height="100" fill="url(#iraq-glow)" />

            {/* Connection lines from baghdad */}
            {IRAQ_PROVINCES.filter(p => p.key !== 'baghdad').map(p => {
              const b = IRAQ_PROVINCES.find(x => x.key === 'baghdad');
              const heat = getHeat(p.key);
              if (heat < 0.15) return null;
              return (
                <line
                  key={`line-${p.key}`}
                  x1={b.x} y1={b.y} x2={p.x} y2={p.y}
                  stroke="hsl(var(--primary))"
                  strokeOpacity={heat * 0.25}
                  strokeWidth="0.2"
                />
              );
            })}

            {/* Province dots */}
            {IRAQ_PROVINCES.map((p) => {
              const heat = getHeat(p.key);
              const isHover = hover === p.key;
              const baseR = 2.2;
              const r = baseR + heat * 4.2 + (isHover ? 1 : 0);
              const fillOpacity = 0.15 + heat * 0.85;
              return (
                <g key={p.key}>
                  {heat > 0 && (
                    <motion.circle
                      cx={p.x} cy={p.y}
                      initial={{ r: 0, opacity: 0 }}
                      animate={{ r: r + 2.5, opacity: heat * 0.25 }}
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
                    fillOpacity={heat > 0 ? fillOpacity : 0.25}
                    stroke={isHover ? 'hsl(var(--primary))' : 'transparent'}
                    strokeWidth="0.4"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(p.key)}
                    onMouseLeave={() => setHover(null)}
                    onTouchStart={() => setHover(p.key)}
                  />
                </g>
              );
            })}
          </svg>

          {/* Hover tooltip */}
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
