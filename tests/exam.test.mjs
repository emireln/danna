// Tests the exam page's rules: the skills an exam asks for, the mock test that practises each skill (every one of
// them must open), the newest score in a skill, the exam's name and its date.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let exam;
let content;
let rules;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  exam = await server.ssrLoadModule('/src/lib/exam.ts');
  content = await server.ssrLoadModule('/src/content/index.ts');
  rules = await server.ssrLoadModule('/src/lib/data/rules.ts');
});

after(async () => {
  await server?.close();
});

test('a TOEFL exam asks for four skills; general English asks for all five', () => {
  assert.deepEqual(exam.examSkills(true), ['reading', 'listening', 'speaking', 'writing']);
  assert.deepEqual(exam.examSkills(false), ['reading', 'listening', 'speaking', 'writing', 'language']);
});

test('each skill opens a mock test that exists, on the level track and on the TOEFL track', () => {
  assert.equal(content.skillTestId('reading', 'B1', false), 'mock-b1-reading-listening');
  assert.equal(content.skillTestId('listening', 'B1', false), 'mock-b1-reading-listening');
  assert.equal(content.skillTestId('writing', 'B1', false), 'mock-b1-writing-speaking');
  assert.equal(content.skillTestId('speaking', 'B2', true), 'mock-toefl-writing-speaking');
  assert.equal(content.skillTestId('language', 'B1', false), 'words-b1', 'language is practised by the vocabulary test');
  assert.equal(content.skillTestId('language', 'B1', true), null, 'the TOEFL track has no vocabulary test');

  for (const level of ['A1', 'B1', 'C1']) {
    for (const skill of exam.examSkills(false)) {
      assert.ok(content.bundledTest(content.skillTestId(skill, level, false)), `${skill} opens for ${level}`);
    }
  }
  for (const skill of exam.examSkills(true)) {
    assert.ok(content.bundledTest(content.skillTestId(skill, 'B1', true)), `${skill} opens on the TOEFL track`);
  }
});

test('the newest score in a skill is the one that counts; a skill never tested has none', () => {
  const attempts = [
    { skills: { reading: 80 } },
    { skills: { listening: 61.4, reading: 40 } },
    { skills: { listening: 20 } },
  ];
  assert.equal(exam.latestSkillScore(attempts, 'reading'), 80);
  assert.equal(exam.latestSkillScore(attempts, 'listening'), 61);
  assert.equal(exam.latestSkillScore(attempts, 'writing'), null);
  assert.equal(exam.latestSkillScore([], 'reading'), null);
});

test('the exam name is trimmed, at most 80 characters, and empty means no name', () => {
  assert.equal(rules.cleanExamName('  TOEFL iBT  '), 'TOEFL iBT');
  assert.equal(rules.cleanExamName('   '), null);
  assert.equal(rules.cleanExamName(null), null);
  assert.equal(rules.cleanExamName(42), null, 'a number is not a name');
  assert.equal(rules.cleanExamName('x'.repeat(120)).length, 80);
});

test('a paused exam shows no date, and the date itself is kept', () => {
  assert.equal(exam.activeExamDate({ exam_date: '2026-12-01', exam_paused: false }), '2026-12-01');
  assert.equal(exam.activeExamDate({ exam_date: '2026-12-01', exam_paused: true }), null);
  assert.equal(exam.activeExamDate({ exam_date: null, exam_paused: false }), null);
  assert.equal(exam.activeExamDate(null), null);
});

test('the exam date reads as the day it is, whatever the time zone', () => {
  const text = exam.examDateText('2026-12-01');
  assert.match(text, /2026/);
  assert.match(text, /\b1\b/);
  assert.doesNotMatch(text, /November|\b30\b/, 'the day does not shift to the day before');
});
