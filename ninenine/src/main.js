import './style.css'

// --- State & Config ---
const INITIAL_LIVES = 10;
const SECONDS_PER_QUESTION = 7;

let state = {
  score: 0,
  lives: INITIAL_LIVES,
  timeLeft: SECONDS_PER_QUESTION,
  timerInterval: null,
  currentQuestion: { a: 0, b: 0, ans: 0 },
  isPlaying: false,
  isMuted: false
};

// --- AudioManager ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const playSound = (freq, type, duration, volume = 0.2) => {
  if (state.isMuted) return;

  // Create nodes
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  // Envelope: start at volume, ramp down to near-zero
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
};

const audio = {
  correct: () => {
    playSound(523.25, 'sine', 0.2); // C5
    setTimeout(() => playSound(659.25, 'sine', 0.3), 50); // E5
  },
  wrong: () => {
    playSound(220, 'sawtooth', 0.1); // A3
    playSound(110, 'sawtooth', 0.4); // A2
  },
  start: () => {
    playSound(440, 'sine', 0.1);
    setTimeout(() => playSound(554.37, 'sine', 0.1), 100);
    setTimeout(() => playSound(659.25, 'sine', 0.3), 200);
  },
  gameOver: () => {
    playSound(392, 'square', 0.2, 0.15); // G4
    setTimeout(() => playSound(349.23, 'square', 0.2, 0.15), 200); // F4
    setTimeout(() => playSound(329.63, 'square', 0.4, 0.15), 400); // E4
  }
};

// --- DOM Elements ---
const screens = {
  start: document.getElementById('start-screen'),
  game: document.getElementById('game-screen'),
  end: document.getElementById('end-screen')
};

const dom = {
  timer: document.getElementById('timer'),
  score: document.getElementById('score'),
  num1: document.getElementById('num1'),
  num2: document.getElementById('num2'),
  optionsContainer: document.getElementById('options-container'),
  heartsContainer: document.getElementById('hearts-container'),
  finalScore: document.getElementById('final-score-display'),
  startBtn: document.getElementById('start-btn'),
  restartBtn: document.getElementById('restart-btn'),
  muteBtn: document.getElementById('mute-btn'),
  muteIcon: document.getElementById('mute-icon')
};

// --- Game Logic ---

function init() {
  dom.startBtn.addEventListener('click', startGame);
  dom.restartBtn.addEventListener('click', startGame);
  dom.muteBtn.addEventListener('click', toggleMute);
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  dom.muteIcon.textContent = state.isMuted ? '❌' : '🔊';
  // Resume context on first interaction if needed
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function startGame() {
  // Resume AudioContext on user gesture
  if (audioCtx.state === 'suspended') audioCtx.resume();

  state.score = 0;
  state.lives = INITIAL_LIVES;
  state.timeLeft = SECONDS_PER_QUESTION;
  state.isPlaying = true;

  updateHUD();
  switchScreen('game');
  generateQuestion();

  audio.start();
  startTimer();
}

function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(tick, 1000);
}

function tick() {
  state.timeLeft--;
  updateHUD();

  if (state.timeLeft <= 0) {
    handleWrongAction();
  }
}

function handleWrongAction(btnElement = null) {
  state.lives--;
  updateHUD();
  audio.wrong();

  if (btnElement) {
    triggerFeedback(btnElement, 'wrong');
  } else {
    triggerFeedback(dom.heartsContainer, 'shake');
  }

  if (state.lives <= 0) {
    endGame();
  } else {
    generateQuestion();
  }
}

function endGame() {
  state.isPlaying = false;
  clearInterval(state.timerInterval);

  audio.gameOver();
  dom.finalScore.textContent = state.score;
  switchScreen('end');
}

function generateQuestion() {
  state.timeLeft = SECONDS_PER_QUESTION;
  updateHUD();

  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  const correctAnswer = a * b;

  state.currentQuestion = { a, b, ans: correctAnswer };

  dom.num1.textContent = a;
  dom.num2.textContent = b;

  // Generate Options
  const options = new Set();
  options.add(correctAnswer);

  while (options.size < 4) {
    let distractor;
    const rand = Math.random();
    if (rand < 0.3) {
      distractor = correctAnswer + (Math.floor(Math.random() * 5) - 2);
    } else if (rand < 0.6) {
      distractor = (a + (Math.floor(Math.random() * 3) - 1)) * b;
    } else {
      distractor = (Math.floor(Math.random() * 9) + 1) * (Math.floor(Math.random() * 9) + 1);
    }

    if (distractor > 0 && distractor !== correctAnswer) {
      options.add(distractor);
    }
  }

  const shuffledOptions = Array.from(options).sort(() => Math.random() - 0.5);
  renderOptions(shuffledOptions);
}

function renderOptions(options) {
  dom.optionsContainer.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.onclick = () => checkAnswer(opt, btn);
    dom.optionsContainer.appendChild(btn);
  });
}

function checkAnswer(userVal, btnElement) {
  if (!state.isPlaying) return;

  // Ensure audio context is active
  if (audioCtx.state === 'suspended') audioCtx.resume();

  if (userVal === state.currentQuestion.ans) {
    state.score += 10;
    audio.correct();
    triggerFeedback(btnElement, 'pulse');

    setTimeout(generateQuestion, 300);
    updateHUD();
  } else {
    handleWrongAction(btnElement);
  }
}

function triggerFeedback(el, type) {
  el.classList.remove('shake', 'pulse');
  void el.offsetWidth;
  el.classList.add(type);
}

function updateHUD() {
  dom.timer.textContent = state.timeLeft;
  dom.score.textContent = state.score;
  renderHearts();
}

function renderHearts() {
  dom.heartsContainer.innerHTML = '';
  for (let i = 0; i < INITIAL_LIVES; i++) {
    const heart = document.createElement('span');
    heart.textContent = i < state.lives ? '❤️' : '🖤';
    heart.style.opacity = i < state.lives ? '1' : '0.4';
    heart.style.transition = 'all 0.3s ease';
    dom.heartsContainer.appendChild(heart);
  }
}

function switchScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenName].classList.add('active');
}

// Start
init();
