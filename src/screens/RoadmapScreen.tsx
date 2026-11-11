import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check, Headphones, Languages, Lock, Mic, PenLine, Star, Trophy } from 'lucide-react';
import { UNITS, type UnitDef } from '../content';
import { Notice, PageHeader, ProgressBar, Skeleton } from '../components/ui';
import { errorText } from '../lib/bridge';
import { nodeStates, progressMap, type NodeInfo } from '../lib/roadmap';
import { plural } from '../lib/text';
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
  const { backend } = useAuth();
  const { profile } = useAppData();
  const [progress, setProgress] = useState<LessonProgressRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    backend
      .listLessonProgress()
      .then((rows) => {
        if (active) setProgress(rows);
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
      <PageHeader eyebrow="Your path" title="Roadmap" aside={<span className="chip">Level {profile?.level ?? 'B1'}</span>}>
        <div className="mt-3">
          <ProgressBar value={done} max={Math.max(1, nodes.length)} label="Roadmap progress" />
        </div>
        <p className="small muted mt-3">
          {done} of {plural(nodes.length, 'step')} done
        </p>
      </PageHeader>

      {loadError && <Notice tone="error">{loadError}</Notice>}
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
  const height = nodes.length * ROW + 24;
  const centers = nodes.map((_, index) => ({
    x: WIDTH / 2 + OFFSETS[index % OFFSETS.length],
    y: index * ROW + NODE / 2 + 12,
  }));
  const doneCount = nodes.filter((node) => node.state === 'done').length;

  return (
    <section className={`unit unit--${unit.accent}`} aria-label={`Unit ${unit.number}: ${unit.title}`}>
      <div className="unit__head">
        <span className="unit__badge" aria-hidden="true">
          {unit.number}
        </span>
        <div className="unit__text">
          <div className="row row--between">
            <h2 className="unit__title">{unit.title}</h2>
            <span className="chip">
              {unit.level} · {doneCount}/{nodes.length}
            </span>
          </div>
          <p className="unit__blurb">{unit.blurb}</p>
        </div>
      </div>

      <div className="path" style={{ width: WIDTH, height, position: 'relative', margin: '18px auto 0', display: 'block' }}>
        <svg className="path-line" width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`} aria-hidden="true">
          {centers.slice(1).map((to, index) => {
            const from = centers[index];
            const finished = nodes[index].state === 'done';
            const d = `M ${from.x} ${from.y} C ${from.x} ${from.y + ROW * 0.5}, ${to.x} ${to.y - ROW * 0.5}, ${to.x} ${to.y}`;
            return (
              <motion.path
                key={`seg-${index}`}
                d={d}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
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
          return (
            <motion.button
              key={item.lesson.id}
              className={classes}
              style={{ position: 'absolute', left: center.x - size / 2, top: center.y - size / 2 }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.06 * index, type: 'spring', stiffness: 260, damping: 18 }}
              disabled={state === 'locked'}
              onClick={() => onOpen(item.lesson.id)}
              aria-label={`${item.checkpoint ? 'Unit check' : item.lesson.title}, ${
                state === 'done' ? 'completed' : state === 'current' ? 'next up' : 'locked'
              }`}
            >
              {state === 'done' ? <Check /> : state === 'locked' ? <Lock /> : <Icon />}
              {state === 'current' && <span className="node__bubble">START</span>}
              <span className={`node__label node__label--${side}`}>
                {item.checkpoint ? 'Unit check' : item.lesson.title}
                <span className="node__meta">
                  {item.checkpoint ? plural(item.lesson.questions.length, 'question') : `${item.lesson.minutes} min`}
                </span>
              </span>
              {state === 'done' && (
                <span className="node__stars" aria-label={`${stars} of 3 stars`}>
                  {[1, 2, 3].map((value) => (
                    <Star key={value} fill={value <= stars ? 'currentColor' : 'none'} className={value <= stars ? '' : 'is-off'} />
                  ))}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
