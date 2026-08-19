// ===== 똥피하기 게임 =====

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const livesEl = document.getElementById("lives");

const selectScreen = document.getElementById("select-screen");
const characterListEl = document.getElementById("character-list");

const gameoverScreen = document.getElementById("gameover-screen");
const finalScoreEl = document.getElementById("finalScore");
const rankMessageEl = document.getElementById("rankMessage");
const rankingListEl = document.getElementById("rankingList");
const restartBtn = document.getElementById("restartBtn");

const levelupToast = document.getElementById("levelup-toast");

const RANKING_KEY = "ddongpihagi-rankings";

// ---------- 캐릭터 목록 ----------
const CHARACTERS = [
  { id: "girl", name: "소녀 캐릭터", src: "assets/character_girl.png" },
  { id: "magpie", name: "까치 캐릭터", src: "assets/character_magpie.png" },
];

function loadImage(src) {
  const img = new Image();
  img.loaded = false;
  img.failed = false;
  img.onload = () => { img.loaded = true; };
  img.onerror = () => { img.failed = true; };
  img.src = src;
  return img;
}

CHARACTERS.forEach((c) => { c.img = loadImage(c.src); });
const poopImg = loadImage("assets/poop.png");
const poopBigImg = loadImage("assets/poop_big.png");

// ---------- 캐릭터 선택 화면 구성 ----------
let selectedCharacter = CHARACTERS[0];

function buildCharacterSelect() {
  characterListEl.innerHTML = "";
  CHARACTERS.forEach((c) => {
    const card = document.createElement("div");
    card.className = "character-card";
    const img = document.createElement("img");
    img.src = c.src;
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = c.name;
    card.appendChild(img);
    card.appendChild(name);
    card.addEventListener("click", () => {
      selectedCharacter = c;
      startGame();
    });
    characterListEl.appendChild(card);
  });
}
buildCharacterSelect();

// ---------- 캔버스 크기 ----------
let width, height;
function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}
window.addEventListener("resize", resize);
resize();

// ---------- 게임 상수 ----------
const PLAYER_SIZE = 70;
const PLAYER_SPEED = 9;
const MAX_LIVES = 3;
const LEVEL_DURATION_FRAMES = 30 * 60; // 30초 (60fps 기준)
const HIT_INVINCIBLE_FRAMES = 75;
const BIG_POOP_LEVEL_INTERVAL = 5;

// ---------- 게임 상태 ----------
let player, poops, score, level, lives, levelFrames, spawnTimer, spawnInterval;
let bigPoopSpawnedThisWindow, bigPoopSpawnFrame;
let invincibleFrames, running, keys;

function currentSpawnInterval() {
  return Math.max(16, 70 - (level - 1) * 4);
}

function currentFallSpeed() {
  return 3 + (level - 1) * 0.6;
}

function scheduleBigPoopIfNeeded() {
  bigPoopSpawnedThisWindow = false;
  if (level % BIG_POOP_LEVEL_INTERVAL === 0) {
    bigPoopSpawnFrame = Math.floor(Math.random() * (LEVEL_DURATION_FRAMES - 60)) + 30;
  } else {
    bigPoopSpawnFrame = -1;
  }
}

function resetGame() {
  player = {
    x: width / 2 - PLAYER_SIZE / 2,
    y: height - PLAYER_SIZE - 20,
    w: PLAYER_SIZE,
    h: PLAYER_SIZE,
    targetX: null,
  };
  poops = [];
  score = 0;
  level = 1;
  lives = MAX_LIVES;
  levelFrames = 0;
  spawnTimer = 0;
  spawnInterval = currentSpawnInterval();
  invincibleFrames = 0;
  keys = { left: false, right: false };
  scheduleBigPoopIfNeeded();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = `점수: ${score}`;
  levelEl.textContent = `레벨: ${level}`;
  livesEl.innerHTML = "";
  for (let i = 0; i < MAX_LIVES; i++) {
    const span = document.createElement("span");
    span.textContent = "❤️";
    if (i >= lives) span.classList.add("empty");
    livesEl.appendChild(span);
  }
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

// ---------- 입력 ----------
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
});

function pointerToTargetX(clientX) {
  const rect = canvas.getBoundingClientRect();
  return clientX - rect.left;
}

canvas.addEventListener("touchstart", (e) => {
  if (!running) return;
  player.targetX = pointerToTargetX(e.touches[0].clientX);
}, { passive: true });

canvas.addEventListener("touchmove", (e) => {
  if (!running) return;
  player.targetX = pointerToTargetX(e.touches[0].clientX);
}, { passive: true });

canvas.addEventListener("touchend", () => {
  if (player) player.targetX = null;
});

let mouseDown = false;
canvas.addEventListener("mousedown", (e) => {
  mouseDown = true;
  if (!running) return;
  player.targetX = pointerToTargetX(e.clientX);
});
canvas.addEventListener("mousemove", (e) => {
  if (!running || !mouseDown) return;
  player.targetX = pointerToTargetX(e.clientX);
});
window.addEventListener("mouseup", () => {
  mouseDown = false;
  if (player) player.targetX = null;
});

// ---------- 똥 스폰 ----------
function spawnPoop(big) {
  // 큰 똥은 일반 똥의 3배 크기 (좁은 화면에서는 화면 폭의 절반까지만)
  let size = big ? 210 + Math.random() * 60 : 34 + Math.random() * 26;
  if (big) size = Math.min(size, width * 0.5);
  const x = Math.random() * (width - size);
  const speedMultiplier = big ? 0.85 : 1;
  const speed = (currentFallSpeed() + Math.random() * 1.5) * speedMultiplier;
  poops.push({
    x, y: -size, size, speed, big,
    rot: Math.random() * Math.PI,
    rotSpeed: (Math.random() - 0.5) * 0.08,
  });
}

// ---------- 충돌 판정 ----------
function isColliding(p, poop) {
  const px = p.x + p.w * 0.15;
  const py = p.y + p.h * 0.15;
  const pw = p.w * 0.7;
  const ph = p.h * 0.7;

  const cx = poop.x + poop.size / 2;
  const cy = poop.y + poop.size / 2;
  const r = (poop.size / 2) * 0.75;

  const nearestX = Math.max(px, Math.min(cx, px + pw));
  const nearestY = Math.max(py, Math.min(cy, py + ph));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return (dx * dx + dy * dy) < (r * r);
}

// ---------- 업데이트 ----------
function update() {
  // 플레이어 이동
  if (player.targetX != null) {
    const center = player.x + player.w / 2;
    const diff = player.targetX - center;
    player.x += Math.max(-PLAYER_SPEED, Math.min(PLAYER_SPEED, diff));
  } else {
    if (keys.left) player.x -= PLAYER_SPEED;
    if (keys.right) player.x += PLAYER_SPEED;
  }
  player.x = Math.max(0, Math.min(width - player.w, player.x));

  if (invincibleFrames > 0) invincibleFrames--;

  // 레벨 타이머
  levelFrames++;
  if (levelFrames >= LEVEL_DURATION_FRAMES) {
    levelFrames = 0;
    const clearedLevel = level;
    level++;
    spawnInterval = currentSpawnInterval();
    scheduleBigPoopIfNeeded();

    if (clearedLevel % BIG_POOP_LEVEL_INTERVAL === 0) {
      const healed = lives < MAX_LIVES;
      lives = Math.min(MAX_LIVES, lives + 1);
      showLevelUpToast(healed ? `레벨 ${level}! 목숨 +1 ❤️` : `레벨 ${level}! (목숨 이미 최대)`);
    } else {
      showLevelUpToast(`레벨 ${level}!`);
    }
    updateHud();
  }

  // 일반 똥 스폰
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnPoop(false);
  }

  // 5레벨마다 랜덤 큰 똥 1회
  if (!bigPoopSpawnedThisWindow && bigPoopSpawnFrame >= 0 && levelFrames >= bigPoopSpawnFrame) {
    spawnPoop(true);
    bigPoopSpawnedThisWindow = true;
  }

  // 똥 이동 + 충돌
  for (let i = poops.length - 1; i >= 0; i--) {
    const poop = poops[i];
    poop.y += poop.speed;
    poop.rot += poop.rotSpeed;

    if (invincibleFrames <= 0 && isColliding(player, poop)) {
      poops.splice(i, 1);
      lives--;
      invincibleFrames = HIT_INVINCIBLE_FRAMES;
      updateHud();
      if (lives <= 0) {
        endGame();
        return;
      }
      continue;
    }

    if (poop.y > height) {
      poops.splice(i, 1);
      score += poop.big ? 5 : 1;
      updateHud();
    }
  }
}

// ---------- 그리기 ----------
function drawPlayer() {
  const img = selectedCharacter.img;
  const flashHidden = invincibleFrames > 0 && Math.floor(invincibleFrames / 6) % 2 === 0;
  if (flashHidden) return;

  if (img.loaded) {
    const ratio = img.naturalWidth / img.naturalHeight;
    let dw = PLAYER_SIZE, dh = PLAYER_SIZE;
    if (ratio > 1) dh = dw / ratio; else dw = dh * ratio;
    const dx = player.x + (player.w - dw) / 2;
    const dy = player.y + (player.h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, player.w / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd54f";
    ctx.fill();
    ctx.strokeStyle = "#f57f17";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

function drawPoop(poop) {
  const img = poop.big ? poopBigImg : poopImg;
  ctx.save();
  ctx.translate(poop.x + poop.size / 2, poop.y + poop.size / 2);
  ctx.rotate(poop.rot * 0.15);
  if (img.loaded) {
    const ratio = img.naturalWidth / img.naturalHeight;
    let dw = poop.size, dh = poop.size;
    if (ratio > 1) dh = dw / ratio; else dw = dh * ratio;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.font = `${poop.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💩", 0, 0);
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  poops.forEach(drawPoop);
  drawPlayer();
}

// ---------- 루프 ----------
let rafId;
function loop() {
  if (!running) return;
  update();
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
  selectScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  cancelAnimationFrame(rafId);
  loop();
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

restartBtn.addEventListener("click", () => {
  gameoverScreen.classList.add("hidden");
  selectScreen.classList.remove("hidden");
});
