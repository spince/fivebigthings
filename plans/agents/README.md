# The agent crew — Five Big Things content pipeline

Standing sub-agent specs for keeping fivebigthings.app fed and healthy.
Activated by Spencer 2026-11-25 (plan: `plans/backlog-agents-plan.md`).

## The pipeline

```
Generator → Playtester → question bank (GREEN only) → Set Builder
  → calendar validator → Spencer approves → calendar PR → merge
  → manual deploy → post-deploy checks
```

The Curator runs alongside, keeping the feature backlog (Notion Master
Backlog) as clean as the question bank.

## Ground rules for every agent

- **Propose, never publish.** No agent merges, deploys, or edits the
  live `static/question-calendar.json`. Outputs are files and digests
  for Spencer's approval.
- **Tracking lives in Notion** (Master Backlog, MB numbers) — never
  GitHub Issues (Spencer, 2026-11-25; MB-068).
- **Scoring law:** every day totals 1,000 points on the ladder
  ×1 ×1 ×2 ×3 ×3 (100/100/200/300/300). Days are 4 number/percent
  questions + 1 map question.
- **No `hint` field** — hints were removed from the game (PR #35).
- **Question shape** (matches `static/question-calendar.json`):
  `{id, type: "number"|"map", title, prompt, unit, answer, explanation}`
  where a map answer is `{"lat": …, "lng": …}` and unit is `"km"`.
- Working files (bank, reports, proposed days) live in the Five Big
  Things goal workspace, not the repo: `question-bank.json`,
  `playtests/`, `daily-sets/`.

## Cadences

| Agent | When | Spec |
|---|---|---|
| Generator | Daily, morning ET | `generator.md` |
| Playtester | On every Generator batch + weekly sweep | `playtester.md` |
| Set Builder | Weekly | `set-builder.md` |
| Curator | Weekly digest | `curator.md` |
