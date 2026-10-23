// Five Big Things Junior — prototype logic
// Same scoring as the main game; helpers are free and never reduce points.
// Production: replace loadQuestions() source with GET /api/junior.
const $ = (s) => document.querySelector(s);
const state = { questions: [], index: 0, answers: [], choiceValue: null, click: null, hintLevel: 0, easierUsed: false, locked: false };
const EARTH = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg';

const mult = (i) => (i < 2 ? 1 : i === 2 ? 2 : 3);
const maxPts = (i) => 100 * mult(i);

function choicesFor(q) {
  const a = Number(q.answer), factors = [0.5, 0.8, 1, 1.3];
  let vals = [...new Set(factors.map((f) => Math.max(0, Math.round(a * f))))];
  while (vals.length < 4) { const c = a + (vals.length - 1) * 2 + 1; if (!vals.includes(c)) vals.push(c); else break; }
  const shift = [...String(q.id)].reduce((s, c) => s + c.charCodeAt(0), 0) % 4;
  return vals.slice(shift).concat(vals.slice(0, shift)).slice(0, 4)
    .map((v, i) => ({ value: v, label: `${v.toLocaleString()} ${q.unit}`, marker: String.fromCharCode(65 + i) }));
}

function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    speechSynthesis.speak(u);
  } catch (e) { /* speech unavailable — no-op */ }
}

function renderQuestion() {
  const q = state.questions[state.index];
  if (!q) return;
  state.choiceValue = null; state.click = null; state.hintLevel = 0; state.easierUsed = false; state.locked = false;
  $('#progress-label').textContent = `QUESTION ${String(state.index + 1).padStart(2, '0')} OF 05`;
  $('#progress-fill').style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
  $('#points-note').innerHTML = `Question ${state.index + 1}: up to <b>${maxPts(state.index)} points</b> ⭐`;
  $('#answer-feedback').classList.add('hidden');
  $('#submit-button').textContent = state.index === state.questions.length - 1 ? 'See my stars ↗' : 'Lock in guess ↗';
  $('#submit-button').onclick = submitAnswer;

  const isChoice = state.index < 2, isMap = q.type === 'map';
  let body = '';
  if (isChoice) {
    body = `<div class="choice-grid">${choicesFor(q).map((c) =>
      `<button class="choice-card" data-value="${c.value}" data-label="${c.label}"><span class="choice-marker">${c.marker}</span><span>${c.label}</span></button>`).join('')}</div>`;
  } else if (isMap) {
    body = `<div class="flat-map" id="flat-map"><img id="flat-img" src="${EARTH}" alt="World map"><span class="flat-pin guess-pin hidden"></span><span class="flat-pin target-pin hidden"></span></div>
            <p style="font-size:14px;color:#9a9d93;text-align:center;margin:10px 0 0">Tap the map to drop your pin 📍</p>`;
  } else {
    body = `<label class="answer-input-wrap"><input id="answer-input" type="number" inputmode="decimal" placeholder="Your best guess" aria-label="Your best guess"><span class="input-unit">${q.unit}</span></label>`;
  }

  $('#question-area').innerHTML = `
    <div class="emoji-big">${q.junior.emoji}</div>
    <h2 class="question-prompt">${q.prompt}</h2>
    <div class="compare-card"><span style="font-size:22px">🤔</span><span><b>Think of it like this:</b> ${q.junior.comparison}</span></div>
    ${body}
    <div class="helpers">
      <button class="helper-btn" id="btn-read">🔊 Read to me</button>
      <button class="helper-btn" id="btn-hint">💡 Hint</button>
      <button class="helper-btn" id="btn-easier">🙌 Make it easier</button>
    </div>
    <div id="hint-box" class="hint-box hidden"></div>
    <div id="range-box" class="range-line hidden">
      <div class="range-track"><div class="range-band" id="range-band"></div></div>
      <div class="range-labels"><span id="range-low"></span><span>your answer is in the green part</span><span id="range-high"></span></div>
    </div>`;

  // --- helpers ---
  $('#btn-read').onclick = () => {
    let t = q.junior.readAloud;
    if (isChoice) t += ' Your choices are: ' + choicesFor(q).map((c) => c.label).join(', ') + '.';
    speak(t);
  };
  $('#btn-hint').onclick = () => {
    const box = $('#hint-box');
    state.hintLevel = Math.min(3, state.hintLevel + 1);
    const texts = [null, `💡 <b>Nudge:</b> ${q.hint}`, `💡💡 <b>Bigger hint:</b> ${q.junior.hint2}`, `🌟 <b>Super hint:</b> ${q.junior.superHint}`];
    box.innerHTML = texts[state.hintLevel];
    box.classList.remove('hidden');
    $('#btn-hint').textContent = state.hintLevel === 1 ? '💡 Bigger hint' : state.hintLevel === 2 ? '🌟 Super hint' : '🌟 Super hint used';
    if (state.hintLevel === 3) $('#btn-hint').disabled = true;
    $('#btn-hint').classList.add('used');
  };
  $('#btn-easier').onclick = () => {
    if (state.easierUsed) return;
    state.easierUsed = true;
    $('#btn-easier').classList.add('used');
    $('#btn-easier').textContent = '🙌 Easier mode on';
    if (isChoice) {
      const cards = [...document.querySelectorAll('.choice-card')].filter((c) => Number(c.dataset.value) !== Number(q.answer));
      cards.sort(() => 0.5 - Math.random()).slice(0, 2).forEach((c) => { c.classList.add('dimmed'); if (Number(c.dataset.value) === state.choiceValue) state.choiceValue = null; });
      showHint('🙌 Two wrong answers went away. You can do it!');
    } else if (isMap) {
      const img = $('#flat-img');
      img.style.transform = 'scale(2.1)';
      img.style.transformOrigin = (q.junior.mapZoom && q.junior.mapZoom.origin) || '50% 50%';
      showHint('🙌 Zoomed in! The country is in this part of the world.');
    } else if (q.junior.range) {
      const { low, high } = q.junior.range;
      const spanLow = Math.max(0, low - (high - low) / 2), spanHigh = high + (high - low) / 2;
      $('#range-band').style.left = `${((low - spanLow) / (spanHigh - spanLow)) * 100}%`;
      $('#range-band').style.width = `${((high - low) / (spanHigh - spanLow)) * 100}%`;
      $('#range-low').textContent = low; $('#range-high').textContent = high;
      $('#range-box').classList.remove('hidden');
      showHint(`🙌 The answer is between <b>${low}</b> and <b>${high}</b>.`);
    }
  };

  if (isChoice) {
    document.querySelectorAll('.choice-card').forEach((b) => b.onclick = () => {
      state.choiceValue = Number(b.dataset.value);
      document.querySelectorAll('.choice-card').forEach((c) => c.classList.toggle('selected', c === b));
    });
  } else if (isMap) {
    $('#flat-map').addEventListener('click', (e) => {
      if (state.locked) return;
      const img = $('#flat-img'), r = img.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      state.click = { lat: 90 - y * 180, lng: x * 360 - 180 };
      placePin('.guess-pin', state.click);
    });
  } else { $('#answer-input')?.focus(); }
}

function placePin(sel, coords) {
  const map = $('#flat-map'), pin = $(sel), img = $('#flat-img');
  const mr = map.getBoundingClientRect(), ir = img.getBoundingClientRect();
  pin.classList.remove('hidden');
  pin.style.left = `${((ir.left - mr.left + (coords.lng + 180) / 360 * ir.width) / mr.width) * 100}%`;
  pin.style.top = `${((ir.top - mr.top + (90 - coords.lat) / 180 * ir.height) / mr.height) * 100}%`;
}

function showHint(html) { const b = $('#hint-box'); b.innerHTML = html; b.classList.remove('hidden'); }

function score(q, value) {
  if (q.type === 'map') {
    const a = q.answer, r = (x) => x * Math.PI / 180;
    const h = Math.sin(r(value.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(value.lat)) * Math.sin(r(value.lng - a.lng) / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return { points: Math.max(0, Math.round(100 * Math.exp(-km / 900))), distance: km };
  }
  const err = Math.abs(Number(value) - q.answer) / Math.max(q.answer, 1);
  return { points: Math.max(0, Math.round(100 * Math.exp(-2.1 * err))), distance: null };
}

function submitAnswer() {
  const q = state.questions[state.index], isChoice = state.index < 2;
  const value = q.type === 'map' ? state.click : isChoice ? state.choiceValue : $('#answer-input')?.value;
  if (value === null || value === undefined || value === '') { showHint(q.type === 'map' ? 'Tap the map to drop your pin first! 📍' : 'Make a guess first — any guess is a good guess!'); return; }
  const res = score(q, value); // res.points is on a 0–100 base scale
  const finalPts = Math.round(res.points / 100 * maxPts(state.index));
  state.locked = true;
  state.answers.push({ points: finalPts, maxPoints: maxPts(state.index) });
  const ratio = finalPts / maxPts(state.index);
  const cheers = ratio >= 0.75 ? '🎉 Amazing guessing!' : ratio >= 0.4 ? '👏 Good thinking!' : '🌱 Great guessing — every guess teaches you something!';
  const reveal = q.type === 'map' ? `You were ${Math.round(res.distance).toLocaleString()} km away.` : `The answer: <strong>${q.answer.toLocaleString()} ${q.unit}</strong>.`;
  const fb = $('#answer-feedback');
  fb.innerHTML = `${cheers}<br>${reveal} You earned <strong>${finalPts} of ${maxPts(state.index)} points</strong>.<br>${q.explanation}`;
  fb.classList.remove('hidden');
  if (q.type === 'map') placePin('.target-pin', q.answer);
  const btn = $('#submit-button');
  btn.textContent = state.index === state.questions.length - 1 ? 'See my stars ⭐' : 'Next question ↗';
  btn.onclick = () => {
    if (state.index < state.questions.length - 1) { state.index++; renderQuestion(); }
    else showResults();
  };
}

function showResults() {
  const total = state.answers.reduce((n, a) => n + a.points, 0);
  const stars = Math.max(1, Math.round(total / 200));
  const panel = $('#result-panel');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div style="font:11px var(--mono);letter-spacing:.1em;color:#bdd69d">JUNIOR ROUND COMPLETE</div>
    <h2>${total >= 800 ? 'Superstar guesser!' : total >= 500 ? 'Great guessing!' : 'You learned five new things!'}</h2>
    <div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
    <div style="font:600 34px var(--display);color:var(--lime);margin:8px 0">${total} <span style="font-size:13px;color:#c8d5c2">/ 1,000 points</span></div>
    ${state.questions.map((q, i) => `<div class="result-line"><span>${q.junior.emoji} ${q.title}</span><b>${state.answers[i].points} / ${state.answers[i].maxPoints}</b></div>`).join('')}
    <button class="button button-light" style="margin-top:18px" onclick="location.reload()">Play again ↗</button>`;
  if (juniorMode === 'daily') { try { localStorage.setItem('fivebigthings-junior-v1', JSON.stringify({ date: new Date().toISOString().slice(0, 10), score: total })); } catch (e) {} }
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Load from the API; fall back to the bundled daily set if it is unreachable
// (e.g. offline, where the service worker may still have the shell cached).
const juniorMode = new URLSearchParams(location.search).get('mode') === 'practice' ? 'practice' : 'daily';
async function loadQuestions() {
  try {
    const res = await fetch(juniorMode === 'practice' ? '/api/junior-practice' : '/api/junior');
    if (!res.ok) throw new Error('junior api ' + res.status);
    state.questions = (await res.json()).questions;
  } catch (e) { state.questions = JUNIOR_SAMPLE.questions; }
  $('#mode-label').textContent = juniorMode === 'practice' ? 'JUNIOR PRACTICE' : 'JUNIOR ROUND';
  renderQuestion();
}
loadQuestions();
