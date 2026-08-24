// ===== 기억력 게임 (카드 뒤집어 짝 맞추기) =====

const hud = document.getElementById("hud");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const timerEl = document.getElementById("timer");
const mistakesEl = document.getElementById("mistakes");
const pauseBtn = document.getElementById("pauseBtn");

const board = document.getElementById("board");
const countdownEl = document.getElementById("countdown");

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
const MAX_LEVEL = 12;
const BOARD_GAP = 6;

// ---------- 카드 풀 ----------
// 01~08번: 똥피하기 캐릭터 이미지를 그대로 재사용합니다(에셋 중복 없이 상대경로로 참조).
// 09~64번: 귀여운 동물 이모지 56종. 같은 동물의 다른 포즈(원숭이 3종, 병아리 2종,
// 고래 2종)는 중복으로 보이니 하나씩만 남기고 다른 동물로 교체했습니다.
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
  "🦁", "🐮", "🐷", "🦦", "🐸", "🐵", "🦥", "🦭", "🦌", "🐔",
  "🐧", "🐦", "🐤", "🦜", "🦩", "🦆", "🦉", "🦇", "🐺", "🐗",
  "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐢", "🦎", "🐙",
  "🦑", "🦐", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🦡", "🦓",
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
let level = 1;
let score = 0;
let wrongThisLevel = 0;
let matchedThisLevel = 0;
let levelPairs = 0;
let boardLocked = false;
let firstCard = null;
let secondCard = null;
let currentCardCount = 0;

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

// ---------- 보드 칸 크기 계산 ----------
// 카드 수에 맞춰 화면을 스크롤 없이 꽉 채우는 열/행 수와 카드 크기를 구합니다.
function measureBoardBox() {
  const cs = getComputedStyle(board);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  return { w: board.clientWidth - padX, h: board.clientHeight - padY };
}

function computeGridLayout(n, w, h, gap) {
  // 정사각형에 가까운 배치(예: 4장→2x2, 48장→6x8)를 우선하고, 그 열 수가
  // n의 약수라 빈 칸 없이 딱 맞아떨어지면 그걸 씁니다. 딱 맞는 약수가 너무
  // 멀리 떨어져 있으면(찌그러진 격자가 되면) 그냥 정사각형에 가까운 열 수를
  // 그대로 써서 마지막 줄 몇 칸만 비웁니다.
  const idealCols = Math.max(1, Math.round(Math.sqrt(n)));
  let cols = idealCols;
  let bestDist = Infinity;
  for (let c = 1; c <= n; c++) {
    if (n % c !== 0) continue;
    const dist = Math.abs(c - idealCols);
    if (dist < bestDist) {
      bestDist = dist;
      cols = c;
    }
  }
  if (bestDist > 2) cols = idealCols;

  const rows = Math.ceil(n / cols);
  const cellW = (w - (cols - 1) * gap) / cols;
  const cellH = (h - (rows - 1) * gap) / rows;
  return { cols, rows, cellW, cellH };
}

function relayoutBoard() {
  if (!currentCardCount) return;
  const { w, h } = measureBoardBox();
  const layout = computeGridLayout(currentCardCount, w, h, BOARD_GAP);
  board.style.gridTemplateColumns = `repeat(${layout.cols}, ${layout.cellW}px)`;
  board.style.gridTemplateRows = `repeat(${layout.rows}, ${layout.cellH}px)`;
}

window.addEventListener("resize", () => {
  if (running) relayoutBoard();
});
// 인앱 브라우저의 자체 하단 툴바처럼 window resize 이벤트 없이 보이는
// 영역만 바뀌는 경우까지 잡기 위해 visualViewport도 함께 감지합니다.
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    if (running) relayoutBoard();
  });
}

// ---------- 카드 앞/뒷면 표시 ----------
function setFaceContent(faceEl, showFront, card) {
  faceEl.classList.toggle("is-front", showFront);
  faceEl.innerHTML = "";
  if (showFront) {
    if (card.type === "img") {
      const img = document.createElement("img");
      img.src = card.src;
      faceEl.appendChild(img);
    } else {
      faceEl.textContent = card.emoji;
    }
  } else {
    faceEl.textContent = "❓";
  }
}

function animateFlip(el, faceEl, showFront, card) {
  el.classList.add("flipping");
  setTimeout(() => {
    setFaceContent(faceEl, showFront, card);
  }, 150);
  setTimeout(() => {
    el.classList.remove("flipping");
  }, 300);
}

// ---------- 보드 구성 ----------
function buildBoard(characters) {
  let cardsData = [];
  characters.forEach((c, idx) => {
    cardsData.push({ charIndex: idx, ...c });
    cardsData.push({ charIndex: idx, ...c });
  });
  cardsData = shuffle(cardsData);

  currentCardCount = cardsData.length;
  board.innerHTML = "";
  board.appendChild(countdownEl);
  relayoutBoard();

  const cardEls = [];
  cardsData.forEach((card) => {
    const el = document.createElement("div");
    el.className = "card up";

    const face = document.createElement("div");
    face.className = "card-face";
    setFaceContent(face, true, card);

    el.appendChild(face);
    board.appendChild(el);

    el.addEventListener("click", () => onCardClick(el, face, card));
    cardEls.push({ el, face, card });
  });

  return cardEls;
}

function onCardClick(el, faceEl, card) {
  if (!running || paused || boardLocked) return;
  if (el.classList.contains("up") || el.classList.contains("matched")) return;

  el.classList.add("up");
  animateFlip(el, faceEl, true, card);

  if (!firstCard) {
    firstCard = { el, faceEl, card };
    return;
  }

  secondCard = { el, faceEl, card };
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
    }, 400);
  } else {
    wrongThisLevel++;
    updateHud();
    const a = firstCard;
    const b = secondCard;
    setTimeout(() => {
      a.el.classList.remove("up");
      b.el.classList.remove("up");
      animateFlip(a.el, a.faceEl, false, null);
      animateFlip(b.el, b.faceEl, false, null);
      firstCard = null;
      secondCard = null;
      boardLocked = false;

      if (wrongThisLevel > MAX_MISTAKES_PER_LEVEL) {
        endGame(false);
      }
    }, 900);
  }
}

// ---------- 레벨 시작 전 미리보기(3초) ----------
function beginPreview(cardEls) {
  boardLocked = true;
  pauseBtn.classList.add("hidden");

  if (segmentStart) {
    elapsedMs += Date.now() - segmentStart;
    segmentStart = null;
  }

  let count = 3;
  countdownEl.textContent = count;
  countdownEl.classList.remove("hidden");

  const tick = () => {
    count--;
    if (count > 0) {
      countdownEl.textContent = count;
      setTimeout(tick, 1000);
    } else {
      countdownEl.classList.add("hidden");
      cardEls.forEach(({ el, face }) => {
        el.classList.remove("up");
        animateFlip(el, face, false, null);
      });
      showLevelUpToast("Start!");
      boardLocked = false;
      pauseBtn.classList.remove("hidden");
      if (!segmentStart) segmentStart = Date.now();
    }
  };
  setTimeout(tick, 1000);
}

// ---------- 레벨/게임 진행 ----------
function startLevel() {
  levelPairs = level * 2;
  const chosen = shuffle(CHARACTER_POOL).slice(0, levelPairs);

  wrongThisLevel = 0;
  matchedThisLevel = 0;
  firstCard = null;
  secondCard = null;

  updateHud();
  const cardEls = buildBoard(chosen);
  beginPreview(cardEls);
}

function onLevelClear() {
  if (level >= MAX_LEVEL) {
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

// ---------- 뒤로가기 = 일시정지 (0001·0002와 동일한 방식) ----------
// 게임 중 실수로 뒤로가기를 누르면 곧장 허브로 나가는 대신 첫 번째는
// 일시정지로 막아줍니다. 이어하기는 화면의 "계속" 버튼으로 하고, 일시정지
// 상태에서 뒤로가기를 또 누르면 정상적으로 허브로 나갑니다.
//
// 뒤로가기를 계속 반복해서 막으려는 시도(history에 항목을 반복해서
// 다시 심는 것)는 크롬/삼성인터넷 등에서 "못 나가게 막는 사이트"로 보고
// 이후로는 우리가 심어둔 항목을 통째로 무시해버리기 때문에(실제로 확인된
// 동작), 한 번만 막고 더는 다시 심지 않습니다.
let trapArmed = false;

function armBackTrap() {
  if (trapArmed) return;
  history.pushState({ ddongBackTrap: true }, "", location.href);
  trapArmed = true;
}

function clearBackTrap() {
  if (!trapArmed) return;
  trapArmed = false;
  history.back();
}

window.addEventListener("popstate", () => {
  if (trapArmed) {
    trapArmed = false;
    if (running) togglePause();
  }
});

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
  level = 1;
  score = 0;
  paused = false;
  elapsedMs = 0;
  segmentStart = null;
  running = true;

  startScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  hud.classList.remove("hidden");

  updateHud();
  timerEl.textContent = formatTime(0);
  startTimerInterval();
  startLevel();
  armBackTrap();
}

function endGame(cleared) {
  running = false;
  clearBackTrap();
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
