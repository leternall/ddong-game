// ===== 기억력 게임 (카드 뒤집어 짝 맞추기) =====

const hud = document.getElementById("hud");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const timerEl = document.getElementById("timer");
const mistakesEl = document.getElementById("mistakes");
const pauseBtn = document.getElementById("pauseBtn");

const board = document.getElementById("board");

const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("startBtn");

const pauseScreen = document.getElementById("pause-screen");
const pauseContinueBtn = document.getElementById("pauseContinueBtn");
const pauseRestartBtn = document.getElementById("pauseRestartBtn");
const pauseHomeBtn = document.getElementById("pauseHomeBtn");

const resultScreen = document.getElementById("result-screen");
const resultTitleEl = document.getElementById("resultTitle");
const resultDetailEl = document.getElementById("resultDetail");
const rankMessageEl = document.getElementById("rankMessage");
const rankingListEl = document.getElementById("rankingList");
const restartBtn = document.getElementById("restartBtn");

const levelupToast = document.getElementById("levelup-toast");

const RANKING_KEY = "gieokryeok-rankings";
const PAUSE_BUTTON_UNLOCK_DELAY = 400;
const MAX_MISTAKES_PER_LEVEL = 20;

// ---------- 64종 카드 풀 ----------
// 01~08번: 똥피하기 캐릭터 이미지를 그대로 재사용합니다(에셋 중복 없이 상대경로로 참조).
// 09~64번: 귀여운 동물 이모지 56종.
const CHARACTER_IMAGE_SRCS = [
  "../0001-ddong-pihagi/assets/character_girl.png",
  "../0001-ddong-pihagi/assets/character_magpie.png",
  "../0001-ddong-pihagi/assets/character_purple.png",
  "../0001-ddong-pihagi/assets/character_panda.png",
  "../0001-ddong-pihagi/assets/character_cotton.png",
  "../0001-ddong-pihagi/assets/character_dog.png",
  "../0001-ddong-pihagi/assets/character_tiger.png",
  "../0001-ddong-pihagi/assets/character_dragon.png",
];

const ANIMAL_EMOJIS = [
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
  "🦁", "🐮", "🐷", "🦦", "🐸", "🐵", "🙈", "🙉", "🙊", "🐔",
  "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦉", "🦇", "🐺", "🐗",
  "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐢", "🦎", "🐙",
  "🦑", "🦐", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦓",
  "🐘", "🦒", "🐐", "🐑", "🐿️", "🦔",
];

const CHARACTER_POOL = [
  ...CHARACTER_IMAGE_SRCS.map((src, i) => ({
    no: String(i + 1).padStart(2, "0"),
    type: "img",
    src,
  })),
  ...ANIMAL_EMOJIS.map((emoji, i) => ({
    no: String(i + 9).padStart(2, "0"),
    type: "emoji",
    emoji,
  })),
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- 게임 상태 ----------
let running = false;
let paused = false;
let sessionPool = [];
let poolIndex = 0;
let level = 1;
let score = 0;
let wrongThisLevel = 0;
let matchedThisLevel = 0;
let levelPairs = 0;
let boardLocked = false;
let firstCard = null;
let secondCard = null;

let elapsedMs = 0;
let segmentStart = null;
let timerInterval = null;
let pauseUnlockTimer = null;

function currentElapsed() {
  return elapsedMs + (segmentStart ? Date.now() - segmentStart : 0);
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startTimerInterval() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerEl.textContent = formatTime(currentElapsed());
  }, 250);
}

function updateHud() {
  scoreEl.textContent = `점수: ${score}`;
  levelEl.textContent = `레벨: ${level}`;
  mistakesEl.textContent = `실수: ${wrongThisLevel}/${MAX_MISTAKES_PER_LEVEL}`;
}

function showLevelUpToast(text) {
  levelupToast.textContent = text;
  levelupToast.classList.remove("hidden");
  requestAnimationFrame(() => levelupToast.classList.add("show"));
  clearTimeout(showLevelUpToast._t);
  showLevelUpToast._t = setTimeout(() => {
    levelupToast.classList.remove("show");
    setTimeout(() => levelupToast.classList.add("hidden"), 250);
  }, 1200);
}

// ---------- 보드 구성 ----------
function buildBoard(characters) {
  let cards = [];
  characters.forEach((c, idx) => {
    cards.push({ charIndex: idx, ...c });
    cards.push({ charIndex: idx, ...c });
  });
  cards = shuffle(cards);

  const cols = cards.length <= 4 ? 2 : 4;
  board.style.setProperty("--cols", cols);
  board.innerHTML = "";

  cards.forEach((card) => {
    const el = document.createElement("div");
    el.className = "card";

    const inner = document.createElement("div");
    inner.className = "card-inner";

    const back = document.createElement("div");
    back.className = "card-face card-back";
    back.textContent = "❓";

    const front = document.createElement("div");
    front.className = "card-face card-front";
    if (card.type === "img") {
      const img = document.createElement("img");
      img.src = card.src;
      front.appendChild(img);
    } else {
      front.textContent = card.emoji;
    }

    inner.appendChild(back);
    inner.appendChild(front);
    el.appendChild(inner);

    el.addEventListener("click", () => onCardClick(el, card));
    board.appendChild(el);
  });
}

function onCardClick(el, card) {
  if (!running || paused || boardLocked) return;
  if (el.classList.contains("flipped") || el.classList.contains("matched")) return;

  el.classList.add("flipped");

  if (!firstCard) {
    firstCard = { el, card };
    return;
  }

  secondCard = { el, card };
  boardLocked = true;

  const isMatch = firstCard.card.charIndex === secondCard.card.charIndex;
  if (isMatch) {
    const a = firstCard;
    const b = secondCard;
    setTimeout(() => {
      a.el.classList.add("matched");
      b.el.classList.add("matched");
      score += 10;
      matchedThisLevel++;
      updateHud();
      firstCard = null;
      secondCard = null;
      boardLocked = false;

      if (matchedThisLevel === levelPairs) {
        onLevelClear();
      }
    }, 250);
  } else {
    wrongThisLevel++;
    updateHud();
    const a = firstCard;
    const b = secondCard;
    setTimeout(() => {
      a.el.classList.remove("flipped");
      b.el.classList.remove("flipped");
      firstCard = null;
      secondCard = null;
      boardLocked = false;

      if (wrongThisLevel > MAX_MISTAKES_PER_LEVEL) {
        endGame(false);
      }
    }, 800);
  }
}

// ---------- 레벨/게임 진행 ----------
function startLevel() {
  const remaining = CHARACTER_POOL.length - poolIndex;
  const desiredPairs = level * 2;
  levelPairs = Math.min(desiredPairs, remaining);
  const chosen = sessionPool.slice(poolIndex, poolIndex + levelPairs);
  poolIndex += levelPairs;

  wrongThisLevel = 0;
  matchedThisLevel = 0;
  boardLocked = false;
  firstCard = null;
  secondCard = null;

  updateHud();
  buildBoard(chosen);
}

function onLevelClear() {
  if (poolIndex >= CHARACTER_POOL.length) {
    endGame(true);
    return;
  }
  level++;
  showLevelUpToast(`레벨 ${level}!`);
  updateHud();
  setTimeout(() => {
    if (running && !paused) startLevel();
  }, 500);
}

// ---------- 일시정지 ----------
function togglePause() {
  if (!running) return;
  paused = !paused;
  clearTimeout(pauseUnlockTimer);
  if (paused) {
    elapsedMs = currentElapsed();
    segmentStart = null;
    pauseBtn.classList.add("hidden");
    pauseScreen.classList.remove("hidden");
    pauseScreen.classList.add("locked");
    pauseUnlockTimer = setTimeout(() => {
      pauseScreen.classList.remove("locked");
    }, PAUSE_BUTTON_UNLOCK_DELAY);
  } else {
    segmentStart = Date.now();
    pauseScreen.classList.remove("locked");
    pauseScreen.classList.add("hidden");
    pauseBtn.classList.remove("hidden");
  }
}

pauseBtn.addEventListener("click", togglePause);
pauseContinueBtn.addEventListener("click", togglePause);
pauseRestartBtn.addEventListener("click", () => {
  startGame();
});
pauseHomeBtn.addEventListener("click", () => {
  location.href = "../../index.html";
});

// ---------- 랭킹 ----------
function loadRuns() {
  try {
    return JSON.parse(localStorage.getItem(RANKING_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function compareRuns(a, b) {
  if (a.cleared !== b.cleared) return a.cleared ? -1 : 1;
  if (a.cleared) return a.timeMs - b.timeMs;
  return b.score - a.score;
}

function saveRunAndGetRank(run) {
  const runs = loadRuns();
  runs.push(run);
  runs.sort(compareRuns);
  const rank = runs.findIndex((r) => r.ts === run.ts) + 1;
  const trimmed = runs.slice(0, 50);
  localStorage.setItem(RANKING_KEY, JSON.stringify(trimmed));
  return { rank, runs: trimmed, ts: run.ts };
}

function formatRunLabel(r) {
  return r.cleared ? `${formatTime(r.timeMs)} 클리어` : `${r.score}점`;
}

function renderRanking(rankInfo) {
  const { rank, runs, ts } = rankInfo;
  rankMessageEl.textContent = `역대 ${rank}위!`;

  rankingListEl.innerHTML = "";
  const heading = document.createElement("h2");
  heading.textContent = "🏆 랭킹 TOP 5";
  rankingListEl.appendChild(heading);

  const ol = document.createElement("ol");
  const top = runs.slice(0, 5);
  top.forEach((r, i) => {
    const li = document.createElement("li");
    if (r.ts === ts) li.classList.add("me");
    li.innerHTML = `<span>${i + 1}위</span><span>${formatRunLabel(r)}</span>`;
    ol.appendChild(li);
  });

  if (rank > 5) {
    const li = document.createElement("li");
    li.classList.add("me");
    li.innerHTML = `<span>${rank}위</span><span>${formatRunLabel(runs[rank - 1])} (내 기록)</span>`;
    ol.appendChild(li);
  }

  rankingListEl.appendChild(ol);
}

// ---------- 시작/종료 ----------
function startGame() {
  sessionPool = shuffle(CHARACTER_POOL);
  poolIndex = 0;
  level = 1;
  score = 0;
  paused = false;
  elapsedMs = 0;
  segmentStart = Date.now();
  running = true;

  startScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  pauseBtn.classList.remove("hidden");

  updateHud();
  timerEl.textContent = formatTime(0);
  startTimerInterval();
  startLevel();
}

function endGame(cleared) {
  running = false;
  clearInterval(timerInterval);
  if (segmentStart) {
    elapsedMs += Date.now() - segmentStart;
    segmentStart = null;
  }
  hud.classList.add("hidden");

  const run = { cleared, timeMs: elapsedMs, score, ts: Date.now() };
  const rankInfo = saveRunAndGetRank(run);

  resultTitleEl.textContent = cleared ? "🎉 클리어! 🎉" : "게임 오버!";
  resultDetailEl.textContent = cleared
    ? `클리어 시간: ${formatTime(elapsedMs)} (점수: ${score})`
    : `점수: ${score} (도달 레벨: ${level})`;
  renderRanking(rankInfo);

  resultScreen.classList.remove("hidden");
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
  resultScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
});
