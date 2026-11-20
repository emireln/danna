// The three daily quests, each with its progress. A finished quest shows a check.
import { Check, Layers, ListChecks, Timer } from 'lucide-react';
import { useT } from '../lib/i18n/react';
import { QUEST_FLASHCARD_TARGET, QUEST_MINUTES_TARGET, type Quest } from '../lib/quests';

export function QuestList({ quests }: { quests: Quest[] }) {
  const t = useT();
  const doneCount = quests.filter((item) => item.done).length;
  return (
    <section className="quests" aria-label={t('Quests')}>
      <div className="quests__head">
        <span>{t('Quests')}</span>
        <span className="quests__count">{t('{done} of {total} done', { done: doneCount, total: quests.length })}</span>
      </div>
      <ul className="quests__list">
        {quests.map((item) => {
          const title =
            item.id === 'lesson'
              ? t('Finish a lesson or a test')
              : item.id === 'flashcards'
                ? t('Study {count} flashcards', { count: QUEST_FLASHCARD_TARGET })
                : t('Practise for {count} minutes', { count: QUEST_MINUTES_TARGET });
          return (
            <li key={item.id} className={item.done ? 'quest quest--done' : 'quest'}>
              <span className="quest__icon" aria-hidden="true">
                {item.done ? <Check /> : item.id === 'lesson' ? <ListChecks /> : item.id === 'flashcards' ? <Layers /> : <Timer />}
              </span>
              <span className="quest__body">
                <span className="quest__title">{title}</span>
                <span
                  className="quest__bar"
                  role="progressbar"
                  aria-label={title}
                  aria-valuemin={0}
                  aria-valuemax={item.target}
                  aria-valuenow={item.progress}
                >
                  <span style={{ width: `${(item.progress / item.target) * 100}%` }} />
                </span>
              </span>
              <span className="quest__count">
                {item.progress}/{item.target}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
