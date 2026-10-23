# Faces — learn people's names from photos (design note)
Added 2026-10-23, from Spencer's slant on the framework work.
GitHub: issue #17 (Faces), #18 (Globe photo steps).

## The idea in one line
A deck is a **roster** — a sports team, a class, a work team — and the game is
the Globe trainer's shape pointed at people instead of countries: study first,
then recognition, then recall, spaced until it sticks.

## Who it's for (Spencer's three cases)
- **Sports teams** — players learning teammates; coaches learning a new squad;
  fans learning a roster (public-figure decks are the only public case).
- **Classes** — the start-of-term problem: a teacher with 30 new faces.
  Also classmates learning each other in week one.
- **Work teams** — new hires learning their org; anyone before a conference,
  offsite, or a big cross-functional meeting. This is also a framework path:
  "Know Your People" (§3D of training-framework.md).

## Round formats (escalating, like Globe's scaffold)
1. **Study card** — photo + name + one fact (position / role / "sits by the
   window, ask her about trail running"). Nobody is quizzed on a person they
   haven't been introduced to.
2. **Name → face** — one name, four photos, tap the right person. (Spencer's format.)
3. **Face → name** — one photo, four names, tap the right name.
4. **Fill in the blank** — one photo, type the name. (Spencer's format.)
   Fuzzy scoring: nickname table (William = Bill = Will), first-name-only
   beginner mode, one-typo tolerance. **This is the mastery format** —
   recognition is guessing-prone; typed recall is proof.
5. **The daily five people** — a roster plays like the Daily Five: 5 people a
   day, mixed formats, missed people resurface in 2 days, mastered = one typed
   recall correct on two different days (the framework spacing engine, §5).

Scoring: keep the house style — 200 per step, 1,000 a round — with typed recall
worth double recognition inside a mixed round (recall is the real skill).

## Data model (extends the question schema)
```
deck:  { id, name, kind: team|class|work|public, ownerId, visibility: private|invite|public }
person:{ id, deckId, name, alsoKnownAs: [], fact, photo: { url, credit? } }
```
Sessions are generated from the deck + the player's per-person spacing state —
no calendar file needed; the deck *is* the content.

## Rules that ship with v1 (not v2, not "later")
- **Human-supplied labels only.** The owner provides photo + name. The system
  does **no** face recognition, face matching, or identification of people in
  photos — not as a feature, not as an assist, not later. It's flashcards,
  not biometrics.
- **Private by default.** Decks are owner/invite only. Public decks only for
  public figures (pro rosters) where photos are already published headshots.
- **Minors:** class decks live in the teacher's account context, sharing off
  by default, and a deck of students is never public or searchable. Photo
  consent is the deck owner's attestation at upload; school deployments
  follow the school's photo policy — the app records who attested and when.
- **Deletion is real**: removing a person removes their photo from storage,
  not just from play.

## The Globe tie-in (issue #18)
Photos cut both ways — the same mechanic strengthens the country trainer:
landmark photo → country (choice), landmark photo → pin it, flag → country,
skyline → capital/second city. Photos come from openly licensed sources
(Wikimedia Commons) with the credit shown, the pattern the game already uses
for the NASA earth texture. Deck records gain `landmark {name, photoUrl,
credit}`; photo steps first appear as variants of Globe steps 1–2 so the
5-step, 1,000-point shape doesn't change.

## Where it lands in the plans
- Consumer backlog: NEXT (issue #17), after accounts (LATER-1) if decks need
  cross-device sync — a single-device v1 on local decks can ship without it.
- Framework: new path §3D "Know Your People" — onboarding trails start with
  your actual team, and the Daily Five's wildcard slot can deal a face.
