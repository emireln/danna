import { useEffect, useState } from 'react';
import { animate, motion } from 'framer-motion';
import { useT } from '../lib/i18n/react';

/** Counts from 0 to `to`. */
export function CountUp({ to, duration = 1.1, decimals = 0 }: { to: number; duration?: number; decimals?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(0, to, { duration, ease: 'easeOut', onUpdate: (latest) => setValue(latest) });
    return () => controls.stop();
  }, [to, duration]);
  return <>{decimals ? value.toFixed(decimals) : Math.round(value)}</>;
}

/** Half-circle score gauge with an animated arc. `value` is shown against `max`. */
export function Gauge({ value, max, range }: { value: number; max: number; range: string }) {
  const t = useT();
  const r = 118;
  const cx = 160;
  const cy = 150;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <div className="gauge" role="img" aria-label={t('{value} of {max}, range {range}', { value, max, range })}>
      <svg viewBox="0 0 320 166" width="100%" aria-hidden="true">
        <path d={arc} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={16} strokeLinecap="round" />
        <motion.path
          d={arc}
          fill="none"
          stroke="#0b2c7d"
          strokeWidth={16}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: fraction }}
          transition={{ duration: 1.3, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="gauge__value">
        <span className="gauge__big">
          <CountUp to={value} />
        </span>
        <span className="gauge__of">{t('of {max}', { max })}</span>
        <span className="gauge__range">{range}</span>
      </div>
    </div>
  );
}

export interface RadarAxis {
  label: string;
  value: number;
}

/** Five-axis radar. `goal` draws a dashed reference polygon (for example a target score). */
export function Radar({ axes, goal }: { axes: RadarAxis[]; goal?: number }) {
  const t = useT();
  const size = 440;
  const cx = size / 2;
  const cy = 176;
  const radius = 116;
  const count = axes.length;
  const angle = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const point = (index: number, percent: number) => {
    const distance = (radius * percent) / 100;
    return [cx + Math.cos(angle(index)) * distance, cy + Math.sin(angle(index)) * distance] as const;
  };
  const polygon = (values: number[]) => values.map((value, index) => point(index, value).join(',')).join(' ');
  const rings = [20, 40, 60, 80, 100];
  const weakest = axes.reduce((lowest, axis, index) => (axis.value < axes[lowest].value ? index : lowest), 0);
  const dataPoints = axes.map((axis) => axis.value);

  return (
    <svg className="radar" viewBox={`0 0 ${size} 352`} role="img" aria-label={t('Skill radar chart')}>
      <motion.g
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        {rings.map((ring) => (
          <polygon key={ring} points={polygon(axes.map(() => ring))} fill="none" stroke="#e1e6ef" strokeWidth={1} />
        ))}
        {axes.map((_, index) => {
          const [x, y] = point(index, 100);
          return <line key={index} x1={cx} y1={cy} x2={x} y2={y} stroke="#e1e6ef" strokeWidth={1} />;
        })}
        {goal !== undefined && (
          <polygon
            points={polygon(axes.map(() => goal))}
            fill="none"
            stroke="#9aa4b8"
            strokeWidth={1.6}
            strokeDasharray="5 5"
          />
        )}
        <polygon
          points={polygon(dataPoints)}
          fill="rgba(47,107,255,0.16)"
          stroke="#2f6bff"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        {axes.map((axis, index) => {
          const [x, y] = point(index, axis.value);
          return (
            <circle key={axis.label} cx={x} cy={y} r={index === weakest ? 5 : 3.5} fill={index === weakest ? '#e5484d' : '#2f6bff'} />
          );
        })}
      </motion.g>
      {axes.map((axis, index) => {
        const [x, y] = point(index, 100);
        const dx = Math.cos(angle(index));
        const anchor = dx > 0.25 ? 'start' : dx < -0.25 ? 'end' : 'middle';
        const labelX = x + (anchor === 'start' ? 10 : anchor === 'end' ? -10 : 0);
        const labelY = y + (Math.sin(angle(index)) > 0.5 ? 26 : Math.sin(angle(index)) < -0.5 ? -26 : 4);
        return (
          <g key={`label-${axis.label}`}>
            <text x={labelX} y={labelY} textAnchor={anchor}>
              {axis.label}
            </text>
            <text x={labelX} y={labelY + 16} textAnchor={anchor} className="radar-score">
              {axis.value}/100
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface DonutSlice {
  label: string;
  percent: number;
  color: string;
}

export function Donut({ slices }: { slices: DonutSlice[] }) {
  const t = useT();
  const r = 74;
  const c = 2 * Math.PI * r;
  let accumulated = 0;
  return (
    <svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label={t('Study plan split')}>
      <g transform="rotate(-90 100 100)">
        <circle cx="100" cy="100" r={r} fill="none" stroke="#eef1f6" strokeWidth={26} />
        {slices.map((slice, index) => {
          const length = (slice.percent / 100) * c;
          const offset = -accumulated;
          accumulated += length;
          return (
            <motion.circle
              key={slice.label}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth={26}
              strokeDasharray={`${Math.max(0, length - 2)} ${c}`}
              strokeDashoffset={offset}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.08 * index, duration: 0.5 }}
            />
          );
        })}
      </g>
    </svg>
  );
}
