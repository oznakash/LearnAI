interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
}

export function Sparkline({
  data,
  width = 240,
  height = 64,
  color = "#28e0b3",
  fill = "rgba(40,224,179,0.2)",
}: SparklineProps) {
  const max = Math.max(1, ...data);
  const dx = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => `${i * dx},${height - (v / max) * (height - 8) - 4}`).join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <polygon points={area} fill={fill} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * dx} cy={height - (v / max) * (height - 8) - 4} r="2.5" fill={color} />
      ))}
    </svg>
  );
}

interface BarsProps {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
}

export function Bars({ data, width = 320, height = 120, color = "#7c5cff" }: BarsProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (width - 20) / Math.max(1, data.length) - 6;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 24);
        return (
          <g key={i} transform={`translate(${10 + i * (bw + 6)}, 0)`}>
            <rect x="0" y={height - h - 16} width={bw} height={h} rx="3" fill={color} opacity={0.85} />
            <text x={bw / 2} y={height - 4} fontSize="9" fill="#9ba3c7" textAnchor="middle">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface RingProps {
  pct: number;       // 0-100
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export function Ring({
  pct,
  size = 120,
  stroke = 12,
  color = "#28e0b3",
  trackColor = "rgba(255,255,255,0.08)",
  label,
  sublabel,
}: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={`rg-${color}`} x1="0" x2="1">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor="#7c5cff" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#rg-${color})`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeDashoffset={c / 4}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-display font-bold text-white">{label ?? `${pct}%`}</div>
        {sublabel && <div className="text-[10px] uppercase tracking-wider text-white/50 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

interface RadarProps {
  axes: { label: string; value: number }[]; // values 0..100
  size?: number;
  color?: string;
}

export function Radar({ axes, size = 200, color = "#7c5cff" }: RadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 24;
  const n = axes.length;
  const points = axes.map((a, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const v = (a.value / 100) * r;
    return [cx + Math.cos(angle) * v, cy + Math.sin(angle) * v];
  });
  const ringPts = (frac: number) =>
    Array.from({ length: n })
      .map((_, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        return `${cx + Math.cos(angle) * r * frac},${cy + Math.sin(angle) * r * frac}`;
      })
      .join(" ");
  return (
    <svg width={size} height={size}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ringPts(f)} fill="none" stroke="rgba(255,255,255,0.08)" />
      ))}
      <polygon points={points.map((p) => p.join(",")).join(" ")} fill={color + "55"} stroke={color} strokeWidth="2" />
      {axes.map((a, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * (r + 12);
        const y = cy + Math.sin(angle) * (r + 12);
        return (
          <text key={i} x={x} y={y} fontSize="10" fill="#9ba3c7" textAnchor="middle" dominantBaseline="middle">
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

interface HeatProps {
  weeks: number; // number of weeks to show
  values: Map<string, number>; // ISO date → 0..1 intensity
}

export function Heat({ weeks = 12, values }: HeatProps) {
  const today = new Date();
  const days: { date: string; v: number }[] = [];
  const total = weeks * 7;
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    days.push({ date: k, v: values.get(k) ?? 0 });
  }
  const cell = 12;
  return (
    <svg width={weeks * cell + 4} height={7 * cell + 4}>
      {days.map((d, i) => {
        const col = Math.floor(i / 7);
        const row = i % 7;
        const opacity = d.v === 0 ? 0.08 : 0.25 + d.v * 0.7;
        return (
          <rect
            key={i}
            x={col * cell + 2}
            y={row * cell + 2}
            width={cell - 2}
            height={cell - 2}
            rx="2"
            fill="#28e0b3"
            opacity={opacity}
          >
            <title>{d.date}: {Math.round(d.v * 100)}%</title>
          </rect>
        );
      })}
    </svg>
  );
}
