// A feedback message is checked here before it is sent. The database holds the same limits.
export const FEEDBACK_COMMENT_LIMIT = 1000;

export interface FeedbackDraft {
  rating: number;
  comment: string;
}

/** The rating is a whole number of stars from 1 to 5. The comment is trimmed, and it may be empty. */
export function checkFeedback(draft: FeedbackDraft): FeedbackDraft {
  const rating = Math.trunc(draft.rating);
  if (rating !== draft.rating || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5 stars.');
  const comment = draft.comment.trim();
  if (comment.length > FEEDBACK_COMMENT_LIMIT) {
    throw new Error(`Keep the comment to ${FEEDBACK_COMMENT_LIMIT} characters or fewer.`);
  }
  return { rating, comment };
}
