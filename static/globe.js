// Five Big Things Globe — country trainer prototype
// One country, 5 steps on the house ladder: 100/100/200/300/300 = 1,000
// (MapTap-style weights: later steps are harder and worth more).
// Steps 1-3: globe zoomed to the country (the scaffold).
// Step 4: full globe, pin the country. Step 5: full globe, MapTap-style —
// only the city name is shown. No hints, no zoom, no help of any kind.
const $ = (s) => document.querySelector(s);
const EARTH = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg';
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
const STEP_NAMES = ['WHAT CONTINENT?', 'WHAT IS ITS CAPITAL?', 'WHERE IS THE CAPITAL?', 'FIND THE COUNTRY', 'FIND THE CITY'];
const PIN_SCALES = { 3: 500, 5: 700 }; // step 4 scale is per-country (countryScale)

const STEP_MAX = [100, 100, 200, 300, 300];
const state = { country: null, step: 0, results: [], choiceValue: null, click: null, locked: false };
let globe = null, globeObserver = null;

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

function haversineKm(a, b) {
  const r = (x) => x * Math.PI / 180;
  const h = Math.sin(r(a.lat - b.lat) / 2) ** 2 + Math.cos(r(b.lat)) * Math.cos(r(a.lat)) * Math.sin(r(a.lng - b.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const pinPoints = (km, scale, max) => Math.max(0, Math.round(max * Math.exp(-km / scale)));

/* ---------- choice builders ---------- */
function continentChoices(c) {
  return shuffle([c.continent, ...shuffle(CONTINENTS.filter((x) => x !== c.continent)).slice(0, 3)]);
}
function capitalChoices(c) {
  const same = shuffle(GLOBE_COUNTRIES.filter((x) => x.continent === c.continent && x.id !== c.id)).map((x) => x.capital.name);
  const rest = shuffle(GLOBE_COUNTRIES.filter((x) => x.continent !== c.continent)).map((x) => x.capital.name);
  return shuffle([c.capital.name, ...[...same, ...rest].slice(0, 3)]);
}
function choiceMarkup(values) {
  return `<div class="choice-grid" role="group">${values.map((v, i) =>
    `<button class="choice-card" type="button" data-value="${v}"><span class="choice-marker">${String.fromCharCode(65 + i)}</span><span class="choice-label">${v}</span></button>`).join('')}</div>`;
}

/* ---------- globe view ---------- */
function globeMarkup(caption) {
  return `<div class="globe-shell">
    <div id="globe-canvas" class="globe-canvas" aria-label="Interactive Earth globe"></div>
    <div id="flat-map" class="flat-map hidden" role="img" aria-label="World map. Click to place your pin">
      <img src="${EARTH}" alt="Satellite image of Earth"><span class="flat-pin guess-pin hidden"></span><span class="flat-pin target-pin hidden"></span>
    </div>
    <div class="globe-prompt"><span class="globe-live-dot"></span><span id="globe-instruction">${caption}</span></div>
    <div class="globe-credit">Earth imagery: NASA Blue Marble</div>
  </div>`;
}
function viewFor(step, c) {
  // steps 1-3 zoomed (0-2 zero-based), steps 4-5 full globe (3-4)
  return step <= 2 ? { lat: c.center.lat, lng: c.center.lng, altitude: c.zoomAltitude } : { lat: 18, lng: 8, altitude: 2.5 };
}
function wireGlobe(step, interactive) {
  const c = state.country, canvas = $('#globe-canvas');
  const view = viewFor(step, c);
  const webgl = (() => { try { const t = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (t.getContext('webgl') || t.getContext('experimental-webgl'))); } catch (e) { return false; } })();
  if (!webgl || typeof window.Globe !== 'function') { enableFlat(step, interactive); return; }
  const probe = new Image();
  probe.crossOrigin = 'anonymous';
  probe.onload = () => {
    try {
      globe = window.Globe()(canvas)
        .width(canvas.clientWidth).height(canvas.clientHeight)
        .globeImageUrl(EARTH).backgroundColor('rgba(0,0,0,0)')
        .showAtmosphere(true).atmosphereColor('#a8c8d8').atmosphereAltitude(0.16)
        .rendererConfig({ antialias: true, alpha: true, powerPreference: 'low-power' })
        .enablePointerInteraction(interactive)
        .pointOfView(view, 900)
        .onGlobeClick(({ lat, lng }) => { if (interactive) setGuess({ lat, lng }); });
      globe.pointAltitude('altitude').pointRadius('radius').pointColor('color').pointsMerge(false).pointsData([]);
      globe.ringLat('lat').ringLng('lng').ringColor(() => (t) => `rgba(202,235,139,${1 - t})`).ringMaxRadius(3).ringPropagationSpeed(2).ringRepeatPeriod(1100).ringsData([]);
      globe.arcsData([]).arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng').arcColor(() => ['#caeb8b', '#f4f6ed']).arcStroke(0.45).arcDashLength(0.45).arcDashGap(0.18).arcDashAnimateTime(1300);
      if (globeObserver) globeObserver.disconnect();
      globeObserver = new ResizeObserver(() => { if (globe && canvas.isConnected) { globe.width(canvas.clientWidth); globe.height(canvas.clientHeight); } });
      globeObserver.observe(canvas);
    } catch (e) { globe = null; enableFlat(step, interactive); }
  };
  probe.onerror = () => enableFlat(step, interactive);
  probe.src = EARTH;
}
function flatRect(map) {
  const b = map.getBoundingClientRect(), img = map.querySelector('img');
  const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 2;
  const w = Math.min(b.width, b.height * ratio), h = w / ratio;
  return { left: b.left + (b.width - w) / 2, top: b.top + (b.height - h) / 2, width: w, height: h, right: b.left + (b.width + w) / 2, bottom: b.top + (b.height + h) / 2 };
}
function enableFlat(step, interactive) {
  $('#globe-canvas')?.classList.add('hidden');
  const map = $('#flat-map'); if (!map) return;
  map.classList.remove('hidden');
  const note = $('#globe-instruction'); if (note) note.textContent = interactive ? 'Tap the world map to place your pin' : 'Study the view — the country is in this region';
  if (!interactive) return;
  map.addEventListener('click', (e) => {
    if (state.locked) return;
    const r = flatRect(map);
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    setGuess({ lat: 90 - (e.clientY - r.top) / r.height * 180, lng: (e.clientX - r.left) / r.width * 360 - 180 }, true);
  });
}
function flatPin(sel, coords) {
  const map = $('#flat-map'); if (!map || map.classList.contains('hidden')) return;
  const pin = $(sel), mr = map.getBoundingClientRect(), ir = flatRect(map);
  pin.classList.remove('hidden');
  pin.style.left = `${((ir.left - mr.left + (coords.lng + 180) / 360 * ir.width) / mr.width) * 100}%`;
  pin.style.top = `${((ir.top - mr.top + (90 - coords.lat) / 180 * ir.height) / mr.height) * 100}%`;
}
function setGuess(coords, flat = false) {
  if (state.locked) return;
  state.click = coords;
  const ins = $('#globe-instruction'); if (ins) ins.textContent = `Pin placed · ${coords.lat.toFixed(1)}°, ${coords.lng.toFixed(1)}° — tap again to adjust`;
  if (globe) globe.pointsData([{ ...coords, altitude: 0.012, radius: 0.42, color: '#caeb8b' }]);
  if (flat) flatPin('.guess-pin', coords);
}
function revealPins(guess, target) {
  if (globe) {
    globe.pointsData([
      { ...guess, altitude: 0.014, radius: 0.42, color: '#caeb8b' },
      { ...target, altitude: 0.018, radius: 0.58, color: '#ffffff' }
    ]).ringsData([{ ...target, maxR: 3 }])
      .arcsData([{ startLat: guess.lat, startLng: guess.lng, endLat: target.lat, endLng: target.lng }]);
    globe.pointOfView({ lat: target.lat, lng: target.lng, altitude: 1.7 }, 1300);
  } else { flatPin('.guess-pin', guess); flatPin('.target-pin', target); }
}

/* ---------- steps ---------- */
function renderStep() {
  const c = state.country, s = state.step;
  state.choiceValue = null; state.click = null; state.locked = false; globe = null;
  if (globeObserver) { globeObserver.disconnect(); globeObserver = null; }
  $('#mode-label').textContent = `STEP ${String(s + 1).padStart(2, '0')} OF 05`;
  $('#step-label').textContent = STEP_NAMES[s];
  $('#progress-fill').style.width = `${((s + 1) / 5) * 100}%`;
  $('#answer-feedback').classList.add('hidden');
  const btn = $('#submit-button');
  btn.textContent = 'Lock in ↗'; btn.onclick = submitStep;
  const qa = $('#question-area');

  if (s === 0) {
    qa.innerHTML = `${globeMarkup('Study the globe — it is zoomed in on one country')}
      <div style="height:16px"></div>
      <h2 class="step-prompt">What continent is this country in?</h2>
      <p class="step-sub">The globe is turned to the country and zoomed in. Where in the world are we?</p>
      ${choiceMarkup(continentChoices(c))}`;
    wireGlobe(s, false); wireChoices();
  } else if (s === 1) {
    qa.innerHTML = `${globeMarkup('Same view — the country from step 1')}
      <div style="height:16px"></div>
      <h2 class="step-prompt">What is the capital of ${c.country}?</h2>
      <p class="step-sub">Yes — the country is <b>${c.country}</b>, in ${c.continent}. Now name its capital.</p>
      ${choiceMarkup(capitalChoices(c))}`;
    wireGlobe(s, false); wireChoices();
  } else if (s === 2) {
    qa.innerHTML = `<h2 class="step-prompt">Where is ${c.capital.name}?</h2>
      <p class="step-sub">Still zoomed in on ${c.country}. Drop a pin where you think its capital sits.</p>
      ${globeMarkup('Drag to turn the globe · tap to place your pin')}`;
    wireGlobe(s, true);
  } else if (s === 3) {
    qa.innerHTML = `<h2 class="step-prompt">Now find ${c.country}.</h2>
      <p class="step-sub">Full globe. The zoom is gone — drop a pin on the country itself.</p>
      ${globeMarkup('Drag to turn the globe · tap to place your pin')}`;
    wireGlobe(s, true);
  } else {
    // Step 5 — MapTap style: the city name, and nothing else.
    qa.innerHTML = `<div class="bare-prompt"><div class="city">${c.secondCity.name}</div><div class="sub">DROP A PIN · NO HINTS</div></div>
      ${globeMarkup('Drag to turn the globe · tap to place your pin')}`;
    wireGlobe(s, true);
  }
  $('#points-note').innerHTML = s === 4 ? `Final step: <b>${STEP_MAX[s]} points</b> — earned the hard way` : `This step: <b>${STEP_MAX[s]} points</b>`;
}
function wireChoices() {
  document.querySelectorAll('.choice-card').forEach((b) => b.onclick = () => {
    state.choiceValue = b.dataset.value;
    document.querySelectorAll('.choice-card').forEach((x) => x.classList.toggle('selected', x === b));
  });
}

function submitStep() {
  const c = state.country, s = state.step;
  let pts = 0, feedback = '';
  if (s === 0 || s === 1) {
    if (state.choiceValue === null) { nudge(s === 0 ? 'Pick a continent first.' : 'Pick a capital first.'); return; }
    const correct = s === 0 ? c.continent : c.capital.name;
    pts = state.choiceValue === correct ? STEP_MAX[s] : 0;
    feedback = pts ? `That's right — <strong>${correct}</strong>.` :
      `Not quite — it's <strong>${correct}</strong>. ${s === 0 ? `Keep the view in mind for the next steps.` : `You'll hunt for ${c.capital.name} on the globe next.`}`;
  } else {
    if (!state.click) { nudge('Tap the globe to place your pin first.'); return; }
    const target = s === 2 ? c.capital : s === 3 ? c.center : c.secondCity;
    const scale = s === 2 ? PIN_SCALES[3] : s === 3 ? countryScale(c) : PIN_SCALES[5];
    const km = haversineKm(state.click, target);
    pts = pinPoints(km, scale, STEP_MAX[s]);
    const what = s === 2 ? c.capital.name : s === 3 ? c.country : c.secondCity.name;
    feedback = `You were <strong>${Math.round(km).toLocaleString()} km</strong> from ${what}. <strong>${pts} of ${STEP_MAX[s]} points.</strong>`;
    if (s === 4) feedback += `<br>${c.secondCity.name} — ${c.secondCity.note}.`;
    revealPins(state.click, target);
  }
  state.locked = true;
  state.results.push({ step: STEP_NAMES[s], points: pts });
  const fb = $('#answer-feedback');
  fb.innerHTML = feedback; fb.classList.remove('hidden');
  const btn = $('#submit-button');
  btn.textContent = s === 4 ? 'See my score ↗' : 'Next step ↗';
  btn.onclick = () => { if (s < 4) { state.step++; renderStep(); } else showResults(); };
}
function nudge(msg) {
  const fb = $('#answer-feedback');
  fb.innerHTML = msg; fb.classList.remove('hidden');
}

function showResults() {
  const total = state.results.reduce((n, r) => n + r.points, 0);
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
    <div class="result-list">${state.results.map((r, i) => `<div class="result-line"><span>${r.step.charAt(0) + r.step.slice(1).toLowerCase()}</span><b>${r.points} / ${STEP_MAX[i]}</b></div>`).join('')}</div>
    <p style="font-size:12.5px;line-height:1.6;color:#d0ddcf;margin:16px 0 0">🌍 ${c.fact}</p>
    <div class="result-actions"><button class="button button-light" id="new-country">New country ↗</button></div>`;
  $('#new-country').onclick = newSession;
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function newSession() {
  state.country = pickCountry();
  state.step = 0; state.results = [];
  $('#result-panel').classList.add('hidden');
  const learnedCount = Object.keys(store.learned).length;
  $('#learned-label').textContent = learnedCount ? `${learnedCount} of ${GLOBE_COUNTRIES.length} countries learned` : '';
  renderStep();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
newSession();
