// Ported from healthPulse.js. The credited-actor filter is gone: HabitBubbles
// has a single user and no import path from ChoreBubbles, so the predicate
// would always be true.
//
// The pulse is event-driven rather than keyed to a rounded percentage, so a
// completion that moves the score by a fraction of a percent still gives
// feedback.

export function completionIds(completions) {
  return new Set(
    (completions || []).map((completion) => completion.id).filter(Boolean)
  );
}

export function shouldPulseRhythm(previousScore, nextScore, previousCompletionIds, completions) {
  if (previousScore == null || previousCompletionIds == null) return false;

  const scoreRose = Number(nextScore) > Number(previousScore) + Number.EPSILON;
  const currentIds = completionIds(completions);
  const hasNewCompletion = [...currentIds].some((id) => !previousCompletionIds.has(id));

  return scoreRose || hasNewCompletion;
}
