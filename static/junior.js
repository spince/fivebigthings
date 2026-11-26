// Five Big Things Junior — same game, kid-sized help.
// Flow and scoring run on the shared core (engine.js) — the scoring is
// the main game's, and helpers are free and never reduce points. The
// question widgets come from the shared presentation layer
// (question-view.js): choice cards, the typed guess box (comma
// formatting on, unit picker off — simpler for kids), and the flat map.
// This file owns what is junior-only: the emoji/comparison chrome, the
// helpers (read to me, hint ladder, make it easier), stars, and data.
// Production data comes from GET /api/junior.
const $ = (s) => document.querySelector(s);
const session = createSession();
const state = { hintLevel: 0, easierUsed: false };
const EARTH = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg';
let view = null; // the mounted question presenter for the current question

// Junior's own choice strategy: the main game's factors, padded with
// answer+offsets and rotated by a hash of the question id.
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
  const q = session.current();
  if (!q) return;
  if (view && view.destroy) view.destroy();
  view = null;
  state.hintLevel = 0; state.easierUsed = false;
  $('#progress-label').textContent = `QUESTION ${String(session.index + 1).padStart(2, '0')} OF 05`;
  $('#progress-fill').style.width = `${((session.index + 1) / session.questions.length) * 100}%`;
  $('#points-note').innerHTML = `Question ${session.index + 1}: up to <b>${maxPointsFor(session.index)} points</b> ⭐`;
  $('#answer-feedback').classList.add('hidden');
  $('#submit-button').textContent = session.index === session.questions.length - 1 ? 'See my stars ↗' : 'Lock in guess ↗';
  $('#submit-button').onclick = submitAnswer;

  const isChoice = session.index < 2, isMap = q.type === 'map';
  $('#question-area').innerHTML = `
    <div class="emoji-big">${q.junior.emoji}</div>
    <h2 class="question-prompt">${q.prompt}</h2>
    <div class="compare-card"><span style="font-size:22px">🤔</span><span><b>Think of it like this:</b> ${q.junior.comparison}</span></div>
    <div id="answer-area"></div>
    ${isMap ? '<p style="font-size:14px;color:#9a9d93;text-align:center;margin:10px 0 0">Tap the map to drop your pin 📍</p>' : ''}
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

  const area = $('#answer-area');
  if (isChoice) view = mountChoices(area, choicesFor(q));
  else if (isMap) view = mountMap(area, { texture: EARTH, flatOnly: true, flatFill: true, chrome: false, coordinates: false });
  else view = mountInput(area, q, { units: false });

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
      const picked = view.read();
      const cards = [...document.querySelectorAll('.choice-card')].filter((c) => Number(c.dataset.value) !== Number(q.answer));
      cards.sort(() => 0.5 - Math.random()).slice(0, 2).forEach((c) => { c.classList.add('dimmed'); if (picked !== null && Number(c.dataset.value) === Number(picked)) view.clear(); });
      showHint('🙌 Two wrong answers went away. You can do it!');
    } else if (isMap) {
      const img = view.flatImage();
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
}

function showHint(html) { const b = $('#hint-box'); b.innerHTML = html; b.classList.remove('hidden'); }

function submitAnswer() {
  const q = session.current(), isChoice = session.index < 2;
  let value;
  if (q.type === 'map') value = view.read();
  else if (isChoice) { const raw = view.read(); value = raw === null ? null : Number(raw); }
  else value = view.read().value;
  if (value === null || value === undefined || value === '') { showHint(q.type === 'map' ? 'Tap the map to drop your pin first! 📍' : 'Make a guess first — any guess is a good guess!'); return; }
  const entry = session.submit(value);
  if (!entry) { showHint('Make a guess first — any guess is a good guess!'); return; }
  const ratio = entry.points / entry.maxPoints;
  const cheers = ratio >= 0.75 ? '🎉 Amazing guessing!' : ratio >= 0.4 ? '👏 Good thinking!' : '🌱 Great guessing — every guess teaches you something!';
  const reveal = q.type === 'map' ? `You were ${Math.round(entry.distanceKm).toLocaleString()} km away.` : `The answer: <strong>${q.answer.toLocaleString()} ${q.unit}</strong>.`;
  const fb = $('#answer-feedback');
  fb.innerHTML = `${cheers}<br>${reveal} You earned <strong>${entry.points} of ${entry.maxPoints} points</strong>.<br>${q.explanation}`;
  fb.classList.remove('hidden');
  if (q.type === 'map') { view.lock(); view.reveal(value, q.answer); }
  const btn = $('#submit-button');
  btn.textContent = session.index === session.questions.length - 1 ? 'See my stars ⭐' : 'Next question ↗';
  btn.onclick = () => {
    if (session.advance()) renderQuestion();
    else showResults();
  };
}

function showResults() {
  const total = session.total();
  const stars = Math.max(1, Math.round(total / 200));
  const panel = $('#result-panel');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div style="font:11px var(--mono);letter-spacing:.1em;color:#bdd69d">JUNIOR ROUND COMPLETE</div>
    <h2>${total >= 800 ? 'Superstar guesser!' : total >= 500 ? 'Great guessing!' : 'You learned five new things!'}</h2>
    <div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
    <div style="font:600 34px var(--display);color:var(--lime);margin:8px 0">${total} <span style="font-size:13px;color:#c8d5c2">/ 1,000 points</span></div>
    ${session.questions.map((q, i) => `<div class="result-line"><span>${q.junior.emoji} ${q.title}</span><b>${session.answers[i].points} / ${session.answers[i].maxPoints}</b></div>`).join('')}
    <button class="button button-light" style="margin-top:18px" onclick="location.reload()">Play again ↗</button>`;
  if (juniorMode === 'daily') { try { localStorage.setItem('fivebigthings-junior-v1', JSON.stringify({ date: servedDate || localDateText(), score: total })); } catch (e) {} }
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Load from the API; fall back to the bundled daily set if it is unreachable
// (e.g. offline, where the service worker may still have the shell cached).
const juniorMode = new URLSearchParams(location.search).get('mode') === 'practice' ? 'practice' : 'daily';
// The player's local calendar date (YYYY-MM-DD) in their own timezone —
// NOT toISOString(), which is the UTC date (see app.js).
function localDateText(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
let servedDate = null;
async function loadQuestions() {
  try {
    const res = await fetch(juniorMode === 'practice' ? '/api/junior-practice' : '/api/junior?date=' + localDateText());
    if (!res.ok) throw new Error('junior api ' + res.status);
    const payload = await res.json();
    session.reset(payload.questions);
    if (payload.date) servedDate = payload.date;
  } catch (e) { session.reset(JUNIOR_SAMPLE.questions); }
  $('#mode-label').textContent = juniorMode === 'practice' ? 'JUNIOR PRACTICE' : 'JUNIOR ROUND';
  renderQuestion();
}
loadQuestions();
