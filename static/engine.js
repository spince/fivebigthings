// Five Big Things — core game engine, shared by every mode.
// Pure logic, no DOM: the scoring law, choice generation, and the
// session state machine. Each mode (daily/practice, junior, globe
// trainer, and future variations) supplies its questions and, when its
// scoring genuinely differs, a score strategy — everything else is
// inherited from here. Loaded before the mode scripts in the browser;
// exported for the node --test suite in tests/js/.

// The 1,000-point ladder: slots pay x1 x1 x2 x3 x3 of a 100-point base.
function multiplierFor(index) { return index < 2 ? 1 : index === 2 ? 2 : 3; }
function maxPointsFor(index) { return 100 * multiplierFor(index); }

function haversineKm(a, b) {
  const r = (x) => x * Math.PI / 180;
  const h = Math.sin(r(a.lat - b.lat) / 2) ** 2 + Math.cos(r(b.lat)) * Math.cos(r(a.lat)) * Math.sin(r(a.lng - b.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Base scores are 0-100; the session scales them by the slot's ladder
// multiplier. Number guesses decay with relative error; pins decay
// with distance (full marks at <=22 km falls out of the curve).
function scoreNumberGuess(answer, guess) {
  const n = Number(guess);
  if (!Number.isFinite(n) || n < 0) return null;
  const err = Math.abs(n - answer) / Math.max(answer, 1);
  return { base: Math.max(0, Math.round(100 * Math.exp(-2.1 * err))), distanceKm: null };
}
function scorePinGuess(answer, pin) {
  if (!pin) return null;
  const km = haversineKm(answer, pin);
  return { base: Math.max(0, Math.round(100 * Math.exp(-km / 900))), distanceKm: km };
}
// Geo: is a point inside a country outline, and how far outside is it?
// polys = [polygon, ...], polygon = [outer ring, ...holes], ring = [[lng, lat], ...]
// (the shape of GLOBE_BORDERS in globe-borders.js).
function inRing(pt, ring) { // ray casting
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt.lat) !== (yj > pt.lat) && pt.lng < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygons(pt, polys) {
  return polys.some(([outer, ...holes]) => inRing(pt, outer) && !holes.some((h) => inRing(pt, h)));
}
function kmToPolygons(pt, polys) {
  // Local equirectangular projection around the point: accurate enough for scoring.
  const kx = 111.32 * Math.cos(pt.lat * Math.PI / 180), ky = 110.57;
  const proj = ([lng, lat]) => [((lng - pt.lng + 540) % 360 - 180) * kx, (lat - pt.lat) * ky];
  let best = Infinity;
  for (const poly of polys) for (const ring of poly) {
    for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = proj(ring[i - 1]), [bx, by] = proj(ring[i]);
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}
// km from a country: 0 anywhere inside it (or within graceKm of the line,
// since simplified outlines sit off the real coast), else km to the nearest border.
function kmOutside(pt, polys, graceKm = 0) {
  if (inPolygons(pt, polys)) return 0;
  const km = kmToPolygons(pt, polys);
  return km <= graceKm ? 0 : km;
}

function scoreQuestion(q, value) { return q.type === 'map' ? scorePinGuess(q.answer, value) : scoreNumberGuess(q.answer, value); }

// Default choice cards for number/percent questions: 0.5x / 0.8x / 1x /
// 1.3x of the answer, deduped (percent clamped to 0-100), padded back
// to four with answer +/- small offsets, then rotated by a hash of the
// question id so the right card is not always in the same seat. A mode
// with its own choice strategy (junior pads differently, the trainer
// uses strings) builds the same {value, label, marker} shape itself.
function defaultChoices(q) {
  const answer = Number(q.answer);
  const factors = [0.5, 0.8, 1, 1.3];
  const unique = [...new Set(factors.map((f) => {
    let v = Math.round(answer * f);
    if (q.type === 'percent') v = Math.min(100, Math.max(0, v));
    return v;
  }))];
  while (unique.length < 4) {
    const offset = Math.ceil(unique.length / 2);
    const candidates = [answer - offset, answer + offset].filter((v) => q.type !== 'percent' || (v >= 0 && v <= 100));
    const candidate = candidates.find((v) => !unique.includes(v));
    if (candidate === undefined) break;
    unique.push(candidate);
  }
  const shift = [...String(q.id)].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 4;
  const rotated = unique.slice(shift).concat(unique.slice(0, shift));
  return rotated.slice(0, 4).map((value, i) => ({ value, label: `${value.toLocaleString()} ${q.unit}`, marker: String.fromCharCode(65 + i) }));
}

// The session state machine. score(q, value, index) must return
// {base, distanceKm} or null for "no valid answer yet". Submitted
// entries are {value, base, points, maxPoints, distanceKm} where
// points = round(base x ladder multiplier for the slot).
function createSession({ questions = [], score = scoreQuestion } = {}) {
  return {
    questions, index: 0, answers: [], locked: false,
    current() { return this.questions[this.index]; },
    get done() { return this.index >= this.questions.length; },
    submit(value) {
      if (this.locked) return null;
      const q = this.current(); if (!q) return null;
      const r = score(q, value, this.index); if (!r) return null;
      const maxPoints = maxPointsFor(this.index);
      const points = Math.round(r.base * maxPoints / 100);
      this.locked = true;
      const entry = { value, base: r.base, points, maxPoints, distanceKm: r.distanceKm ?? null };
      this.answers.push(entry);
      return entry;
    },
    advance() {
      if (!this.locked) return false;
      this.index += 1; this.locked = false;
      return !this.done;
    },
    total() { return this.answers.reduce((n, a) => n + a.points, 0); },
    reset(qs) { this.questions = qs || []; this.index = 0; this.answers = []; this.locked = false; },
  };
}

// Spencer's rule: length questions are ASKED in imperial units —
// feet, miles, inches — the numbers people actually carry in their
// heads (Everest is 29,032 feet, not 8,849 meters). The bank stays as
// authored; this converts at presentation time, and the unit picker
// still lets a player switch to any unit they think in. Scoring is
// relative-error, so converting changes nothing about fairness.
// Kilometers become feet below 50,000 ft (heights and human-scale
// distances are quoted in feet — Everest included) and miles above.
const METERS_PER = { centimeters: 0.01, meters: 1, kilometers: 1000, inches: 0.0254, feet: 0.3048, miles: 1609.344 };
function roundSig(n, sig = 5) {
  if (n === 0) return 0;
  const p = Math.pow(10, sig - Math.ceil(Math.log10(Math.abs(n))));
  return Math.round(n * p) / p;
}
function imperializeQuestion(q) {
  if (!q || q.type === 'map') return q;
  const from = String(q.unit || '').trim().toLowerCase();
  if (!(from in METERS_PER) || from === 'feet' || from === 'miles' || from === 'inches') return q;
  const meters = Number(q.answer) * METERS_PER[from];
  const to = from === 'centimeters' ? 'inches' : (meters / METERS_PER.feet >= 50000 ? 'miles' : 'feet');
  const answer = roundSig(meters / METERS_PER[to]);
  // Swap the unit word in the title and prompt, keeping its case
  // ("Kilometers wide is Saturn" -> "Miles wide is Saturn").
  const swapUnit = (text) => text ? text.replace(new RegExp(`\\b${from}\\b`, 'gi'), (w) => w[0] === w[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to) : text;
  // In the explanation, convert only the answer's own figure; any other
  // metric numbers stay true as written. If the figure isn't there,
  // keep the text and add the converted answer.
  let explanation = q.explanation;
  const newFigure = `${answer.toLocaleString('en-US')} ${to}`;
  if (explanation) {
    const oldFigure = `${Number(q.answer).toLocaleString('en-US')} ${from}`;
    explanation = explanation.includes(oldFigure) ? explanation.split(oldFigure).join(newFigure) : `${explanation} That's about ${newFigure}.`;
  }
  return { ...q, answer, unit: to, title: swapUnit(q.title), prompt: swapUnit(q.prompt), explanation };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { multiplierFor, maxPointsFor, haversineKm, inPolygons, kmToPolygons, kmOutside, scoreNumberGuess, scorePinGuess, scoreQuestion, defaultChoices, createSession, imperializeQuestion };
