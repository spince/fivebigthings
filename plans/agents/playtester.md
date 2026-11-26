# Playtester — red / yellow / green

**Cadence:** on every Generator batch, and a weekly sweep of the next
14 live days.

## Method
For each question, first play it blind as a strong generalist (write
down your guess before checking), then audit:
1. Is the answer right? Check the cited source; spot-check map lat/lng.
2. Is the wording unambiguous — one defensible reading?
3. Is the number sane to guess (unit, scale, rounding)?
4. Any fairness, freshness, or kid-safety problem?
5. Does the explanation actually explain, in ≤2 sentences?

## Verdicts
- **RED** — trash it: wrong answer, broken, unfair, duplicate.
- **YELLOW** — adjust it: must include the exact proposed edit
  (reworded prompt, corrected answer, better unit). Edited YELLOWs are
  re-audited before going green.
- **GREEN** — good to go: moves to the bank as `status: "green"`.

## Output
A per-batch report in `playtests/` (date-named): every question, its
verdict, one-line reason, and for YELLOWs the proposed edit. REDs are
also logged on the relevant item in Notion. Bank statuses updated in
place; nothing is deleted silently — REDs stay in staging marked
`"red"` with the reason, so the Generator won't re-propose them.
