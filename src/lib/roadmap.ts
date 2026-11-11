// Roadmap progress: lessons unlock in order, and a lesson is done once it earns a star.
import { PATH, type PathItem } from '../content';
import type { LessonProgressRow } from './types';

export type NodeState = 'done' | 'current' | 'locked';

export interface NodeInfo {
  item: PathItem;
  state: NodeState;
  stars: number;
}

export function nodeStates(progress: Map<string, LessonProgressRow>): NodeInfo[] {
  let foundCurrent = false;
  return PATH.map((item) => {
    const row = progress.get(item.lesson.id);
    const stars = row ? row.stars : 0;
    let state: NodeState;
    if (stars >= 1) {
      state = 'done';
    } else if (!foundCurrent) {
      state = 'current';
      foundCurrent = true;
    } else {
      state = 'locked';
    }
    return { item, state, stars };
  });
}

export function progressMap(rows: LessonProgressRow[]): Map<string, LessonProgressRow> {
  return new Map(rows.map((row) => [row.lesson_id, row]));
}

/** Completed lessons from earlier units, so a learner who starts at B2 is not repeated. */
export function placementRows(level: string): LessonProgressRow[] {
  const unitsDone = level === 'B1' ? 1 : level === 'B2' ? 2 : level === 'C1' ? 3 : 0;
  return PATH.filter((item) => Number(item.unit.number) <= unitsDone).map((item) => ({
    lesson_id: item.lesson.id,
    stars: 1,
    best_pct: 80,
    attempts: 0,
    completed_at: new Date().toISOString(),
  }));
}
