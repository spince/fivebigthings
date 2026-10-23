# Five to Focus — family/team planning mode (design note)
Added 2026-10-23, from Spencer's slant. GitHub: issue #20.
Master backlog: MB-008 / MB-016 in "Spencer — Master Backlog".

## The idea in one line
Same five-slot discipline, pointed at getting things done instead of trivia:
each person — and the family or team as a whole — keeps exactly five active
things, chosen by capture → rank → cut, and the week is checked against them daily.

## The two questions (the core ritual)
1. **Capture** — "What are your things?" Each person enters **5–7 candidates**
   for the week. The family/team also builds a shared candidate list.
   Seven is the wide net; five is the commitment.
2. **Rank & cut** — order the candidates. **Only the top five survive.**
   Everything below the cut line goes to a Parked list — visible, not active,
   and the first place to look when a slot frees up. Cutting is the product:
   a list that can't say no isn't a plan.

Before a thing counts it needs an **owner** and a **definition of done**
(one line each). Vague things ("get healthier") get sharpened or parked.

## The weekly / daily loop
- **Start of week (the planning session, ~15 min):** set the **Family Five**
  (shared) and each person's **My Five** for the week, using capture → rank → cut.
- **Each morning:** **Five for Today**, drawn from the weekly five first.
  Urgent or maintenance items can take a daily slot, but they're tagged
  *off-plan* so the trade is visible.
- **The callout:** if someone's Five for Today doesn't tackle **at least one**
  of their weekly five (or a Family Five they're part of), the app calls it
  out — as a question, not a verdict: *"None of today's five moves a weekly
  five. Drift, or a deliberate off-plan day?"* Three honest answers:
  **swap one in**, **mark today intentional** (the reason is the record), or
  **revise the weekly five** (the week changed; re-rank openly).
- **End of week:** review — done / progressed / blocked / carried / cut.
  Carried items re-enter next week's capture at the rank they earned.

## Rules that ship with v1
- **One in, one out.** Mid-week, a new thing can only enter the five by
  cutting one. The cut is recorded, so the plan has a memory.
- **Private by default.** Individual lists are the person's own; the
  family/team sees the Family Five and each person's *alignment status*
  (on-plan / intentional off-plan / not checked in), not their item details,
  unless they share them.
- **The callout is a nudge, never a scoreboard.** No public shaming, no
  streak-breaking penalties for an intentional day — the system's job is to
  make drift visible early, while it's still cheap to fix.
- **Kids participate at their level:** younger kids pick from the family
  capture list with a parent; the ritual matters more than the tooling.

## Data model (sketch)
```
list:   { id, scope: family|team|person, ownerId, weekOf }
thing:  { id, listId, title, ownerId, definitionOfDone, status: candidate|active|parked|done|carried|cut,
          rank, sourceListId (the weekly five a daily item serves), offPlanReason? }
checkin:{ id, personId, date, callout: none|drift|intentional, note? }
```

## Where it lands
- Consumer: a new mode beside Daily/Junior/Globe once accounts & sync
  (issue #10) exist for multi-device families; the ritual itself can be
  piloted manually first (Master Backlog MB-016).
- Framework tie-in: the team version is the same loop for work — a team's
  Five for the Week, daily standups replaced by the callout.
