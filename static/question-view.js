// Five Big Things — question presentation, shared by every mode.
// The answer widgets a player interacts with: choice cards, the typed
// guess box, and the globe/map. A mode mounts a presenter into its
// question area, reads the answer back out of the handle, and lets the
// engine (engine.js) score it. Modes own flow, copy, and results;
// presenters own the widgets. Depends on units.js (typed guesses) and,
// for the map, the globe.gl CDN script.

// ---------- choice cards ----------
// choices: [{value, label, marker}]. read() returns the raw value of
// the picked card (a string — modes coerce), or null.
function mountChoices(root, choices, { onPick, initialValue = null, readOnly = false } = {}) {
  root.innerHTML = `<div class="choice-grid" role="group" aria-label="Choose your estimate">${choices.map((c) => `<button class="choice-card" type="button" data-value="${c.value}" data-label="${c.label}"><span class="choice-marker">${c.marker}</span><span class="choice-label">${c.label}</span></button>`).join('')}</div>`;
  let value = null;
  if (initialValue !== null && initialValue !== undefined) {
    const card = [...root.querySelectorAll('.choice-card')].find((b) => b.dataset.value === String(initialValue));
    if (card) { value = card.dataset.value; card.classList.add('selected'); }
  }
  root.querySelectorAll('.choice-card').forEach((b) => b.addEventListener('click', () => {
    if (readOnly) return;
    value = b.dataset.value;
    root.querySelectorAll('.choice-card').forEach((x) => x.classList.toggle('selected', x === b));
    if (onPick) onPick(value, b.dataset.label);
  }));
  return {
    read: () => value,
    clear() { value = null; root.querySelectorAll('.choice-card').forEach((x) => x.classList.remove('selected')); },
  };
}

// ---------- typed guess ----------
// The guess box with live comma formatting and, for length questions,
// the unit picker (answer in feet/miles/kilometers — converted to the
// question's unit on read). read() returns {value, entered}: value is
// in the question's unit ('' when blank, NaN when unparseable);
// entered is {amount, unit} when a different unit was used, else null.
function mountInput(root, q, { autofocus = true, units = true, initialValue = null, initialUnit = null, readOnly = false } = {}) {
  const active = units ? lengthUnit(q.unit) : null;
  const picker = active ? `<div class="unit-picker" role="group" aria-label="Answer in your unit">${Object.keys(LENGTH_UNITS).map((u) => `<button type="button" class="unit-chip${u === active ? ' active' : ''}" data-unit="${u}">${u}</button>`).join('')}</div>` : '';
  root.innerHTML = `<label class="answer-input-wrap"><input id="answer-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Your best guess" aria-label="Your best guess"><span class="input-unit" id="input-unit">${q.unit}</span></label>${picker}`;
  const input = root.querySelector('#answer-input');
  let unitChoice = active;
  input.addEventListener('input', () => { const v = formatGuess(input.value); if (v !== input.value) input.value = v; });
  root.querySelectorAll('.unit-chip').forEach((chip) => chip.addEventListener('click', () => {
    unitChoice = chip.dataset.unit;
    root.querySelectorAll('.unit-chip').forEach((c) => c.classList.toggle('active', c === chip));
    root.querySelector('#input-unit').textContent = chip.dataset.unit;
    input.focus();
  }));
  if (initialUnit && active) {
    const chip = [...root.querySelectorAll('.unit-chip')].find((c) => c.dataset.unit === initialUnit);
    if (chip) chip.click();
  }
  if (initialValue !== null && initialValue !== undefined) input.value = formatGuess(String(initialValue));
  if (readOnly) { input.disabled = true; root.querySelectorAll('.unit-chip').forEach((c) => { c.disabled = true; }); }
  if (autofocus && !readOnly) input.focus();
  return {
    read() {
      let value = parseGuess(input.value);
      let entered = null;
      if (typeof value === 'number' && unitChoice && lengthUnit(q.unit) && unitChoice !== lengthUnit(q.unit)) {
        entered = { amount: value, unit: unitChoice };
        value = convertLength(value, unitChoice, q.unit);
      }
      return { value, entered };
    },
  };
}

// ---------- flat-map variants ----------
// The world's classrooms don't agree on one map. The daily game
// rotates through these by date: centerings of the same
// equirectangular earth, plus the south-up views (the famous
// Australian "upside-down" map — McArthur's Universal Corrective
// Map, 1979). Pin math stays exact for all of them: a centering is
// just a horizontal wrap of the same projection, and south-up is a
// 180° rotation of the surface (pins are positioned in the surface's
// own coordinates, so they rotate with the map).
const MAP_VARIANTS = [
  { id: 'atlantic', label: 'Atlantic-centred', center: 0, southUp: false },
  { id: 'americas', label: 'Americas-centred', center: -100, southUp: false },
  { id: 'pacific', label: 'Pacific-centred', center: 150, southUp: false },
  { id: 'south-up', label: 'South-up', center: 0, southUp: true },
  { id: 'south-up-americas', label: 'South-up · Americas-centred', center: -100, southUp: true },
  { id: 'south-up-pacific', label: 'South-up · Pacific-centred', center: 150, southUp: true },
];
function mapVariantForDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
  return MAP_VARIANTS[day % MAP_VARIANTS.length];
}

// ---------- globe / map ----------
// One presenter, three tiers: WebGL globe → flat map → coordinate
// entry, falling back automatically. Options:
//   texture      earth image URL (globe texture + flat map)
//   caption      initial instruction text
//   interactive  false = study view (no pin placement)
//   view         {lat, lng, altitude} point of view for study views
//   controls     {enableZoom, enableRotate, autoRotate, autoRotateSpeed}
//   flatOnly     never WebGL (junior)
//   flatFill     flat image fills the width instead of the fixed shell
//   chrome       show the instruction bar + credit line (default true)
//   coordinates  offer the coordinate-entry tier (default true)
//   studyTarget  coords marked on the flat map in study views
//   onPin        (coords) => {} when the player places/moves the pin
// Handle: read() → pin coords or null; reveal(guess, answer, opts);
// setInstruction(text); lock(); flatImage(); destroy().
function mountMap(root, {
  texture, caption = 'Drag to turn the globe · tap to place your pin',
  interactive = true, view = null, controls = null,
  flatOnly = false, flatFill = false, chrome = true, coordinates = true,
  studyTarget = null, onPin = null,
  flatVariant = MAP_VARIANTS[0], variantLabel = null, initialPin = null, readOnly = false,
} = {}) {
  root.innerHTML = `<div class="globe-shell${flatFill ? ' flat-fill' : ''}">
    <div class="globe-canvas" data-role="canvas" aria-label="Interactive Earth globe"></div>
    <div class="flat-map hidden" data-role="flat" role="img" aria-label="World map. Click to place your pin"><div class="flat-surface" data-role="surface"><span class="flat-pin guess-pin hidden"></span><span class="flat-pin target-pin hidden"></span></div></div>
    ${coordinates ? `<div class="coordinate-entry hidden" data-role="coords"><span class="coordinate-title">Map unavailable on this device</span><span class="coordinate-copy">Enter the coordinates of your best guess.</span><div class="coordinate-fields"><label>Latitude<input data-role="lat" type="number" min="-90" max="90" step="any" placeholder="0°"></label><label>Longitude<input data-role="lng" type="number" min="-180" max="180" step="any" placeholder="0°"></label></div><button data-role="coord-submit" class="button button-primary" type="button">Place pin ↗</button></div>` : ''}
    ${chrome ? `<div class="globe-prompt"><span class="globe-live-dot"></span><span data-role="instruction">${caption}</span></div><div class="globe-credit">Earth imagery: <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noreferrer">NASA Blue Marble</a>${variantLabel ? ` · Map: ${variantLabel}` : ''}</div>` : ''}
  </div>`;
  const canvasEl = root.querySelector('[data-role="canvas"]');
  const flatEl = root.querySelector('[data-role="flat"]');
  const surfaceEl = root.querySelector('[data-role="surface"]');
  const coordsEl = root.querySelector('[data-role="coords"]');
  const instructionEl = root.querySelector('[data-role="instruction"]');
  let globe = null, observer = null, flatObserver = null, pin = null, locked = readOnly, tier = 'globe';

  const setInstruction = (t) => { if (instructionEl) instructionEl.textContent = t; };

  // The flat map is a repeating background on the surface div: one
  // tile is exactly one world, so any centering is a pixel shift and
  // the wrap is seamless. South-up rotates the surface itself; pins
  // are children positioned in surface coordinates, so they follow.
  function layoutSurface() {
    if (!surfaceEl) return;
    surfaceEl.style.backgroundImage = `url("${texture}")`;
    if (flatFill) {
      const w = surfaceEl.clientWidth;
      if (w) {
        surfaceEl.style.backgroundSize = `${w}px ${w / 2}px`;
        surfaceEl.style.backgroundPosition = `${-flatVariant.center / 360 * w}px 0`;
      }
      return;
    }
    const W = flatEl.clientWidth, H = flatEl.clientHeight;
    if (!W || !H) return;
    const w = Math.min(W, H * 2), h = w / 2;
    Object.assign(surfaceEl.style, { left: `${(W - w) / 2}px`, top: `${(H - h) / 2}px`, width: `${w}px`, height: `${h}px` });
    surfaceEl.style.backgroundSize = `${w}px ${h}px`;
    surfaceEl.style.backgroundPosition = `${-flatVariant.center / 360 * w}px 0`;
    surfaceEl.style.transform = flatVariant.southUp ? 'rotate(180deg)' : '';
  }
  function positionFlatPin(sel, coords) {
    const pinEl = surfaceEl.querySelector(sel);
    const fx = (((coords.lng - flatVariant.center + 180) % 360) + 360) % 360 / 360;
    pinEl.classList.remove('hidden');
    pinEl.style.left = `${fx * 100}%`;
    pinEl.style.top = `${(90 - coords.lat) / 180 * 100}%`;
  }
  function drawGuess() {
    if (!pin) return;
    if (tier === 'globe' && globe) globe.pointsData([{ ...pin, altitude: 0.012, radius: 0.42, color: '#caeb8b' }]);
    else if (tier === 'flat') positionFlatPin('.guess-pin', pin);
  }
  function setPin(coords) {
    pin = coords;
    drawGuess();
    if (onPin) onPin(coords);
  }

  function enableCoordinates() {
    tier = 'coords';
    canvasEl.classList.add('hidden'); flatEl.classList.add('hidden');
    if (coordsEl) coordsEl.classList.remove('hidden');
    setInstruction('Enter a latitude and longitude');
  }
  function enableFlat() {
    tier = 'flat';
    canvasEl.classList.add('hidden');
    flatEl.classList.remove('hidden');
    layoutSurface();
    if (flatObserver) flatObserver.disconnect();
    flatObserver = new ResizeObserver(() => layoutSurface());
    flatObserver.observe(flatEl);
    if (initialPin) { pin = initialPin; drawGuess(); }
    if (!interactive) {
      setInstruction('Study the view — the country is in this region');
      if (studyTarget) positionFlatPin('.target-pin', studyTarget);
      return;
    }
    setInstruction('Tap the world map to place your pin');
    surfaceEl.addEventListener('click', (event) => {
      if (locked) return;
      const rect = surfaceEl.getBoundingClientRect();
      let fx = (event.clientX - rect.left) / rect.width, fy = (event.clientY - rect.top) / rect.height;
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
      if (flatVariant.southUp) { fx = 1 - fx; fy = 1 - fy; }
      let lng = flatVariant.center + fx * 360 - 180;
      lng = ((lng + 540) % 360) - 180;
      setPin({ lat: 90 - fy * 180, lng });
    });
    if (coordinates && coordsEl) {
      // No <img> anymore — probe the texture plainly (no CORS) just to
      // learn whether the last-resort coordinate tier is needed.
      const probe = new Image();
      probe.addEventListener('error', () => enableCoordinates(), { once: true });
      probe.src = texture;
    }
  }
  function createGlobe() {
    try {
      const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
      if (w === 0 || h === 0) { enableFlat(); return; }
      globe = window.Globe()(canvasEl)
        .width(w).height(h)
        .globeImageUrl(texture)
        .backgroundColor('rgba(0,0,0,0)')
        .showAtmosphere(true).atmosphereColor('#a8c8d8').atmosphereAltitude(0.16)
        // no .rendererConfig() — removed in globe.gl 2.46.x; calling it
        // throws and used to force the flat fallback everywhere (MB-067)
        .enablePointerInteraction(interactive);
      if (interactive) globe.onGlobeClick(({ lat, lng }) => { if (!locked) setPin({ lat, lng }); });
      globe.pointAltitude('altitude').pointRadius('radius').pointColor('color').pointsMerge(false).pointsData([]);
      globe.ringLat('lat').ringLng('lng').ringColor(() => (t) => `rgba(202,235,139,${1 - t})`).ringMaxRadius(3).ringPropagationSpeed(2).ringRepeatPeriod(1100).ringsData([]);
      globe.arcsData([]).arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng').arcColor(() => ['#caeb8b', '#f4f6ed']).arcStroke(0.45).arcDashLength(0.45).arcDashGap(0.18).arcDashAnimateTime(1300);
      if (view) globe.pointOfView(view, 900);
      if (controls && globe.controls) {
        const c = globe.controls();
        if (c) {
          if (controls.enableZoom !== undefined) c.enableZoom = controls.enableZoom;
          if (controls.enableRotate !== undefined) c.enableRotate = controls.enableRotate;
          if (controls.autoRotate !== undefined) c.autoRotate = controls.autoRotate;
          if (controls.autoRotateSpeed !== undefined) c.autoRotateSpeed = controls.autoRotateSpeed;
        }
      }
      if (initialPin) { pin = initialPin; drawGuess(); }
      observer = new ResizeObserver(() => { if (globe && canvasEl.isConnected) globe.width(canvasEl.clientWidth).height(canvasEl.clientHeight); });
      observer.observe(canvasEl);
      window.requestAnimationFrame(() => { if (globe && canvasEl.isConnected) globe.width(canvasEl.clientWidth).height(canvasEl.clientHeight); });
      setInstruction(caption);
    } catch (error) { globe = null; enableFlat(); }
  }

  if (coordinates && coordsEl) {
    coordsEl.querySelector('[data-role="coord-submit"]').addEventListener('click', () => {
      if (locked) return;
      const lat = Number(coordsEl.querySelector('[data-role="lat"]').value), lng = Number(coordsEl.querySelector('[data-role="lng"]').value);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) { setInstruction('Latitude: −90 to 90 · longitude: −180 to 180'); return; }
      setPin({ lat, lng });
    });
  }

  if (flatOnly) enableFlat();
  else {
    const webgl = (() => { try { const t = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (t.getContext('webgl') || t.getContext('experimental-webgl'))); } catch (e) { return false; } })();
    if (!webgl || typeof window.Globe !== 'function') { enableFlat(); }
    else {
      // Skip the CORS image probe — it fails on Safari iOS for cross-origin
      // CDN assets (NASA) and incorrectly forces the flat fallback even when
      // WebGL is available. globe.gl handles texture load errors internally.
      // Also defer past the current frame so the canvas has non-zero layout
      // dimensions before we query clientWidth/clientHeight (MB-068).
      setInstruction('Loading Earth imagery…');
      requestAnimationFrame(() => {
        if (!canvasEl.isConnected) return;
        // If the canvas still has no width the element isn't painted yet —
        // give the browser one more frame (covers iOS WKWebView layout lag).
        if (canvasEl.clientWidth === 0) {
          requestAnimationFrame(() => { if (canvasEl.isConnected) createGlobe(); else enableFlat(); });
        } else {
          createGlobe();
        }
      });
    }
  }

  return {
    read: () => pin,
    lock() { locked = true; },
    setInstruction,
    flatImage: () => surfaceEl,
    reveal(guess, answer, { arc = false, focus = 'answer', altitude = 1.7 } = {}) {
      setInstruction('Your guess and the correct place');
      if (tier === 'globe' && globe) {
        globe.pointsData([
          { ...guess, altitude: 0.014, radius: 0.42, color: '#caeb8b' },
          { ...answer, altitude: 0.018, radius: 0.58, color: '#ffffff' },
        ]).ringsData([{ ...answer, maxR: 3 }]);
        if (arc) globe.arcsData([{ startLat: guess.lat, startLng: guess.lng, endLat: answer.lat, endLng: answer.lng }]);
        const target = focus === 'mid' ? { lat: (guess.lat + answer.lat) / 2, lng: (guess.lng + answer.lng) / 2, altitude } : { lat: answer.lat, lng: answer.lng, altitude };
        globe.pointOfView(target, 1300);
      } else if (tier === 'flat') {
        positionFlatPin('.guess-pin', guess);
        positionFlatPin('.target-pin', answer);
      }
    },
    destroy() { if (observer) observer.disconnect(); if (flatObserver) flatObserver.disconnect(); },
  };
}
