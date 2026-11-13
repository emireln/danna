// The criteria of the writing and speaking tasks in the extra practice. They are shared between tasks, so
// each line is translated once. The Portuguese for these lines is in i18n/pt/practice.ts.
export const WRITING_RUBRIC: Record<'basic' | 'intermediate' | 'advanced', string[]> = {
  basic: ['Answers every part of the task', 'Uses the grammar of the lesson', 'Sentences are clear and correct'],
  intermediate: ['Clear opinion or purpose', 'Ideas developed with examples', 'Linking words and varied grammar', 'Accurate spelling and punctuation'],
  advanced: ['Precise argument and clear structure', 'Academic vocabulary used well', 'Complex grammar under control', 'Few errors that affect the meaning'],
};

export const SPEAKING_RUBRIC: Record<'basic' | 'intermediate' | 'advanced', string[]> = {
  basic: ['Answers the question', 'Gives one detail or example', 'Speaks clearly and slowly'],
  intermediate: ['A clear main idea', 'Reasons or examples', 'Fluent, steady delivery'],
  advanced: ['A well organized answer', 'Precise vocabulary', 'Natural, fluent delivery'],
};
