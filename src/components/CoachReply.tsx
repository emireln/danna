import { Fragment, useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Check, RotateCcw, Square, Volume2, X } from 'lucide-react';
import {
  BLANK,
  gapMatches,
  gradeItem,
  parseCoachReply,
  scoreExercise,
  spokenText,
  type Exercise,
  type ExerciseItem,
  type ItemResponse,
} from '../lib/coachReply';
import { clearDraft, localDrafts, readDraft, writeDraft, type DraftStore } from '../lib/drafts';
import { useT } from '../lib/i18n/react';
import { narrate, type Narration } from '../lib/speech';

// The coach's text is shown as Markdown. Links are shown as plain words: the coach does not open pages.
const replyParts: Components = {
  a: ({ children }) => <span>{children}</span>,
};

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

/** The first accepted answer of each blank, as the learner sees it after a check. */
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
    <section className="exercise" aria-label={title}>
      <p className="exercise__title">{title}</p>
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

/** Reads the coach's words aloud with the voice the learner chose. A press stops it. */
function ReadAloud({ text }: { text: string }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [narration, setNarration] = useState<Narration | null>(null);

  useEffect(() => () => narration?.stop(), [narration]);

  const toggle = () => {
    if (narration) {
      narration.stop();
      return;
    }
    setNotice(null);
    const started = narrate(text, {
      onStart: () => setPlaying(true),
      onEnd: () => {
        setNarration(null);
        setPlaying(false);
      },
      onNotice: (message) => setNotice(message),
    });
    setNarration(started);
  };

  return (
    <div className="read-aloud">
      <button type="button" className="btn btn--text btn--sm" onClick={toggle} aria-pressed={playing}>
        {playing ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        {playing ? t('Stop reading') : t('Read aloud')}
      </button>
      {notice && <p className="small muted">{notice}</p>}
    </div>
  );
}

/** One reply of the coach: its text, its exercises, its quick replies (under the newest reply only) and read aloud. */
export function CoachReply({
  id,
  text,
  latest,
  busy,
  draftPrefix,
  onSend,
}: {
  id: string;
  text: string;
  /** True for the newest reply, the only one whose quick replies show. */
  latest: boolean;
  busy: boolean;
  /** The start of the key that keeps this reply's exercise answers on this device. Null when they are not kept. */
  draftPrefix: string | null;
  onSend: (text: string) => void;
}) {
  const t = useT();
  const parts = useMemo(() => parseCoachReply(text), [text]);
  const chips = [...new Set(parts.flatMap((part) => (part.kind === 'chips' ? part.chips : [])))];
  const spoken = spokenText(parts);

  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === 'text') {
          return (
            <div key={`text-${index}`} className="bubble bubble--coach bubble--rich">
              <ReactMarkdown components={replyParts}>{part.text}</ReactMarkdown>
            </div>
          );
        }
        if (part.kind === 'exercise') {
          return (
            <ExerciseCard
              key={`${id}-exercise-${index}`}
              exercise={part.exercise}
              storeKey={draftPrefix ? `${draftPrefix}:${index}` : null}
              busy={busy}
              onSend={onSend}
            />
          );
        }
        return null;
      })}
      {latest && chips.length > 0 && (
        <div className="suggest suggest--replies" role="group" aria-label={t('Quick replies')}>
          {chips.map((chip) => (
            <button key={chip} type="button" onClick={() => onSend(chip)} disabled={busy}>
              {chip}
            </button>
          ))}
        </div>
      )}
      {spoken && <ReadAloud text={spoken} />}
    </>
  );
}
