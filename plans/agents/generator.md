# Generator — 10 new questions a day

**Cadence:** daily, morning ET.

## Inputs
- The live calendar (`static/question-calendar.json`) and the question
  bank — dedupe against every existing prompt and every previously
  generated candidate, accepted or not.
- The topic spread of the last 14 days (avoid clustering).

## Output
10 candidates appended to the bank staging file, each in calendar
question shape plus two staging-only fields:
- `source`: a citable reference for the answer (name + URL).
- `status: "candidate"` (the Playtester changes this).

## Rules
- Answers are checkable facts with a source. No time-sensitive facts
  ("current CEO…", "latest iPhone…").
- Numbers should be guessable within an order of magnitude by a strong
  generalist; prefer answers with a story the explanation can tell in
  one or two sentences.
- Mix per batch, roughly: 6 number, 2 percent-flavored number,
  2 map. Map answers need verified lat/lng.
- Titles follow the house style: the prompt inverted into a noun
  phrase ("Keys are on a standard full-size piano").
- No `hint` field. No duplicate prompts, no near-duplicates (same fact,
  different wording).
