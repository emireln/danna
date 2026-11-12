// Dropdowns and calendars drawn in the app's own style. The browser's native popups cannot be
// styled, so every choice list and date in danna uses these instead.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check, CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface Anchor {
  top: number;
  left: number;
  width: number;
  above: boolean;
}

/** Where a floating panel goes: under its trigger, or above it when the window has no room below. */
function useAnchor(open: boolean, trigger: RefObject<HTMLElement | null>, panelHeight: number): Anchor | null {
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const element = trigger.current;
      if (!element) return;
      const box = element.getBoundingClientRect();
      const above = window.innerHeight - box.bottom < panelHeight + 12 && box.top > panelHeight + 12;
      setAnchor({ top: above ? box.top - 6 : box.bottom + 6, left: box.left, width: box.width, above });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, trigger, panelHeight]);

  return open ? anchor : null;
}

/** A press outside both the trigger and the panel closes the panel. */
function useDismiss(
  open: boolean,
  setOpen: (open: boolean) => void,
  trigger: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return undefined;
    const onPress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (trigger.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPress);
    return () => document.removeEventListener('pointerdown', onPress);
  }, [open, setOpen, trigger, panel]);
}

export function Select<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = 'Choose',
  disabled = false,
  variant = 'field',
}: {
  id?: string;
  label?: string;
  options: ReadonlyArray<SelectOption<T>>;
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  /** `line` is the underlined style used in page headers. */
  variant?: 'field' | 'line';
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const anchor = useAnchor(open, trigger, Math.min(options.length * 42 + 14, 300));
  useDismiss(open, setOpen, trigger, panel);

  const placed = anchor !== null;
  useEffect(() => {
    if (open && placed) panel.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, placed, active]);

  const openList = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const last = options.length - 1;
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, last));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(last);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      // Closes the list only: an open sheet behind it stays open.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const selected = options[selectedIndex];

  return (
    <div className={`pick ${variant === 'line' ? 'pick--line' : ''}`}>
      <div
        ref={trigger}
        id={id}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-disabled={disabled || undefined}
        data-placeholder={selectedIndex < 0 || undefined}
        className="pick__trigger"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
      >
        <span className="pick__value">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="pick__chev" aria-hidden="true" />
      </div>
      {anchor &&
        createPortal(
          <div
            ref={panel}
            id={listId}
            role="listbox"
            className="pick__panel"
            style={{ top: anchor.top, left: anchor.left, width: anchor.width, transform: anchor.above ? 'translateY(-100%)' : undefined }}
            onMouseDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                data-active={index === active}
                className="pick__option"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {index === selectedIndex && <Check aria-hidden="true" />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

const pad = (number: number) => String(number).padStart(2, '0');
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Today's date on this device, as YYYY-MM-DD. */
export const todayIso = () => toIso(new Date());

/** Reads a YYYY-MM-DD value as a local date, so the day never shifts with the time zone. */
function fromIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const LONG_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function DateField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  placeholder = 'Choose a date',
  disabled = false,
}: {
  id?: string;
  label?: string;
  /** YYYY-MM-DD, or an empty string for no date. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const selected = fromIso(value);
  const earliest = min ? fromIso(min) : null;
  const latest = max ? fromIso(max) : null;
  const todayIso = toIso(new Date());
  const [open, setOpen] = useState(false);
  // The focused day. The calendar shows the month it is in.
  const [cursor, setCursor] = useState<Date>(() => selected ?? new Date());
  const trigger = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const anchor = useAnchor(open, trigger, 360);
  useDismiss(open, setOpen, trigger, panel);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + index));
  }, [cursor]);

  // Keyboard focus follows the focused day, so arrow keys move through the calendar. The panel is
  // placed after the first render, so the effect waits for it.
  const placed = anchor !== null;
  useEffect(() => {
    if (open && placed) panel.current?.querySelector<HTMLButtonElement>(`[data-iso="${toIso(cursor)}"]`)?.focus();
  }, [open, placed, cursor]);

  // A calendar is 300 px wide, or narrower on a small window.
  const calendarWidth = Math.min(300, window.innerWidth - 32);

  const isBlocked = (day: Date) => Boolean((earliest && day < earliest) || (latest && day > latest));

  const openCalendar = () => {
    if (disabled) return;
    setCursor(selected ?? new Date());
    setOpen(true);
  };

  const choose = (day: Date | null) => {
    onChange(day ? toIso(day) : '');
    setOpen(false);
    trigger.current?.focus();
  };

  const shiftDays = (count: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + count));

  const shiftMonth = (count: number) =>
    setCursor((current) => {
      const target = new Date(current.getFullYear(), current.getMonth() + count, 1);
      const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      return new Date(target.getFullYear(), target.getMonth(), Math.min(current.getDate(), last));
    });

  const onTriggerKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
      event.preventDefault();
      openCalendar();
    }
  };

  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') shiftDays(-1);
    else if (event.key === 'ArrowRight') shiftDays(1);
    else if (event.key === 'ArrowUp') shiftDays(-7);
    else if (event.key === 'ArrowDown') shiftDays(7);
    else if (event.key === 'PageUp') shiftMonth(-1);
    else if (event.key === 'PageDown') shiftMonth(1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    } else if (event.key === 'Tab') {
      setOpen(false);
      return;
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <div className="pick">
      <div
        ref={trigger}
        id={id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        data-placeholder={!selected || undefined}
        className="pick__trigger"
        onClick={() => (open ? setOpen(false) : openCalendar())}
        onKeyDown={onTriggerKey}
      >
        <span className="pick__value">{selected ? SHORT_DATE.format(selected) : placeholder}</span>
        <CalendarDays className="pick__chev" aria-hidden="true" />
      </div>
      {anchor &&
        createPortal(
          <div
            ref={panel}
            className="pick__panel cal"
            role="dialog"
            aria-label={label ? `Choose ${label.toLowerCase()}` : 'Choose a date'}
            style={{
              top: anchor.top,
              left: Math.max(16, Math.min(anchor.left, window.innerWidth - calendarWidth - 16)),
              width: calendarWidth,
              transform: anchor.above ? 'translateY(-100%)' : undefined,
            }}
            onKeyDown={onPanelKey}
          >
            <div className="cal__head">
              <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                <ChevronLeft />
              </button>
              <span className="cal__title" aria-live="polite">
                {MONTH.format(cursor)}
              </span>
              <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label="Next month" onClick={() => shiftMonth(1)}>
                <ChevronRight />
              </button>
            </div>
            <div className="cal__grid">
              {WEEKDAYS.map((day) => (
                <span key={day} className="cal__dow" aria-hidden="true">
                  {day}
                </span>
              ))}
              {days.map((day) => {
                const iso = toIso(day);
                return (
                  <button
                    key={iso}
                    type="button"
                    data-iso={iso}
                    className="cal__day"
                    data-outside={day.getMonth() !== cursor.getMonth() || undefined}
                    data-today={iso === todayIso || undefined}
                    aria-pressed={iso === value}
                    aria-label={LONG_DATE.format(day)}
                    disabled={isBlocked(day)}
                    tabIndex={iso === toIso(cursor) ? 0 : -1}
                    onClick={() => choose(day)}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="cal__foot">
              <button type="button" className="btn btn--text" onClick={() => choose(null)} disabled={!value}>
                Clear
              </button>
              <button
                type="button"
                className="btn btn--text"
                onClick={() => choose(new Date())}
                disabled={isBlocked(fromIso(todayIso) ?? new Date())}
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
