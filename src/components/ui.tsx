import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import logoUrl from '../assets/logo.webp';
import { useT } from '../lib/i18n/react';

// The danna logo. The WebP file is generated from brand/logo.png by `npm run icons`.
export function BrandMark({ size = 26 }: { size?: number }) {
  return <img className="brand-mark" src={logoUrl} width={size} height={size} alt="" draggable={false} decoding="async" />;
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`wordmark ${className}`}>danna</span>;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Avatar({
  name,
  color,
  size = 'md',
  src,
}: {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  /** A picture URL. When there is one, it replaces the initials. */
  src?: string | null;
}) {
  const sizeClass = size === 'lg' ? 'avatar--lg' : size === 'sm' ? 'avatar--sm' : '';
  return (
    <span className={`avatar ${sizeClass}`} style={color && !src ? { background: color } : undefined} aria-hidden="true">
      {src ? (
        <img className="avatar__img" src={src} alt="" draggable={false} />
      ) : (
        initials(name)
      )}
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
  const t = useT();
  const dialog = useRef<HTMLDivElement>(null);

  // The dialog takes the focus when it opens, and the control that opened it gets the focus back when it closes.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Tab moves through the dialog only, so the keyboard does not reach the page behind it.
  const keepFocusInside = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialog.current) return;
    const items = Array.from(
      dialog.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((item) => !item.hasAttribute('disabled'));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

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
        ref={dialog}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={keepFocusInside}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="sheet__head">
          <h3>{title}</h3>
          <button className="btn btn--icon" onClick={onClose} aria-label={t('Close')}>
            <X />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </motion.div>
    </motion.div>
  );
}

/** A short confirmation before something is removed or cleared. The confirm button is red, the cancel button is quiet. */
export function ConfirmSheet({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const t = useT();
  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            {t('Cancel')}
          </button>
          <button className="btn btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : null} {confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted">{children}</p>
    </Sheet>
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

/**
 * A search box with its magnifier inside the left edge and its own clear button, in place of the browser's.
 * Used for the chat history, the library, the find box of a file, and the search of the whole app.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  inputRef,
  onKeyDown,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  const t = useT();
  return (
    <label className="search-field">
      <Search aria-hidden="true" />
      <input
        ref={inputRef}
        className="input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="search-field__clear"
          aria-label={t('Clear search')}
          onClick={() => {
            onChange('');
            inputRef?.current?.focus();
          }}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </label>
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

/** The header of a top-level page: a short eyebrow, the title, and actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {children}
      </div>
      {aside && <div className="page-header__aside">{aside}</div>}
    </header>
  );
}

/** A section of a page: an h2 title, with an optional action on the right. */
export function SectionTitle({ title, aside, id }: { title: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="section-title">
      <h2 id={id}>{title}</h2>
      {aside && <div className="section-title__aside">{aside}</div>}
    </div>
  );
}

/** The link back to where the person came from, used on sub-pages. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="back-link">
      <ArrowLeft aria-hidden="true" />
      {children}
    </Link>
  );
}

export type BadgeTone = 'neutral' | 'done' | 'beta';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** Shown beside the label when above zero. */
  count?: number;
  /** Red count: something here is waiting for the person (a request, an unread item). */
  alert?: boolean;
}

/** The one tab control used across the app: a segmented control. */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
  block = false,
}: {
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Stretch the tabs across the full width, for a card or a narrow column. */
  block?: boolean;
}) {
  return (
    <div className={`segmented${block ? ' segmented--block' : ''}`} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className="segmented__btn"
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && item.count > 0 && (
            <span className={`segmented__count${item.alert ? ' segmented__count--alert' : ''}`}>{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** A card for one thing: an icon, a title with an optional badge, a line of detail, and an arrow when it opens. */
export function FeatureCard({
  icon,
  title,
  badge,
  meta,
  action,
  muted = false,
  onClick,
}: {
  icon: ReactNode;
  title: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  muted?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="feature-card__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="feature-card__body">
        <span className="feature-card__title">
          {title}
          {badge}
        </span>
        {meta && <span className="feature-card__meta">{meta}</span>}
      </span>
      {action ?? (onClick ? <ChevronRight className="feature-card__arrow" aria-hidden="true" /> : null)}
    </>
  );
  const className = `feature-card${muted ? ' feature-card--muted' : ''}`;
  if (onClick) {
    return (
      <button type="button" className={`${className} feature-card--link`} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
