// The wording of a score report, shared by the level check report and the profile report: the tip for each skill,
// the colours of the study plan, and the advice that names the strongest and the weakest skill.
import type { Translate } from './i18n/react';
import type { SkillMap } from './scoring';
import { SKILLS, SKILL_LABEL, type Skill } from './types';

export const TIPS: Record<Skill, string> = {
  reading: 'Summarize each paragraph in one sentence before you answer. Then check every option against that summary.',
  listening: 'Replay each clip once with the transcript hidden. Then write the main idea in five words.',
  speaking: 'Use three parts: your position, one reason and one example. Record it and listen back for pauses.',
  writing: 'Write a thesis you could argue against. Give each body paragraph one reason and one example.',
  language: 'Rebuild the sentences you missed from memory the next day. Repeat the ones that still feel slow.',
};

export const PLAN_COLORS = ['#2f6bff', '#14b8a6', '#f5b400', '#a4adbf'];

/** The advice for a score: it names the strongest and the weakest skill, and gives a tip for the weakest one. */
export function adviceFor(skills: SkillMap, percent: number, level: string, estimate: number | null, t: Translate) {
  const ranked = SKILLS.map((skill) => ({ skill, score: skills[skill] ?? 0 })).sort((a, b) => a.score - b.score);
  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];
  const weakName = t(SKILL_LABEL[weakest.skill]).toLowerCase();
  const strongName = t(SKILL_LABEL[strongest.skill]).toLowerCase();
  const title =
    percent >= 80
      ? t('Strong across the sections, sharpen {skill}', { skill: weakName })
      : t('Strong {strong}, focus on {weak}', { strong: strongName, weak: weakName });
  const overall =
    estimate !== null
      ? t('Your overall level looks like {level}, with an estimated TOEFL score of {score}.', { level, score: estimate })
      : t('Your overall level looks like {level}.', { level });
  const areas = t('{strongest} is your strongest area at {strongScore}/100, and {weakest} needs the most attention at {weakScore}/100.', {
    strongest: t(SKILL_LABEL[strongest.skill]),
    strongScore: strongest.score,
    weakest: t(SKILL_LABEL[weakest.skill]),
    weakScore: weakest.score,
  });
  return { title, body: `${overall} ${areas} ${t(TIPS[weakest.skill])}`, weakest: weakest.skill };
}
