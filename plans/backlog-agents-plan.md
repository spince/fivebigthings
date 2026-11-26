# Five Big Things — backlog attack plan, deploy checks, test hardening, and the agent crew

Drafted 2026-11-25. **Tracking lives in the Notion Master Backlog
(Spencer, 2026-11-25: "Never use GitHub Issues, always use Notion" —
recorded as MB-068).** The # numbers below are legacy references to the
repo's October GitHub issues, kept only because the work was first scoped
there; every item of work in this plan gets an MB number in Notion, and
new work is filed there, never as a GitHub issue.
House rules that apply to every workstream below: PRs assigned to spince,
tests + prek green before merge, never hand-write `?v=` or the service-worker
VERSION (app.py stamps both from file hashes), production deploys stay manual
behind the approval gate.

## 1. Backlog attack order

Worked in this order; "Claude" = doable end-to-end by Claude with review,
"Decision" = blocked on a Spencer call, "Spencer" = needs his hands/accounts.

### Now (before the January content cliff)
1. **#4 Content runway — next 90 days (2027-01-20 → 2027-04-19).** Hard
   deadline: the live calendar ends 2027-01-19; on 2027-01-20 `/api/daily`
   starts returning 503. Fed by the Generator → Playtester → Set Builder
   pipeline in §4. Claude drafts, Spencer approves days in batches.
2. **#27 Pinpoint scoring recalibration.** One-constant change (decay
   900 → 10,000) plus a scoring unit test so the ladder math is pinned.
   ~15 minutes. Claude.
3. **#8 Calendar validator + preview.** A script/CI check that validates
   any proposed calendar JSON (90 consecutive days, 5/day, unique prompts,
   answer sanity ranges, map answers have lat/lng) before it can merge.
   This is the gate the agent pipeline's output passes through. Claude.
4. **#28 Results-card mismatch.** Blocked on the player's answers to the
   three questions in the Oct comment. Claude re-asks once via Spencer;
   if no reply by mid-December, close as unreproducible with the
   version-skew explanation attached.
5. **#2 Close it.** PR #1 shipped in October; the issue is housekeeping.
   Spencer or Claude with a "shipped in PR #1" comment.
6. **#3 PNG icons.** Spencer uploads the PNG set in the web UI (binary
   files can't go through Claude's GitHub connection); Claude wires the
   manifest + HTML refs in a follow-up PR.

### Next (hardening and growth, roughly in order)
7. **#9 Route smoke tests in CI** — implemented by §3 of this plan.
8. **#26 Usage stats.** Decision: log streaming vs beacon vs
   Plausible/Umami. Recommendation: a tiny first-party beacon to a Fastly
   log endpoint is overkill; start with Plausible-style privacy-friendly
   counting or accept Fastly totals. Spencer decides; Claude implements.
9. **#6 Junior calendar pipeline** — date-keyed junior days (30 banked),
   same validator as #8, junior sets assembled by the Set Builder.
10. **#7 Globe deck growth** — 19 → 100+ countries + Country of the Day.
    The Generator can draft country entries; every entry verified against
    REST Countries before merge (the 19-country deck's standard).
11. **#18 Globe photo steps** (landmarks/skylines/flags) and **#17 Faces**
    — Faces only with human-supplied labels, never face recognition, and
    minors' decks never public (standing rule from the spec).

### Later / decision-gated
12. **#16 Framework pilot**, **#20/#21 planning modes** — product bets;
    the framework's 6 open decisions are Spencer's.
13. **#5 Native iOS app** — gate: Apple Developer Program ($99/yr) +
    distribution decision. Revisit after the content runway is safe.
14. **#10 → #11 → #12 chain** — accounts, then server-side scoring, then
    leaderboards/share cards. Strictly in that order; each is a project.
15. **#13 Streaks/recap**, **#14 accessibility pass**, **#15 Android/i18n**
    — schedule after the chain above or opportunistically.

## 2. Post-deployment checks

Goal: a deploy is not "done" when the workflow goes green; it's done when
the live site proves it. Two layers:

### 2a. Verify job inside the deploy workflow (immediate)
Add a `verify` job to `deploy-production.yml` (`needs: deploy-production`)
that curls the live site and fails the run loudly if any check fails:
- `GET /`, `/junior`, `/globe`, `/offline.html` → 200 and contain `</html>`.
- `GET /api/daily` → 200, `date` equals the UTC date, exactly 5 questions.
- `GET /api/daily?date=<UTC+1>` and `?date=<UTC-1>` → 200 (timezone window
  from #25's fix works in production, not just in tests).
- `GET /api/daily?date=<UTC+7>` → 400 (future-peeking still refused).
- `GET /api/practice`, `/api/junior`, `/api/junior-practice` → 200, 5 each.
- `GET /sw.js` → 200 with `Service-Worker-Allowed: /`.
- `GET /api/daily` response header `Cache-Control: no-store`.
- Fetch `/`, extract the `app.js?v=<hash>` reference, fetch it → 200 (the new
  build actually reached players; catches cache/version skew like #28).

### 2b. Daily scheduled smoke (catches slow-motion failures)
A small GitHub Actions cron workflow running the same checks once a day
against production. Its real job: catch the calendar running out
(2027-01-20 cliff), a lapsed domain/cert, or a silent Fastly config drift
on a day nobody deployed. Failures open/notify via the failed run.

A `scripts/smoke.sh` holds the checks so they run identically locally,
in the verify job, and in the cron.

## 3. Test hardening

Current state: `tests/test_app.py` (11 tests: routes, SW scope, manifest,
daily shape + timezone window, calendar integrity) and CI `node --check`
on every JS file. Gaps and the fixes, in order:

1. **Scoring unit tests (JS).** The 1,000-point ladder
   (×1 ×1 ×2 ×3 ×3 = 100/100/200/300/300), the ≤22 km full-marks rule,
   the pinpoint decay curve (incl. the #27 constant), and haversine
   sanity. Pure functions get a `node --test` suite; where a function
   lives inside app.js/globe.js/junior.js, expose it for tests with a
   guarded `module.exports` (no build step, no behavior change).
2. **Calendar contract test (Python).** Run the test client across
   *every* scheduled day: 200, 5 questions, served `date` == requested
   date. Catches key/ID drift like the 2026-11-10/11 offset.
3. **Cache-header matrix test.** Every route class asserts its header:
   `/static/*` immutable, `/api/*` no-store, shell pages no-cache.
4. **Browser integration test (the #globe lesson).** A headless-Chrome
   test (Playwright) in CI against the locally served app:
   - `/` loads, a practice round can be played end-to-end, and the score
     card's rows match the questions asked (regression for #28).
   - `/globe` loads with WebGL available and the **WebGL canvas is the
     visible view** (flat fallback stays hidden) — and the study view's
     point of view equals the country's coordinates at its zoomAltitude
     (regression for the un-zoomed globe bug).
   - `/junior` loads and a practice round completes.
   Runs in CI on PRs (local server) and, in smoke form, against
   production in the §2b cron.
5. **Fallback-path tests.** With WebGL disabled, /globe must land on the
   flat map *with a country marker for study steps* (steps 1–3 are
   unanswerable on a bare world map) — see the bug fix that ships with
   this plan.

## 4. The agent crew

Four standing sub-agents. All four **propose**; none merges, deploys, or
edits the live calendar directly. Outputs land as files/PRs for review.
Specs live in `plans/agents/` so any Claude session can run them.

### 4.1 Generator — 10 new questions a day
- **Cadence:** daily, morning ET.
- **Input:** the live calendar + bank (dedupe against all 450 prompts and
  every previously generated candidate), topic spread of the last 14
  days (avoid clustering), the scoring ladder (each candidate declares
  its intended slot type: number / percent / map).
- **Output:** 10 candidates in calendar JSON shape — prompt, answer,
  unit, explanation, and a **source** for the answer. No `hint` field
  (hints were removed from the game in PR #35).
- **Rules:** answers must be checkable facts with a citable source;
  numbers should be guessable within an order of magnitude; map answers
  need lat/lng. Nothing time-sensitive ("current CEO…").

### 4.2 Playtester — red / yellow / green
- **Cadence:** on every Generator batch and every proposed calendar day;
  weekly sweep of the next 14 live days.
- **Method:** plays each question blind as a strong generalist, then
  audits it: Is the answer right (checks the source)? Is the wording
  unambiguous? Are number ranges sane to guess? For choice questions,
  are distractors plausible but not trick? Any kid-safety or
  fairness problem?
- **Verdicts:** **RED** = trash it (wrong answer, broken, unfair,
  duplicate). **YELLOW** = adjust it — must include the exact proposed
  edit (reworded prompt, corrected answer, better unit). **GREEN** =
  good to go.
- **Output:** a per-batch report (`reports/playtests/`) with verdicts
  and reasons; REDs also get logged on the item in Notion.

### 4.3 Set Builder — themed daily sets
- **Cadence:** weekly, or per runway sprint for #4.
- **Input:** GREEN questions only (bank + approved Generator output).
- **Method:** assembles 5-question days that theme and build: a shared
  thread (a place, a scale, a story) where later questions reward what
  earlier ones taught; difficulty ramps across the ×1 ×1 ×2 ×3 ×3
  ladder; each day keeps the house shape (4 number/percent + 1 map);
  no prompt repeats within the 90-day span; topics rotate across the
  week so no two adjacent days feel alike.
- **Output:** proposed days as calendar-format JSON + a one-line theme
  note per day, delivered as a PR against a staging calendar file —
  never directly into `question-calendar.json`. The #8 validator runs
  on every proposal.

### 4.4 Curator — feature requests
- **Cadence:** weekly digest.
- **Input:** the Notion Master Backlog, player reports relayed by
  Spencer (the #25/#28 pattern), and asks dropped in this chat.
- **Method:** dedupe against open MB items, cluster themes, draft new
  MB items in the house format with a proposed priority and a one-line
  "why it matters," flag decision-gated items (money, accounts,
  anything touching kids' data).
- **Output:** a weekly digest for Spencer + draft MB items. Files
  nothing without his nod.

### The pipeline, end to end
Generator (daily candidates) → Playtester (verdicts; YELLOWs edited and
re-checked) → question bank (GREENs) → Set Builder (themed days) →
validator (#8) → Spencer approves → calendar PR → merge → manual deploy
→ §2 checks prove it live. The Curator runs alongside, keeping the
feature backlog as clean as the question bank.

## 5. Decisions this plan needs from Spencer
1. Analytics route for #26 (beacon vs Plausible/Umami vs Fastly totals).
2. Agent cadences: Generator daily? Playtester per batch + weekly?
   Curator digest day?
3. Where Playtester reports live: repo `reports/` (public) or the
   private goal workspace.
4. Native app gate (#5): still parked until the runway is safe?
