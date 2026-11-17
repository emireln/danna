// Tests the overall report (src/lib/overallReport.ts): the strengths and the weaknesses of the skills, the sessions,
// the practice time, the average score, and the lessons and stars.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let report;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ overallReport: report } = await server.ssrLoadModule('/src/lib/overallReport.ts'));
});

after(async () => {
  await server?.close();
});

test('strengths are the skills at 70 or more, best first; weaknesses are the lowest, and unpractised skills come first', () => {
  const overview = report({ skills: { reading: 82, listening: 55, speaking: 71, writing: 40 }, attempts: [], lessons: [] });
  assert.deepEqual(overview.strengths.map((line) => line.skill), ['reading', 'speaking']);
  assert.deepEqual(overview.weaknesses.map((line) => line.skill), ['language', 'writing'], 'language is not practised yet');
  assert.equal(overview.skills.length, 5, 'all five skills are listed');
  assert.equal(overview.skills.find((line) => line.skill === 'language')?.score, null);
});

test('the sessions, the practice time, the average score and the lessons are added up', () => {
  const overview = report({
    skills: {},
    attempts: [
      { score_pct: 60, duration_s: 600 },
      { score_pct: 81, duration_s: 330 },
    ],
    lessons: [{ stars: 3 }, { stars: 0 }, { stars: 2 }],
  });
  assert.equal(overview.sessions, 2);
  assert.equal(overview.practiceMinutes, 16, '930 seconds, rounded to minutes');
  assert.equal(overview.averageScore, 71, 'the average of 60 and 81, rounded');
  assert.equal(overview.lessonsDone, 2, 'a lesson with no star is not done');
  assert.equal(overview.stars, 5);
});

test('an empty report has no average, no strengths, and the first skills to work on', () => {
  const overview = report({ skills: {}, attempts: [], lessons: [] });
  assert.equal(overview.averageScore, null);
  assert.equal(overview.sessions, 0);
  assert.deepEqual(overview.strengths, []);
  assert.deepEqual(overview.weaknesses.map((line) => line.skill), ['reading', 'listening']);
});
