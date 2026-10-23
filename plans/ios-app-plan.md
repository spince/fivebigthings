# Five Big Things — iOS / iPadOS App Plan
> **Status (2026-10-23):** Option C (PWA) is implemented in PR #1,
> together with /junior and /globe — pending merge and Fastly deployment. Option A (native SwiftUI) is next — see backlog issue #5
> and [backlog.md](backlog.md). This document is the original checked analysis.

Checked live 2026-10-23 from https://fivebigthings.app

## What the web app is today
- Daily game: 5 questions, 1,000 points total. Modes: Daily + Practice
- Question flow as implemented in /static/app.js:
  - Q1-Q2: 4-choice estimates (factors 0.5 / 0.8 / 1.0 / 1.3 of answer)
  - Q3-Q5: free numeric guess (percent type clamped 0-100)
  - One question is type `map`: drop a pin — Globe.gl (WebGL) with flat-map and lat/lng fallbacks
  - Scoring client-side: multiplier 1x,1x,2x,3x,3x = max 100/100/200/300/300
    - Numeric: `round(100 * exp(-2.1 * |guess-answer|/max(answer,1))) * multiplier`
    - Map: haversine km, `round(100 * exp(-km/900)) * multiplier`
  - Hint per question, explanation on reveal, share via Web Share API / clipboard
  - Daily completion saved only in localStorage `fivebigthings-daily-v2`
- No accounts, no login, no PWA manifest yet ( /manifest.json = 404 )
- Design tokens: paper #f5f4ef, ink #20241f, green #234b3c, lime #caeb8b
  Fonts: Space Grotesk (display), DM Sans (body), DM Mono (labels)

## API — no backend changes needed for v1
- `GET /api/daily` -> `{ date: "2026-10-23", questions: [...] }`
- `GET /api/practice` -> `{ questions: [...] }`
- Question: `{ id, title, prompt, hint, explanation, type: number|percent|map, unit, answer }`
  - For map, `answer` is `{ lat, lng }`, otherwise a number
  - Note: answers ship in the payload and scoring is local — fine for a casual game, same as web

## Options

### A) Native SwiftUI — recommended for App Store
- Universal app (iPhone + iPad), talks directly to the two APIs above
- Map question uses MapKit instead of Globe.gl — faster, native pinch/drop-pin, works offline-cached tiles
- Native wins that fix Apple's Guideline 4.2 rejection risk for web wrappers:
  daily reminder push/local notification, Home Screen widget (today's round / streak),
  haptics on lock-in, native share sheet, iPad split layout with larger map
- Keep: same colors/fonts, UserDefaults equivalent of localStorage for daily completion
- Effort: solid v1 in ~1-2 weeks of focused work; scaffold in a day
- Needs: Xcode on Mac, Apple Developer Program $99/yr for TestFlight external / App Store

### B) Capacitor WKWebView wrapper — fastest to a real .ipa
- Wraps the live Fastly site, adds native share, notifications, icon/splash
- Effort: 1-2 days to TestFlight
- Risk: Apple Guideline 4.2 — "minimum functionality" — often rejects pure website wrappers
  unless you add the native features in (A). Good for personal/family TestFlight, risky for public store.

### C) PWA first — installable today, no App Store
- Add manifest.webmanifest + icons + apple-touch-icon + service worker to the Fastly site
- Users: Share > Add to Home Screen on iPhone/iPad, full-screen, same game
- Effort: a few hours on the web side, $0, no review
- Limits: no App Store presence, no push on older iOS flows, no widget

## Recommendation
Do C now as a stopgap (cheap, immediate on your own iPad), build A as the real app.
Skip B unless you need TestFlight this week for other people.

## Open decision from Spencer
1. Distribution: just you/family (TestFlight / direct Xcode install) or public App Store?
2. If public: are widgets + a daily reminder in v1, or v1.1?
