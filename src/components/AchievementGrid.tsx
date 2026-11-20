// The achievements on the profile: a badge for each one, unlocked or locked, with the count toward it.
import { Bookmark, Crown, Flame, Footprints, Layers, MessageCircle, PenLine, Sparkles, Trophy, Zap, type LucideIcon } from 'lucide-react';
import { useT } from '../lib/i18n/react';
import type { Achievement, AchievementId } from '../lib/achievements';

const ICON: Record<AchievementId, LucideIcon> = {
  'first-steps': Footprints,
  'on-a-roll': Flame,
  unstoppable: Crown,
  'thousand-club': Zap,
  'lesson-master': Trophy,
  'deck-builder': Layers,
  'card-shark': Sparkles,
  'careful-writer': PenLine,
  'word-collector': Bookmark,
  conversationalist: MessageCircle,
};

export function AchievementGrid({ items }: { items: Achievement[] }) {
  const t = useT();
  const unlocked = items.filter((item) => item.unlocked).length;
  return (
    <section className="card achievements" aria-label={t('Achievements')}>
      <div className="achievements__head">
        <span className="achievements__title">{t('Achievements')}</span>
        <span className="achievements__count">{t('{done} of {total} unlocked', { done: unlocked, total: items.length })}</span>
      </div>
      <ul className="achievements__grid">
        {items.map((item) => {
          const Icon = ICON[item.id];
          const title = achievementTitle(t, item.id);
          const text = achievementText(t, item.id);
          return (
            <li key={item.id} className={item.unlocked ? 'achievement achievement--on' : 'achievement'}>
              <span className="achievement__badge" aria-hidden="true">
                <Icon />
              </span>
              <span className="achievement__body">
                <span className="achievement__title">{title}</span>
                <span className="achievement__text">{text}</span>
                <span
                  className="achievement__bar"
                  role="progressbar"
                  aria-label={title}
                  aria-valuemin={0}
                  aria-valuemax={item.need}
                  aria-valuenow={item.value}
                >
                  <span style={{ width: `${(item.value / item.need) * 100}%` }} />
                </span>
                <span className="achievement__state">
                  {item.unlocked ? t('Unlocked') : t('{value} of {need}', { value: item.value, need: item.need })}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function achievementTitle(t: ReturnType<typeof useT>, id: AchievementId): string {
  switch (id) {
    case 'first-steps':
      return t('First steps');
    case 'on-a-roll':
      return t('On a roll');
    case 'unstoppable':
      return t('Unstoppable');
    case 'thousand-club':
      return t('Thousand club');
    case 'lesson-master':
      return t('Lesson master');
    case 'deck-builder':
      return t('Deck builder');
    case 'card-shark':
      return t('Card shark');
    case 'careful-writer':
      return t('Careful writer');
    case 'word-collector':
      return t('Word collector');
    case 'conversationalist':
      return t('Conversationalist');
  }
}

function achievementText(t: ReturnType<typeof useT>, id: AchievementId): string {
  switch (id) {
    case 'first-steps':
      return t('Finish one lesson or test.');
    case 'on-a-roll':
      return t('Practise seven days in a row.');
    case 'unstoppable':
      return t('Practise thirty days in a row.');
    case 'thousand-club':
      return t('Earn 1000 XP.');
    case 'lesson-master':
      return t('Complete 25 lessons.');
    case 'deck-builder':
      return t('Make your first deck.');
    case 'card-shark':
      return t('Study 100 flashcards.');
    case 'careful-writer':
      return t('Run five writing checks.');
    case 'word-collector':
      return t('Save ten words from the reader.');
    case 'conversationalist':
      return t('Finish three role-play scenarios.');
  }
}
