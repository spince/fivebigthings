# Five Big Things at Work — a training & learning framework
Refined outline, 2026-10-23. Built on the live fivebigthings.app engine
(5 questions a day, 1,000 points, every answer explained).

## 1. The premise
Corporate training fails on delivery, not content. Courses are long, rare, and
forgotten; policy reminders are emails nobody reads. This framework flips the
unit of learning to **five questions a day, ~2 minutes**, and relies on three
well-established effects:
- **Retrieval practice** — answering beats re-reading for retention.
- **Spacing** — the same idea resurfaces at expanding intervals until it sticks.
- **Elaborative feedback** — every answer ships with the little story behind
  it (already the consumer game's signature) plus a "go deeper" link.
The game is the delivery truck. The framework below is the cargo system:
what goes in, who owns it, how you prove it worked.

## 2. The Daily Five — anatomy of a day
A fixed slot template makes authoring fast and the habit predictable:

| Slot | Content | Source |
|------|---------|--------|
| 1–2 | **Know the Job** — role training | Team training tracks (§3A) |
| 3 | **Know the Rules** — policy pulse | Policy library (§3B) |
| 4 | **Know the Company** — product, customer, strategy, history | Company bank (§3C) |
| 5 | **Wildcard** — values in action, culture, a miss from *your* past questions | Rotation + spacing engine |

Same scoring DNA as the consumer game (1,000 points, streaks, shareable result),
but the scoreboard defaults to **teams, not individuals** (§7).

## 3. The three content paths

### 3A. Training tracks (Know the Job)
- Tracks map to roles/stations — the Chick-fil-A translation you already use
  for epop: data engineering, analytics, program management each get a track;
  a track is an ordered set of **objectives**, not a pile of questions.
- Each objective has a mastery bar (e.g. 3 correct answers, spaced ≥7 days apart).
- New-hire variant ("Rookie mode" — the Junior pattern): same content with the
  helper layer on: worked examples, easier distractors, comparisons, no stakes.
- Completion of a track = a certification event a manager can sign off,
  mirroring station sign-offs rather than course completions.

### 3B. Policy pulses (Know the Rules)
- Every policy in scope gets a small question set, **versioned to the policy
  version**. When Legal updates the policy, its questions expire automatically
  and must be re-approved — a stale question is a compliance risk, not content.
- Cadence by risk: high-risk (security, privacy, safety) pulses monthly;
  standard policies quarterly; launch-day pulse when a policy changes.
- Miss handling: a missed policy question resurfaces in 48 hours with a
  teaching variant, then escalates to a manager-visible *team* gap if the
  cohort keeps missing it. The system teaches first; it reports patterns,
  not people (§7).
- **Hard line: a pulse is evidence of exposure, not attestation.** Where a
  policy legally requires acknowledgment, the framework hands off to a formal
  1-tap acknowledge flow (Phase 3) or the existing LMS — the game never
  quietly pretends a trivia answer was a signature.

### 3C. Learn More (Know the Company) — the self-directed path
- **Trails**: short, themed, self-paced sequences — "Company 101", "How we
  make money", "Meet the product", "Customer stories", "How decisions get
  made here". A trail reuses the **Globe trainer pattern**: scaffolded steps
  that build (see it → name it → find it → use it), ending with a capstone set.
- Every daily question's explanation ends with **Go deeper →**, dropping the
  curious into the matching trail step. The Daily Five creates the itch;
  Learn More is where it's scratched.
- Trails are also the onboarding spine: a new hire's first two weeks can be
  one trail a day, alongside the Rookie daily five.

### 3D. Faces (Know Your People) — added 2026-10-23
- The photo version of the same engine: a deck is a roster (team, class,
  new-hire cohort), and people are learned like Globe learns countries —
  study card → name→face → face→name → typed fill-in-the-blank (the mastery
  gate; recognition alone never counts).
- In the Daily Five anatomy, a face can fill the wildcard slot — one new
  colleague a day beats a directory nobody opens.
- Hard rules, same spirit as §3B's attestation line: human-supplied labels
  only (never face recognition), private by default, consent attested by the
  deck owner, student decks never public. Full note: faces-spec.md.

## 4. Question design system (what makes a question "in framework")
Every question — training, policy, or company — carries this metadata
(the consumer game's schema, extended; unknown fields stay optional so one
engine serves both products):
```
id, track/objective, type (choice | estimate | scenario | locate),
prompt, answer, distractors-from-real-misconceptions,
explanation (the story, ≤ 2 sentences), goDeeper -> link/trail step,
sourceOfTruth (doc + section), owner (named human), difficulty 1–3,
reviewBy date, policyVersion (if policy), status (draft/review/live/expired)
```
Writing rules: one idea per question; plausible distractors built from real
misconceptions, not filler; numbers where the job uses numbers (estimates
train judgement); scenarios for judgement calls ("A customer sends X — what
do you do?"); **locate** questions reuse the pin mechanic for anything with a
place in a system: the right dashboard, the step in a runbook, the team on an
org chart, the region on a network map.

## 5. Spacing & mastery engine (Phase 2 core)
- Per-person, per-item schedule: correct → +1d, +3d, +7d, +21d, then retired
  to the wildcard pool; miss → resurface in 2 days with a variant.
- Slot 5 of the Daily Five is drawn from *your* due reviews first — so the
  template in §2 holds while the content personalizes.
- Mastery = the bar in §3A, computed from spaced correct answers only
  (same-day repeats don't count). Team heatmap = mastery by objective,
  aggregated; that heatmap is the manager's coaching agenda.

## 6. Roles & governance (the certified-trainer layer)
- **Player** — plays the daily five, walks trails.
- **Manager** — sees team completion + objective heatmap; gets a weekly
  digest, not a firehose.
- **Content Owner ("Certified Trainer")** — a named owner per track/bank,
  measured on their team's mastery movement, exactly the certified-trainer
  layer from the Chick-fil-A model: trainers own question quality,
  misconception mining, and review dates.
- **Policy Owner / Legal** — approves policy questions, owns versions/expiry.
- **Admin** — identity, cohorts, exports, retention.
Content lifecycle: `draft → SME review → (Legal, if policy) → live → expired`
— nothing lives past its `reviewBy` date without a human re-approval.

## 7. Measurement — and the trust rules that protect it
- **Engagement**: % of cohort playing ≥4 days/week; streak distribution.
- **Learning**: mastery by objective; retention re-test delta (a question
  answered right in week 1, probed again in week 6).
- **Compliance**: policy-pulse coverage by deadline (% of required cohort
  exposed + correct), exportable for audit.
- **Business**: time-to-proficiency for new hires; downstream signals owners
  already track (policy incidents, repeat support questions).
Trust rules (non-negotiable if employees are the players):
aggregate reporting only for groups of 5+; no public individual leaderboards
by default; no disciplinary use of game data; purpose stated in-product in
plain language; retention limits on per-person history.

## 8. Delivery & identity
Surfaces reuse the consumer stack: web + PWA + the planned native shell,
plus a daily nudge where people already are (Slack/Teams message, email
fallback) deep-linking into that day's five. Identity: anonymous pilot →
SSO (Okta/Google) → LMS/xAPI export for credit where the company requires it.
A tenant is a company: own brand, banks, cohorts, SSO, data.

## 9. How this relates to the consumer app
One engine, two skins. Consumer Daily/Junior/Globe are living demos of the
three patterns the framework sells: **Daily** = the habit loop,
**Junior** = scaffolded onboarding, **Globe** = trainer trails. Schema or
engine improvements should be built once, in the consumer repo's shape first.

## 10. Iteration plan
Each phase has a build, a measure, and a decision gate. Pilot cohort
suggestion: **epop** — your org, your content, your certified-trainer work
already underway.

- **Phase 0 — Prove the loop (2 weeks, no new code)**
  Build: hand-author 10 days of Daily Fives for one team in a private skin of
  the current app (10 job questions, 5 policy, 5 company per week-mix above),
  plus one 5-step Learn trail on the Globe pattern.
  Measure: completion ≥60% of cohort on ≥8 of 10 days; 5 player interviews;
  authoring time per question (the hidden cost).
  Gate: if completion or authoring cost fails, fix the format before any platform work.
- **Phase 1 — MVP tenant (3–4 weeks)**
  Build: config-driven tenant (brand + banks + cohorts) on the Flask engine;
  magic-link identity; policy-pulse scheduling + expiry; CSV export of coverage.
  Measure: one real policy cycle run end-to-end with Legal sign-off on wording.
  Gate: Legal accepts pulse records as exposure evidence (not attestation).
- **Phase 2 — Make it learn (4–6 weeks)**
  Build: spacing/mastery engine, wildcard slot personalization, manager
  heatmap + weekly digest, Slack/Teams nudge.
  Measure: retention re-test delta vs Phase 0 cohort; manager uses the heatmap in ≥1 coaching conversation.
  Gate: measurable retention lift, or the spacing design gets reworked before scaling.
- **Phase 3 — Learn paths & formal flows**
  Build: trail builder for Content Owners, formal acknowledge handoff for
  policies that need it, xAPI/LMS export, SSO.
- **Phase 4 — Productize or hand over**
  Multi-tenant hardening, native shell, admin console — only if Phases 0–2 say yes.

## 11. Open decisions for Spencer
1. Internal Fastly tool, your side product, or both-in-sequence?
2. Pilot cohort: epop as suggested, or a Fastly team with a real compliance cycle?
3. Attestation ambition: stay at "exposure + handoff" (§3B) or aim to *be* the system of record?
4. Identity for the pilot: magic link is enough, or must it be Fastly SSO from day one?
5. Who owns content long-term: central L&D, or distributed Certified Trainers per team?
6. Name: keep "Five Big Things (at Work)" equity, or a distinct work brand?
