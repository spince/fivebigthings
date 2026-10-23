# Dinner Draft — household meal planning mode (design note)
Added 2026-10-23, from Spencer's slant. GitHub: issue #21.
Master backlog: MB-009 in "Spencer — Master Backlog". Pairs with issue #20.

## The idea in one line
Every person in the household submits their five dinners; the app combines
and ranks them into a draft board, and mom/dad assign the winners to days
using the family calendar — so "what's for dinner?" is answered on Sunday,
not at 5:30pm.

## The flow
1. **Submit (the five)** — each household member submits **5 dinner ideas**,
   ranked 1–5 by the submitter. Kids submit too; a parent can submit on
   behalf of the youngest.
2. **Combine** — submissions merge into one board:
   - **Dedupe** near-matches (tacos / beef tacos / taco night = one entry,
     with variants noted).
   - **Rank** by nominations across the household + each submitter's own
     ranking (a meal three people listed beats one person's #1).
   - **Filters before ranking:** hard vetoes (allergies, true dislikes),
     a repeat cooldown (served in the last ~2 weeks drops, unless the
     household re-nominates it), and practical tags (quick / slow-cooker /
     weekend project / leftovers-friendly).
3. **Assign (mom/dad)** — the ranked shortlist (top ~10) is dragged onto the
   week's days **with the family calendar in view**: quick meals on
   practice/activity nights, slow-cooker on late-meeting days, the big
   roast on the quiet evening, leftovers and eating-out nights placed
   deliberately instead of by default.
4. **Callouts** — the board flags a mismatch before the week starts:
   a 90-minute recipe on soccer night, three chicken nights in a row,
   a day still unassigned.
5. **Output** — the week's dinner board (fridge-ready) plus a **grocery
   list draft** built from the assigned meals.

## Rules that ship with v1
- **Submissions are a draft, not a binding vote.** Parents hold final
  assignment and veto — nutrition, budget, and the calendar outrank the
  popular vote. The ranking informs; it doesn't rule.
- **Everyone's five counts.** The point of the ritual is that a kid who
  submitted sees their pick land on a day — that's what keeps submissions
  coming. If a person's picks never land, the board shows it.
- **History is the memory:** what was served, when, and how it landed
  (thumbs up/down at assignment time next week) feeds the cooldown and
  future rankings.

## Data model (sketch)
```
meal:       { id, householdId, name, variants: [], tags: [], lastServed, vetoedBy: [] }
submission: { id, weekOf, personId, mealId, rank }
plan:       { id, weekOf, assignments: { date -> mealId | leftovers | out }, assignedBy }
```

## Where it lands
- A household mode beside the planning mode (issue #20) — same weekly
  session can run both: Family Five, then Dinner Draft.
- Needs household accounts (issue #10) for multi-device submitting; a
  single-device + paper-board pilot works today.
