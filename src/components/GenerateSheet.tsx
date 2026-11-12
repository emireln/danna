import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Field, Notice, Sheet, Spinner } from './ui';
import { Select } from './Pickers';
import { extractJson, testRequest, validateGeneratedTest } from '../lib/ai';
import { errorText } from '../lib/bridge';
import { useT } from '../lib/i18n/react';
import { useAI } from '../state/ai';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { LEVELS, SKILLS, SKILL_LABEL, type Level, type Skill } from '../lib/types';

interface GenerateSheetProps {
  title: string;
  defaultSkill: Skill | 'mixed';
  defaultLevel: Level;
  onClose: () => void;
}

/** Asks the chosen model for a practice set, validates it, and saves it to the user's sets. */
export function GenerateSheet({ title, defaultSkill, defaultLevel, onClose }: GenerateSheetProps) {
  const navigate = useNavigate();
  const t = useT();
  const { complete } = useAI();
  const { backend } = useAuth();
  const { notify } = useToast();
  const [topic, setTopic] = useState('');
  const [skill, setSkill] = useState<Skill | 'mixed'>(defaultSkill);
  const [level, setLevel] = useState<Level>(defaultLevel);
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!backend) return;
    setBusy(true);
    setError(null);
    try {
      const request = testRequest({ skill, level, topic, count });
      const result = await complete({
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
        json: true,
        maxTokens: 6000,
      });
      const generated = validateGeneratedTest(extractJson(result.text), skill);
      const row = await backend.insertTest({
        title: generated.title,
        description: generated.description,
        kind: 'ai',
        skill,
        level,
        minutes: generated.minutes,
        content: generated.content,
      });
      notify(t('Your set is ready.'), 'ok');
      navigate(`/play/test/${row.id}`);
    } catch (caught) {
      setError(t(errorText(caught)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            {t('Cancel')}
          </button>
          <button className="btn btn--primary" onClick={generate} disabled={busy}>
            {busy ? <Spinner /> : <Sparkles />} {t('Generate set')}
          </button>
        </>
      }
    >
      <Field label={t('Topic (optional)')} hint={t('For example: climate policy, university housing, job interviews.')}>
        <input
          className="input"
          value={topic}
          maxLength={120}
          onChange={(event) => setTopic(event.target.value)}
          placeholder={t('Leave empty for everyday academic life')}
        />
      </Field>
      <div className="grid-2">
        <Field label={t('Section')}>
          <Select<Skill | 'mixed'>
            label={t('Section')}
            value={skill}
            onChange={setSkill}
            options={[{ value: 'mixed', label: t('Mixed') }, ...SKILLS.map((item) => ({ value: item, label: t(SKILL_LABEL[item]) }))]}
          />
        </Field>
        <Field label={t('Level')}>
          <Select<Level> label={t('Level')} value={level} onChange={setLevel} options={LEVELS.map((item) => ({ value: item, label: item }))} />
        </Field>
      </div>
      <Field label={t('Questions')}>
        <div className="segmented self-start" role="radiogroup" aria-label={t('Number of questions')}>
          {[5, 8, 10].map((value) => (
            <button key={value} role="radio" aria-checked={count === value} className={`segmented__btn ${count === value ? 'is-active' : ''}`} onClick={() => setCount(value)}>
              {value}
            </button>
          ))}
        </div>
      </Field>
      <Notice tone="info">{t('The set is saved with your practice sets. The model you chose in Settings writes it.')}</Notice>
      {error && <Notice tone="error">{error}</Notice>}
    </Sheet>
  );
}
