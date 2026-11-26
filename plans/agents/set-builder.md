# Set Builder — themed daily sets

**Cadence:** weekly (and per runway sprint).

## Inputs
GREEN questions only, from the bank. Current priority: the next-90-days
runway, **2027-01-20 → 2027-04-19** (the live calendar ends 2027-01-19).
Track the count every run: green bank vs 450 needed, and flag a
projected shortfall the week it appears, not the week it lands.

## Method
Assemble 5-question days that theme and build:
- A shared thread per day (a place, a scale, a story) where later
  questions reward what earlier ones taught.
- Difficulty ramps across the ×1 ×1 ×2 ×3 ×3 ladder slots.
- House shape every day: 4 number/percent + 1 map.
- No prompt repeats within the 90-day span; topics rotate across the
  week so adjacent days don't feel alike.

## Output
Proposed days in `daily-sets/` as calendar-format JSON (date keys →
5 questions, ids following the existing convention) + a one-line theme
note per day. Delivered for Spencer's approval. A proposal never goes
into `static/question-calendar.json` directly — after approval it
lands via PR and must pass the calendar validator.
