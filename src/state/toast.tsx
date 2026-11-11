import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Tone = 'default' | 'ok' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastApi {
  notify: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const notify = useCallback((message: string, tone: Tone = 'default') => {
    const id = nextId.current++;
    setItems((previous) => [...previous.slice(-2), { id, message, tone }]);
    window.setTimeout(
      () => setItems((previous) => previous.filter((item) => item.id !== id)),
      tone === 'error' ? 5200 : 3000,
    );
  }, []);

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              className={`toast ${item.tone === 'error' ? 'toast--error' : item.tone === 'ok' ? 'toast--ok' : ''}`}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              {item.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}
