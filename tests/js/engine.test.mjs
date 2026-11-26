import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { multiplierFor, maxPointsFor, haversineKm, scoreNumberGuess, scorePinGuess, defaultChoices, createSession, imperializeQuestion } = require('../../static/engine.js');

test('the ladder is x1 x1 x2 x3 x3 = 100/100/200/300/300', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(multiplierFor), [1, 1, 2, 3, 3]);
  assert.deepEqual([0, 1, 2, 3, 4].map(maxPointsFor), [100, 100, 200, 300, 300]);
});

test('number scoring: exact answer earns full base, error decays it', () => {
  assert.equal(scoreNumberGuess(88, 88).base, 100);
  assert.equal(scoreNumberGuess(100, 150).base, Math.round(100 * Math.exp(-2.1 * 0.5)));
  assert.equal(scoreNumberGuess(100, -5), null);
  assert.equal(scoreNumberGuess(100, 'abc'), null);
  assert.equal(scoreNumberGuess(100, '50').base, Math.round(100 * Math.exp(-2.1 * 0.5)));
});

test('pin scoring: <=22 km is (near) full marks, distance decays', () => {
  const paris = { lat: 48.8566, lng: 2.3522 };
  assert.equal(scorePinGuess(paris, paris).base, 100);
  assert.equal(scorePinGuess(paris, paris).distanceKm, 0);
  const near = scorePinGuess(paris, { lat: 48.9, lng: 2.4 });
  assert.ok(near.distanceKm < 22 && near.base >= 97);
  assert.equal(scorePinGuess(paris, null), null);
  assert.ok(Math.abs(haversineKm(paris, { lat: 51.5074, lng: -0.1278 }) - 343) < 5);
});

test('defaultChoices builds the 0.5/0.8/1/1.3 ladder with unit labels', () => {
  const cs = defaultChoices({ answer: 100, unit: 'keys', type: 'number', id: 'x' }); // id hash shift 0
  assert.deepEqual(cs.map((c) => c.value), [50, 80, 100, 130]);
  assert.equal(cs[2].label, '100 keys');
  assert.deepEqual(cs.map((c) => c.marker), ['A', 'B', 'C', 'D']);
  const pct = defaultChoices({ answer: 90, unit: '%', type: 'percent', id: 'x' });
  assert.ok(pct.every((c) => c.value <= 100));
});

test('defaultChoices pads deduped values back to four cards', () => {
  const cs = defaultChoices({ answer: 2, unit: 'legs', type: 'number', id: 'x' });
  assert.equal(cs.length, 4);
  assert.ok(cs.some((c) => c.value === 2));
  assert.equal(new Set(cs.map((c) => c.value)).size, 4);
});

test('session: submit locks, scales by the ladder, advance walks the round', () => {
  const qs = [
    { type: 'number', answer: 10, unit: 'x' }, { type: 'number', answer: 20, unit: 'x' },
    { type: 'number', answer: 30, unit: 'x' }, { type: 'number', answer: 40, unit: 'x' },
    { type: 'map', answer: { lat: 0, lng: 0 }, unit: 'km' },
  ];
  const s = createSession({ questions: qs });
  assert.equal(s.submit(10).points, 100);          // slot 1: base 100 x1
  assert.equal(s.submit(10), null);                // locked — no double submit
  assert.equal(s.advance(), true);
  assert.equal(s.submit(999).points, 0);           // way off
  s.advance();
  assert.equal(s.submit(30).points, 200);          // slot 3: base 100 x2
  s.advance();
  assert.equal(s.submit(20).points, Math.round(Math.round(100 * Math.exp(-2.1 * 0.5)) * 3));
  s.advance();
  assert.equal(s.submit({ lat: 0, lng: 0 }).points, 300); // slot 5 pin, exact
  assert.equal(s.total(), 100 + 0 + 200 + Math.round(Math.round(100 * Math.exp(-2.1 * 0.5)) * 3) + 300);
  assert.equal(s.advance(), false);
  assert.equal(s.done, true);
});

test('session: a custom score strategy replaces the default law', () => {
  const s = createSession({ questions: [{ type: 'choice' }, { type: 'choice' }], score: (q, v) => ({ base: v === 'right' ? 100 : 0, distanceKm: null }) });
  assert.equal(s.submit('right').points, 100);
  s.advance();
  assert.equal(s.submit('wrong').points, 0);
});

test('country borders: inside scores 0 km, holes and distance outside', () => {
  const { inPolygons, kmToPolygons, kmOutside } = require('../../static/engine.js');
  // A 10°x10° square at the equator with a 2°x2° hole in the middle.
  const square = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]];
  const polys = [square];
  assert.equal(inPolygons({ lat: 2, lng: 2 }, polys), true);
  assert.equal(inPolygons({ lat: 5, lng: 5 }, polys), false); // in the hole
  assert.equal(inPolygons({ lat: 2, lng: 12 }, polys), false);
  assert.equal(kmOutside({ lat: 2, lng: 2 }, polys), 0);
  // 1° of longitude east of the edge at lat 2 is ~111 km.
  const km = kmToPolygons({ lat: 2, lng: 11 }, polys);
  assert.ok(km > 105 && km < 115, `got ${km}`);
  assert.equal(kmOutside({ lat: 2, lng: 10.1 }, polys, 15), 0); // within the grace band
  assert.ok(kmOutside({ lat: 2, lng: 11 }, polys, 15) > 100);
});

test('imperializeQuestion asks in feet/miles/inches (Spencer rule)', () => {
  const everestM = imperializeQuestion({ type: 'number', answer: 8849, unit: 'meters', prompt: 'About how many meters tall is Everest?', explanation: 'It stands 8,849 meters.' });
  assert.equal(everestM.unit, 'feet');
  assert.equal(everestM.answer, 29032); // the number everyone knows
  assert.ok(everestM.prompt.includes('feet') && !everestM.prompt.includes('meters'));
  assert.ok(everestM.explanation.includes('29,032 feet'));
  const everestKm = imperializeQuestion({ type: 'number', answer: 8.849, unit: 'kilometers', prompt: 'How many kilometers?', explanation: '' });
  assert.equal(everestKm.unit, 'feet'); // km-authored Everest still lands in feet
  const orbit = imperializeQuestion({ type: 'number', answer: 2400000, unit: 'kilometers', prompt: 'How many kilometers?', explanation: '' });
  assert.equal(orbit.unit, 'miles');
  // the title converts too, keeping its capital letter
  const saturn = imperializeQuestion({ type: 'number', answer: 120536, unit: 'kilometers', title: 'Kilometers wide is Saturn', prompt: 'About how many kilometers wide is Saturn?', explanation: 'About 120,536 kilometers, roughly 9 times Earth (12,742 kilometers).' });
  assert.equal(saturn.title, 'Miles wide is Saturn');
  assert.ok(saturn.explanation.includes('74,898 miles') && saturn.explanation.includes('12,742 kilometers')); // other figures stay true
  const noFigure = imperializeQuestion({ type: 'number', answer: 8849, unit: 'meters', prompt: 'How many meters?', explanation: 'It is the tallest mountain above sea level.' });
  assert.equal(noFigure.explanation, "It is the tallest mountain above sea level. That's about 29,032 feet.");
  assert.ok(Math.abs(orbit.answer - 1491290) / 1491290 < 0.001);
  const ruler = imperializeQuestion({ type: 'number', answer: 30, unit: 'centimeters', prompt: 'How many centimeters?', explanation: '' });
  assert.equal(ruler.unit, 'inches');
  // already imperial, non-length, and map questions pass through untouched
  const whale = { type: 'number', answer: 80, unit: 'feet', prompt: 'How many feet?', explanation: '' };
  assert.equal(imperializeQuestion(whale), whale);
  const keys = { type: 'number', answer: 88, unit: 'keys', prompt: 'How many keys?', explanation: '' };
  assert.equal(imperializeQuestion(keys), keys);
  const pin = { type: 'map', answer: { lat: 0, lng: 0 }, unit: 'km' };
  assert.equal(imperializeQuestion(pin), pin);
});
