# fivebigthings.app — backlog & enhancement plan
As of 2026-10-23. GitHub: spince/fivebigthings.
**Backlog is now tracked as GitHub Issues #2–#18** (created 2026-10-23 from this doc):
NOW #2 ship PR #1 · #3 PNG icons · #4 content runway — NEXT #5 native v1 · #6 junior pipeline ·
#7 globe deck · #8 calendar tooling · #9 CI tests · #17 Faces mode · #18 globe photo steps —
LATER #10 accounts · #11 server scoring · #12 friends/leaderboards · #13 streaks · #14 a11y ·
#15 Android/i18n — FRAMEWORK #16 Phase 0 pilot. This doc stays the narrative version.

## State of the app today
- **Live**: Daily + Practice (Flask on Fastly Compute), 90-day question calendar:
  2026-10-22 → **2027-01-19**, 450 unique questions, no repeats, no gaps.
- **In PR #1 (open, unmerged)**: PWA (SW/manifest/offline, SVG icons), `/junior`
  (daily + practice, helper layer), `/globe` (19-country trainer), nav update.
- **Designed, not built**: native iOS/iPadOS app (ios-app-plan.md — SwiftUI, MapKit,
  widget, daily reminder), corporate training framework (training-framework.md).

## NOW — ship PR #1 and protect the daily
1. **Merge PR #1** and deploy (`fastly compute deploy` from repo).
2. **Post-deploy verification** (30 min): install PWA on iPhone + iPad
   (Add to Home Screen, icon renders, full-screen), play 1 round each of
   Daily / Junior / Globe, confirm SW activates and an offline relaunch
   shows the offline page rather than a stale daily.
3. **PNG icon follow-up** (from PR #1 notes): drop the 6 PNGs from the PWA kit
   into `static/icons/` via GitHub web UI, swap `apple-touch-icon` + manifest
   references from SVG → PNG in a small follow-up PR. (SVG renders correctly;
   PNG is the belt-and-braces for older iOS.)
4. **Content runway alert**: the daily calendar ends **2027-01-19**. Authoring
   the next 90 days is the long pole — start by **Dec 2026** at the latest.
   Decide: same hand-authored JSON flow, or the authoring tool in NEXT-4 first.

## NEXT — depth on the three modes + native v1
1. **Native iOS/iPadOS app v1** (the "then native" step):
   SwiftUI universal app on the existing APIs; MapKit for Globe pin steps;
   UserDefaults parity with localStorage completion; **v1 native-only wins**:
   daily-reminder notification, Home Screen widget (today's status/streak).
   Needs: Xcode project scaffold, Apple Developer Program ($99/yr), TestFlight.
   v1.1: streak sync consideration (see LATER-1), share-sheet polish, iPad split layout.
2. **Junior content pipeline**: date-keyed `junior-calendar.json` mirroring the
   main calendar (today Junior serves one fixed daily set). Target: 30 days
   banked before promoting Junior in the nav long-term. Add read-aloud voice
   check on a real iPad (speechSynthesis voice quality varies).
3. **Globe deck growth**: 19 → 50 → 100+ countries; unlock the held-back sets
   with house rules (multi-capital countries as a "hard mode" where step 2
   accepts any capital; transcontinental with the dataset's convention noted
   in the fact line). Add **Country of the Day** (date-seeded, reuses the
   Daily calendar pattern) alongside free-trainer mode.
3b. **Faces mode** (issue #17, spec: faces-spec.md): photo-based name learning —
   roster decks (sports teams, classes, work teams) with study cards, name→face,
   face→name, and typed fill-in-the-blank as the mastery gate. Human-supplied
   labels only, private by default. Globe gains photo steps too (issue #18:
   landmark → country/pin, flags, skylines; Wikimedia Commons photos with credit).
4. **Calendar authoring tooling**: a small validator + preview for
   `question-calendar.json` (schema check, duplicate-id detection, date-gap
   report, answer-sanity lint) — the file is 170KB hand-edited JSON; one bad
   comma takes down `/api/daily` for a day. Add the same validator as a
   GitHub Action on PRs touching the calendar.
5. **Route tests in CI**: the local smoke test from PR #1 (all routes 200 +
   headers) as a pytest + GitHub Action, so app.py changes can't silently
   break a route. Fastly preview deploy per PR if the Fastly GitHub
   integration makes it cheap.

## LATER — growth features (in dependency order)
1. **Accounts & sync** — prerequisite for everything below: identity
   (Sign in with Apple first), server-side completion/streak storage.
   Today everything is per-device localStorage.
2. **Server-side scoring** — required before any leaderboard (answers
   currently ship in the API payload; fine for a friendly game, not for
   ranked play). Move scoring + answer-checking behind the API for all modes.
3. **Friends & leaderboards** — weekly friends board, team boards for Globe
   countries learned; share cards rendered as images (today share is text-only).
4. **Streaks & gentle retention** — visible streak, freeze day, weekly recap
   share; no dark patterns (fits the brand: "your score, your call").
5. **Accessibility pass** — VoiceOver labels on choice cards and the globe,
   reduced-motion handling for globe spin, contrast audit of the lime/green.
6. **Android** — the PWA already covers installable Android; a native Android
   app only if the iOS numbers justify it.
7. **i18n** — question schema already separates prompt/explanation; units and
   number formatting are the real work, in that order.

## Framework track (from training-framework.md — separate plan, shared engine)
- Phase 0 pilot on the consumer engine (private skin, hand-authored banks) —
  no consumer-app work required beyond a branding/bank config switch.
- Keep the question schema forward-compatible: optional `objective`,
  `sourceOfTruth`, `reviewBy` fields should be *allowed* by the consumer
  validators now, so the corporate fork never needs a schema migration.

## Parking lot (named so they stop resurfacing)
- Tuesday-flight-style re-litigations don't apply here, but: no ads, no
  in-app purchases, no public individual leaderboards by default — brand
  decisions already implicit in the design; revisit only deliberately.
- Globe "hard mode" (multi-capital/transcontinental) lives in NEXT-3, not v1.
