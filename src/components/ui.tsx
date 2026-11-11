import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#2f6bff" />
      <circle cx="13" cy="18" r="6.2" fill="none" stroke="#ffffff" strokeWidth="3.2" />
      <rect x="18.4" y="7.5" width="3.2" height="17.5" rx="1.6" fill="#ffffff" />
    </svg>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Avatar({ name, color, size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'avatar--lg' : size === 'sm' ? 'avatar--sm' : '';
  return (
    <span className={`avatar ${sizeClass}`} style={color ? { background: color } : undefined} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function ProgressBar({
  value,
  max = 100,
  onBlue = false,
  label,
  className = '',
}: {
  value: number;
  max?: number;
  onBlue?: boolean;
  label?: string;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={`progress ${onBlue ? 'progress--on-blue' : ''} ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
    >
      <motion.div
        className="progress__bar"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </div>
  );
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="sheet__head">
          <h3>{title}</h3>
          <button className="btn btn--icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </motion.div>
    </motion.div>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'info' | 'error'; children: ReactNode }) {
  const toneClass = tone === 'info' ? 'notice--info' : tone === 'error' ? 'notice--error' : '';
  return (
    <div className={`notice ${toneClass}`} role={tone === 'error' ? 'alert' : undefined}>
      <span>{children}</span>
    </div>
  );
}

export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="icon-tile icon-tile--sm">{icon}</div>}
      <h3>{title}</h3>
      {children && <p className="muted small">{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ dark = false }: { dark?: boolean }) {
  return <span className={`spinner ${dark ? 'spinner--dark' : ''}`} aria-hidden="true" />;
}

export function Skeleton({ height = 80 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
