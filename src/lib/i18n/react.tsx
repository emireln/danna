// React access to the language. A component that shows text calls useT(), so it draws again when the
// language changes. Without a LanguageProvider (for example in a static render), it still works in English.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { bridge } from '../bridge';
import { getLang, setLang as storeLang, t as translate, type Lang, type Vars } from './index';

export type Translate = (text: string, vars?: Vars) => string;

interface LanguageApi {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
}

const LanguageContext = createContext<LanguageApi>({ lang: 'en', setLang: storeLang, t: translate });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(getLang);

  const setLang = useCallback((next: Lang) => {
    storeLang(next);
    setState(next);
  }, []);

  // The desktop shell (its tray menu) uses the same language, so it is told each time the app's language changes.
  useEffect(() => {
    bridge?.settings.set({ language: lang }).catch(() => undefined);
  }, [lang]);

  const api = useMemo<LanguageApi>(() => ({ lang, setLang, t: translate }), [lang, setLang]);
  return <LanguageContext.Provider value={api}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageApi {
  return useContext(LanguageContext);
}

export function useT(): Translate {
  return useContext(LanguageContext).t;
}
