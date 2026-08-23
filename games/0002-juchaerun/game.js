// ===== 쭈채런 게임 =====

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const pauseBtn = document.getElementById("pauseBtn");

const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("startBtn");

const pauseScreen = document.getElementById("pause-screen");
const pauseContinueBtn = document.getElementById("pauseContinueBtn");
const pauseRestartBtn = document.getElementById("pauseRestartBtn");
const pauseHomeBtn = document.getElementById("pauseHomeBtn");

const gameoverScreen = document.getElementById("gameover-screen");
const finalScoreEl = document.getElementById("finalScore");
const rankMessageEl = document.getElementById("rankMessage");
const rankingListEl = document.getElementById("rankingList");
const restartBtn = document.getElementById("restartBtn");

const levelupToast = document.getElementById("levelup-toast");

const RANKING_KEY = "juchaerun-rankings";

// ---------- 캔버스 크기 ----------
let width, height, groundY;
let player, obstacles, distance, score, level, levelFrames, spawnTimer, spawnInterval;
let running, paused = false;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  groundY = height - GROUND_MARGIN;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (player) {
    player.x = width * 0.15;
    if (player.onGround) player.y = groundY - player.h;
  }
}

// ---------- 게임 상수 ----------
const PLAYER_W = 50;
const PLAYER_H = 60;
const GROUND_MARGIN = 60;
const GRAVITY = 0.9;
const JUMP_VELOCITY = -15;
const LEVEL_DURATION_FRAMES = 20 * 60; // 20초 (60fps 기준)
const PAUSE_BUTTON_UNLOCK_DELAY = 400;

window.addEventListener("resize", resize);
resize();

function currentRunSpeed() {
  return 6 + (level - 1) * 0.8;
}

function currentSpawnInterval() {
  return Math.max(45, 110 - (level - 1) * 6);
}

function resetGame() {
  player = {
    x: width * 0.15,
    y: groundY - PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H,
    vy: 0,
    onGround: true,
  };
  obstacles = [];
  distance = 0;
  score = 0;
  level = 1;
  levelFrames = 0;
  spawnTimer = 0;
  spawnInterval = currentSpawnInterval();
  paused = false;
  pauseScreen.classList.add("hidden");
  pauseBtn.classList.remove("hidden");
  updateHud();
}

function updateHud() {
  scoreEl.textContent = `점수: ${score}`;
  levelEl.textContent = `레벨: ${level}`;
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

// ---------- 점프 입력 ----------
function jump() {
  if (!running || paused) return;
  if (player.onGround) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
  }
}

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  jump();
}, { passive: false });

canvas.addEventListener("mousedown", () => {
  jump();
});

window.addEventListener("keydown", (e) => {
  if (e.key === " " || e.code === "Space" || e.key === "ArrowUp" || e.key === "Up") {
    e.preventDefault();
    if (e.repeat) return;
    jump();
  }
});

// ---------- 일시정지 ----------
let pauseUnlockTimer = null;

function togglePause() {
  if (!running) return;
  paused = !paused;
  clearTimeout(pauseUnlockTimer);
  if (paused) {
    cancelAnimationFrame(rafId);
    pauseBtn.classList.add("hidden");
    pauseScreen.classList.remove("hidden");
    pauseScreen.classList.add("locked");
    pauseUnlockTimer = setTimeout(() => {
      pauseScreen.classList.remove("locked");
    }, PAUSE_BUTTON_UNLOCK_DELAY);
  } else {
    pauseScreen.classList.remove("locked");
    pauseScreen.classList.add("hidden");
    pauseBtn.classList.remove("hidden");
    lastTimestamp = null;
    rafId = requestAnimationFrame(loop);
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

// ---------- 장애물 ----------
function spawnObstacle() {
  const h = 30 + Math.random() * 30;
  const w = 22 + Math.random() * 18;
  obstacles.push({ x: width, y: groundY - h, w, h });
}

function isColliding(p, o) {
  const px = p.x + p.w * 0.22;
  const py = p.y + p.h * 0.15;
  const pw = p.w * 0.56;
  const ph = p.h * 0.8;
  return px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y;
}

// ---------- 업데이트 ----------
// dt: 이번 프레임이 "60fps 기준 몇 프레임 치"의 시간이었는지 (1 = 정확히 1/60초).
function update(dt) {
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;
  if (player.y >= groundY - player.h) {
    player.y = groundY - player.h;
    player.vy = 0;
    player.onGround = true;
  }

  const speed = currentRunSpeed();
  distance += speed * dt;
  const newScore = Math.floor(distance / 8);
  if (newScore !== score) {
    score = newScore;
    updateHud();
  }

  levelFrames += dt;
  if (levelFrames >= LEVEL_DURATION_FRAMES) {
    levelFrames = 0;
    level++;
    spawnInterval = currentSpawnInterval();
    showLevelUpToast(`레벨 ${level}!`);
    updateHud();
  }

  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnObstacle();
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= speed * dt;

    if (isColliding(player, o)) {
      endGame();
      return;
    }

    if (o.x + o.w < 0) obstacles.splice(i, 1);
  }
}

// ---------- 그리기 ----------
function drawGround() {
  ctx.fillStyle = "#5d4037";
  ctx.fillRect(0, groundY, width, height - groundY);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(0, groundY, width, 3);
}

function drawPlayer() {
  const p = player;
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = "#42a5f5";
  ctx.fillRect(p.w * 0.1, p.h * 0.15, p.w * 0.8, p.h * 0.5);

  ctx.beginPath();
  ctx.arc(p.w / 2, p.h * 0.12, p.w * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "#ffcc80";
  ctx.fill();

  const cycle = Math.sin(distance * 0.25);
  const legH = p.h * 0.35;
  ctx.fillStyle = "#1565c0";
  if (p.onGround) {
    ctx.fillRect(p.w * 0.18, p.h * 0.65, p.w * 0.22, legH + cycle * 6);
    ctx.fillRect(p.w * 0.6, p.h * 0.65, p.w * 0.22, legH - cycle * 6);
  } else {
    ctx.fillRect(p.w * 0.18, p.h * 0.65, p.w * 0.22, legH * 0.7);
    ctx.fillRect(p.w * 0.6, p.h * 0.65, p.w * 0.22, legH * 0.7);
  }

  ctx.restore();
}

function drawObstacle(o) {
  ctx.fillStyle = "#2e7d32";
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.fillStyle = "#43a047";
  ctx.fillRect(o.x + o.w * 0.15, o.y, o.w * 0.25, o.h);
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  drawGround();
  obstacles.forEach(drawObstacle);
  drawPlayer();
}

// ---------- 루프 ----------
let rafId;
let lastTimestamp = null;
function loop(timestamp) {
  if (!running) return;
  if (lastTimestamp == null) lastTimestamp = timestamp;
  const dt = Math.min(3, (timestamp - lastTimestamp) / (1000 / 60));
  lastTimestamp = timestamp;

  update(dt);
  if (running) {
    draw();
    rafId = requestAnimationFrame(loop);
  }
}

// ---------- 랭킹 ----------
function loadRankings() {
  try {
    return JSON.parse(localStorage.getItem(RANKING_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveScoreAndGetRank(finalScore) {
  const rankings = loadRankings();
  const entry = { score: finalScore, ts: Date.now() };
  rankings.push(entry);
  rankings.sort((a, b) => b.score - a.score || a.ts - b.ts);
  const rank = rankings.findIndex((r) => r.ts === entry.ts) + 1;
  const trimmed = rankings.slice(0, 50);
  localStorage.setItem(RANKING_KEY, JSON.stringify(trimmed));
  return { rank, rankings: trimmed, entryTs: entry.ts };
}

function renderRanking(rankInfo) {
  const { rank, rankings, entryTs } = rankInfo;
  rankMessageEl.textContent = `역대 ${rank}위!`;

  rankingListEl.innerHTML = "";
  const heading = document.createElement("h2");
  heading.textContent = "🏆 랭킹 TOP 5";
  rankingListEl.appendChild(heading);

  const ol = document.createElement("ol");
  const top = rankings.slice(0, 5);
  top.forEach((r, i) => {
    const li = document.createElement("li");
    if (r.ts === entryTs) li.classList.add("me");
    li.innerHTML = `<span>${i + 1}위</span><span>${r.score}점</span>`;
    ol.appendChild(li);
  });

  if (rank > 5) {
    const li = document.createElement("li");
    li.classList.add("me");
    li.innerHTML = `<span>${rank}위</span><span>${rankings[rank - 1].score}점 (내 기록)</span>`;
    ol.appendChild(li);
  }

  rankingListEl.appendChild(ol);
}

// ---------- 시작/종료 ----------
function startGame() {
  resetGame();
  running = true;
  startScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  cancelAnimationFrame(rafId);
  lastTimestamp = null;
  rafId = requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  cancelAnimationFrame(rafId);
  hud.classList.add("hidden");
  finalScoreEl.textContent = `점수: ${score} (도달 레벨: ${level})`;
  const rankInfo = saveScoreAndGetRank(score);
  renderRanking(rankInfo);
  gameoverScreen.classList.remove("hidden");
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
  gameoverScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
});
