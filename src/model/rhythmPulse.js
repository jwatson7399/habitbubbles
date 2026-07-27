// Ported from healthPulse.js. The pulse is event-driven rather than keyed to a
// rounded percentage, so a completion that moves the score by a fraction of a
// percent still gives feedback.
//
// TRANSITIONAL: `service` and `reset` completions are chore-era records that
// explicitly credit nobody, and they must not fire the pulse. HabitBubbles'
// target schema has no actor field at all, so this exclusion is deleted along
// with the service and board-reset features in a later phase.
const NON_CREDITING_ACTORS = new Set(["service", "reset"]);

export function completionIds(completions) {
  return new Set(
    (completions || [])
      .filter((completion) => !NON_CREDITING_ACTORS.has(completion.by))
      .map((completion) => completion.id)
      .filter(Boolean)
  );
}

export function shouldPulseRhythm(previousScore, nextScore, previousCompletionIds, completions) {
  if (previousScore == null || previousCompletionIds == null) return false;

  const scoreRose = Number(nextScore) > Number(previousScore) + Number.EPSILON;
  const currentIds = completionIds(completions);
  const hasNewCompletion = [...currentIds].some((id) => !previousCompletionIds.has(id));

  return scoreRose || hasNewCompletion;
}
