import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import logoUrl from '../assets/logo.webp';
import { defaultAvatarUrl } from '../lib/avatarPack';
import { useT } from '../lib/i18n/react';

/** How many rows a long list shows at first, and how many more each press of "Show more" adds. */
export const PAGE_SIZE = 40;

/**
 * The first page of a long list, so a list of hundreds of items stays quick and fits its sheet or screen.
 * The page goes back to its first rows whenever `resetKey` changes, such as a new search, so a list
 * never opens halfway down.
 */
export function usePaged<T>(items: T[], resetKey: string, pageSize = PAGE_SIZE) {
  const [count, setCount] = useState(pageSize);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setCount(pageSize);
  }
  return {
    shown: items.slice(0, count),
    hidden: Math.max(0, items.length - count),
    showMore: () => setCount((value) => value + pageSize),
  };
}

/** The button under a long list. It names how many rows are still hidden, and a press shows the next page. */
export function ShowMore({ hidden, pageSize = PAGE_SIZE, onClick }: { hidden: number; pageSize?: number; onClick: () => void }) {
  const t = useT();
  if (hidden <= 0) return null;
  return (
    <button className="btn btn--ghost btn--block show-more" onClick={onClick}>
      {t('Show {count} more', { count: Math.min(hidden, pageSize) })}
    </button>
  );
}

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
  seed,
  size = 'md',
  src,
}: {
  name: string;
  /** A stable text for the person, such as their id. It picks their built-in picture when they have none of their own. */
  seed?: string;
  size?: 'sm' | 'md' | 'lg';
  /** The person's own picture. When there is one, it replaces the built-in picture. */
  src?: string | null;
}) {
  const sizeClass = size === 'lg' ? 'avatar--lg' : size === 'sm' ? 'avatar--sm' : '';
  return (
    <span className={`avatar avatar--picture ${sizeClass}`} aria-hidden="true">
      <img className="avatar__img" src={src || defaultAvatarUrl(seed ?? name)} alt="" draggable={false} />
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
        initial={{ scaleX: 0 }}
        animate={{ scaleX: percent / 100 }}
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
  /** A picture drawn before the label, such as a flag. */
  icon?: ReactNode;
  /** The icon already says what the tab is: the label is then kept for screen readers and shown as a tooltip. */
  iconOnly?: boolean;
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
          title={item.iconOnly ? item.label : undefined}
          onClick={() => onChange(item.value)}
        >
          {item.icon}
          {item.iconOnly ? <span className="sr-only">{item.label}</span> : item.label}
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
  arrow = true,
  onClick,
}: {
  icon: ReactNode;
  title: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  muted?: boolean;
  /** Set to false when the card has its own button, so only that button shows in the corner. */
  arrow?: boolean;
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
      {action ?? (onClick && arrow ? <ChevronRight className="feature-card__arrow" aria-hidden="true" /> : null)}
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

// A clock of a session or a question: minutes and seconds (05:09), and once an hour has passed, the hours too (1:05:09,
// or 36:49:54 after a day). The hours are not capped, so a long session never runs its minutes into the hours.
export function formatClock(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}
