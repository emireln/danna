import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CircleCheck, Mic, Play, Sparkles, Square, Volume2, XCircle } from 'lucide-react';
import { errorText } from '../lib/bridge';
import { parseCloze } from '../lib/grading';
import { extractJson, parseFeedback, speakingRequest, writingRequest, type Feedback } from '../lib/ai';
import { useAI } from '../state/ai';
import { useToast } from '../state/toast';
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
  return (
    <>
      {passage && question.passageId === passage.id && (
        <div className="q-passage" aria-label="Reading passage">
          <div className="q-passage__title">{passage.title}</div>
          {passage.text}
        </div>
      )}
      <h2 className="q-prompt">{question.prompt}</h2>
      {question.listen && <ListenButton text={question.listen} />}
      {question.type === 'choice' && <ChoiceBody question={question} {...shared} />}
      {question.type === 'cloze' && <ClozeBody question={question} {...shared} />}
      {question.type === 'reorder' && <ReorderBody question={question} {...shared} />}
      {question.type === 'writing' && <WritingBody question={question} {...shared} />}
      {question.type === 'speaking' && <SpeakingBody question={question} {...shared} />}
      {shared.reveal && question.explanation && (
        <motion.div className="feedback-card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <strong>Why</strong>
          <p>{question.explanation}</p>
        </motion.div>
      )}
    </>
  );
}

function ListenButton({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const play = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    setPlaying(true);
    synth.speak(utterance);
  };

  return (
    <button className="listen" onClick={play}>
      {playing ? <Volume2 aria-hidden="true" /> : <Play aria-hidden="true" />}
      {playing ? 'Playing the recording' : 'Play the recording'}
    </button>
  );
}

function ChoiceBody({ question, state, reveal, locked, onChange }: SharedProps & { question: ChoiceQuestion }) {
  return (
    <div className="options" role="radiogroup" aria-label="Answer options">
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
            <span>{option}</span>
            {correct && (
              <span className="option__mark" style={{ color: 'var(--green)' }}>
                <CircleCheck />
              </span>
            )}
            {wrong && (
              <span className="option__mark" style={{ color: 'var(--red)' }}>
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
              aria-label={`Blank ${segment.index + 1}`}
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
  const order = state.order ?? [];
  const placed = new Set(order);
  return (
    <div className="stack--tight">
      <div className="answer-line" aria-label="Your sentence">
        {order.length === 0 && <span className="muted small">Tap the words in the right order.</span>}
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
          Correct order: <strong style={{ color: 'var(--ink)' }}>{question.answer}</strong>
        </p>
      )}
    </div>
  );
}

function WritingBody({ question, state, locked, onChange }: SharedProps & { question: WritingQuestion }) {
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
        placeholder="Write your response here."
        aria-label="Your response"
        onChange={(event) => onChange({ text: event.target.value })}
      />
      <div className="row row--between">
        <span className={`counter ${short ? 'is-short' : ''}`}>
          {words} / {question.minWords} words
        </span>
      </div>
      <Grader
        state={state}
        locked={locked}
        rubric={question.rubric}
        canAi={ready && text.trim().length > 0}
        aiHint={ready ? 'Write a response first.' : 'Connect an AI key in Settings to get feedback on your writing.'}
        runAi={runAi}
        onChange={onChange}
      />
    </div>
  );
}

function SpeakingBody({ question, state, locked, onChange }: SharedProps & { question: SpeakingQuestion }) {
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
      notify(errorText(error), 'error');
    } finally {
      setPhase('idle');
    }
  };

  const start = async () => {
    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      notify('Recording is not available on this device. Rate your answer yourself.', 'error');
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
      notify('The microphone is not available right now. You can rate your answer yourself.', 'error');
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
        <span className="tone tone--good" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatClock(shown)}
        </span>
        <span className="small muted">Limit {question.seconds} seconds</span>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {phase === 'idle' && (
          <button className="btn btn--primary" onClick={start} disabled={locked || graded}>
            <Mic /> {state.audioUrl ? 'Record again' : 'Start recording'}
          </button>
        )}
        {phase === 'recording' && (
          <button className="btn btn--danger" onClick={stopRecording}>
            <Square /> Stop
          </button>
        )}
        {phase === 'processing' && (
          <span className="row small muted">
            <Spinner dark /> Transcribing your answer
          </span>
        )}
      </div>
      {state.audioUrl && <audio controls src={state.audioUrl} style={{ width: '100%', maxWidth: 420 }} aria-label="Your recording" />}
      {state.transcript && (
        <div className="feedback-card">
          <span className="small muted">Transcript</span>
          <p>{state.transcript}</p>
        </div>
      )}
      {!state.audioUrl && phase === 'idle' && (
        <span className="small muted">Recording is optional. You can also rate your own answer below.</span>
      )}
      <Grader
        state={state}
        locked={locked}
        rubric={question.rubric}
        canAi={ready && Boolean(state.transcript)}
        aiHint={
          canTranscribe
            ? 'Feedback appears once the transcript is ready.'
            : 'Add an OpenAI key in Settings to transcribe speaking. You can still rate yourself.'
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
      notify(errorText(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="feedback-card">
      <div className="row row--between">
        <strong>Get feedback</strong>
        {!canAi && <span className="small muted">{aiHint}</span>}
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {canAi && (
          <button className="btn btn--primary btn--sm" onClick={requestAi} disabled={busy || locked}>
            {busy ? <Spinner /> : <Sparkles />} Get AI feedback
          </button>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => setSelfMode(true)} disabled={locked}>
          Rate it myself
        </button>
      </div>
      {selfMode && (
        <div className="stack--tight">
          <ul>
            {rubric.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
          <div className="rubric-slider" role="group" aria-label="Your score out of 5">
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
  const score = state.feedback ? state.feedback.score : state.selfScore ?? 0;
  const tone = score >= 4 ? 'excellent' : score >= 3 ? 'good' : 'needs-work';
  return (
    <motion.div className="feedback-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="row row--between">
        <strong>{state.feedback ? 'AI feedback' : 'Your rating'}</strong>
        <span className={`tone tone--${tone}`}>{score} / 5</span>
      </div>
      {state.feedback && (
        <>
          {state.feedback.strengths.length > 0 && (
            <div>
              <span className="small muted">Strengths</span>
              <ul>
                {state.feedback.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {state.feedback.improvements.length > 0 && (
            <div>
              <span className="small muted">To improve</span>
              <ul>
                {state.feedback.improvements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {state.feedback.revision && (
            <p className="small">
              <strong>Try this:</strong> {state.feedback.revision}
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}
