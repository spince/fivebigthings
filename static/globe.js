// Five Big Things Globe — country trainer.
// One country, 5 steps on the house ladder: 100/100/200/300/300 = 1,000
// (MapTap-style weights: later steps are harder and worth more).
// Steps 1-3: globe zoomed to the country (the scaffold).
// Step 4: full globe, pin the country. Step 5: full globe, MapTap-style —
// only the city name is shown. No hints, no zoom, no help of any kind.
//
// Flow runs on the shared core (engine.js) with a trainer score
// strategy — choices are right-or-wrong, pins decay on per-step scales
// instead of the main game's 900 km curve — and the globe and choice
// widgets come from the shared presentation layer (question-view.js).
// This file owns the country deck, the step script, and the results.
const $ = (s) => document.querySelector(s);
const EARTH = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg';
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
const STEP_NAMES = ['WHAT CONTINENT?', 'WHAT IS ITS CAPITAL?', 'WHERE IS THE CAPITAL?', 'FIND THE COUNTRY', 'FIND THE CITY'];
const PIN_SCALES = { 3: 500, 5: 700 }; // step 4 scale is per-country (countryScale)
const STEP_MAX = [100, 100, 200, 300, 300]; // = the engine ladder, maxPointsFor(0..4)

const state = { country: null };
let mapView = null, choiceView = null;

const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const store = {
  get learned() { try { return JSON.parse(localStorage.getItem('fivebigthings-globe-v1') || '{}'); } catch (e) { return {}; } },
  save(id, score) { try { const l = this.learned; l[id] = Math.max(l[id] || 0, score); localStorage.setItem('fivebigthings-globe-v1', JSON.stringify(l)); } catch (e) {} }
};
function countryScale(c) { return Math.round(500 + Math.sqrt(c.areaKm2) / 4); } // ISL ~580km … CAN ~1290km

function pickCountry() {
  const learned = store.learned;
  const unseen = GLOBE_COUNTRIES.filter((c) => !(c.id in learned));
  const pool = unseen.length ? unseen : GLOBE_COUNTRIES;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ---------- the trainer as an engine session ---------- */
function stepQuestions(c) {
  return [
    { type: 'choice', correct: c.continent },
    { type: 'choice', correct: c.capital.name },
    { type: 'pin', target: c.capital, scale: PIN_SCALES[3] },
    // "Find the country" scores the border, not the center (PR #41): inside = full points.
    { type: 'country', target: c.center, borders: GLOBE_BORDERS[c.id], scale: countryScale(c) },
    { type: 'pin', target: c.secondCity, scale: PIN_SCALES[5] },
  ];
}
// Natural Earth 1:110m outlines are simplified; a pin this close to the line counts as inside.
const BORDER_GRACE_KM = 15;
// Returns base as an unrounded float for pins so the session's single
// rounding lands exactly where the old pinPoints() did.
function trainerScore(q, value) {
  if (q.type === 'choice') return { base: value === q.correct ? 100 : 0, distanceKm: null };
  if (!value) return null;
  const km = q.type === 'country' && q.borders ? kmOutside(value, q.borders, BORDER_GRACE_KM) : haversineKm(q.target, value);
  return { base: 100 * Math.exp(-km / q.scale), distanceKm: km };
}
const session = createSession({ score: trainerScore });

/* ---------- choice builders ---------- */
function continentChoices(c) {
  return shuffle([c.continent, ...shuffle(CONTINENTS.filter((x) => x !== c.continent)).slice(0, 3)]);
}
function capitalChoices(c) {
  const same = shuffle(GLOBE_COUNTRIES.filter((x) => x.continent === c.continent && x.id !== c.id)).map((x) => x.capital.name);
  const rest = shuffle(GLOBE_COUNTRIES.filter((x) => x.continent !== c.continent)).map((x) => x.capital.name);
  return shuffle([c.capital.name, ...[...same, ...rest].slice(0, 3)]);
}
const asChoices = (values) => values.map((v, i) => ({ value: v, label: v, marker: String.fromCharCode(65 + i) }));

function viewFor(step, c) {
  // steps 1-3 zoomed (0-2 zero-based), steps 4-5 full globe (3-4)
  return step <= 2 ? { lat: c.center.lat, lng: c.center.lng, altitude: c.zoomAltitude } : { lat: 18, lng: 8, altitude: 2.5 };
}

/* ---------- steps ---------- */
function renderStep() {
  const c = state.country, s = session.index;
  if (mapView) mapView.destroy();
  mapView = null; choiceView = null;
  $('#mode-label').textContent = `STEP ${String(s + 1).padStart(2, '0')} OF 05`;
  $('#step-label').textContent = STEP_NAMES[s];
  $('#progress-fill').style.width = `${((s + 1) / 5) * 100}%`;
  $('#answer-feedback').classList.add('hidden');
  const btn = $('#submit-button');
  btn.textContent = 'Lock in ↗'; btn.onclick = submitStep;
  const qa = $('#question-area');

  if (s === 0) {
    qa.innerHTML = `<div id="map-area"></div>
      <div style="height:16px"></div>
      <h2 class="step-prompt">What continent is this country in?</h2>
      <p class="step-sub">The globe is turned to the country and zoomed in. Where in the world are we?</p>
      <div id="choice-area"></div>`;
    mapView = mountMap($('#map-area'), { texture: EARTH, caption: 'Study the globe — it is zoomed in on one country', interactive: false, view: viewFor(s, c), studyTarget: c.center, coordinates: false });
    choiceView = mountChoices($('#choice-area'), asChoices(continentChoices(c)));
  } else if (s === 1) {
    qa.innerHTML = `<div id="map-area"></div>
      <div style="height:16px"></div>
      <h2 class="step-prompt">What is the capital of ${c.country}?</h2>
      <p class="step-sub">Yes — the country is <b>${c.country}</b>, in ${c.continent}. Now name its capital.</p>
      <div id="choice-area"></div>`;
    mapView = mountMap($('#map-area'), { texture: EARTH, caption: 'Same view — the country from step 1', interactive: false, view: viewFor(s, c), studyTarget: c.center, coordinates: false });
    choiceView = mountChoices($('#choice-area'), asChoices(capitalChoices(c)));
  } else if (s === 2) {
    qa.innerHTML = `<h2 class="step-prompt">Where is ${c.capital.name}?</h2>
      <p class="step-sub">Still zoomed in on ${c.country}. Drop a pin where you think its capital sits.</p>
      <div id="map-area"></div>`;
    mapView = mountMap($('#map-area'), { texture: EARTH, view: viewFor(s, c), onPin: pinPlaced });
  } else if (s === 3) {
    qa.innerHTML = `<h2 class="step-prompt">Now find ${c.country}.</h2>
      <p class="step-sub">Full globe. The zoom is gone — drop a pin on the country itself.</p>
      <div id="map-area"></div>`;
    mapView = mountMap($('#map-area'), { texture: EARTH, view: viewFor(s, c), onPin: pinPlaced });
  } else {
    // Step 5 — MapTap style: the city name, and nothing else.
    qa.innerHTML = `<div class="bare-prompt"><div class="city">${c.secondCity.name}</div><div class="sub">DROP A PIN · NO HINTS</div></div>
      <div id="map-area"></div>`;
    mapView = mountMap($('#map-area'), { texture: EARTH, view: viewFor(s, c), onPin: pinPlaced });
  }
  $('#points-note').innerHTML = s === 4 ? `Final step: <b>${STEP_MAX[s]} points</b> — earned the hard way` : `This step: <b>${STEP_MAX[s]} points</b>`;
}
function pinPlaced(coords) {
  if (mapView) mapView.setInstruction(`Pin placed · ${coords.lat.toFixed(1)}°, ${coords.lng.toFixed(1)}° — tap again to adjust`);
}

function submitStep() {
  const c = state.country, s = session.index;
  const q = session.current();
  const value = s < 2 ? choiceView.read() : mapView.read();
  if (value === null || value === undefined) { nudge(s === 0 ? 'Pick a continent first.' : s === 1 ? 'Pick a capital first.' : 'Tap the globe to place your pin first.'); return; }
  const entry = session.submit(value); if (!entry) return;
  let feedback;
  if (s < 2) {
    feedback = entry.points ? `That's right — <strong>${q.correct}</strong>.` :
      `Not quite — it's <strong>${q.correct}</strong>. ${s === 0 ? 'Keep the view in mind for the next steps.' : `You'll hunt for ${c.capital.name} on the globe next.`}`;
  } else {
    const what = s === 2 ? c.capital.name : s === 3 ? c.country : c.secondCity.name;
    const score = `<strong>${entry.points} of ${STEP_MAX[s]} points.</strong>`;
    const km = `<strong>${Math.round(entry.distanceKm).toLocaleString()} km</strong>`;
    feedback = q.type !== 'country' ? `You were ${km} from ${what}. ${score}`
      : entry.distanceKm === 0 ? `Your pin is inside <strong>${c.country}</strong>. ${score}`
      : `You were ${km} outside ${c.country}. ${score}`;
    if (s === 4) feedback += `<br>${c.secondCity.name} — ${c.secondCity.note}.`;
    mapView.lock();
    mapView.reveal(value, q.target, { arc: true });
  }
  const fb = $('#answer-feedback');
  fb.innerHTML = feedback; fb.classList.remove('hidden');
  const btn = $('#submit-button');
  btn.textContent = s === 4 ? 'See my score ↗' : 'Next step ↗';
  btn.onclick = () => { if (session.advance()) renderStep(); else showResults(); };
}
function nudge(msg) {
  const fb = $('#answer-feedback');
  fb.innerHTML = msg; fb.classList.remove('hidden');
}

function showResults() {
  const total = session.total();
  const c = state.country;
  store.save(c.id, total);
  const learnedCount = Object.keys(store.learned).length;
  $('#learned-label').textContent = `${learnedCount} of ${GLOBE_COUNTRIES.length} countries learned`;
  const panel = $('#result-panel');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="result-kicker">COUNTRY COMPLETE — ${c.country.toUpperCase()}</div>
    <div class="result-main"><h2>${total >= 800 ? 'Globe master.' : total >= 500 ? 'Well travelled.' : 'A good first trip.'}</h2>
    <div class="result-score">${total}<span style="font:12px 'DM Mono',monospace;color:#c8d5c2"> / 1,000</span></div></div>
    <div class="result-list">${session.answers.map((r, i) => `<div class="result-line"><span>${STEP_NAMES[i].charAt(0) + STEP_NAMES[i].slice(1).toLowerCase()}</span><b>${r.points} / ${STEP_MAX[i]}</b></div>`).join('')}</div>
    <p style="font-size:12.5px;line-height:1.6;color:#d0ddcf;margin:16px 0 0">🌍 ${c.fact}</p>
    <div class="result-actions"><button class="button button-light" id="new-country">New country ↗</button></div>`;
  $('#new-country').onclick = newSession;
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function newSession() {
  state.country = pickCountry();
  session.reset(stepQuestions(state.country));
  $('#result-panel').classList.add('hidden');
  const learnedCount = Object.keys(store.learned).length;
  $('#learned-label').textContent = learnedCount ? `${learnedCount} of ${GLOBE_COUNTRIES.length} countries learned` : '';
  renderStep();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
newSession();
