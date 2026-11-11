// Tests the plural helper every count on screen uses, so "1 lesson" and "2 lessons" are written the same way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plural } from '../src/lib/text.ts';

test('a count uses the singular only for exactly one', () => {
  assert.equal(plural(1, 'lesson'), '1 lesson');
  assert.equal(plural(0, 'lesson'), '0 lessons');
  assert.equal(plural(2, 'lesson'), '2 lessons');
});

test('an irregular plural can be given explicitly', () => {
  assert.equal(plural(1, 'person', 'people'), '1 person');
  assert.equal(plural(3, 'person', 'people'), '3 people');
});
