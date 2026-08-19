/* ========================================================================
   game.js — screens, keyboard rendering, scoring and the challenge timer
   ======================================================================== */

(() => {
  const state = {
    mode: null,
    song: null,
    index: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    correct: 0,
    attempts: 0,
    instrument: 'piano',
    bestScore: 0,
    challengeTimer: null,
    keyboardRendered: false,
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', () => {
    els.menuScreen = document.getElementById('menuScreen');
    els.gameScreen = document.getElementById('gameScreen');
    els.resultsScreen = document.getElementById('resultsScreen');
    els.keyboard = document.getElementById('keyboard');
    els.upcomingNotes = document.getElementById('upcomingNotes');
    els.feedback = document.getElementById('feedback');
    els.nowPlaying = document.getElementById('nowPlaying');
    els.score = document.getElementById('score');
    els.combo = document.getElementById('combo');
    els.accuracy = document.getElementById('accuracy');
    els.level = document.getElementById('level');
    els.volumeControl = document.getElementById('volumeControl');
    els.bestScoreDisplay = document.getElementById('bestScoreDisplay');
    els.instrumentSelect = document.getElementById('instrumentSelect');

    renderKeyboard();
    bindComputerKeyboard();

    els.volumeControl.addEventListener('input', (e) => {
      AudioEngine.setVolume(Number(e.target.value));
    });
  });

  /* ---------------- Keyboard rendering ---------------- */

  function renderKeyboard() {
    if (state.keyboardRendered) return;
    els.keyboard.innerHTML = '';

    const whiteKeys = KEYBOARD_KEYS.filter((k) => !k.isSharp);
    const blackKeys = KEYBOARD_KEYS.filter((k) => k.isSharp);
    const whiteWidthPercent = 100 / whiteKeys.length;
    const blackWidthPercent = 6.4;
    const offsetWithinOctave = { 'C#': 0.7, 'D#': 1.75, 'F#': 3.65, 'G#': 4.7, 'A#': 5.75 };

    whiteKeys.forEach((k) => {
      const btn = document.createElement('button');
      btn.className = 'key white';
      btn.dataset.id = k.id;
      btn.dataset.note = k.note;
      btn.dataset.octave = k.octave;
      btn.innerHTML = `<span class="key-label">${k.note}</span>`;
      els.keyboard.appendChild(btn);
    });

    blackKeys.forEach((k) => {
      const baseWhiteIndex = (k.octave - 4) * 7;
      const leftPercent = (baseWhiteIndex + offsetWithinOctave[k.note]) * whiteWidthPercent - blackWidthPercent / 2;
      const btn = document.createElement('button');
      btn.className = 'key black';
      btn.dataset.id = k.id;
      btn.dataset.note = k.note;
      btn.dataset.octave = k.octave;
      btn.style.left = `${leftPercent}%`;
      els.keyboard.appendChild(btn);
    });

    els.keyboard.querySelectorAll('.key').forEach((keyEl) => {
      const trigger = () => pressKey(keyEl.dataset.note, Number(keyEl.dataset.octave), keyEl);
      keyEl.addEventListener('mousedown', trigger);
      keyEl.addEventListener('touchstart', (e) => { e.preventDefault(); trigger(); }, { passive: false });
    });

    state.keyboardRendered = true;
  }

  function bindComputerKeyboard() {
    const held = new Set();
    window.addEventListener('keydown', (e) => {
      if (!els.gameScreen.classList.contains('active')) return;
      const key = e.key.toLowerCase();
      if (held.has(key)) return;
      const target = KEY_BINDINGS[key];
      if (!target) return;
      held.add(key);
      const note = target.slice(0, -1);
      const octave = Number(target.slice(-1));
      const keyEl = els.keyboard.querySelector(`[data-id="${target}"]`);
      pressKey(note, octave, keyEl);
    });
    window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
  }

  /* ---------------- Screen management ---------------- */

  function showScreen(name) {
    [els.menuScreen, els.gameScreen, els.resultsScreen].forEach((s) => s.classList.remove('active'));
    ({ menu: els.menuScreen, game: els.gameScreen, results: els.resultsScreen })[name].classList.add('active');
  }

  window.startGame = function startGame(mode) {
    AudioEngine.ensureContext();
    clearTimeout(state.challengeTimer);

    state.mode = mode;
    state.index = 0;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.correct = 0;
    state.attempts = 0;

    if (mode === 'freestyle') {
      state.song = null;
      els.nowPlaying.textContent = 'Freestyle — play anything';
      els.upcomingNotes.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;padding-left:80px;">No score here. Just enjoy the keys.</p>';
    } else if (mode === 'challenge') {
      state.song = generateChallengeSong(24);
      els.nowPlaying.textContent = `${state.song.title} — ${state.song.origin}`;
      renderUpcoming();
      armChallengeTimer();
    } else {
      const pool = SONGS[mode];
      state.song = pool[Math.floor(Math.random() * pool.length)];
      els.nowPlaying.textContent = `${state.song.title} — ${state.song.origin}`;
      renderUpcoming();
    }

    updateStatsDisplay();
    showScreen('game');
  };

  window.backToMenu = function backToMenu() {
    clearTimeout(state.challengeTimer);
    els.bestScoreDisplay.textContent = state.bestScore;
    showScreen('menu');
  };

  window.replaySong = function replaySong() {
    startGame(state.mode);
  };

  window.changeInstrument = function changeInstrument(value) {
    state.instrument = value;
  };

  /* ---------------- Note track ---------------- */

  function renderUpcoming() {
    els.upcomingNotes.innerHTML = '';
    const upcoming = state.song.notes.slice(state.index, state.index + 7);
    upcoming.forEach((n, i) => {
      const chip = document.createElement('div');
      chip.className = `note-chip${n.note.includes('#') ? ' sharp' : ''}${i === 0 ? ' is-next' : ''}`;
      chip.textContent = `${n.note}${n.octave}`;
      chip.dataset.slot = i;
      els.upcomingNotes.appendChild(chip);
    });
    if (upcoming.length === 0) {
      els.upcomingNotes.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding-left:80px;">Song complete 🎉</p>';
    }
  }

  function flashChip(hit) {
    const chip = els.upcomingNotes.querySelector('[data-slot="0"]');
    if (chip) chip.classList.add(hit ? 'hit' : 'miss');
  }

  /* ---------------- Playing & scoring ---------------- */

  function pressKey(note, octave, keyEl) {
    if (keyEl) {
      keyEl.classList.add('pressed');
      setTimeout(() => keyEl.classList.remove('pressed'), 120);
    }
    AudioEngine.playNote(state.instrument, noteFrequency(note, octave), 0.55);

    if (state.mode === 'freestyle' || !state.song || state.index >= state.song.notes.length) return;

    const expected = state.song.notes[state.index];
    const isMatch = expected.note === note && expected.octave === octave;
    registerAttempt(isMatch, keyEl);
  }

  function registerAttempt(isMatch, keyEl) {
    state.attempts += 1;

    if (isMatch) {
      state.correct += 1;
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      const multiplier = 1 + Math.floor(state.combo / 5);
      state.score += 10 * multiplier;
      showFeedback(state.combo >= 5 ? 'Perfect!' : 'Good', state.combo >= 5 ? 'perfect' : 'good');
      if (keyEl) keyEl.classList.add(keyEl.classList.contains('black') ? 'correct-flash' : 'correct-flash');
      flashChip(true);
      advanceNote();
    } else {
      state.combo = 0;
      showFeedback('Miss', 'miss');
      if (keyEl) keyEl.classList.add('wrong-flash');
      flashChip(false);
      if (state.mode === 'challenge') advanceNote(); // challenge doesn't wait for retries
    }

    if (keyEl) setTimeout(() => keyEl.classList.remove('correct-flash', 'wrong-flash'), 350);
    updateStatsDisplay();
  }

  function advanceNote() {
    clearTimeout(state.challengeTimer);
    state.index += 1;
    if (state.index >= state.song.notes.length) {
      finishSong();
      return;
    }
    renderUpcoming();
    if (state.mode === 'challenge') armChallengeTimer();
  }

  function armChallengeTimer() {
    clearTimeout(state.challengeTimer);
    const windowMs = Math.max(500, state.song.tempo * 2.2);
    state.challengeTimer = setTimeout(() => {
      registerAttempt(false, null);
    }, windowMs);
  }

  function showFeedback(text, cls) {
    els.feedback.textContent = text;
    els.feedback.className = `feedback ${cls}`;
    setTimeout(() => { els.feedback.textContent = ''; els.feedback.className = 'feedback'; }, 500);
  }

  function updateStatsDisplay() {
    els.score.textContent = state.score;
    els.combo.textContent = state.combo;
    const acc = state.attempts === 0 ? 100 : Math.round((state.correct / state.attempts) * 100);
    els.accuracy.textContent = `${acc}%`;
    els.level.textContent = 1 + Math.floor(state.correct / 8);
  }

  /* ---------------- Results ---------------- */

  function finishSong() {
    clearTimeout(state.challengeTimer);
    if (state.score > state.bestScore) state.bestScore = state.score;

    const acc = state.attempts === 0 ? 100 : Math.round((state.correct / state.attempts) * 100);
    document.getElementById('finalScore').textContent = state.score;
    document.getElementById('finalAccuracy').textContent = `${acc}%`;
    document.getElementById('maxCombo').textContent = state.maxCombo;
    document.getElementById('totalNotes').textContent = state.song.notes.length;

    let message = 'Keep practicing those keys.';
    if (acc >= 95) message = 'Flawless. That was a real performance.';
    else if (acc >= 80) message = 'Strong technique — very listenable.';
    else if (acc >= 60) message = 'Getting there. One more take?';

    document.getElementById('resultsTitle').textContent = state.song.title;
    document.getElementById('resultMessage').textContent = message;
    showScreen('results');
  }
})();
