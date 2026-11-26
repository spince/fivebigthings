import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { lengthUnit, convertLength, formatGuess, parseGuess } = require('../../static/units.js');

test('lengthUnit recognizes the bank spellings and rejects non-lengths', () => {
  assert.equal(lengthUnit('km'), 'kilometers');
  assert.equal(lengthUnit('Kilometers'), 'kilometers');
  assert.equal(lengthUnit('feet'), 'feet');
  assert.equal(lengthUnit('meters'), 'meters');
  assert.equal(lengthUnit('miles'), 'miles');
  assert.equal(lengthUnit('days'), null);
  assert.equal(lengthUnit('light-years'), null);
});

test('convertLength converts through meters', () => {
  assert.ok(Math.abs(convertLength(1, 'miles', 'meters') - 1609.344) < 1e-9);
  assert.ok(Math.abs(convertLength(1000, 'meters', 'kilometers') - 1) < 1e-12);
  assert.ok(Math.abs(convertLength(12, 'inches', 'feet') - 1) < 1e-9);
  assert.ok(Math.abs(convertLength(1, 'kilometers', 'miles') - 0.621371) < 1e-6);
  assert.equal(convertLength(5, 'days', 'meters'), null);
});

test('formatGuess adds thousands separators as you type', () => {
  assert.equal(formatGuess(''), '');
  assert.equal(formatGuess('100'), '100');
  assert.equal(formatGuess('1000000'), '1,000,000');
  assert.equal(formatGuess('1234.56'), '1,234.56');
  assert.equal(formatGuess('.5'), '0.5');
  assert.equal(formatGuess('12,34'), '1,234');
});

test('parseGuess reads formatted input back', () => {
  assert.equal(parseGuess('1,000,000'), 1000000);
  assert.equal(parseGuess('1,234.56'), 1234.56);
  assert.equal(parseGuess(''), '');
  assert.ok(Number.isNaN(parseGuess('abc')));
  assert.equal(parseGuess(formatGuess('7926')), 7926);
});
