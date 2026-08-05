// A completion logged in the small hours usually belongs to the waking day
// that just ended. Before 4 a.m., "Just now" therefore defaults to 11 p.m. on
// the previous calendar date. The date and time remain fully editable in the
// completion sheet.
export const LATE_NIGHT_CUTOFF_HOUR = 4;
export const LATE_NIGHT_COMPLETION_HOUR = 23;

const pad = (value) => String(value).padStart(2, "0");

export function defaultCompletionAt(nowMs) {
  const current = new Date(Number(nowMs));
  if (!Number.isFinite(current.getTime())) return NaN;
  if (current.getHours() >= LATE_NIGHT_CUTOFF_HOUR) return current.getTime();

  const adjusted = new Date(current);
  adjusted.setDate(adjusted.getDate() - 1);
  adjusted.setHours(LATE_NIGHT_COMPLETION_HOUR, 0, 0, 0);
  return adjusted.getTime();
}

export function dateInputValue(timestamp) {
  const date = new Date(Number(timestamp));
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function timeInputValue(timestamp) {
  const date = new Date(Number(timestamp));
  if (!Number.isFinite(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateTime(dateValue, timeValue) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue));
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(timeValue));
  if (!dateMatch || !timeMatch) return NaN;

  const [, year, month, day] = dateMatch.map(Number);
  const [, hour, minute] = timeMatch.map(Number);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  ) return NaN;
  return result.getTime();
}

export function daysAgoAt(nowMs, daysAgo, timeSource = nowMs) {
  // Base quick choices on the same waking-day convention as "Just now". At
  // 1 a.m., Just now belongs to the date that just ended and Yesterday means
  // the date before that, so the two choices never silently collapse together.
  const current = new Date(defaultCompletionAt(nowMs));
  const time = new Date(Number(timeSource));
  if (!Number.isFinite(current.getTime()) || !Number.isFinite(time.getTime())) return NaN;
  current.setDate(current.getDate() - Math.max(0, Number(daysAgo) || 0));
  current.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return current.getTime();
}
