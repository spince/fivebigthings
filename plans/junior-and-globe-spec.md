# Five Big Things — /junior and /globe spec
Drafted 2026-10-23 from Spencer's brief. Working prototypes (junior.html/js, globe.html/js, sample data) were built with this spec and live in the project workspace; the production implementation is in PR #1, pending merge and deployment.

Both modes reuse what already works: same design tokens, same 5-question /
1,000-point shape, same client-side scoring style, same Globe.gl + flat-map +
coordinate fallbacks. New routes: `/junior`, `/globe`. Nav becomes
Today · Practice · Junior · Globe — on narrow screens the topbar nav needs to
scroll or shrink (it is absolutely centered today; test at 375px).

---

## /junior — same game, built for kids

Same structure as the main game (Q1–Q2 four choices, Q3–Q4 free number,
Q5 map pin), same scoring formulas, friendlier everything else:

**Question bank rules**
- Kid topics: animals, body, space-lite, food, weather, sports, geography-lite
- Round, friendly numbers (answers mostly under 100, or big-but-round: 100, 1,000)
- Short sentences, no trick wording, US grade ~2–4 reading level
- Every question ships the extra `junior` fields below — helpers are data, not code

**The additional helpers (the point of the mode)**
1. **🔊 Read to me** — speechSynthesis reads prompt + choices aloud.
   Essential for pre-readers; no server cost.
2. **Hint ladder, 3 rungs** instead of the adult single hint:
   *Nudge* (existing hint) → *Bigger hint* → *Super hint* (nearly gives the scale away, never the answer).
3. **Make it easier** (per question type):
   - Choices: 50/50 — greys out two wrong choices
   - Number: reveals a range ("It's between 10 and 25") + shows it on a simple number line
   - Map: zooms the globe to the right continent/region first
4. **Comparison card** — every answer anchored to a kid-scale reference:
   "About as tall as 3 grown-ups stacked up", with an emoji/pictogram.
5. **Tone layer** — bigger type (18–20px prompts), bigger tap targets,
   no fail language: low scores say "Great guessing — here's a cool fact",
   every reveal leads with the fun explanation, stars alongside points.
6. **Helpers are FREE.** No point penalty. Junior is for learning, there's
   no Junior leaderboard to protect. (If that changes, revisit.)

**API**
```
GET /api/junior          -> { date, questions: [...] }   (as built in PR #1: ONE fixed daily set.
                             A date-seeded rotating junior calendar is planned — issue #6)
GET /api/junior-practice -> { questions: [...] }
```
Question = existing shape + 
```json
"junior": {
  "emoji": "🦒",
  "readAloud": "How many feet tall is a giraffe?",
  "hint2": "Taller than a house's front door — a lot taller.",
  "superHint": "It's between 10 and 25 feet.",
  "comparison": "About as tall as 3 grown-ups stacked up.",
  "range": { "low": 10, "high": 25 }
}
```
Daily completion stored separately: `fivebigthings-junior-v1` in localStorage.
Prototype sample round: `junior-sample.json` (prototype data, now `static/junior-questions.json` in production) (5 Qs, all fields filled).

---

## /globe — country trainer

One session = **one country**, five steps. **Scoring is the house ladder —
the same as the main game and MapTap: the round totals 1,000 and difficulty
climbs with the multipliers, steps worth up to 100 / 100 / 200 / 300 / 300
(×1 ×1 ×2 ×3 ×3).** The easy continent pick is ×1; the hardest step — pinning a
bare city name — is ×3. Choice steps award their step max or 0; pin steps award
a distance-decayed share of their step max.
Not a daily — a trainer: "New country" button deals another, endless play.
(A date-seeded "country of the day" is a trivial later add: seed by date like Daily.)

| # | Step | View | Player does | Scoring |
|---|------|------|-------------|---------|
| 1 | What continent? | Globe **zoomed to the country** (centered, `zoomAltitude`), no labels | Pick 1 of 4 continents | 200 or 0 |
| 2 | What's its capital? | Same zoomed view stays | Pick 1 of 4 capitals | 200 or 0 |
| 3 | Where is the capital? | Still zoomed in | Drop a pin | `200·exp(−km/500)` |
| 4 | Find the country | **Full globe** (altitude ~2.5) | Drop a pin on the country | `200·exp(−km/scale)`, scale grows with country size (see data) |
| 5 | The other big city | Full globe, **MapTap style** | Drop a pin given **only the city name** — no hints, no zoom help, no comparison, nothing | `200·exp(−km/700)` |

Flow notes from Spencer's brief, made explicit:
- Steps 1–3 share the zoomed view — that's the *learning* scaffold:
  see the place, name its continent, name its capital, find that capital.
- Step 4 removes the scaffold (full globe) but the target is the country they just studied.
- Step 5 is deliberately bare, MapTap.gg-style (checked 2026-10-23: MapTap is
  "find 5 world locations on a 3D globe, tap to place", name-only prompts):
  the prompt is just e.g. "São Paulo". Nothing else on screen helps.
- After each pin step: show your pin, the true pin, the arc between them, and
  distance in km — same reveal the main game already does.
- End screen: per-step breakdown + one fact line about the country +
  "New country ↗". Track countries learned in localStorage
  (`fivebigthings-globe-v1`: country id → best score) so the trainer can
  avoid repeats until the deck is done, then reshuffle.

**Continent choices:** correct + 3 distractors drawn from the other continents
represented in the deck (Africa, Asia, Europe, North America, South America, Oceania).
**Capital choices:** correct + 3 distractors, preferring capitals from the
same continent first (harder, more instructive), then any.

**Data — `globe-countries.json`, 19 countries to start (production: `static/globe-countries.js`)**
Capitals, continents, and country centers verified 2026-10-23 against the
REST Countries dataset (mledoze/countries mirror; the v3.1 API itself is
deprecated). Second-city name/coordinates are standard reference values.
Each record:
```json
{ "id":"fra","country":"France","continent":"Europe",
  "center":{"lat":46.0,"lng":2.0},"areaKm2":551695,"zoomAltitude":1.15,
  "capital":{"name":"Paris","lat":48.8566,"lng":2.3522},
  "secondCity":{"name":"Lyon","lat":45.764,"lng":4.8357,"note":"France's food capital"},
  "fact":"..." }
```
Deck curation rules (learned while verifying):
- **Exclude multi-capital countries at first** — South Africa has three
  capitals (Pretoria / Bloemfontein / Cape Town); it breaks Step 2.
- **Exclude transcontinental arguments** from the starter deck — Türkiye,
  Russia, Egypt is fine (dataset + convention: Africa). Add later with a
  house rule stated in the fact line.
- `zoomAltitude` scales with area: ~0.9 for Iceland-size, ~2.3 for Canada-size,
  or big countries fill the whole view and Step 1–3 geography is lost.
- Step 4's scoring scale is per-country for the same reason: being 800 km off
  inside Canada is a good guess; 800 km off Iceland is another ocean.

**API (when it moves server-side)**
```
GET /api/globe           -> { country: {...} }  (random unseen, or ?country=fra)
GET /api/globe?mode=daily-> date-seeded country (later)
```
Keep the existing trust model for now: answers ride in the payload and scoring
is local, same as Daily/Practice. If a public leaderboard ever appears, move
scoring server-side for all modes at once.

---

## PWA / native follow-ons (after these routes ship)
- PWA kit v2: add `/junior` + `/globe` to manifest shortcuts and SW precache,
  bump SW `VERSION` to `fbt-v2`.
- Native app: Junior and Globe are just two more modes on the same APIs —
  Globe's MapKit pin steps map 1:1 onto steps 3–5 above.
