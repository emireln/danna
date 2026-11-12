// The app's language, as two choices. It sits in the title bar and in Settings.
import { LANGUAGES, type Lang } from '../lib/i18n';
import { useLanguage } from '../lib/i18n/react';
import { Tabs } from './ui';

export function LanguageSwitch({ block = false }: { block?: boolean }) {
  const { lang, setLang, t } = useLanguage();
  const items = LANGUAGES.map((item) => ({ value: item.code, label: item.label }));
  return <Tabs<Lang> label={t('App language')} items={items} value={lang} onChange={setLang} block={block} />;
}
