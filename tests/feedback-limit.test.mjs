// Tests the one-an-hour limit of feedback in the app: the error a blocked message raises, and the seconds it carries,
// which the feedback box turns into a notice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FeedbackLimitError } from '../src/lib/feedback.ts';

test('a blocked feedback message is a limit error that says how many seconds to wait', () => {
  const blocked = new FeedbackLimitError(1200);
  assert.ok(blocked instanceof Error);
  assert.equal(blocked.name, 'FeedbackLimitError');
  assert.equal(blocked.seconds, 1200);
});
