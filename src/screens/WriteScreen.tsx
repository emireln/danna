// The writing check (2.0.0): write a text, check it, and take or leave each suggestion. With an AI key a model finds the
// issues and writes the reasons; without one, the local rules find the basics. A check is saved as a practice run.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, Plus, Sparkles } from 'lucide-react';
import { Field, Notice, PageHeader, ProgressBar } from '../components/ui';
import { errorText } from '../lib/bridge';
import { extractJson } from '../lib/ai';
import { replyLanguage } from '../lib/i18n';
import { useT, type Translate } from '../lib/i18n/react';
import { applyIssue, localCheck, parseCheck, WRITING_CHECK_XP, WRITING_MAX_WORDS, WRITING_MIN_WORDS, wordCount, writingCheckRequest, type CheckResult, type Issue, type IssueCategory, type Tone } from '../lib/writingCheck';
import { CORRECTIONS_NAMES } from '../lib/deck';
import { WRITING_REF } from '../lib/quests';
import { localDate, nextStreak } from '../lib/progress';
import { useAI } from '../state/ai';
import { useAppData } from '../state/appData';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

function categoryName(t: Translate, category: IssueCategory): string {
  switch (category) {
    case 'spelling':
      return t('Spelling');
    case 'grammar':
      return t('Grammar');
    case 'word_choice':
      return t('Word choice');
    case 'clarity':
      return t('Clarity');
    case 'punctuation':
      return t('Punctuation');
    case 'tone':
      return t('Tone');
  }
}

function toneName(t: Translate, tone: Tone): string {
  switch (tone) {
    case 'formal':
      return t('Formal');
    case 'neutral':
      return t('Neutral');
    case 'friendly':
      return t('Friendly');
    case 'casual':
      return t('Casual');
    case 'assertive':
      return t('Assertive');
  }
}

/** The text with its issues marked, in order. Issues never overlap. */
function segmentsOf(text: string, issues: readonly Issue[]): Array<{ text: string; issue?: Issue }> {
  const sorted = [...issues].sort((a, b) => a.start - b.start);
  const out: Array<{ text: string; issue?: Issue }> = [];
  let cursor = 0;
  for (const issue of sorted) {
    if (issue.start < cursor || issue.end > text.length) continue;
    if (issue.start > cursor) out.push({ text: text.slice(cursor, issue.start) });
    out.push({ text: text.slice(issue.start, issue.end), issue });
    cursor = issue.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

export function WriteScreen() {
  const t = useT();
  const navigate = useNavigate();
  const { backend } = useAuth();
  const { complete, ready, selection } = useAI();
  const { profile, patchProfile } = useAppData();
  const { notify } = useToast();
  const [text, setText] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = wordCount(text);
  const tooShort = words < WRITING_MIN_WORDS;
  const tooLong = words > WRITING_MAX_WORDS;
  const aiOn = ready && Boolean(selection);
  const segments = useMemo(() => (result ? segmentsOf(text, result.issues) : []), [text, result]);

  // A check is saved as a practice run: it counts for the profile, the league and the achievements.
  const saveRun = async (next: CheckResult) => {
    if (!backend) return;
    try {
      await backend.insertAttempt({
        kind: 'practice',
        ref_id: WRITING_REF,
        title: t('Writing check'),
        score_pct: next.score,
        predicted: null,
        skills: { writing: next.score },
        answers: [],
        duration_s: 0,
        xp: WRITING_CHECK_XP,
      });
      if (profile) {
        const today = localDate();
        await patchProfile({ xp: profile.xp + WRITING_CHECK_XP, streak: nextStreak(profile.last_active, profile.streak, today), last_active: today });
      }
    } catch (failure) {
      notify(t(errorText(failure)), 'error');
    }
  };

  const check = async () => {
    if (tooShort || tooLong || busy) return;
    setBusy(true);
    setError(null);
    try {
      let next: CheckResult;
      if (aiOn) {
        const request = writingCheckRequest(text, replyLanguage());
        const reply = await complete({ system: request.system, messages: [{ role: 'user', content: request.prompt }], json: true, maxTokens: 1500 });
        next = parseCheck(extractJson(reply.text), text);
      } else {
        next = localCheck(text);
      }
      setResult(next);
      await saveRun(next);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  const useIssue = (issue: Issue) => {
    if (!result) return;
    const applied = applyIssue(text, issue, result.issues);
    setText(applied.text);
    setResult({ ...result, issues: applied.issues });
  };

  const ignoreIssue = (issue: Issue) => {
    if (!result) return;
    setResult({ ...result, issues: result.issues.filter((item) => item !== issue) });
  };

  // The correction goes into a deck called "My corrections", made the first time it is needed.
  const saveAsCard = async (issue: Issue) => {
    if (!backend) return;
    try {
      const decks = await backend.listDecks();
      let deck = decks.find((item) => CORRECTIONS_NAMES.includes(item.title));
      if (!deck) {
        deck = await backend.createDeck({ title: t('My corrections'), description: t('Corrections from the writing check'), colour: 'violet' });
      }
      await backend.createCards(deck.id, [{ front: issue.original, back: issue.suggestion, note: t(issue.reason) }]);
      notify(t('Saved to {deck}.', { deck: deck.title }), 'ok');
    } catch (failure) {
      notify(t(errorText(failure)), 'error');
    }
  };

  const counter = t('{count} of {max} words', { count: words, max: WRITING_MAX_WORDS });

  return (
    <div className="page">
      <PageHeader title={t('Writing check')}>
        <p className="muted">{t('Write a few sentences, then check them. Take the fixes you agree with.')}</p>
      </PageHeader>

      <div className="stack">
        {!aiOn && (
          <Notice tone="info">
            {t('Connect an AI key for a full check: the reasons, a tone and a score written by a model. Without one, the basics are checked on this device.')}{' '}
            <button className="btn btn--text" onClick={() => navigate('/settings/ai')}>
              {t('Open Settings')}
            </button>
          </Notice>
        )}

        <Field label={t('Your text')}>
          <textarea
            className="input write-area"
            rows={9}
            value={text}
            placeholder={t('Write a few sentences in English.')}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>

        <div className="write-bar">
          <span className={tooLong ? 'write-count write-count--over' : 'write-count'}>{counter}</span>
          <button className="btn btn--primary" disabled={busy || tooShort || tooLong} onClick={() => void check()}>
            <Sparkles aria-hidden="true" /> {busy ? t('Checking your text') : t('Check my writing')}
          </button>
        </div>
        {tooShort && text.trim() && <p className="small muted">{t('Write at least {count} words to check.', { count: WRITING_MIN_WORDS })}</p>}

        {error && <Notice tone="error">{t(error)}</Notice>}

        {result && (
          <section className="write-result" aria-label={t('Result')}>
            <div className="write-result__head">
              <div className="write-result__score">
                <span className="write-result__value">{result.score}</span>
                <span className="small muted">{t('out of 100')}</span>
              </div>
              <div className="write-result__meta">
                <span className="chip chip--ai">{result.byModel ? t('Checked with your AI key') : t('Checked on this device')}</span>
                {result.tone && <span className={`chip write-tone write-tone--${result.tone}`}>{t('Tone')}: {toneName(t, result.tone)}</span>}
                <ProgressBar value={result.score} max={100} label={t('Score')} />
              </div>
            </div>
            {result.summary && <p className="write-result__summary">{result.byModel ? result.summary : t(result.summary)}</p>}

            <div className="write-preview" aria-label={t('Your text, with its issues marked')}>
              {segments.map((segment, index) =>
                segment.issue ? (
                  <mark key={index} className={`write-mark write-mark--${segment.issue.category}`} title={t(segment.issue.reason)}>
                    {segment.text}
                  </mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
            </div>

            {result.issues.length === 0 ? (
              <p className="write-clean">{t('Nothing to fix here. Well written!')}</p>
            ) : (
              <ul className="issue-list">
                {result.issues.map((issue, index) => (
                  <li key={`${issue.start}-${index}`} className="issue">
                    <span className={`issue__category issue__category--${issue.category}`}>{categoryName(t, issue.category)}</span>
                    <p className="issue__change">
                      <s>{issue.original}</s> <span aria-hidden="true">→</span> <b>{issue.suggestion}</b>
                    </p>
                    <p className="issue__reason">{t(issue.reason)}</p>
                    <div className="issue__actions">
                      <button className="btn btn--primary btn--sm" onClick={() => useIssue(issue)}>
                        {t('Use this')}
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={() => ignoreIssue(issue)}>
                        {t('Ignore')}
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={() => void saveAsCard(issue)}>
                        <Plus aria-hidden="true" /> {t('Save as a card')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted write-result__pen">
              <PenLine aria-hidden="true" />{' '}
              {result.byModel
                ? t('Your text was sent to the AI provider you connected, only for this check.')
                : t('Nothing left this device: the basics were checked here.')}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
