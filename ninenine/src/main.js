import './style.css'

// --- State & Config ---
const INITIAL_LIVES = 10;
const SECONDS_PER_QUESTION = 8;

let state = {
  score: 0,
  lives: INITIAL_LIVES,
  timeLeft: SECONDS_PER_QUESTION,
  timerInterval: null,
  currentQuestion: { a: 0, b: 0, ans: 0 },
  isPlaying: false,
  isMuted: false,
  gameMode: 'endless',
  currentStage: 1,
  highestStage: parseInt(localStorage.getItem('ninenine_highest_stage')) || 1,
  progress: 0,
  targetScore: 0,
  isBossStage: false
};

let shopData = {
  stars: parseInt(localStorage.getItem('ninenine_stars')) || 0,
  plus5Sec: parseInt(localStorage.getItem('ninenine_plus5')) || 0,
  removeWrong: parseInt(localStorage.getItem('ninenine_remove_wrong')) || 0,
  healCard: parseInt(localStorage.getItem('ninenine_heal_card')) || 0,
  avatarOwned: JSON.parse(localStorage.getItem('ninenine_avatar_owned')) || ['hair_0', 'eyes_0', 'nose_0', 'mouth_0'],
  avatarEquipped: JSON.parse(localStorage.getItem('ninenine_avatar_equipped')) || { hair: 'hair_0', eyes: 'eyes_0', nose: 'nose_0', mouth: 'mouth_0', accessory: null }
};

const avatarCatalog = {
  hair: [
    { id: 'hair_0', emoji: '', name: '光頭', price: 0 },
    { id: 'hair_1', emoji: '🧢', name: '棒球帽', price: 50 },
    { id: 'hair_2', emoji: '🎩', name: '魔術帽', price: 100 },
    { id: 'hair_3', emoji: '👑', name: '皇冠', price: 300 }
  ],
  eyes: [
    { id: 'eyes_0', emoji: '👀', name: '基本眼', price: 0 },
    { id: 'eyes_1', emoji: '🕶️', name: '墨鏡', price: 80 },
    { id: 'eyes_2', emoji: '✨', name: '星星眼', price: 150 },
    { id: 'eyes_3', emoji: '💧', name: '水汪汪', price: 200 }
  ],
  nose: [
    { id: 'nose_0', emoji: '👃', name: '基本鼻', price: 0 },
    { id: 'nose_1', emoji: '🐽', name: '豬鼻', price: 50 },
    { id: 'nose_2', emoji: '🤡', name: '小丑鼻', price: 100 }
  ],
  mouth: [
    { id: 'mouth_0', emoji: '👄', name: '基本嘴', price: 0 },
    { id: 'mouth_1', emoji: '👅', name: '吐舌', price: 50 },
    { id: 'mouth_2', emoji: '💋', name: '烈焰紅唇', price: 100 },
    { id: 'mouth_3', emoji: 'O', name: '大笑', price: 150 }
  ],
  accessory: [
    { id: 'acc_1', emoji: '🎀', name: '蝴蝶結', price: 150 },
    { id: 'acc_2', emoji: '🎧', name: '耳機', price: 250 },
    { id: 'acc_3', emoji: '💫', name: '閃亮亮', price: 400 }
  ]
};

function saveShopData() {
  localStorage.setItem('ninenine_stars', shopData.stars);
  localStorage.setItem('ninenine_plus5', shopData.plus5Sec);
  localStorage.setItem('ninenine_remove_wrong', shopData.removeWrong);
  localStorage.setItem('ninenine_heal_card', shopData.healCard);
  localStorage.setItem('ninenine_avatar_owned', JSON.stringify(shopData.avatarOwned));
  localStorage.setItem('ninenine_avatar_equipped', JSON.stringify(shopData.avatarEquipped));
  localStorage.setItem('ninenine_highest_stage', state.highestStage);
}

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
  end: document.getElementById('end-screen'),
  shop: document.getElementById('shop-screen'),
  avatarShop: document.getElementById('avatar-shop-screen'),
  stageSelect: document.getElementById('stage-select-screen'),
  stageClear: document.getElementById('stage-clear-screen')
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
  endGameBtn: document.getElementById('end-game-btn'),
  muteBtn: document.getElementById('mute-btn'),
  muteIcon: document.getElementById('mute-icon'),
  shopBtnStart: document.getElementById('shop-btn-start'),
  shopBtnEnd: document.getElementById('shop-btn-end'),
  avatarShopBtnEnd: document.getElementById('avatar-shop-btn-end'),
  shopBackBtn: document.getElementById('shop-back-btn'),
  shopStars: document.getElementById('shop-stars'),
  buyPlus5Btn: document.getElementById('buy-plus5-btn'),
  inventoryPlus5: document.getElementById('inventory-plus5'),
  usePlus5Btn: document.getElementById('use-plus5-btn'),
  gameInventoryPlus5: document.getElementById('game-inventory-plus5'),
  buyRemoveWrongBtn: document.getElementById('buy-remove-wrong-btn'),
  inventoryRemoveWrong: document.getElementById('inventory-remove-wrong'),
  useRemoveWrongBtn: document.getElementById('use-remove-wrong-btn'),
  gameInventoryRemoveWrong: document.getElementById('game-inventory-remove-wrong'),
  buyHealBtn: document.getElementById('buy-heal-btn'),
  inventoryHeal: document.getElementById('inventory-heal'),
  useHealBtn: document.getElementById('use-heal-btn'),
  gameInventoryHeal: document.getElementById('game-inventory-heal'),
  // Avatar UI
  avatarShopBtn: document.getElementById('avatar-shop-btn'),
  avatarShopBackBtn: document.getElementById('avatar-shop-back-btn'),
  avatarShopStars: document.getElementById('avatar-shop-stars'),
  mainAvatar: document.getElementById('main-avatar'),
  previewAvatar: document.getElementById('preview-avatar'),
  avatarTabs: document.querySelectorAll('.avatar-tab'),
  avatarItemsGrid: document.getElementById('avatar-items-grid'),
  // Adventure Mode
  stageSelectBtn: document.getElementById('stage-select-btn'),
  stageSelectBackBtn: document.getElementById('stage-select-back-btn'),
  stagesGrid: document.getElementById('stages-grid'),
  stageSelectStars: document.getElementById('stage-select-stars'),
  adventureUi: document.getElementById('adventure-ui'),
  normalProgress: document.getElementById('normal-progress'),
  bossProgress: document.getElementById('boss-progress'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  bossIcon: document.getElementById('boss-icon'),
  bossHpFill: document.getElementById('boss-hp-fill'),
  bossHpText: document.getElementById('boss-hp-text'),
  stageClearStarsDisplay: document.getElementById('stage-clear-stars-display'),
  nextStageBtn: document.getElementById('next-stage-btn'),
  backToStagesBtn: document.getElementById('back-to-stages-btn'),
  stageClearShopBtn: document.getElementById('stage-clear-shop-btn'),
  scoreBoxContainer: document.getElementById('score-box-container')
};

// --- Game Logic ---

function init() {
  dom.startBtn.addEventListener('click', startEndless);
  dom.stageSelectBtn.addEventListener('click', openStageSelect);
  dom.stageSelectBackBtn.addEventListener('click', () => switchScreen('start'));
  dom.nextStageBtn.addEventListener('click', () => startStage(state.currentStage + 1));
  dom.backToStagesBtn.addEventListener('click', openStageSelect);
  
  dom.restartBtn.addEventListener('click', () => {
    if (state.gameMode === 'adventure') {
      startStage(state.currentStage);
    } else {
      startEndless();
    }
  });
  dom.endGameBtn.addEventListener('click', endGame);
  dom.muteBtn.addEventListener('click', toggleMute);

  // Shop listeners
  dom.shopBtnStart.addEventListener('click', openShop);
  dom.shopBtnEnd.addEventListener('click', openShop);
  dom.stageClearShopBtn.addEventListener('click', () => {
    updateAvatarShopUI();
    const activeTab = document.querySelector('.avatar-tab.active') || dom.avatarTabs[0];
    renderAvatarGrid(activeTab.dataset.category);
    renderAvatar(dom.previewAvatar);
    switchScreen('avatarShop');
  });
  dom.shopBackBtn.addEventListener('click', () => switchScreen('start'));
  dom.buyPlus5Btn.addEventListener('click', buyPlus5);
  dom.buyRemoveWrongBtn.addEventListener('click', buyRemoveWrong);
  dom.buyHealBtn.addEventListener('click', buyHealCard);

  // Game item listener
  dom.usePlus5Btn.addEventListener('click', usePlus5);
  dom.useRemoveWrongBtn.addEventListener('click', useRemoveWrong);
  dom.useHealBtn.addEventListener('click', useHealCard);

  // Avatar listeners
  dom.avatarShopBtn.addEventListener('click', openAvatarShop);
  dom.avatarShopBtnEnd.addEventListener('click', openAvatarShop);
  dom.avatarShopBackBtn.addEventListener('click', () => {
    switchScreen('start');
    renderAvatar(dom.mainAvatar); // Re-render main menu avatar when leaving shop
  });

  dom.avatarTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      dom.avatarTabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      renderAvatarGrid(e.target.dataset.category);
    });
  });

  updateShopUI();
  renderAvatar(dom.mainAvatar);
}

function openShop() {
  updateShopUI();
  switchScreen('shop');
}

function openAvatarShop() {
  updateAvatarShopUI();
  // Ensure the active tab renders correctly
  const activeTab = document.querySelector('.avatar-tab.active');
  renderAvatarGrid(activeTab.dataset.category);
  renderAvatar(dom.previewAvatar);
  switchScreen('avatarShop');
}

function updateShopUI() {
  dom.shopStars.textContent = shopData.stars;
  dom.inventoryPlus5.textContent = shopData.plus5Sec;
  dom.inventoryRemoveWrong.textContent = shopData.removeWrong;
  dom.inventoryHeal.textContent = shopData.healCard;
  dom.buyPlus5Btn.disabled = shopData.stars < 50;
  dom.buyRemoveWrongBtn.disabled = shopData.stars < 80;
  dom.buyHealBtn.disabled = shopData.stars < 100;
}

function buyPlus5() {
  // Ensure audio context is active
  if (audioCtx.state === 'suspended') audioCtx.resume();

  if (shopData.stars >= 50) {
    shopData.stars -= 50;
    shopData.plus5Sec += 1;
    saveShopData();
    updateShopUI();
    audio.correct();
  }
}

function buyRemoveWrong() {
  if (audioCtx.state === 'suspended') audioCtx.resume();

  if (shopData.stars >= 80) {
    shopData.stars -= 80;
    shopData.removeWrong += 1;
    saveShopData();
    updateShopUI();
    audio.correct();
  }
}

function buyHealCard() {
  if (audioCtx.state === 'suspended') audioCtx.resume();

  if (shopData.stars >= 100) {
    shopData.stars -= 100;
    shopData.healCard += 1;
    saveShopData();
    updateShopUI();
    audio.correct();
  }
}

function usePlus5() {
  if (!state.isPlaying || state.timeLeft <= 0) return;
  if (shopData.plus5Sec > 0) {
    shopData.plus5Sec -= 1;
    saveShopData();
    state.timeLeft += 5; // Add 5 seconds
    updateHUD();
    updateGameInventoryUI();
    audio.correct(); // Provide feedback
    triggerFeedback(dom.timer.parentElement, 'pulse'); // use parent to avoid moving text randomly
  }
}

function useRemoveWrong() {
  if (!state.isPlaying || state.timeLeft <= 0) return;
  if (shopData.removeWrong > 0) {
    const optionBtns = Array.from(dom.optionsContainer.children);
    const wrongBtns = optionBtns.filter(btn => parseInt(btn.textContent) !== state.currentQuestion.ans && btn.style.opacity !== '0');

    // Randomly hide up to 2 wrong answers
    if (wrongBtns.length > 0) {
      shopData.removeWrong -= 1;
      saveShopData();
      updateGameInventoryUI();
      audio.correct();

      // Shuffle wrong buttons and hide first 2
      wrongBtns.sort(() => Math.random() - 0.5);
      const toRemove = Math.min(2, wrongBtns.length);
      for (let i = 0; i < toRemove; i++) {
        wrongBtns[i].style.opacity = '0';
        wrongBtns[i].style.pointerEvents = 'none';
      }
    }
  }
}

function useHealCard() {
  if (!state.isPlaying || state.timeLeft <= 0) return;
  if (shopData.healCard > 0 && state.lives < INITIAL_LIVES) {
    shopData.healCard -= 1;
    saveShopData();
    state.lives += 1;
    updateHUD();
    updateGameInventoryUI();
    audio.correct(); // Provide feedback
    triggerFeedback(dom.heartsContainer, 'pulse');
  }
}

function updateGameInventoryUI() {
  dom.gameInventoryPlus5.textContent = shopData.plus5Sec;
  dom.gameInventoryRemoveWrong.textContent = shopData.removeWrong;
  dom.gameInventoryHeal.textContent = shopData.healCard;
  dom.usePlus5Btn.disabled = shopData.plus5Sec <= 0;
  dom.useRemoveWrongBtn.disabled = shopData.removeWrong <= 0;
  dom.useHealBtn.disabled = shopData.healCard <= 0 || state.lives >= INITIAL_LIVES;
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  dom.muteIcon.textContent = state.isMuted ? '❌' : '🔊';
  // Resume context on first interaction if needed
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function openStageSelect() {
  dom.stageSelectStars.textContent = shopData.stars;
  renderStageSelect();
  switchScreen('stageSelect');
}

function renderStageSelect() {
  dom.stagesGrid.innerHTML = '';
  // Show up to highest stage + 2, max 20
  const maxDisplay = Math.min(20, Math.max(10, state.highestStage + 2));
  for (let i = 1; i <= maxDisplay; i++) {
    const btn = document.createElement('button');
    const isBoss = i % 5 === 0;
    btn.className = `stage-btn ${isBoss ? 'boss-stage' : ''}`;
    
    if (i <= state.highestStage) {
      btn.textContent = isBoss ? `😈 ${i}` : i;
      btn.onclick = () => startStage(i);
    } else {
      btn.innerHTML = `<span class="lock-icon">🔒</span>`;
      btn.disabled = true;
    }
    dom.stagesGrid.appendChild(btn);
  }
}

function startEndless() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  state.gameMode = 'endless';
  state.score = 0;
  state.lives = INITIAL_LIVES;
  state.timeLeft = SECONDS_PER_QUESTION;
  state.isPlaying = true;

  dom.adventureUi.style.display = 'none';
  dom.scoreBoxContainer.style.display = 'block';

  updateGameInventoryUI();
  updateHUD();
  switchScreen('game');
  generateQuestion();
  audio.start();
  startTimer();
}

function startStage(level) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  state.gameMode = 'adventure';
  state.currentStage = level;
  state.isBossStage = (level % 5 === 0);
  state.progress = 0;
  
  if (state.isBossStage) {
    state.targetScore = 10 + Math.floor(level / 5) * 5; 
  } else {
    state.targetScore = 5 + level; 
  }

  state.score = 0;
  state.lives = INITIAL_LIVES;
  state.timeLeft = SECONDS_PER_QUESTION;
  state.isPlaying = true;

  // Setup UI
  dom.adventureUi.style.display = 'flex';
  dom.scoreBoxContainer.style.display = 'none'; 
  
  if (state.isBossStage) {
    dom.normalProgress.style.display = 'none';
    dom.bossProgress.style.display = 'flex';
    dom.bossIcon.classList.add('shake-infinite');
  } else {
    dom.normalProgress.style.display = 'flex';
    dom.bossProgress.style.display = 'none';
    dom.bossIcon.classList.remove('shake-infinite');
  }

  updateGameInventoryUI();
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

  // Find the correct button to highlight
  const optionBtns = Array.from(dom.optionsContainer.children);
  const correctBtn = optionBtns.find(btn => parseInt(btn.textContent) === state.currentQuestion.ans);
  if (correctBtn) {
    correctBtn.classList.add('correct-highlight');
  }

  // Disable gameplay during delay
  state.isPlaying = false;
  if (state.timerInterval) clearInterval(state.timerInterval);

  setTimeout(() => {
    if (correctBtn) {
      correctBtn.classList.remove('correct-highlight');
    }
    if (state.lives <= 0) {
      endGame();
    } else {
      state.isPlaying = true;
      generateQuestion();
      startTimer();
    }
  }, 2000);
}

function endGame() {
  state.isPlaying = false;
  clearInterval(state.timerInterval);

  audio.gameOver();
  dom.finalScore.textContent = state.score;

  if (state.score > 0) {
    shopData.stars += state.score;
    saveShopData();
  }

  switchScreen('end');
}

function stageCleared() {
  state.isPlaying = false;
  clearInterval(state.timerInterval);
  
  audio.correct(); 
  setTimeout(() => audio.correct(), 200);

  let starsEarned = state.currentStage * 20;
  if (state.isBossStage) starsEarned += 100;
  
  shopData.stars += starsEarned;
  
  if (state.currentStage === state.highestStage) {
    state.highestStage++;
  }
  saveShopData();

  dom.stageClearStarsDisplay.textContent = starsEarned;
  switchScreen('stageClear');
}

function generateQuestion() {
  state.timeLeft = SECONDS_PER_QUESTION;
  
  let a, b;
  if (state.gameMode === 'adventure') {
    let maxDigit = 9;
    let minDigit = 2;
    if (state.currentStage <= 2) {
      maxDigit = 5;
    } else if (state.currentStage >= 10 && !state.isBossStage) {
      minDigit = 4;
      maxDigit = 12;
    }
    a = Math.floor(Math.random() * (maxDigit - minDigit + 1)) + minDigit;
    b = Math.floor(Math.random() * (maxDigit - minDigit + 1)) + minDigit;
  } else {
    a = Math.floor(Math.random() * 8) + 2;
    b = Math.floor(Math.random() * 8) + 2;
  }
  
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
  if (audioCtx.state === 'suspended') audioCtx.resume();

  if (userVal === state.currentQuestion.ans) {
    state.score += 10;
    audio.correct();
    triggerFeedback(btnElement, 'pulse');
    
    if (state.gameMode === 'adventure') {
      state.progress++;
      if (state.isBossStage) {
        triggerFeedback(dom.bossIcon, 'shake');
      }
      updateHUD();
      
      if (state.progress >= state.targetScore) {
        setTimeout(stageCleared, 300);
        return;
      }
    } else {
      updateHUD();
    }

    setTimeout(generateQuestion, 300);
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
  
  if (state.gameMode === 'adventure') {
    if (state.isBossStage) {
      let hpLeft = Math.max(0, state.targetScore - state.progress);
      dom.bossHpText.textContent = `${hpLeft}/${state.targetScore}`;
      dom.bossHpFill.style.width = `${(hpLeft / state.targetScore) * 100}%`;
    } else {
      dom.progressText.textContent = `${Math.min(state.progress, state.targetScore)}/${state.targetScore}`;
      dom.progressFill.style.width = `${(state.progress / state.targetScore) * 100}%`;
    }
  }
  
  renderHearts();
  updateGameInventoryUI();
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

// --- Avatar Logic ---
function updateAvatarShopUI() {
  dom.avatarShopStars.textContent = shopData.stars;
}

function renderAvatar(containerEl) {
  containerEl.innerHTML = '';

  // Render based on equipped items
  const categories = Object.keys(shopData.avatarEquipped);
  categories.forEach(cat => {
    const equippedId = shopData.avatarEquipped[cat];
    if (equippedId) {
      const itemData = avatarCatalog[cat].find(item => item.id === equippedId);
      if (itemData && itemData.emoji) {
        const partEl = document.createElement('div');
        partEl.className = 'avatar-part';
        partEl.dataset.type = cat;
        partEl.textContent = itemData.emoji;
        containerEl.appendChild(partEl);
      }
    }
  });
}

function renderAvatarGrid(category) {
  dom.avatarItemsGrid.innerHTML = '';
  const items = avatarCatalog[category];

  items.forEach(item => {
    const isOwned = shopData.avatarOwned.includes(item.id);
    const isEquipped = shopData.avatarEquipped[category] === item.id;

    const card = document.createElement('div');
    card.className = `avatar-item-card ${isEquipped ? 'equipped' : ''}`;

    card.innerHTML = `
      <div class="avatar-item-preview">${item.emoji || '👤'}</div>
      <div class="avatar-item-name">${item.name}</div>
    `;

    if (!isOwned) {
      card.innerHTML += `<div class="avatar-item-price">${item.price} ⭐</div>`;
      const btn = document.createElement('button');
      btn.className = 'avatar-item-action';
      btn.textContent = '購買';
      btn.disabled = shopData.stars < item.price;
      btn.onclick = () => buyAvatarItem(category, item);
      card.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = `avatar-item-action ${isEquipped ? 'unequip-btn' : 'equip-btn'}`;
      btn.textContent = isEquipped ? '卸下' : '裝備';
      btn.onclick = () => toggleEquipAvatarItem(category, item.id);
      card.appendChild(btn);
    }

    dom.avatarItemsGrid.appendChild(card);
  });
}

function buyAvatarItem(category, item) {
  if (shopData.stars >= item.price) {
    audio.correct();
    shopData.stars -= item.price;
    shopData.avatarOwned.push(item.id);

    // Auto equip if it's the first item bought in that category
    if (!shopData.avatarEquipped[category]) {
      shopData.avatarEquipped[category] = item.id;
    }

    saveShopData();
    updateAvatarShopUI();
    renderAvatarGrid(category);
    renderAvatar(dom.previewAvatar);
  }
}

function toggleEquipAvatarItem(category, itemId) {
  audio.start(); // Using start sound for a neat "click" feedback

  if (shopData.avatarEquipped[category] === itemId) {
    // Unequip
    shopData.avatarEquipped[category] = null;
  } else {
    // Equip
    shopData.avatarEquipped[category] = itemId;
  }

  saveShopData();
  renderAvatarGrid(category);
  renderAvatar(dom.previewAvatar);
}

// Start
init();
