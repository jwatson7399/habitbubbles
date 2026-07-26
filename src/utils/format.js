import { now } from "../App.jsx";

// The home's face: seven moods from loving bliss down to withering
export function faceFor(pct) {
  if (pct >= 90) return "🥰🌱";
  if (pct >= 75) return "🙂";
  if (pct >= 60) return "😐";
  if (pct >= 45) return "😟";
  if (pct >= 30) return "😩";
  if (pct >= 15) return "😫";
  return "🥀";
}

export function timeAgo(ts) {
  const m = Math.floor((now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  return d + "d ago";
}

export function historyDate(ts) {
  const date = new Date(Number(ts));
  if (!Number.isFinite(date.getTime())) return "Unknown date";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
