import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CircleCheck, Mic, Play, Sparkles, Square, Volume2, XCircle } from 'lucide-react';
import { errorText } from '../lib/bridge';
import { parseCloze } from '../lib/grading';
import { extractJson, parseFeedback, speakingRequest, writingRequest, type Feedback } from '../lib/ai';
import { useT } from '../lib/i18n/react';
import { useAI } from '../state/ai';
import { useToast } from '../state/toast';
import { narrate, type Narration } from '../lib/speech';
import { Spinner, formatClock } from './ui';
import type {
  ChoiceQuestion,
  ClozeQuestion,
  Passage,
  Question,
  ReorderQuestion,
  SpeakingQuestion,
  WritingQuestion,
} from '../lib/types';

/** What the learner has done with one question. The runner keeps one per question. */
export interface ItemState {
  choice?: number | null;
  cloze?: string[];
  order?: number[];
  text?: string;
  audioUrl?: string;
  transcript?: string;
  feedback?: Feedback;
  selfScore?: number;
}

interface SharedProps {
  state: ItemState;
  reveal: boolean;
  locked: boolean;
  words: string[];
  correctBlanks?: boolean[];
  onChange: (patch: ItemState) => void;
}

type QuestionViewProps = SharedProps & { question: Question; passage?: Passage };

export function QuestionView({ question, passage, ...shared }: QuestionViewProps) {
  const t = useT();
  return (
    <>
      {passage && question.passageId === passage.id && (
        <div className="q-passage" aria-label={t('Reading passage')}>
          <div className="q-passage__title">{t(passage.title)}</div>
          {passage.text}
        </div>
      )}
      <h2 className="q-prompt">{t(question.prompt)}</h2>
      {question.listen && <ListenButton text={question.listen} />}
      {question.type === 'choice' && <ChoiceBody question={question} {...shared} />}
      {question.type === 'cloze' && <ClozeBody question={question} {...shared} />}
      {question.type === 'reorder' && <ReorderBody question={question} {...shared} />}
      {question.type === 'writing' && <WritingBody question={question} {...shared} />}
      {question.type === 'speaking' && <SpeakingBody question={question} {...shared} />}
      {shared.reveal && question.explanation && (
        <motion.div className="feedback-card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <strong>{t('Why')}</strong>
          <p>{t(question.explanation)}</p>
        </motion.div>
      )}
    </>
  );
}

function ListenButton({ text }: { text: string }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'preparing' | 'playing'>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const narration = useRef<Narration | null>(null);

  useEffect(() => () => narration.current?.stop(), []);

  // A press starts the recording, and a press while it plays or loads stops it.
  const toggle = () => {
    if (narration.current) {
      narration.current.stop();
      return;
    }
    setNotice(null);
    setState('preparing');
    narration.current = narrate(text, {
      onStart: () => setState('playing'),
      onEnd: () => {
        narration.current = null;
        setState('idle');
      },
      onNotice: (message) => setNotice(message),
    });
  };

  return (
    <div className="listen-block">
      <button className="listen" onClick={toggle} aria-pressed={state !== 'idle'}>
        {state === 'idle' ? <Play aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        {state === 'idle' && t('Play the recording')}
        {state === 'preparing' && t('Preparing the voice…')}
        {state === 'playing' && t('Playing the recording')}
      </button>
      {notice && <p className="listen-block__notice small muted">{notice}</p>}
    </div>
  );
}

function ChoiceBody({ question, state, reveal, locked, onChange }: SharedProps & { question: ChoiceQuestion }) {
  const t = useT();
  return (
    <div className="options" role="radiogroup" aria-label={t('Answer options')}>
      {question.options.map((option, index) => {
        const selected = state.choice === index;
        const correct = reveal && index === question.answer;
        const wrong = reveal && selected && index !== question.answer;
        const classes = ['option', correct ? 'option--correct' : '', wrong ? 'option--wrong' : ''].join(' ');
        return (
          <button
            key={`${index}-${option}`}
            role="radio"
            aria-checked={selected}
            className={classes}
            disabled={locked}
            onClick={() => onChange({ choice: index })}
          >
            <span className="option__key">{String.fromCharCode(65 + index)}</span>
            <span>{t(option)}</span>
            {correct && (
              <span className="option__mark option__mark--correct">
                <CircleCheck />
              </span>
            )}
            {wrong && (
              <span className="option__mark option__mark--wrong">
                <XCircle />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ClozeBody({ question, state, reveal, locked, correctBlanks, onChange }: SharedProps & { question: ClozeQuestion }) {
  const t = useT();
  const segments = useMemo(() => parseCloze(question.text), [question.text]);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const values = state.cloze ?? [];
  const blankCount = segments.filter((segment) => segment.kind === 'blank').length;

  const setBlank = (index: number, prefix: string, typed: string) => {
    const next = Array.from({ length: blankCount }, (_, i) => values[i] ?? '');
    next[index] = prefix + typed;
    onChange({ cloze: next });
  };

  return (
    <p className="cloze">
      {segments.map((segment, position) => {
        if (segment.kind === 'text') return <span key={`t${position}`}>{segment.value}</span>;
        const prefix = segment.answer.slice(0, segment.reveal);
        const remaining = segment.answer.length - segment.reveal;
        const typed = (values[segment.index] ?? '').slice(prefix.length);
        const status = reveal ? (correctBlanks?.[segment.index] ? 'blank--ok' : 'blank--bad') : '';
        return (
          <span key={`b${segment.index}`} className={`blank ${status}`}>
            {prefix && <span className="blank__prefix">{prefix}</span>}
            <input
              ref={(element) => {
                inputs.current[segment.index] = element;
              }}
              value={typed}
              disabled={locked}
              maxLength={remaining}
              autoComplete="off"
              spellCheck={false}
              aria-label={t('Blank {number}', { number: segment.index + 1 })}
              style={{ width: `${remaining + 0.6}ch` }}
              onChange={(event) => {
                const clean = event.target.value.replace(/\s/g, '');
                setBlank(segment.index, prefix, clean);
                if (clean.length >= remaining) {
                  const nextIndex = inputs.current.findIndex(
                    (element, i) => i > segment.index && element !== null && !element.disabled,
                  );
                  inputs.current[nextIndex]?.focus();
                }
              }}
            />
            {reveal && !correctBlanks?.[segment.index] && <span className="blank__answer">{segment.answer}</span>}
          </span>
        );
      })}
    </p>
  );
}

function ReorderBody({ question, state, reveal, locked, words, onChange }: SharedProps & { question: ReorderQuestion }) {
  const t = useT();
  const order = state.order ?? [];
  const placed = new Set(order);
  return (
    <div className="stack--tight">
      <div className="answer-line" aria-label={t('Your sentence')}>
        {order.length === 0 && <span className="muted small">{t('Tap the words in the right order.')}</span>}
        {order.map((wordIndex, position) => (
          <motion.button
            layout
            key={`placed-${wordIndex}`}
            className="word"
            disabled={locked}
            onClick={() => onChange({ order: order.filter((_, i) => i !== position) })}
          >
            {words[wordIndex]}
          </motion.button>
        ))}
      </div>
      <div className="word-bank">
        {words.map((word, wordIndex) =>
          placed.has(wordIndex) ? null : (
            <motion.button
              layout
              key={`bank-${wordIndex}`}
              className="word"
              disabled={locked}
              onClick={() => onChange({ order: [...order, wordIndex] })}
            >
              {word}
            </motion.button>
          ),
        )}
      </div>
      {reveal && (
        <p className="small muted">
          {t('Correct order:')} <strong className="answer-key">{question.answer}</strong>
        </p>
      )}
    </div>
  );
}

function WritingBody({ question, state, locked, onChange }: SharedProps & { question: WritingQuestion }) {
  const t = useT();
  const { ready, complete } = useAI();
  const text = state.text ?? '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const short = words < question.minWords;
  const graded = state.feedback !== undefined || state.selfScore !== undefined;

  const runAi = async (): Promise<Feedback> => {
    const request = writingRequest({ task: question.prompt, rubric: question.rubric, minWords: question.minWords, response: text });
    const result = await complete({
      system: request.system,
      messages: [{ role: 'user', content: request.prompt }],
      json: true,
      maxTokens: 1200,
    });
    return parseFeedback(extractJson(result.text));
  };

  return (
    <div className="stack--tight">
      <textarea
        className="input"
        rows={8}
        value={text}
        disabled={locked || graded}
        placeholder={t('Write your response here.')}
        aria-label={t('Your response')}
        onChange={(event) => onChange({ text: event.target.value })}
      />
      <div className="row row--between">
        <span className={`counter ${short ? 'is-short' : ''}`}>
          {t('{words} / {minWords} words', { words, minWords: question.minWords })}
        </span>
      </div>
      <Grader
        state={state}
        locked={locked}
        rubric={question.rubric}
        canAi={ready && text.trim().length > 0}
        aiHint={ready ? t('Write a response first.') : t('Connect an AI key in Settings to get feedback on your writing.')}
        runAi={runAi}
        onChange={onChange}
      />
    </div>
  );
}

function SpeakingBody({ question, state, locked, onChange }: SharedProps & { question: SpeakingQuestion }) {
  const t = useT();
  const { notify } = useToast();
  const { ready, canTranscribe, complete, transcribe } = useAI();
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [left, setLeft] = useState(question.seconds);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const graded = state.feedback !== undefined || state.selfScore !== undefined;

  const stopRecording = useCallback(() => {
    if (recorder.current && recorder.current.state === 'recording') recorder.current.stop();
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  useEffect(() => () => stopRecording(), [stopRecording]);

  useEffect(() => {
    if (phase === 'recording' && left <= 0) stopRecording();
  }, [phase, left, stopRecording]);

  const transcribeAudio = async (blob: Blob) => {
    setPhase('processing');
    try {
      onChange({ transcript: await transcribe(blob) });
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setPhase('idle');
    }
  };

  const start = async () => {
    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      notify(t('Recording is not available on this device. Rate your answer yourself.'), 'error');
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const instance = new MediaRecorder(stream.current);
      recorder.current = instance;
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      instance.onstop = () => {
        const blob = new Blob(chunks, { type: instance.mimeType || 'audio/webm' });
        onChange({ audioUrl: URL.createObjectURL(blob), transcript: undefined });
        setPhase('idle');
        if (canTranscribe) void transcribeAudio(blob);
      };
      instance.start();
      setLeft(question.seconds);
      setPhase('recording');
      timer.current = window.setInterval(() => setLeft((value) => value - 1), 1000);
    } catch {
      notify(t('The microphone is not available right now. You can rate your answer yourself.'), 'error');
    }
  };

  const runAi = async (): Promise<Feedback> => {
    const request = speakingRequest({ task: question.prompt, rubric: question.rubric, transcript: state.transcript ?? '' });
    const result = await complete({
      system: request.system,
      messages: [{ role: 'user', content: request.prompt }],
      json: true,
      maxTokens: 900,
    });
    return parseFeedback(extractJson(result.text));
  };

  const shown = phase === 'recording' ? Math.max(0, left) : question.seconds;

  return (
    <div className="stack">
      <div className="row">
        <span className="tone tone--good tabular">{formatClock(shown)}</span>
        <span className="small muted">{t('Limit {seconds} seconds', { seconds: question.seconds })}</span>
      </div>
      <div className="row row--wrap">
        {phase === 'idle' && (
          <button className="btn btn--primary" onClick={start} disabled={locked || graded}>
            <Mic /> {state.audioUrl ? t('Record again') : t('Start recording')}
          </button>
        )}
        {phase === 'recording' && (
          <button className="btn btn--danger" onClick={stopRecording}>
            <Square /> {t('Stop')}
          </button>
        )}
        {phase === 'processing' && (
          <span className="row small muted">
            <Spinner dark /> {t('Transcribing your answer')}
          </span>
        )}
      </div>
      {state.audioUrl && <audio controls src={state.audioUrl} className="audio-player" aria-label={t('Your recording')} />}
      {state.transcript && (
        <div className="feedback-card">
          <span className="small muted">{t('Transcript')}</span>
          <p>{state.transcript}</p>
        </div>
      )}
      {!state.audioUrl && phase === 'idle' && (
        <span className="small muted">{t('Recording is optional. You can also rate your own answer below.')}</span>
      )}
      <Grader
        state={state}
        locked={locked}
        rubric={question.rubric}
        canAi={ready && Boolean(state.transcript)}
        aiHint={
          canTranscribe
            ? t('Feedback appears once the transcript is ready.')
            : t('Add an OpenAI key in Settings to transcribe speaking. You can still rate yourself.')
        }
        runAi={runAi}
        onChange={onChange}
      />
    </div>
  );
}

interface GraderProps {
  state: ItemState;
  locked: boolean;
  rubric: string[];
  canAi: boolean;
  aiHint: string;
  runAi: () => Promise<Feedback>;
  onChange: (patch: ItemState) => void;
}

function Grader({ state, locked, rubric, canAi, aiHint, runAi, onChange }: GraderProps) {
  const t = useT();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [selfMode, setSelfMode] = useState(false);
  const graded = state.feedback !== undefined || state.selfScore !== undefined;

  if (graded) return <FeedbackCard state={state} />;

  const requestAi = async () => {
    setBusy(true);
    try {
      onChange({ feedback: await runAi() });
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="feedback-card">
      <div className="row row--between">
        <strong>{t('Get feedback')}</strong>
        {!canAi && <span className="small muted">{aiHint}</span>}
      </div>
      <div className="row row--wrap">
        {canAi && (
          <button className="btn btn--primary btn--sm" onClick={requestAi} disabled={busy || locked}>
            {busy ? <Spinner /> : <Sparkles />} {t('Get AI feedback')}
          </button>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => setSelfMode(true)} disabled={locked}>
          {t('Rate it myself')}
        </button>
      </div>
      {selfMode && (
        <div className="stack--tight">
          <ul>
            {rubric.map((criterion) => (
              <li key={criterion}>{t(criterion)}</li>
            ))}
          </ul>
          <div className="rubric-slider" role="group" aria-label={t('Your score out of 5')}>
            {[0, 1, 2, 3, 4, 5].map((score) => (
              <button key={score} aria-pressed={state.selfScore === score} onClick={() => onChange({ selfScore: score })}>
                {score}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ state }: { state: ItemState }) {
  const t = useT();
  const score = state.feedback ? state.feedback.score : state.selfScore ?? 0;
  const tone = score >= 4 ? 'excellent' : score >= 3 ? 'good' : 'needs-work';
  return (
    <motion.div className="feedback-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="row row--between">
        <strong>{state.feedback ? t('AI feedback') : t('Your rating')}</strong>
        <span className={`tone tone--${tone}`}>{score} / 5</span>
      </div>
      {state.feedback && (
        <>
          {state.feedback.strengths.length > 0 && (
            <div>
              <span className="small muted">{t('Strengths')}</span>
              <ul>
                {state.feedback.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {state.feedback.improvements.length > 0 && (
            <div>
              <span className="small muted">{t('To improve')}</span>
              <ul>
                {state.feedback.improvements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {state.feedback.revision && (
            <p className="small">
              <strong>{t('Try this:')}</strong> {state.feedback.revision}
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}
