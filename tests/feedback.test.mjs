// Checks a feedback message before it is sent (src/lib/feedback.ts). The database holds the same limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFeedback, FEEDBACK_COMMENT_LIMIT } from '../src/lib/feedback.ts';

test('a rating is a whole number of stars from 1 to 5', () => {
  assert.equal(checkFeedback({ rating: 1, comment: '' }).rating, 1);
  assert.equal(checkFeedback({ rating: 5, comment: '' }).rating, 5);
  for (const rating of [0, 6, 2.5, -1, Number.NaN]) {
    assert.throws(() => checkFeedback({ rating, comment: '' }), /1 to 5 stars/, `rating ${rating}`);
  }
});

test('the comment is trimmed, may be empty, and stops at the limit', () => {
  assert.equal(checkFeedback({ rating: 4, comment: '  Clear lessons  ' }).comment, 'Clear lessons');
  assert.equal(checkFeedback({ rating: 3, comment: '   ' }).comment, '');
  const longest = 'x'.repeat(FEEDBACK_COMMENT_LIMIT);
  assert.equal(checkFeedback({ rating: 3, comment: longest }).comment.length, FEEDBACK_COMMENT_LIMIT);
  assert.throws(() => checkFeedback({ rating: 3, comment: `${longest}x` }), /1000 characters/);
});
