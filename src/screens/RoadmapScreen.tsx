import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check, Headphones, Languages, Lock, Mic, PenLine, Star, Trophy } from 'lucide-react';
import { UNITS, type UnitDef } from '../content';
import { Notice, PageHeader, ProgressBar, Skeleton } from '../components/ui';
import { keepAnswer, lastAnswer } from '../lib/cache';
import { errorText } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { nodeStates, progressMap, type NodeInfo } from '../lib/roadmap';
import type { LessonProgressRow, Skill } from '../lib/types';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';

const WIDTH = 320;
const ROW = 116;
const NODE = 74;
const OFFSETS = [0, -64, 0, 64];
const ICONS: Record<Skill, typeof BookOpen> = {
  reading: BookOpen,
  listening: Headphones,
  speaking: Mic,
  writing: PenLine,
  language: Languages,
};

export function RoadmapScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { backend } = useAuth();
  const { profile } = useAppData();
  // The roadmap as it was last time, shown at once while the newest progress is checked.
  const [progress, setProgress] = useState<LessonProgressRow[] | null>(() => lastAnswer<LessonProgressRow[]>('roadmap', backend));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    backend
      .listLessonProgress()
      .then((rows) => {
        if (active) setProgress(keepAnswer('roadmap', backend, rows));
      })
      .catch((error: unknown) => {
        console.error('Could not load the roadmap', error);
        if (!active) return;
        setProgress([]);
        setLoadError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [backend]);

  const nodes = useMemo(() => nodeStates(progressMap(progress ?? [])), [progress]);
  const done = nodes.filter((node) => node.state === 'done').length;

  return (
    <div className="page">
      <PageHeader eyebrow={t('Your path')} title={t('Roadmap')}>
        <div className="roadmap-progress">
          <ProgressBar value={done} max={Math.max(1, nodes.length)} label={t('Roadmap progress')} />
          <span className="chip">{t('Level {level}', { level: profile?.level ?? 'B1' })}</span>
        </div>
        <p className="small muted mt-2">
          {t('{done} of {total} done', {
            done,
            total: tn('{count} step', '{count} steps', nodes.length, { count: nodes.length }),
          })}
        </p>
      </PageHeader>

      {loadError && <Notice tone="error">{t(loadError)}</Notice>}
      <div className="stack">
        {progress === null && <Skeleton height={300} />}
        {progress !== null &&
          UNITS.map((unit) => (
            <UnitBlock
              key={unit.id}
              unit={unit}
              nodes={nodes.filter((node) => node.item.unit.id === unit.id)}
              onOpen={(lessonId) => navigate(`/play/lesson/${lessonId}`)}
            />
          ))}
      </div>
    </div>
  );
}

function UnitBlock({ unit, nodes, onOpen }: { unit: UnitDef; nodes: NodeInfo[]; onOpen: (lessonId: string) => void }) {
  const t = useT();
  const height = nodes.length * ROW + 24;
  const centers = nodes.map((_, index) => ({
    x: WIDTH / 2 + OFFSETS[index % OFFSETS.length],
    y: index * ROW + NODE / 2 + 12,
  }));
  const doneCount = nodes.filter((node) => node.state === 'done').length;

  return (
    <section className={`unit unit--${unit.accent}`} aria-label={t('Unit {number}: {title}', { number: unit.number, title: t(unit.title) })}>
      <div className="unit__head">
        <span className="unit__badge" aria-hidden="true">
          {unit.number}
        </span>
        <div className="unit__text">
          <div className="row row--between">
            <h2 className="unit__title">{t(unit.title)}</h2>
            <span className="chip">
              {unit.level} · {doneCount}/{nodes.length}
            </span>
          </div>
          <p className="unit__blurb">{t(unit.blurb)}</p>
        </div>
      </div>

      <div className="path" style={{ width: WIDTH, height, position: 'relative', margin: '18px auto 0', display: 'block' }}>
        <svg className="path-line" width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`} aria-hidden="true">
          {centers.slice(1).map((to, index) => {
            const from = centers[index];
            const finished = nodes[index].state === 'done';
            const d = `M ${from.x} ${from.y} C ${from.x} ${from.y + ROW * 0.5}, ${to.x} ${to.y - ROW * 0.5}, ${to.x} ${to.y}`;
            return (
              <path
                key={`seg-${index}`}
                d={d}
                style={{ stroke: finished ? 'var(--teal)' : undefined, strokeDasharray: finished ? 'none' : undefined, strokeWidth: finished ? 6 : undefined }}
              />
            );
          })}
        </svg>

        {nodes.map((node, index) => {
          const { item, state, stars } = node;
          const center = centers[index];
          const Icon = item.checkpoint ? Trophy : ICONS[item.lesson.skill];
          const side = OFFSETS[index % OFFSETS.length] > 0 ? 'left' : 'right';
          const size = item.checkpoint ? 84 : NODE;
          const classes = ['node', `node--${state}`, item.checkpoint ? 'node--checkpoint' : '', state === 'current' ? 'pulse' : '']
            .filter(Boolean)
            .join(' ');
          const title = item.checkpoint ? t('Unit check') : t(item.lesson.title);
          const stateText = state === 'done' ? t('completed') : state === 'current' ? t('next up') : t('locked');
          return (
            <button
              key={item.lesson.id}
              className={classes}
              style={
                {
                  position: 'absolute',
                  left: center.x - size / 2,
                  top: center.y - size / 2,
                  // The first few nodes of a unit fade in one after another; the rest appear with them.
                  '--d': `${Math.min(index, 8) * 30}ms`,
                } as CSSProperties
              }
              disabled={state === 'locked'}
              onClick={() => onOpen(item.lesson.id)}
              aria-label={t('{title}, {state}', { title, state: stateText })}
            >
              {state === 'done' ? <Check /> : state === 'locked' ? <Lock /> : <Icon />}
              {state === 'current' && <span className="node__bubble">{t('START')}</span>}
              <span className={`node__label node__label--${side}`}>
                {title}
                <span className="node__meta">
                  {item.checkpoint
                    ? tn('{count} question', '{count} questions', item.lesson.questions.length, { count: item.lesson.questions.length })
                    : t('{minutes} min', { minutes: item.lesson.minutes })}
                </span>
                {state === 'done' && (
                  <span className="node__stars" aria-label={t('{stars} of 3 stars', { stars })}>
                    {[1, 2, 3].map((value) => (
                      <Star key={value} fill={value <= stars ? 'currentColor' : 'none'} className={value <= stars ? '' : 'is-off'} />
                    ))}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
