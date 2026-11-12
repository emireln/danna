// Roadmap progress: lessons unlock in order, and a lesson is done once it earns a star.
import { PATH, type PathItem } from '../content';
import { LEVELS, type Level, type LessonProgressRow } from './types';

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

/** Every lesson and check of the levels below the chosen one counts as done, so a learner who starts at B1 is not repeated. */
export function placementRows(level: Level): LessonProgressRow[] {
  const below = LEVELS.indexOf(level);
  return PATH.filter((item) => LEVELS.indexOf(item.unit.level) < below).map((item) => ({
    lesson_id: item.lesson.id,
    stars: 1,
    best_pct: 80,
    attempts: 0,
    completed_at: new Date().toISOString(),
  }));
}
