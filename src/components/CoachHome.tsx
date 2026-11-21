// The coach's home: what the learner is working on, the ways to work with the coach (the modes), a few questions to
// start from, and the recent chats. It is what a learner sees before a chat starts.
import type { ComponentType } from 'react';
import { BookOpen, ListChecks, Languages, MessageCircle, Mic, PenLine, Radio, RefreshCw, Target, Users } from 'lucide-react';
import { coachMode, COACH_MODES, type CoachModeId, type ModeIcon } from '../lib/coachModes';
import { roleplayModeId, SCENARIOS } from '../lib/scenarios';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { daysUntil } from '../lib/progress';
import { SKILL_LABEL, type Goal, type Level, type Skill, type TutorChatRow } from '../lib/types';

const ICONS: Record<ModeIcon, ComponentType<{ 'aria-hidden'?: boolean }>> = {
  chat: MessageCircle,
  people: Users,
  pen: PenLine,
  mic: Mic,
  live: Radio,
  target: Target,
  rule: ListChecks,
  words: Languages,
  book: BookOpen,
  repeat: RefreshCw,
};

export interface CoachHomeProps {
  level: Level;
  goal: Goal;
  targetScore: number;
  examDate: string | null;
  examName: string | null;
  /** The latest score in each skill, out of 100. */
  skills: Partial<Record<Skill, number>>;
  /** How many answers are waiting for review. */
  reviewCount: number;
  /** The newest chats that are not archived. */
  recentChats: TutorChatRow[];
  /** A few questions to start from, picked for this visit. */
  starters: string[];
  busy: boolean;
  onMode: (id: CoachModeId) => void;
  onOpenChat: (id: string) => void;
  onStarter: (text: string) => void;
  onNavigate: (to: string) => void;
}

export function CoachHome({
  level,
  goal,
  targetScore,
  examDate,
  examName,
  skills,
  reviewCount,
  recentChats,
  starters,
  busy,
  onMode,
  onOpenChat,
  onStarter,
  onNavigate,
}: CoachHomeProps) {
  const t = useT();
  const scored = (Object.keys(skills) as Skill[]).filter((skill) => typeof skills[skill] === 'number');
  const weakest = scored.length > 0 ? scored.reduce((low, skill) => ((skills[skill] ?? 0) < (skills[low] ?? 0) ? skill : low), scored[0]) : null;
  const days = examDate ? daysUntil(examDate) : null;
  const goalText = goal === 'toefl' ? t('the TOEFL iBT, target {score}', { score: targetScore }) : t('general English');
  const freeMode = coachMode('chat');
  const FreeIcon = ICONS[freeMode.icon];

  return (
    <section className="coach-home" aria-label={t('Your coach')}>
      <div className="coach-home__hero">
        <p className="eyebrow">{t('Your coach')}</p>
        <h2 className="coach-home__title">{t('What would you like to work on?')}</h2>
        <p className="coach-home__lead">{t('Level {level}, studying for {goal}.', { level, goal: goalText })}</p>
      </div>

      <div className="coach-home__focus">
        <button type="button" className="focus-card" onClick={() => onNavigate('/exam')}>
          <span className="focus-card__label">{examName || t('Your exam')}</span>
          <span className="focus-card__value">
            {days === null
              ? t('Set a date')
              : days > 0
                ? tn('{count} day left', '{count} days left', days, { count: days })
                : days === 0
                  ? t('Today')
                  : t('Passed')}
          </span>
        </button>
        <button
          type="button"
          className="focus-card"
          onClick={() => (weakest ? onNavigate(`/study/${weakest}`) : onNavigate('/study'))}
          disabled={busy}
        >
          <span className="focus-card__label">{t('Weakest skill')}</span>
          <span className="focus-card__value">
            {weakest ? `${t(SKILL_LABEL[weakest])} · ${Math.round(skills[weakest] ?? 0)}` : t('Not tested yet')}
          </span>
        </button>
        <button type="button" className="focus-card" onClick={() => onMode('review')} disabled={busy}>
          <span className="focus-card__label">{t('Answers to review')}</span>
          <span className="focus-card__value">{reviewCount}</span>
        </button>
      </div>

      <h3 className="coach-home__label">{t('Choose a way to work')}</h3>
      <div className="mode-grid">
        <button type="button" className="mode-card mode-card--free" onClick={() => onMode(freeMode.id)} disabled={busy}>
          <span className={`mode-card__icon mode-card__icon--${freeMode.icon}`}>
            <FreeIcon aria-hidden={true} />
          </span>
          <span className="mode-card__title">{t(freeMode.title)}</span>
          <span className="mode-card__blurb">{t(freeMode.blurb)}</span>
        </button>
        {COACH_MODES.filter((mode) => mode.id !== 'chat').map((mode) => {
          const Icon = ICONS[mode.icon];
          return (
            <button key={mode.id} type="button" className="mode-card" onClick={() => onMode(mode.id)} disabled={busy}>
              <span className={`mode-card__icon mode-card__icon--${mode.icon}`}>
                <Icon aria-hidden={true} />
              </span>
              <span className="mode-card__title">{t(mode.title)}</span>
              <span className="mode-card__blurb">{t(mode.blurb)}</span>
            </button>
          );
        })}
      </div>

      <h3 className="coach-home__label">{t('Role-play scenes')}</h3>
      <div className="roleplay-grid">
        {SCENARIOS.map((scene) => (
          <button key={scene.id} type="button" className="roleplay-card" onClick={() => onMode(roleplayModeId(scene.id))} disabled={busy}>
            <span className="roleplay-card__title">{t(scene.title)}</span>
            <span className="roleplay-card__with">{t('With {who}', { who: t(scene.character) })}</span>
            <span className="roleplay-card__goal">{t(scene.goal)}</span>
          </button>
        ))}
      </div>

      {starters.length > 0 && (
        <div className="coach-home__ask">
          <p className="coach-home__label">{t('Or start with a question')}</p>
          <div className="suggest">
            {starters.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => onStarter(t(suggestion))} disabled={busy}>
                {t(suggestion)}
              </button>
            ))}
          </div>
        </div>
      )}

      {recentChats.length > 0 && (
        <div className="coach-home__recent">
          <h3 className="coach-home__label">{t('Recent chats')}</h3>
          <ul className="recent-list">
            {recentChats.map((chat) => (
              <li key={chat.id}>
                <button type="button" className="recent-list__item" onClick={() => onOpenChat(chat.id)} disabled={busy}>
                  <span className="recent-list__title">{chat.title || t('Untitled chat')}</span>
                  <span className="recent-list__mode">{t(coachMode(chat.mode).title)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
