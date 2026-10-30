import { fmt } from '../lib/util';

export interface Point {
  x: number;
  y: number;
  label?: string;
}

/** Einfaches Liniendiagramm (z. B. Gewicht), x = Zeitstempel. */
export function LineChart({
  points,
  goal,
  height = 170,
  unit = '',
}: {
  points: Point[];
  goal?: number;
  height?: number;
  unit?: string;
}) {
  const W = 340;
  const H = height;
  const pad = { l: 34, r: 10, t: 12, b: 22 };
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y).concat(goal != null ? [goal] : []);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  if (minX === maxX) {
    minX -= 86400000;
    maxX += 86400000;
  }
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  const span = Math.max(maxY - minY, 1);
  minY -= span * 0.15;
  maxY += span * 0.15;
  const sx = (x: number) => pad.l + ((x - minX) / (maxX - minX)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - minY) / (maxY - minY)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const ticks = [minY + (maxY - minY) * 0.15, (minY + maxY) / 2, maxY - (maxY - minY) * 0.15];
  const fmtD = (ts: number) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="chart" role="img">
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke="var(--track)" stroke-width="1" />
          <text x={pad.l - 6} y={sy(v) + 4} text-anchor="end" class="chart-text">
            {fmt(v, 1)}
          </text>
        </g>
      ))}
      {goal != null && (
        <g>
          <line x1={pad.l} x2={W - pad.r} y1={sy(goal)} y2={sy(goal)} stroke="var(--good)" stroke-dasharray="4 4" stroke-width="1.5" />
          <text x={W - pad.r} y={sy(goal) - 4} text-anchor="end" class="chart-text good">
            {fmt(goal, 1)} {unit}
          </text>
        </g>
      )}
      <path d={path} fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={points.length > 40 ? 0 : 3.5} fill="var(--card)" stroke="var(--primary)" stroke-width="2" />
      ))}
      <text x={pad.l} y={H - 4} class="chart-text">
        {fmtD(minX)}
      </text>
      <text x={W - pad.r} y={H - 4} text-anchor="end" class="chart-text">
        {fmtD(maxX)}
      </text>
    </svg>
  );
}

/** Balkendiagramm mit Ziellinie (z. B. Kalorien pro Tag). */
export function BarChart({
  data,
  target,
  height = 150,
}: {
  data: { label: string; value: number }[];
  target?: number;
  height?: number;
}) {
  const W = 340;
  const H = height;
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const max = Math.max(...data.map((d) => d.value), target ?? 0, 1) * 1.1;
  const bw = (W - pad.l - pad.r) / data.length;
  const sy = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="chart" role="img">
      {data.map((d, i) => {
        const over = target != null && d.value > target;
        return (
          <g key={i}>
            <rect
              x={pad.l + i * bw + bw * 0.18}
              width={bw * 0.64}
              y={sy(d.value)}
              height={Math.max(0, H - pad.b - sy(d.value))}
              rx="4"
              fill={d.value === 0 ? 'var(--track)' : over ? 'var(--warn)' : 'var(--primary)'}
            />
            <text x={pad.l + i * bw + bw / 2} y={H - 6} text-anchor="middle" class="chart-text">
              {d.label}
            </text>
            {d.value > 0 && (
              <text x={pad.l + i * bw + bw / 2} y={sy(d.value) - 3} text-anchor="middle" class="chart-text">
                {fmt(d.value)}
              </text>
            )}
          </g>
        );
      })}
      {target != null && <line x1={pad.l} x2={W - pad.r} y1={sy(target)} y2={sy(target)} stroke="var(--text-2)" stroke-dasharray="4 4" stroke-width="1.2" />}
    </svg>
  );
}
