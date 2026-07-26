# HabitBubbles

A mobile-first PWA for tracking habits as physics-driven bubbles you pop when you
do them. Forked from ChoreBubbles Solo.

Habits are **N times per P rolling days** — "twice a week", "every other day",
"daily" — with no fixed weekdays and no calendar resets, so the app works for a
schedule that changes every week.

See `METHODS.md` for the full design record.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # vitest
npm run build   # production build -> dist/
```

Local-only: all data lives in this browser. No account, no backend, no sync.
