// Pure helpers for typed guesses: length-unit conversion and
// thousands-separator formatting. Loaded before app.js in the browser;
// exported for the node --test suite in tests/js/.
const LENGTH_UNITS = { inches: 0.0254, centimeters: 0.01, feet: 0.3048, meters: 1, kilometers: 1000, miles: 1609.344 };
const UNIT_ALIASES = { inch: 'inches', inches: 'inches', cm: 'centimeters', centimeter: 'centimeters', centimeters: 'centimeters', foot: 'feet', feet: 'feet', ft: 'feet', meter: 'meters', meters: 'meters', metre: 'meters', metres: 'meters', kilometer: 'kilometers', kilometers: 'kilometers', km: 'kilometers', mile: 'miles', miles: 'miles' };
function lengthUnit(unit) { return UNIT_ALIASES[String(unit || '').trim().toLowerCase()] || null; }
function convertLength(value, fromUnit, toUnit) { const f = LENGTH_UNITS[lengthUnit(fromUnit)], t = LENGTH_UNITS[lengthUnit(toUnit)]; if (!f || !t) return null; return value * f / t; }
function formatGuess(raw) { const c = String(raw).replace(/[^0-9.]/g, ''); const dot = c.indexOf('.'); const intPart = dot === -1 ? c : c.slice(0, dot); const decPart = dot === -1 ? '' : '.' + c.slice(dot + 1).replace(/\./g, ''); const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ','); if (grouped) return grouped + decPart; return decPart ? '0' + decPart : ''; }
function parseGuess(raw) { if (raw === null || raw === undefined) return raw; const t = String(raw).trim(); if (t === '') return ''; return Number(t.replace(/,/g, '')); }
if (typeof module !== 'undefined' && module.exports) module.exports = { LENGTH_UNITS, lengthUnit, convertLength, formatGuess, parseGuess };
