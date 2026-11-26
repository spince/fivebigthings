// Five Big Things — main game (daily + practice).
// Flow and scoring live in the shared core (engine.js); the question
// widgets live in the shared presentation layer (question-view.js).
// This file owns only what is specific to this mode: where questions
// come from, the daily lock, feedback copy, results, and sharing.
const $ = (s) => document.querySelector(s);
const state = { mode: 'daily', date: null, entered: [] };
const session = createSession();
const localKey = 'fivebigthings-daily-v3';
const earthTexture = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg';
let view = null; // the mounted question presenter for the current question

function dateText() { return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()); }
// The player's local calendar date (YYYY-MM-DD) in their own timezone —
// NOT toISOString(), which is the UTC date and rolls the day over hours
// early or late depending on where the player lives.
function localDateText(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
async function api(path) {
  const response = await fetch(path);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function renderQuestion() {
  const q = session.current(); if (!q) return;
  if (view && view.destroy) view.destroy();
  view = null;
  $('#mode-label').textContent = state.mode === 'daily' ? 'DAILY ROUND' : 'PRACTICE';
  $('#progress-label').textContent = `QUESTION ${String(session.index + 1).padStart(2, '0')} OF ${String(session.questions.length).padStart(2, '0')}`;
  $('#progress-fill').style.width = `${((session.index + 1) / session.questions.length) * 100}%`;
  const title = `<div class="question-heading"><span class="question-title">${q.title}</span><span class="q-number">${String(session.index + 1).padStart(2, '0')} / 05</span></div><h2 class="question-prompt">${q.prompt}</h2>`;
  $('#question-area').innerHTML = title + `<div id="answer-area"></div><div class="hint-row"><span id="hint-text"></span></div>`;
  $('#answer-feedback').classList.add('hidden');
  $('#submit-button').textContent = session.index === session.questions.length - 1 ? 'See my score ↗' : 'Lock in guess ↗';
  $('#submit-button').onclick = submitAnswer;
  $('#points-note').innerHTML = `Question ${session.index + 1}: up to <b>${maxPointsFor(session.index)} points</b>`;
  const area = $('#answer-area');
  if (q.type === 'map') {
    // The daily pin question is flat — simple and quick (Spencer,
    // 2026-11-26). The round, movable globe lives on /globe. The flat
    // map rotates daily through the world-map variants.
    const variant = mapVariantForDate(state.date || localDateText());
    view = mountMap(area, {
      texture: earthTexture,
      flatOnly: true,
      flatVariant: variant,
      variantLabel: variant.label,
      onPin: (coords) => {
        $('#hint-text').textContent = `Pin placed · ${coords.lat.toFixed(1)}°, ${coords.lng.toFixed(1)}°`;
        view.setInstruction('Pin placed · tap again to adjust');
      },
    });
  } else if (session.index < 2) {
    view = mountChoices(area, defaultChoices(q), { onPick: (value, label) => { $('#hint-text').textContent = `Selected: ${label}`; } });
  } else {
    view = mountInput(area, q);
  }
}

function submitAnswer() {
  const q = session.current(), isChoice = session.index < 2;
  let value, entered = null;
  if (q.type === 'map') value = view.read();
  else if (isChoice) { const raw = view.read(); value = raw === null ? null : Number(raw); }
  else { const r = view.read(); value = r.value; entered = r.entered; }
  if (value === null || value === undefined || value === '' || (q.type !== 'map' && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
    $('#hint-text').textContent = q.type === 'map' ? 'Tap the map to place your pin first.' : isChoice ? 'Choose one of the four estimates.' : 'Enter a number to lock in your guess.';
    return;
  }
  const entry = session.submit(value); if (!entry) return;
  state.entered[session.index] = entered;
  const feedback = $('#answer-feedback'); feedback.classList.remove('hidden');
  let reveal;
  if (q.type === 'map') reveal = `You were ${Math.round(entry.distanceKm).toLocaleString()} km away.`;
  else {
    reveal = `The answer: <strong>${q.answer.toLocaleString()} ${q.unit}</strong>.`;
    if (entered) reveal += ` Your ${entered.amount.toLocaleString()} ${entered.unit} = ${Math.round(value).toLocaleString()} ${q.unit}.`;
  }
  feedback.innerHTML = `${reveal} You earned <strong>${entry.points} of ${entry.maxPoints} points.</strong><br>${q.explanation}`;
  if (q.type === 'map') { view.lock(); view.reveal(value, q.answer, { arc: true }); }
  $('#submit-button').textContent = session.index === session.questions.length - 1 ? 'Finish round ↗' : 'Next question ↗';
  $('#submit-button').onclick = nextQuestion;
}

function nextQuestion() {
  if (session.advance()) { renderQuestion(); return; }
  if (session.done) showResults();
}

function showResults() {
  const total = session.total();
  const panel = $('#result-panel'); panel.classList.remove('hidden');
  const breakdown = session.questions.map((q, i) => ({ title: q.title, points: session.answers[i].points, maxPoints: session.answers[i].maxPoints }));
  const rows = breakdown.map((item) => `<div class="result-line"><span>${item.title}</span><b>${item.points} / ${item.maxPoints}</b></div>`).join('');
  panel.innerHTML = `<div class="result-kicker">${state.mode === 'daily' ? 'TODAY, IN NUMBERS' : 'PRACTICE COMPLETE'}</div><div class="result-main"><h2>${total >= 800 ? 'Sharp eyes.' : total >= 500 ? 'Pretty good perspective.' : 'A world of things to learn.'}</h2><div class="result-score">${total}<span style="font:12px var(--mono);color:#c8d5c2"> / 1,000</span></div></div><div class="result-list">${rows}</div><div class="result-actions"><button class="button button-light" id="share-button">Share my score ↗</button>${state.mode === 'practice' ? '<button class="button button-outline" id="again-button">Another practice round</button>' : ''}</div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#share-button').onclick = () => shareScore(total, breakdown, state.mode);
  if ($('#again-button')) $('#again-button').onclick = () => loadMode('practice');
  if (state.mode === 'daily') {
    // Save the answers and the questions as played (imperialized), so
    // the round can be reviewed later from the lock screen.
    const answers = session.answers.map((a, i) => ({ value: a.value, points: a.points, maxPoints: a.maxPoints, distanceKm: a.distanceKm, entered: state.entered[i] || null }));
    localStorage.setItem(localKey, JSON.stringify({ date: state.date || localDateText(), score: total, breakdown, answers, questions: session.questions }));
  }
}

async function shareScore(score, breakdown = session.questions.map((q, i) => ({ title: q.title, points: session.answers[i]?.points || 0, maxPoints: session.answers[i]?.maxPoints || maxPointsFor(i) })), mode = state.mode) {
  const shareDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date());
  const marks = breakdown.map((item) => {
    const result = Math.round(100 * item.points / item.maxPoints);
    const emoji = result >= 90 ? '🎯' : result >= 75 ? '🔥' : result >= 50 ? '🙂' : '🤔';
    return `${result}${emoji}`;
  }).join(' ');
  const round = mode === 'daily' ? '' : ' · Practice';
  const text = `${location.origin} ${shareDate}${round}\n${marks}\nFinal score: ${score}/1,000`;
  const button = $('#share-button');
  // Keep a copy of the full score text available in case a native share target
  // chooses to include only the link. The Web Share API leaves target behavior
  // up to the platform, so this gives every device the same pasteable result.
  const copied = navigator.clipboard?.writeText(text).then(() => true).catch(() => false);
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Five Big Things score', text });
      if (await copied) button.textContent = 'Score text copied too ✓';
    } else if (await copied) { button.textContent = 'Copied to clipboard ✓'; }
    else { throw new Error('Clipboard unavailable'); }
  } catch (e) { if (e.name !== 'AbortError') alert('Could not share just now.'); }
}

// ---------- review: click through today's round, answers pre-filled ----------
let review = null;
function startReview(saved) {
  review = { data: saved, index: 0 };
  $('#result-panel').classList.add('hidden');
  renderReview();
}
function renderReview() {
  const { data } = review, i = review.index;
  const q = data.questions[i], a = data.answers[i];
  if (view && view.destroy) view.destroy();
  view = null;
  $('#mode-label').textContent = 'REVIEW';
  $('#progress-label').textContent = `QUESTION ${String(i + 1).padStart(2, '0')} OF 05 · YOUR ANSWERS`;
  $('#progress-fill').style.width = `${((i + 1) / data.questions.length) * 100}%`;
  const title = `<div class="question-heading"><span class="question-title">${q.title}</span><span class="q-number">${String(i + 1).padStart(2, '0')} / 05</span></div><h2 class="question-prompt">${q.prompt}</h2>`;
  $('#question-area').innerHTML = title + `<div id="answer-area"></div><div class="hint-row"><span id="hint-text"></span>${i > 0 ? '<button class="hint-button" id="review-back" type="button">← Back</button>' : ''}</div>`;
  const feedback = $('#answer-feedback'); feedback.classList.remove('hidden');
  let reveal;
  if (q.type === 'map') reveal = `You were ${Math.round(a.distanceKm).toLocaleString()} km away.`;
  else {
    reveal = `The answer: <strong>${q.answer.toLocaleString()} ${q.unit}</strong>.`;
    if (a.entered) reveal += ` Your ${a.entered.amount.toLocaleString()} ${a.entered.unit} = ${Math.round(a.value).toLocaleString()} ${q.unit}.`;
  }
  feedback.innerHTML = `${reveal} You earned <strong>${a.points} of ${a.maxPoints} points.</strong><br>${q.explanation}`;
  $('#points-note').innerHTML = `Question ${i + 1}: you earned <b>${a.points} of ${a.maxPoints} points</b>`;
  const area = $('#answer-area');
  if (q.type === 'map') {
    const variant = mapVariantForDate(data.date);
    view = mountMap(area, { texture: earthTexture, flatOnly: true, flatVariant: variant, variantLabel: variant.label, initialPin: a.value, readOnly: true });
    view.reveal(a.value, q.answer);
  } else if (i < 2) {
    view = mountChoices(area, defaultChoices(q), { initialValue: a.value, readOnly: true });
  } else {
    view = mountInput(area, q, { initialValue: a.entered ? a.entered.amount : a.value, initialUnit: a.entered ? a.entered.unit : null, readOnly: true, autofocus: false });
  }
  const btn = $('#submit-button');
  btn.textContent = i === data.questions.length - 1 ? 'Back to my score ✓' : 'Next question →';
  btn.onclick = () => {
    if (review.index < review.data.questions.length - 1) { review.index++; renderReview(); }
    else { review = null; loadMode('daily'); }
  };
  if ($('#review-back')) $('#review-back').onclick = () => { review.index--; renderReview(); };
}

async function loadMode(mode) {
  state.mode = mode;
  state.entered = [];
  session.reset([]);
  $('#result-panel').classList.add('hidden');
  document.querySelectorAll('.nav-link').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  if (mode === 'daily') {
    const today = localDateText();
    const saved = JSON.parse(localStorage.getItem(localKey) || 'null');
    if (saved?.date === today) {
      $('#question-area').innerHTML = `<div style="padding:30px 0;text-align:center"><div class="question-title">TODAY'S ROUND IS IN THE BOOKS</div><h2 class="question-prompt" style="margin:16px auto">You scored ${saved.score} out of 1,000.</h2><p style="font-size:12px;color:#85897e">Come back tomorrow for five fresh questions, or head to practice.</p><button class="button button-primary" style="margin:20px auto 0" id="resume-share">Share today's score ↗</button>${saved.answers && saved.questions ? '<button class="button button-outline" style="margin:10px auto 0" id="resume-review">Review my answers ↺</button>' : ''}</div>`;
      $('#resume-share').onclick = () => shareScore(saved.score, saved.breakdown, 'daily');
      if ($('#resume-review')) $('#resume-review').onclick = () => startReview(saved);
      $('#progress-label').textContent = 'ROUND COMPLETE';
      $('#progress-fill').style.width = '100%';
      return;
    }
    const data = await api('/api/daily?date=' + today);
    session.reset(data.questions.map(imperializeQuestion));
    state.date = data.date;
    $('#date-label').textContent = new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  } else {
    const data = await api('/api/practice');
    session.reset(data.questions.map(imperializeQuestion));
    $('#date-label').textContent = 'NO SCOREBOARD · ALL FOR FUN';
  }
  renderQuestion();
}

document.querySelectorAll('.nav-link').forEach((b) => b.onclick = () => loadMode(b.dataset.mode));
$('#practice-cta').onclick = () => loadMode('practice');
$('#footer-date').textContent = dateText();
const startMode = new URLSearchParams(location.search).get('mode');
loadMode(startMode === 'practice' ? 'practice' : 'daily');
