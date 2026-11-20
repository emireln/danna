// The app's language, as two choices. It sits in the title bar and in Settings.
import { LANGUAGES, type Lang } from '../lib/i18n';
import { useLanguage } from '../lib/i18n/react';
import brFlag from '../assets/flags/br.svg';
import usFlag from '../assets/flags/us.svg';
import { Tabs, type TabItem } from './ui';

// Each language is shown by its country's flag. The name stays on the tab for screen readers and as a tooltip.
const FLAGS: Record<Lang, string> = { en: usFlag, pt: brFlag };

export function LanguageSwitch({ block = false }: { block?: boolean }) {
  const { lang, setLang, t } = useLanguage();
  const items: TabItem<Lang>[] = LANGUAGES.map((item) => ({
    value: item.code,
    label: item.label,
    icon: <img className="lang-flag" src={FLAGS[item.code]} alt="" />,
    iconOnly: true,
  }));
  return <Tabs<Lang> label={t('App language')} items={items} value={lang} onChange={setLang} block={block} />;
}
