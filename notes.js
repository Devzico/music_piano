/* ========================================================================
   notes.js — pitch math + the song library for every game mode
   ======================================================================== */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI note number -> frequency in Hz (A4 = 69 = 440Hz, equal temperament). */
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** e.g. noteToMidi('C', 4) -> 60 */
function noteToMidi(name, octave) {
  const idx = NOTE_NAMES.indexOf(name);
  return (octave + 1) * 12 + idx;
}

function noteFrequency(name, octave) {
  return midiToFreq(noteToMidi(name, octave));
}

/**
 * The two-octave keyboard the game renders, C4 through B5.
 * Each entry becomes one physical key.
 */
const KEYBOARD_KEYS = (() => {
  const keys = [];
  for (let octave = 4; octave <= 5; octave++) {
    NOTE_NAMES.forEach((name) => {
      keys.push({
        note: name,
        octave,
        isSharp: name.includes('#'),
        id: `${name}${octave}`,
      });
    });
  }
  return keys;
})();

/** Computer-keyboard shortcuts, mapped across the two visible octaves. */
const KEY_BINDINGS = {
  a: 'C4', w: 'C#4', s: 'D4', e: 'D#4', d: 'E4',
  f: 'F4', t: 'F#4', g: 'G4', y: 'G#4', h: 'A4', u: 'A#4', j: 'B4',
  k: 'C5', o: 'C#5', l: 'D5', p: 'D#5', ';': 'E5',
};

/* ---------------------------------------------------------------------
   Song library. `notes` uses relative beat lengths (1 = quarter note).
   Classic & Ode to Joy are public-domain compositions; the folk and
   international entries are traditional melodies with no known author.
   "Nile Nights" is an original piece written for this game.
   --------------------------------------------------------------------- */

function seq(pairs) {
  return pairs.map(([note, octave, beat]) => ({ note, octave, beat: beat || 1 }));
}

const SONGS = {
  classic: [
    {
      title: 'Ode to Joy',
      origin: 'Beethoven, 1824',
      tempo: 480,
      notes: seq([
        ['E', 4], ['E', 4], ['F', 4], ['G', 4],
        ['G', 4], ['F', 4], ['E', 4], ['D', 4],
        ['C', 4], ['C', 4], ['D', 4], ['E', 4],
        ['E', 4, 1.5], ['D', 4, 0.5], ['D', 4, 2],
      ]),
    },
    {
      title: 'Für Elise (opening)',
      origin: 'Beethoven, c.1810',
      tempo: 420,
      notes: seq([
        ['E', 5], ['D#', 5], ['E', 5], ['D#', 5], ['E', 5],
        ['B', 4], ['D', 5], ['C', 5],
        ['A', 4, 2],
      ]),
    },
    {
      title: 'C Major Étude',
      origin: 'Original',
      tempo: 380,
      notes: seq([
        ['C', 4], ['D', 4], ['E', 4], ['F', 4], ['G', 4], ['A', 4], ['B', 4], ['C', 5, 2],
        ['C', 5], ['B', 4], ['A', 4], ['G', 4], ['F', 4], ['E', 4], ['D', 4], ['C', 4, 2],
      ]),
    },
  ],

  folk: [
    {
      title: 'Frère Jacques',
      origin: 'French folk tune',
      tempo: 420,
      notes: seq([
        ['C', 4], ['D', 4], ['E', 4], ['C', 4],
        ['C', 4], ['D', 4], ['E', 4], ['C', 4],
        ['E', 4], ['F', 4], ['G', 4, 2],
        ['E', 4], ['F', 4], ['G', 4, 2],
      ]),
    },
    {
      title: 'Twinkle, Twinkle, Little Star',
      origin: 'Traditional, French melody',
      tempo: 440,
      notes: seq([
        ['C', 4], ['C', 4], ['G', 4], ['G', 4], ['A', 4], ['A', 4], ['G', 4, 2],
        ['F', 4], ['F', 4], ['E', 4], ['E', 4], ['D', 4], ['D', 4], ['C', 4, 2],
      ]),
    },
    {
      title: 'Oh, Susanna',
      origin: 'American folk tune',
      tempo: 400,
      notes: seq([
        ['C', 4], ['D', 4], ['E', 4, 0.5], ['E', 4, 0.5], ['G', 4],
        ['G', 4], ['A', 4], ['G', 4], ['E', 4],
        ['D', 4], ['C', 4, 2],
      ]),
    },
  ],

  international: [
    {
      title: 'Sakura Sakura',
      origin: 'Japan · traditional',
      tempo: 460,
      notes: seq([
        ['A', 4], ['A', 4], ['B', 4], ['C', 5],
        ['C', 5], ['B', 4], ['A', 4], ['B', 4],
        ['C', 5], ['D', 5], ['C', 5], ['B', 4], ['A', 4, 2],
      ]),
    },
    {
      title: 'Auld Lang Syne',
      origin: 'Scotland · traditional',
      tempo: 440,
      notes: seq([
        ['G', 4], ['C', 5], ['C', 5], ['E', 5], ['D', 5], ['C', 5],
        ['D', 5], ['E', 5, 2],
        ['C', 5], ['C', 5], ['E', 5], ['D', 5], ['C', 5, 2],
      ]),
    },
    {
      title: 'Waltzing Matilda',
      origin: 'Australia · traditional',
      tempo: 400,
      notes: seq([
        ['C', 4], ['E', 4], ['G', 4], ['E', 4],
        ['C', 4], ['E', 4], ['D', 4, 2],
        ['E', 4], ['G', 4], ['C', 5], ['G', 4, 2],
      ]),
    },
    {
      title: 'Nile Nights',
      origin: 'Original · Hijaz-scale piece',
      tempo: 420,
      notes: seq([
        ['C', 4], ['C#', 4], ['E', 4], ['F', 4], ['G', 4],
        ['G#', 4], ['B', 4, 0.5], ['C', 5, 1.5],
        ['B', 4], ['G#', 4], ['G', 4], ['F', 4], ['E', 4], ['C#', 4], ['C', 4, 2],
      ]),
    },
  ],

  freestyle: [], // no song — the keyboard just plays

  challenge: [
    {
      title: 'Speed Run I',
      origin: 'Generated',
      tempo: 260,
      notes: seq([
        ['C', 4], ['E', 4], ['G', 4], ['C', 5], ['G', 4], ['E', 4],
        ['D', 4], ['F', 4], ['A', 4], ['D', 5], ['A', 4], ['F', 4],
        ['E', 4], ['G', 4], ['B', 4], ['E', 5], ['B', 4], ['G', 4, 2],
      ]),
    },
  ],
};

/** Builds a randomized challenge run so Challenge mode never repeats. */
function generateChallengeSong(length = 20) {
  const pool = KEYBOARD_KEYS.filter((k) => !k.isSharp || Math.random() < 0.25);
  const notes = [];
  for (let i = 0; i < length; i++) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    notes.push({ note: pick.note, octave: pick.octave, beat: 1 });
  }
  return {
    title: 'Speed Run',
    origin: 'Generated for you',
    tempo: 260,
    notes,
  };
}
