const $ = (s) => document.querySelector(s);
const state = {mode:'daily', questions:[], index:0, answers:[], revealHint:false, click:null, choiceValue:null};
const localKey = 'fivebigthings-daily-v2';
const earthTexture = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg';
let globe = null;
let globeResizeObserver = null;

function dateText() { return new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(new Date()); }
async function api(path) {
  const response = await fetch(path);
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
function questionList() { return state.questions; }
function scoreMultiplier(index) { return index < 2 ? 1 : index === 2 ? 2 : 3; }
function maxPoints(index) { return 100 * scoreMultiplier(index); }
function answerChoices(q) {
  const answer = Number(q.answer);
  const factors = [0.5, 0.8, 1, 1.3];
  const choices = factors.map(factor => {
    let value = Math.round(answer * factor);
    if (q.type === 'percent') value = Math.min(100, Math.max(0, value));
    return value;
  });
  const unique = [...new Set(choices)];
  while (unique.length < 4) {
    const offset = Math.ceil(unique.length / 2);
    const candidates = [answer - offset, answer + offset].filter(value => q.type !== 'percent' || (value >= 0 && value <= 100));
    const candidate = candidates.find(value => !unique.includes(value));
    if (candidate === undefined) break;
    unique.push(candidate);
  }
  const shift = [...String(q.id)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
  const rotated = unique.slice(shift).concat(unique.slice(0, shift));
  return rotated.slice(0, 4).map((value, index) => ({
    value,
    label: `${value.toLocaleString()} ${q.unit}`,
    marker: String.fromCharCode(65 + index),
  }));
}
function choiceMarkup(q) {
  return `<div class="choice-grid" role="group" aria-label="Choose your estimate">${answerChoices(q).map(choice => `<button class="choice-card" type="button" data-value="${choice.value}" data-label="${choice.label}"><span class="choice-marker">${choice.marker}</span><span class="choice-label">${choice.label}</span></button>`).join('')}</div>`;
}
function renderQuestion() {
  const q=questionList()[state.index]; if(!q)return;
  state.click=null; state.choiceValue=null; state.revealHint=false; state.locked=false; globe=null;
  if(globeResizeObserver){globeResizeObserver.disconnect();globeResizeObserver=null;}
  $('#mode-label').textContent=state.mode==='daily'?'DAILY ROUND':'PRACTICE';
  $('#progress-label').textContent=`QUESTION ${String(state.index+1).padStart(2,'0')} OF ${String(state.questions.length).padStart(2,'0')}`;
  $('#progress-fill').style.width=`${((state.index+1)/state.questions.length)*100}%`;
  const title=`<div class="question-heading"><span class="question-title">${q.title}</span><span class="q-number">${String(state.index+1).padStart(2,'0')} / 05</span></div><h2 class="question-prompt">${q.prompt}</h2>`;
  const answer=q.type==='map'?mapMarkup():state.index<2?choiceMarkup(q):`<label class="answer-input-wrap"><input id="answer-input" type="number" inputmode="decimal" autocomplete="off" placeholder="Your best guess" step="any" aria-label="Your best guess"><span class="input-unit">${q.unit}</span></label>`;
  $('#question-area').innerHTML=title+answer+`<div class="hint-row"><span id="hint-text">Take a guess before you peek.</span><button class="hint-button" id="hint-button">Need a nudge?</button></div>`;
  $('#answer-feedback').classList.add('hidden');
  $('#submit-button').textContent=state.index===state.questions.length-1?'See my score ↗':'Lock in guess ↗';
  $('#points-note').innerHTML=`Question ${state.index+1}: up to <b>${maxPoints(state.index)} points</b>`;
  $('#hint-button').onclick=()=>{state.revealHint=true;$('#hint-text').textContent=q.hint;$('#hint-button').textContent='Hint revealed';};
  if(q.type==='map') wireMap();
  else if(state.index<2){
    document.querySelectorAll('.choice-card').forEach(button=>button.onclick=()=>{
      state.choiceValue=Number(button.dataset.value);
      document.querySelectorAll('.choice-card').forEach(card=>card.classList.toggle('selected',card===button));
      $('#hint-text').textContent=`Selected: ${button.dataset.label}`;
    });
    $('.choice-card')?.focus();
  }else $('#answer-input').focus();
}
function mapMarkup(){
  return `<div class="globe-shell"><div id="globe-canvas" class="globe-canvas" aria-label="Interactive Earth globe"></div><div id="flat-map" class="flat-map hidden" role="img" aria-label="World map. Click to place your pin"><img src="${earthTexture}" alt="Satellite image of Earth"><span class="flat-pin guess-pin hidden"></span><span class="flat-pin target-pin hidden"></span></div><div id="coordinate-entry" class="coordinate-entry hidden"><span class="coordinate-title">Map unavailable on this device</span><span class="coordinate-copy">Enter the coordinates of your best guess.</span><div class="coordinate-fields"><label>Latitude<input id="guess-lat" type="number" min="-90" max="90" step="any" placeholder="0°"></label><label>Longitude<input id="guess-lng" type="number" min="-180" max="180" step="any" placeholder="0°"></label></div><button id="coordinate-submit" class="button button-primary">Place pin ↗</button></div><div class="globe-prompt"><span class="globe-live-dot"></span><span id="globe-instruction">Drag to turn the globe · tap to place your pin</span></div><div class="globe-credit">Earth imagery: <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noreferrer">NASA Blue Marble</a></div></div>`;
}
function wireMap(){
  const canvas=$('#globe-canvas');
  const supportsWebGL=(()=>{try{const c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl')||c.getContext('experimental-webgl')));}catch(e){return false;}})();
  if(!supportsWebGL||typeof window.Globe!=='function'){enableFlatMap();return;}
  $('#globe-instruction').textContent='Loading Earth imagery…';
  const probe=new Image();probe.crossOrigin='anonymous';probe.onload=()=>createGlobe(canvas);probe.onerror=()=>enableFlatMap();probe.src=earthTexture;
}
function createGlobe(canvas){
  try{
    globe=window.Globe()(canvas)
      .width(canvas.clientWidth).height(canvas.clientHeight)
      .globeImageUrl(earthTexture)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true).atmosphereColor('#a8c8d8').atmosphereAltitude(0.16)
      .rendererConfig({antialias:true,alpha:true,powerPreference:'low-power'})
      .enablePointerInteraction(true)
      .onGlobeClick(({lat,lng})=>setGuess({lat,lng}));
    globe.pointAltitude('altitude').pointRadius('radius').pointColor('color').pointsMerge(false).pointsData([]);
    globe.ringLat('lat').ringLng('lng').ringColor(()=>t=>`rgba(202,235,139,${1-t})`).ringMaxRadius(3).ringPropagationSpeed(2).ringRepeatPeriod(1100).ringsData([]);
    globe.arcsData([]).arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng').arcColor(()=>['#caeb8b','#f4f6ed']).arcStroke(0.45).arcDashLength(0.45).arcDashGap(0.18).arcDashAnimateTime(1300);
    globeResizeObserver=new ResizeObserver(()=>{if(globe&&canvas.isConnected)globe.width(canvas.clientWidth).height(canvas.clientHeight);});globeResizeObserver.observe(canvas);
    window.requestAnimationFrame(()=>{if(globe&&canvas.isConnected)globe.width(canvas.clientWidth).height(canvas.clientHeight);});
  }catch(error){console.warn('3D globe unavailable; using the image map.',error);globe=null;enableFlatMap();}
}
function enableFlatMap(){
  $('#globe-canvas').classList.add('hidden');$('#flat-map').classList.remove('hidden');$('#globe-instruction').textContent='Tap the world map to place your pin';
  const map=$('#flat-map');map.addEventListener('click',event=>{if(state.locked)return;const rect=flatImageRect(map);if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return;const x=(event.clientX-rect.left)/rect.width;const y=(event.clientY-rect.top)/rect.height;setGuess({lat:90-y*180,lng:x*360-180},true);});
  const image=map.querySelector('img'),showCoordinates=()=>{map.classList.add('hidden');$('#coordinate-entry').classList.remove('hidden');$('#globe-instruction').textContent='Enter a latitude and longitude';};image.addEventListener('error',showCoordinates,{once:true});if(image.complete&&!image.naturalWidth)showCoordinates();
  $('#coordinate-submit').onclick=()=>{const lat=Number($('#guess-lat').value),lng=Number($('#guess-lng').value);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat>90||lng < -180||lng>180){$('#globe-instruction').textContent='Latitude: −90 to 90 · longitude: −180 to 180';return;}setGuess({lat,lng});};
}
function flatImageRect(map){const bounds=map.getBoundingClientRect(),image=map.querySelector('img'),ratio=image.naturalWidth&&image.naturalHeight?image.naturalWidth/image.naturalHeight:2;const width=Math.min(bounds.width,bounds.height*ratio),height=width/ratio;return {left:bounds.left+(bounds.width-width)/2,top:bounds.top+(bounds.height-height)/2,width,height,right:bounds.left+(bounds.width+width)/2,bottom:bounds.top+(bounds.height+height)/2};}
function positionFlatPin(selector,coords){const map=$('#flat-map'),pin=$(selector),mapRect=map.getBoundingClientRect(),imageRect=flatImageRect(map);pin.classList.remove('hidden');pin.style.left=`${((imageRect.left-mapRect.left+(coords.lng+180)/360*imageRect.width)/mapRect.width)*100}%`;pin.style.top=`${((imageRect.top-mapRect.top+(90-coords.lat)/180*imageRect.height)/mapRect.height)*100}%`;}
function setGuess(coords,flat=false){
  if(state.locked)return;state.click={lat:coords.lat,lng:coords.lng};
  $('#hint-text').textContent=`Pin placed · ${coords.lat.toFixed(1)}°, ${coords.lng.toFixed(1)}°`;
  $('#globe-instruction').textContent='Pin placed · tap again to adjust';
  if(globe){globe.pointsData([{...coords,altitude:0.012,radius:0.42,color:'#caeb8b'}]);}
  if(flat)positionFlatPin('.guess-pin',coords);
}
function revealGlobeAnswer(guess,answer){
  $('#globe-instruction').textContent='Your guess and the correct place';
  if(globe){globe.pointsData([{...guess,altitude:0.014,radius:0.42,color:'#caeb8b'},{...answer,altitude:0.018,radius:0.58,color:'#ffffff'}]).ringsData([{...answer,maxR:3}]).arcsData([{startLat:guess.lat,startLng:guess.lng,endLat:answer.lat,endLng:answer.lng}]);globe.pointOfView({lat:answer.lat,lng:answer.lng,altitude:1.7},1300);}
  else positionFlatPin('.target-pin',answer);
}
function scoreAnswer(q,value){
  if(q.type==='map') { const a=q.answer, toRad=x=>x*Math.PI/180;const dLat=toRad(value.lat-a.lat),dLng=toRad(value.lng-a.lng);const h=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(value.lat))*Math.sin(dLng/2)**2;const km=6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));return {points:Math.max(0,Math.round(100*Math.exp(-km/900))),distance:km}; }
  const n=Number(value);if(!Number.isFinite(n)||n<0)return null;
  const err=Math.abs(n-q.answer)/Math.max(q.answer,1);
  return {points:Math.max(0,Math.round(100*Math.exp(-2.1*err))),distance:null};
}
function submitAnswer(){
  const q=questionList()[state.index], isChoice=state.index<2;let value=q.type==='map'?state.click:isChoice?state.choiceValue:$('#answer-input')?.value;
  if(value===null||value===undefined||value===''||(!q.type.includes('map')&&(!Number.isFinite(Number(value))||Number(value)<0))){$('#hint-text').textContent=q.type==='map'?'Tap the map to place your pin first.':isChoice?'Choose one of the four estimates.':'Enter a number to lock in your guess.';return;}
  if(q.type!=='map')value=Number(value);
  const result=scoreAnswer(q,value);if(!result)return;
  const multiplier=scoreMultiplier(state.index), available=maxPoints(state.index), points=Math.round(result.points*multiplier);
  state.locked=true;
  state.answers.push({value,points,maxPoints:available});
  const feedback=$('#answer-feedback');feedback.classList.remove('hidden');let reveal;
  if(q.type==='map')reveal=`You were ${Math.round(result.distance).toLocaleString()} km away.`;
  else reveal=`The answer: <strong>${q.answer.toLocaleString()} ${q.unit}</strong>.`;
  feedback.innerHTML=`${reveal} You earned <strong>${points} of ${available} points.</strong><br>${q.explanation}`;
  if(q.type==='map')revealGlobeAnswer(value,q.answer);
  $('#submit-button').textContent=state.index===state.questions.length-1?'Finish round ↗':'Next question ↗';
  $('#submit-button').onclick=nextQuestion;
}
async function nextQuestion(){
  if(state.answers.length<state.index+1)return;
  if(state.index<state.questions.length-1){state.index++;$('#submit-button').onclick=submitAnswer;renderQuestion();return;}
  showResults();
}
function showResults(){
  const total=state.answers.reduce((n,a)=>n+a.points,0);const panel=$('#result-panel');panel.classList.remove('hidden');
  const breakdown=state.questions.map((q,i)=>({title:q.title,points:state.answers[i].points,maxPoints:state.answers[i].maxPoints}));
  const rows=breakdown.map(item=>`<div class="result-line"><span>${item.title}</span><b>${item.points} / ${item.maxPoints}</b></div>`).join('');
  panel.innerHTML=`<div class="result-kicker">${state.mode==='daily'?'TODAY, IN NUMBERS':'PRACTICE COMPLETE'}</div><div class="result-main"><h2>${total>=800?'Sharp eyes.':total>=500?'Pretty good perspective.':'A world of things to learn.'}</h2><div class="result-score">${total}<span style="font:12px var(--mono);color:#c8d5c2"> / 1,000</span></div></div><div class="result-list">${rows}</div><div class="result-actions"><button class="button button-light" id="share-button">Share my score ↗</button>${state.mode==='practice'?'<button class="button button-outline" id="again-button">Another practice round</button>':''}</div>`;
  panel.scrollIntoView({behavior:'smooth',block:'center'});$('#share-button').onclick=()=>shareScore(total,breakdown,state.mode);
  if($('#again-button'))$('#again-button').onclick=()=>loadMode('practice');
  if(state.mode==='daily'){
    localStorage.setItem(localKey,JSON.stringify({date:new Date().toISOString().slice(0,10),score:total,breakdown}));
  }
}
async function shareScore(score,breakdown=state.questions.map((q,i)=>({title:q.title,points:state.answers[i]?.points||0,maxPoints:state.answers[i]?.maxPoints||maxPoints(i)})),mode=state.mode){
  const shareDate=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric'}).format(new Date());
  const marks=breakdown.map(item=>{
    const result=Math.round(100*item.points/item.maxPoints);
    const emoji=result>=90?'🎯':result>=75?'🔥':result>=50?'🙂':'🤔';
    return `${result}${emoji}`;
  }).join(' ');
  const round=mode==='daily'?'':' · Practice';
  const text=`${location.origin} ${shareDate}${round}\n${marks}\nFinal score: ${score}/1,000`;
  try{if(navigator.share)await navigator.share({text});else{await navigator.clipboard.writeText(text);$('#share-button').textContent='Copied to clipboard ✓';}}catch(e){if(e.name!=='AbortError')alert('Could not share just now.');}
}
async function loadMode(mode){
  state.mode=mode;state.index=0;state.answers=[];$('#result-panel').classList.add('hidden');
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  if(mode==='daily'){
    const today=new Date().toISOString().slice(0,10);const saved=JSON.parse(localStorage.getItem(localKey)||'null');
    if(saved?.date===today){state.questions=[];$('#question-area').innerHTML=`<div style="padding:30px 0;text-align:center"><div class="question-title">TODAY'S ROUND IS IN THE BOOKS</div><h2 class="question-prompt" style="margin:16px auto">You scored ${saved.score} out of 1,000.</h2><p style="font-size:12px;color:#85897e">Come back tomorrow for five fresh questions, or head to practice.</p><button class="button button-primary" style="margin:20px auto 0" id="resume-share">Share today's score ↗</button></div>`;$('#resume-share').onclick=()=>shareScore(saved.score,saved.breakdown,'daily');$('#progress-label').textContent='ROUND COMPLETE';$('#progress-fill').style.width='100%';return;}
    const data=await api('/api/daily');state.questions=data.questions;$('#date-label').textContent=new Date(data.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
  }else{const data=await api('/api/practice');state.questions=data.questions;$('#date-label').textContent='NO SCOREBOARD · ALL FOR FUN';}
  renderQuestion();$('#submit-button').onclick=submitAnswer;
}
document.querySelectorAll('.nav-link').forEach(b=>b.onclick=()=>loadMode(b.dataset.mode));
$('#practice-cta').onclick=()=>loadMode('practice');
$('#footer-date').textContent=dateText();
loadMode('daily');
