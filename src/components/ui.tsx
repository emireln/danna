import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

// The danna mark: a speech bubble with rising bars (learning that grows). Same geometry as public/favicon.svg.
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0f1b33" />
      <path
        d="M22 12H42A12 12 0 0 1 54 24V32A12 12 0 0 1 42 44H30L19 52L20 44H22A12 12 0 0 1 10 32V24A12 12 0 0 1 22 12Z"
        fill="#2f6bff"
      />
      <rect x="14.75" y="31" width="6" height="7" rx="3" fill="#ffffff" />
      <rect x="24.25" y="26" width="6" height="12" rx="3" fill="#ffffff" />
      <rect x="33.75" y="21" width="6" height="17" rx="3" fill="#ffffff" />
      <rect x="43.25" y="16" width="6" height="22" rx="3" fill="#13b5a4" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`wordmark ${className}`}>danna</span>;
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
