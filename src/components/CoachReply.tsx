// One reply of the coach as the learner sees it: its text, its cards (exercises, feedback, vocabulary, actions and
// quick replies), and the actions under it (copy, listen, write again, continue). The card rules live in
// lib/coachReply.ts and lib/coachVocab.ts; this file only draws them and keeps the learner's answers.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { ArrowRight, BookmarkCheck, BookmarkPlus, Check, Copy, Pencil, RotateCcw, Square, Volume2, X } from 'lucide-react';
import { bundledTest } from '../content';
import {
  averageScore,
  BLANK,
  gapMatches,
  gradeItem,
  isAppRoute,
  parseCoachReply,
  scoreExercise,
  spokenText,
  type AppAction,
  type CoachPart,
  type Exercise,
  type ExerciseItem,
  type Feedback,
  type ItemResponse,
  type VocabItem,
} from '../lib/coachReply';
import { vocabCloze, vocabKey } from '../lib/coachVocab';
import { clearDraft, localDrafts, readDraft, writeDraft, type DraftStore } from '../lib/drafts';
import { getLocale } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { narrate, type Narration } from '../lib/speech';

// The coach's text is shown as Markdown. Links are shown as plain words: the coach does not open web pages.
const replyParts: Components = {
  a: ({ children }) => <span>{children}</span>,
};

/** Whether the app can open a path the coach suggests: a known page, and a lesson or test that exists. */
export function canOpen(path: string): boolean {
  if (!isAppRoute(path)) return false;
  const item = /^\/play\/(lesson|test)\/(.+)$/.exec(path);
  return item ? bundledTest(item[2]) !== null : true;
}

/** What is kept for one exercise: the answers so far, and whether they have been checked. */
interface ExerciseState {
  responses: Record<string, ItemResponse>;
  checked: boolean;
}

function isExerciseState(value: unknown): value is ExerciseState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<ExerciseState>;
  return typeof state.checked === 'boolean' && typeof state.responses === 'object' && state.responses !== null;
}

function hasAnswer(response: ItemResponse | undefined): boolean {
  if (typeof response === 'number') return true;
  if (typeof response === 'string') return response.trim().length > 0;
  return Array.isArray(response) && response.some((word) => word.trim().length > 0);
}

/** The right answer of an item, as the learner sees it after a check. */
function rightAnswer(item: ExerciseItem): string {
  if (item.type === 'choice') return item.options[item.answer];
  if (item.type === 'gap') return item.answers.map((answer) => answer.split('|')[0]).join(', ');
  return '';
}

/** What the learner gave, written out for the coach. */
function givenAnswer(item: ExerciseItem, response: ItemResponse | undefined, noAnswer: string): string {
  if (item.type === 'choice') return typeof response === 'number' && item.options[response] ? item.options[response] : noAnswer;
  if (item.type === 'gap') {
    const words = Array.isArray(response) ? response.filter((word) => word.trim().length > 0) : [];
    return words.length > 0 ? words.join(', ') : noAnswer;
  }
  return typeof response === 'string' && response.trim() ? response.trim() : noAnswer;
}

/** Reads text aloud with the voice the learner chose. A press stops it. */
export function ListenButton({ text, label, compact = false }: { text: string; label?: string; compact?: boolean }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const narration = useRef<Narration | null>(null);

  useEffect(() => () => narration.current?.stop(), []);

  const toggle = () => {
    if (narration.current) {
      narration.current.stop();
      return;
    }
    setNotice(null);
    narration.current = narrate(text, {
      onStart: () => setPlaying(true),
      onEnd: () => {
        narration.current = null;
        setPlaying(false);
      },
      onNotice: (message) => setNotice(message),
    });
  };

  const name = label ?? (playing ? t('Stop reading') : t('Read aloud'));
  return (
    <span className={compact ? 'coach-listen coach-listen--compact' : 'coach-listen'}>
      <button type="button" className={compact ? 'btn btn--ghost btn--icon btn--sm' : 'turn__tool'} onClick={toggle} aria-pressed={playing} aria-label={name} title={name}>
        {playing ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        {!compact && <span>{playing ? t('Stop reading') : t('Read aloud')}</span>}
      </button>
      {notice && <span className="coach-listen__notice small muted">{notice}</span>}
    </span>
  );
}

function ExerciseCard({
  exercise,
  storeKey,
  busy,
  onSend,
}: {
  exercise: Exercise;
  /** Where the answers are kept on this device, or null when they are not kept. */
  storeKey: string | null;
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const t = useT();
  const store = useMemo<DraftStore | null>(() => localDrafts(), []);
  const [state, setState] = useState<ExerciseState>(
    () => (storeKey ? readDraft(store, storeKey, isExerciseState) : null) ?? { responses: {}, checked: false },
  );
  const { responses, checked } = state;
  const scored = useMemo(() => scoreExercise(exercise.items, responses), [exercise.items, responses]);
  const title = exercise.title || t('Practice');
  const noAnswer = t('no answer');

  // The answers stay on this device, so leaving the chat does not lose them. An exercise with nothing answered keeps none.
  useEffect(() => {
    if (!storeKey) return;
    if (checked || Object.keys(responses).length > 0) writeDraft(store, storeKey, state);
    else clearDraft(store, storeKey);
  }, [store, storeKey, state, checked, responses]);

  const answer = (index: number, response: ItemResponse) =>
    setState((current) => ({ ...current, responses: { ...current.responses, [index]: response } }));

  const typeBlank = (index: number, blank: number, word: string, blanks: number) =>
    setState((current) => {
      const previous = current.responses[index];
      const words = Array.isArray(previous) ? [...previous] : Array.from({ length: blanks }, () => '');
      words[blank] = word;
      return { ...current, responses: { ...current.responses, [index]: words } };
    });

  const check = () => setState((current) => ({ ...current, checked: true }));
  const tryAgain = () => setState({ responses: {}, checked: false });
  const gradable = scored.graded > 0;
  const hasAnswers = Object.values(responses).some(hasAnswer);

  const askAboutMistakes = () => {
    const details = scored.wrong.map((index) => {
      const item = exercise.items[index];
      return t('“{prompt}” I wrote “{given}”; the answer is “{right}”.', {
        prompt: item.prompt.replace(BLANK, '…'),
        given: givenAnswer(item, responses[String(index)], noAnswer),
        right: rightAnswer(item),
      });
    });
    onSend(
      t('I got {correct} of {total} right in “{title}”. Explain my mistakes, one at a time: {details}', {
        correct: scored.correct,
        total: scored.graded,
        title,
        details: details.join(' '),
      }),
    );
  };

  return (
    <section className="reply-card reply-card--exercise" aria-label={title}>
      <p className="reply-card__title">{title}</p>
      <ol className="exercise__list">
        {exercise.items.map((item, index) => {
          const response = responses[String(index)];
          if (item.type === 'choice') {
            return (
              <li key={index} className="exercise__item">
                <p className="exercise__prompt">{item.prompt}</p>
                <div className="exercise__options" role="group" aria-label={item.prompt}>
                  {item.options.map((option, optionIndex) => {
                    const selected = response === optionIndex;
                    const right = checked && optionIndex === item.answer;
                    const wrong = checked && selected && optionIndex !== item.answer;
                    const classes = ['exercise__option', selected && 'is-selected', right && 'is-right', wrong && 'is-wrong']
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        className={classes}
                        aria-pressed={selected}
                        disabled={checked || busy}
                        onClick={() => answer(index, optionIndex)}
                      >
                        <span className="exercise__letter" aria-hidden="true">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span>{option}</span>
                        {right && <Check aria-hidden="true" />}
                        {wrong && <X aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
                {checked && item.explain && <p className="exercise__explain">{item.explain}</p>}
              </li>
            );
          }
          if (item.type === 'gap') {
            const words = Array.isArray(response) ? response : [];
            const segments = item.prompt.split(BLANK);
            const itemRight = checked ? gradeItem(item, response) : null;
            return (
              <li key={index} className="exercise__item">
                <p className="exercise__prompt">
                  {segments.map((segment, blank) => {
                    const blankRight = checked && gapMatches(words[blank] ?? '', item.answers[blank]);
                    const blankWrong = checked && !blankRight;
                    return (
                      <Fragment key={blank}>
                        {segment}
                        {blank < segments.length - 1 && (
                          <input
                            className={['exercise__blank', blankRight && 'is-right', blankWrong && 'is-wrong'].filter(Boolean).join(' ')}
                            value={words[blank] ?? ''}
                            onChange={(event) => typeBlank(index, blank, event.target.value, item.answers.length)}
                            disabled={checked || busy}
                            aria-label={t('Word {number} of the sentence', { number: blank + 1 })}
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            size={Math.max(4, Math.min(16, item.answers[blank].split('|')[0].length + 1))}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </p>
                {item.hint && (
                  <details className="exercise__hint">
                    <summary>{t('Hint')}</summary>
                    <p>{item.hint}</p>
                  </details>
                )}
                {checked && itemRight === false && <p className="exercise__answer">{t('Answer: {answer}', { answer: rightAnswer(item) })}</p>}
                {checked && item.explain && <p className="exercise__explain">{item.explain}</p>}
              </li>
            );
          }
          const text = typeof response === 'string' ? response : '';
          return (
            <li key={index} className="exercise__item">
              <p className="exercise__prompt">{item.prompt}</p>
              <textarea
                className="exercise__text"
                rows={2}
                value={text}
                onChange={(event) => answer(index, event.target.value)}
                placeholder={t('Write your answer')}
                aria-label={item.prompt}
                disabled={busy}
              />
              <div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={!text.trim() || busy}
                  onClick={() => onSend(t('Please check my answer to “{prompt}”: {answer}', { prompt: item.prompt, answer: text.trim() }))}
                >
                  {t('Send to the coach')}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {gradable && (
        <div className="exercise__foot">
          {checked ? (
            <>
              <p className="exercise__score" role="status">
                {t('{correct} of {total} correct', { correct: scored.correct, total: scored.graded })}
              </p>
              <div className="exercise__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={tryAgain}>
                  <RotateCcw aria-hidden="true" /> {t('Try again')}
                </button>
                {scored.wrong.length > 0 && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={askAboutMistakes} disabled={busy}>
                    {t('Ask the coach about my mistakes')}
                  </button>
                )}
              </div>
            </>
          ) : (
            <button type="button" className="btn btn--primary btn--sm" onClick={check} disabled={!hasAnswers}>
              {t('Check answers')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  const t = useT();
  const average = averageScore(feedback.scores);
  const number = (value: number) => value.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <section className="reply-card reply-card--feedback" aria-label={feedback.title || t('Feedback')}>
      <header className="reply-card__head">
        <p className="reply-card__title">{feedback.title || t('Feedback')}</p>
        {average !== null && <span className="score-pill">{t('{score} of 5', { score: number(average) })}</span>}
      </header>
      {feedback.scores.length > 0 && (
        <ul className="score-list">
          {feedback.scores.map((item) => (
            <li key={item.label} className="score-row">
              <span className="score-row__label">{item.label}</span>
              <span className="score-row__bar" aria-hidden="true">
                <span style={{ width: `${(item.score / 5) * 100}%` }} />
              </span>
              <span className="score-row__value">{number(item.score)}</span>
            </li>
          ))}
        </ul>
      )}
      {feedback.summary && <p className="reply-card__summary">{feedback.summary}</p>}
      {feedback.corrections.length > 0 && (
        <div className="corrections">
          <p className="reply-card__label">{t('Corrections')}</p>
          <ol className="corrections__list">
            {feedback.corrections.map((item, index) => (
              <li key={index} className="correction">
                <p className="correction__line">
                  <del className="correction__before">{item.before}</del> <span className="correction__after">{item.after}</span>
                </p>
                {item.why && <p className="correction__why">{item.why}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {feedback.model && (
        <details className="reply-card__model">
          <summary>{t('A model version')}</summary>
          <p>{feedback.model}</p>
        </details>
      )}
    </section>
  );
}

function VocabCard({ item, saved, onSave }: { item: VocabItem; saved: boolean; onSave: (item: VocabItem) => Promise<boolean> }) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const usable = vocabCloze(item) !== null;
  const keep = async () => {
    setSaving(true);
    try {
      await onSave(item);
    } finally {
      setSaving(false);
    }
  };
  return (
    <article className="vocab-card">
      <div className="vocab-card__head">
        <span className="vocab-card__word">{item.word}</span>
        <ListenButton text={item.word} label={t('Listen to the word')} compact />
      </div>
      <p className="vocab-card__meaning">{item.meaning}</p>
      {item.example && <p className="vocab-card__example">{item.example}</p>}
      {item.note && <p className="vocab-card__note">{item.note}</p>}
      <div className="vocab-card__foot">
        {saved ? (
          <span className="vocab-card__saved">
            <BookmarkCheck aria-hidden="true" /> {t('In your review')}
          </span>
        ) : usable ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={keep} disabled={saving}>
            <BookmarkPlus aria-hidden="true" /> {t('Save to review')}
          </button>
        ) : (
          <span className="small muted">{t('This example does not use the word, so it cannot be saved.')}</span>
        )}
      </div>
    </article>
  );
}

function ActionRow({ actions, onNavigate }: { actions: AppAction[]; onNavigate: (to: string) => void }) {
  const usable = actions.filter((action) => canOpen(action.to));
  if (usable.length === 0) return null;
  return (
    <div className="action-row">
      {usable.map((action) => (
        <button key={`${action.to}-${action.label}`} type="button" className="action-row__item" onClick={() => onNavigate(action.to)}>
          {action.label} <ArrowRight aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export interface AssistantReplyProps {
  id: string;
  text: string;
  /** The reply is still being written: no tools yet, and a cursor at its end. */
  streaming?: boolean;
  /** The newest message of the chat: its quick replies and its tools show. */
  latest: boolean;
  /** A reply or a file is on its way: buttons that would start another one wait. */
  busy: boolean;
  /** The reply stopped because it ran out of room, so it can be continued. */
  cut: boolean;
  /** Where the answers of this reply's exercises are kept on this device. Null when they are not kept. */
  draftPrefix: string | null;
  /** The keys of the review items the learner already has, so a saved word shows as saved. */
  reviewKeys: ReadonlySet<string>;
  onSend: (text: string) => void;
  onSaveWord: (item: VocabItem) => Promise<boolean>;
  onNavigate: (to: string) => void;
  onRegenerate: () => void;
  onContinue: () => void;
  onCopy: (text: string) => void;
}

/** A reply of the coach: its parts in order, the quick replies under the newest one, and its tools. */
export function AssistantReply({
  id,
  text,
  streaming = false,
  latest,
  busy,
  cut,
  draftPrefix,
  reviewKeys,
  onSend,
  onSaveWord,
  onNavigate,
  onRegenerate,
  onContinue,
  onCopy,
}: AssistantReplyProps) {
  const t = useT();
  const parts = useMemo(() => parseCoachReply(text), [text]);
  const chips = [...new Set(parts.flatMap((part) => (part.kind === 'chips' ? part.chips : [])))];
  const spoken = spokenText(parts);
  const plain = parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])).join('\n\n');

  const renderPart = (part: CoachPart, index: number) => {
    switch (part.kind) {
      case 'text':
        return (
          <div key={`text-${index}`} className="reply-text">
            <ReactMarkdown components={replyParts}>{part.text}</ReactMarkdown>
          </div>
        );
      case 'exercise':
        return (
          <ExerciseCard
            key={`${id}-exercise-${index}`}
            exercise={part.exercise}
            storeKey={draftPrefix ? `${draftPrefix}:${index}` : null}
            busy={busy}
            onSend={onSend}
          />
        );
      case 'feedback':
        return <FeedbackCard key={`${id}-feedback-${index}`} feedback={part.feedback} />;
      case 'vocab':
        return (
          <div key={`${id}-vocab-${index}`} className="vocab-grid">
            {part.items.map((item) => (
              <VocabCard key={item.word} item={item} saved={reviewKeys.has(vocabKey(item.word))} onSave={onSaveWord} />
            ))}
          </div>
        );
      case 'actions':
        return <ActionRow key={`${id}-actions-${index}`} actions={part.actions} onNavigate={onNavigate} />;
      case 'chips':
        return null;
    }
  };

  return (
    <div className={`turn turn--coach${streaming ? ' is-writing' : ''}`}>
      <span className="turn__avatar" aria-hidden="true">
        <span className="turn__mark" />
      </span>
      <div className="turn__body">
        {parts.map(renderPart)}
        {streaming && <span className="turn__cursor" aria-hidden="true" />}
        {!streaming && latest && chips.length > 0 && (
          <div className="suggest suggest--replies" role="group" aria-label={t('Quick replies')}>
            {chips.map((chip) => (
              <button key={chip} type="button" onClick={() => onSend(chip)} disabled={busy}>
                {chip}
              </button>
            ))}
          </div>
        )}
        {!streaming && text.trim() && (
          <div className="turn__tools">
            <button type="button" className="turn__tool" onClick={() => onCopy(plain || text)} title={t('Copy')}>
              <Copy aria-hidden="true" /> <span>{t('Copy')}</span>
            </button>
            {spoken && <ListenButton text={spoken} />}
            {latest && cut && (
              <button type="button" className="turn__tool" onClick={onContinue} disabled={busy}>
                <ArrowRight aria-hidden="true" /> <span>{t('Continue')}</span>
              </button>
            )}
            {latest && (
              <button type="button" className="turn__tool" onClick={onRegenerate} disabled={busy}>
                <RotateCcw aria-hidden="true" /> <span>{t('Write it again')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The learner's own message: a bubble, its files, and the actions under it. */
export function LearnerTurn({
  text,
  files,
  editable,
  busy,
  onCopy,
  onEdit,
  children,
}: {
  text: string;
  files: ReactNode;
  editable: boolean;
  busy: boolean;
  onCopy: (text: string) => void;
  onEdit: () => void;
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="turn turn--user">
      {files}
      {text && <div className="turn__bubble">{text}</div>}
      {children}
      {text && (
        <div className="turn__tools turn__tools--user">
          {editable && (
            <button type="button" className="turn__tool" onClick={onEdit} disabled={busy}>
              <Pencil aria-hidden="true" /> <span>{t('Edit and send again')}</span>
            </button>
          )}
          <button type="button" className="turn__tool" onClick={() => onCopy(text)} title={t('Copy')}>
            <Copy aria-hidden="true" /> <span>{t('Copy')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
