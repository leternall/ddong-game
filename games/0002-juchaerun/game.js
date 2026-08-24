// ===== 쭈채Run: 3줄 달리기 게임 =====

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const scoreEl = document.getElementById("score");
const distanceEl = document.getElementById("distance");
const livesEl = document.getElementById("lives");

const controls = document.getElementById("controls");
const leftBtn = document.getElementById("leftBtn");
const jumpBtn = document.getElementById("jumpBtn");
const rightBtn = document.getElementById("rightBtn");

const selectScreen = document.getElementById("select-screen");
const characterListEl = document.getElementById("character-list");

const pauseScreen = document.getElementById("pause-screen");
const pauseContinueBtn = document.getElementById("pauseContinueBtn");
const pauseRestartBtn = document.getElementById("pauseRestartBtn");
const pauseSelectBtn = document.getElementById("pauseSelectBtn");

const gameoverScreen = document.getElementById("gameover-screen");
const gameoverHitImg = document.getElementById("gameoverHitImg");
const gameoverTitleEl = document.getElementById("gameoverTitle");
const finalScoreEl = document.getElementById("finalScore");
const rankMessageEl = document.getElementById("rankMessage");
const nameEntryEl = document.getElementById("nameEntry");
const nameInputEl = document.getElementById("nameInput");
const nameSubmitBtn = document.getElementById("nameSubmitBtn");
const nameSavedMsgEl = document.getElementById("nameSavedMsg");
const rankingListEl = document.getElementById("rankingList");
const restartBtn = document.getElementById("restartBtn");

const levelupToast = document.getElementById("levelup-toast");

// 게임 방식이 완전히 바뀌어서(점프 러너 → 3줄 달리기) 예전 점수와 섞이지
// 않도록 랭킹 저장 키를 새로 둡니다.
const RANKING_KEY = "juchaerun-lanes-rankings";

// ---------- 캐릭터 목록 ----------
// 똥피하기(0001)의 03·05번 캐릭터 그림을 그대로 재사용합니다(에셋 중복 없음).
const CHARACTERS = [
  { id: "purple", name: "보라 캐릭터", src: "../0001-ddong-pihagi/assets/character_purple.png" },
  { id: "cotton", name: "솜사탕 곰", src: "../0001-ddong-pihagi/assets/character_cotton.png" },
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

// ---------- 캐릭터 선택 화면 구성 ----------
let selectedCharacter = CHARACTERS[0];

function buildCharacterSelect() {
  characterListEl.innerHTML = "";
  CHARACTERS.forEach((c) => {
    const card = document.createElement("div");
    card.className = "character-card";
    const img = document.createElement("img");
    img.src = c.src;
    img.alt = c.name;
    card.appendChild(img);
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
let playHeight;
let controlHeight;

let player, entities, score, lives, level, distanceM, distancePx;
let meatEaten;
let spawnTimer, spawnInterval;
let invincibleFrames, running, paused;

function laneX(lane) {
  return (width / LANE_COUNT) * (lane + 0.5);
}

// 휴대폰 하단 제스처/내비게이션 바 높이(안전 영역)를 실측합니다.
// env(safe-area-inset-bottom)은 JS에서 바로 읽을 수 없어, 그 값만큼
// padding-bottom을 준 보이지 않는 엘리먼트의 실제 높이로 측정합니다.
function getSafeAreaBottom() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;bottom:0;left:0;height:0;" +
    "padding-bottom:env(safe-area-inset-bottom, 0px);" +
    "visibility:hidden;pointer-events:none;";
  document.body.appendChild(probe);
  const value = probe.getBoundingClientRect().height;
  document.body.removeChild(probe);
  return value;
}

// 카카오톡 등 인앱 브라우저는 자체 하단 툴바를 얹으면서도
// window.innerHeight를 그대로(툴바 포함) 보고하는 경우가 있어, 실제로
// 보이는 영역을 더 정확히 아는 visualViewport를 우선 사용합니다.
function getViewportSize() {
  if (window.visualViewport) {
    return { w: window.visualViewport.width, h: window.visualViewport.height };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

function resize() {
  const vp = getViewportSize();
  width = vp.w;
  height = vp.h;

  const safeBottom = getSafeAreaBottom();
  // 조작 버튼이 화면 하단 안전 영역(제스처 바 등)에 가려지지 않도록
  // 그만큼 조작 띠 높이에 더해줍니다.
  controlHeight = Math.max(100, Math.min(160, Math.round(height * 0.16))) + safeBottom;
  playHeight = height - controlHeight;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  controls.style.height = controlHeight + "px";

  if (player) {
    player.y = playHeight - player.h / 2 - 10;
    player.x = laneX(player.lane);
  }
}
window.addEventListener("resize", resize);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
}

// ---------- 게임 상수 ----------
const PLAYER_SIZE = 70;
const LANE_COUNT = 3;
const LANE_MOVE_SPEED = 40; // px / 프레임(60fps 기준)
const MAX_LIVES = 3;
const HIT_INVINCIBLE_FRAMES = 75;
const JUMP_DURATION_FRAMES = 42;
const JUMP_HEIGHT = 46;
const PAUSE_ZONE_MARGIN = 30;
const PAUSE_BUTTON_UNLOCK_DELAY = 400;

const LEVEL_DISTANCE = 100; // 100m마다 레벨업
const METER_SCORE = 5;
const MEAT_SCORE = 10;
const MEAT_PER_LIFE = 50;
const PX_PER_METER = 60;
// 레벨 1은 느긋하게 시작해서 레벨이 오를수록 점점 빨라지고 장애물도 늘어납니다.
const BASE_SPEED = 2.6;
const SPEED_GROWTH_PER_LEVEL = 0.6;
const MAX_SPEED = 13;
const BASE_SPAWN_INTERVAL = 78;
const SPAWN_INTERVAL_DECAY_PER_LEVEL = 4;
const MIN_SPAWN_INTERVAL = 30;
const COLLIDE_BAND = 26;

resize();

function currentSpeed() {
  return Math.min(MAX_SPEED, BASE_SPEED + (level - 1) * SPEED_GROWTH_PER_LEVEL);
}

function currentSpawnInterval() {
  return Math.max(MIN_SPAWN_INTERVAL, BASE_SPAWN_INTERVAL - (level - 1) * SPAWN_INTERVAL_DECAY_PER_LEVEL);
}

// 레벨이 오를수록 장애물이 2개 겹쳐 나오는 웨이브 비중이 늘고, 아예 없는
// 웨이브 비중은 줄어듭니다(그래도 한 줄은 항상 비워둡니다).
function obstacleWaveProbabilities() {
  const twoProb = Math.min(0.45, 0.06 + (level - 1) * 0.05);
  const zeroProb = Math.max(0.10, 0.4 - (level - 1) * 0.04);
  const oneProb = 1 - twoProb - zeroProb;
  return { zeroProb, oneProb, twoProb };
}

function resetGame() {
  player = {
    lane: 1,
    x: laneX(1),
    y: playHeight - PLAYER_SIZE / 2 - 10,
    w: PLAYER_SIZE,
    h: PLAYER_SIZE,
    jumpFrames: 0,
  };
  entities = [];
  score = 0;
  lives = MAX_LIVES;
  level = 1;
  distanceM = 0;
  distancePx = 0;
  meatEaten = 0;
  spawnTimer = 0;
  spawnInterval = currentSpawnInterval();
  invincibleFrames = 0;
  paused = false;
  pauseScreen.classList.add("hidden");
  updateHud();
}

function updateHud() {
  scoreEl.textContent = `점수: ${score}`;
  const distanceInLevel = distanceM % LEVEL_DISTANCE;
  distanceEl.textContent = `레벨 ${level} · ${distanceInLevel}m / ${LEVEL_DISTANCE}m`;
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

// ---------- 일시정지 (0001과 동일한 방식) ----------
function pointerToCanvasY(clientY) {
  const rect = canvas.getBoundingClientRect();
  return clientY - rect.top;
}

function isInPauseZone(clientY) {
  if (!player) return false;
  return pointerToCanvasY(clientY) < player.y - player.h / 2 - PAUSE_ZONE_MARGIN;
}

let pauseUnlockTimer = null;

function togglePause() {
  if (!running) return;
  paused = !paused;
  clearTimeout(pauseUnlockTimer);
  if (paused) {
    cancelAnimationFrame(rafId);
    pauseScreen.classList.remove("hidden");
    pauseScreen.classList.add("locked");
    pauseUnlockTimer = setTimeout(() => {
      pauseScreen.classList.remove("locked");
    }, PAUSE_BUTTON_UNLOCK_DELAY);
  } else {
    pauseScreen.classList.remove("locked");
    pauseScreen.classList.add("hidden");
    lastTimestamp = null;
    rafId = requestAnimationFrame(loop);
  }
}

// ---------- 뒤로가기 = 일시정지 (0001과 동일한 방식) ----------
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

canvas.addEventListener("touchstart", (e) => {
  if (!running || paused) return;
  if (isInPauseZone(e.touches[0].clientY)) togglePause();
}, { passive: true });

canvas.addEventListener("mousedown", (e) => {
  if (!running || paused) return;
  if (isInPauseZone(e.clientY)) togglePause();
});

// ---------- 조작(좌우 이동 / 점프) ----------
function moveLeft() {
  if (!running || paused) return;
  player.lane = Math.max(0, player.lane - 1);
}
function moveRight() {
  if (!running || paused) return;
  player.lane = Math.min(LANE_COUNT - 1, player.lane + 1);
}
function jump() {
  if (!running || paused) return;
  if (player.jumpFrames > 0) return;
  player.jumpFrames = JUMP_DURATION_FRAMES;
}

leftBtn.addEventListener("click", moveLeft);
rightBtn.addEventListener("click", moveRight);
jumpBtn.addEventListener("click", jump);

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") moveLeft();
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") moveRight();
  if (e.key === "ArrowUp" || e.key === " " || e.key === "w" || e.key === "W") jump();
});

// ---------- 장애물/먹이 스폰 ----------
function spawnWave() {
  const lanes = [0, 1, 2];
  // 최소 한 줄은 항상 비워둬서 반드시 피할 길이 있게 합니다.
  const { zeroProb, oneProb } = obstacleWaveProbabilities();
  const r = Math.random();
  const obstacleCount = r < zeroProb ? 0 : r < zeroProb + oneProb ? 1 : 2;

  const shuffled = lanes.slice().sort(() => Math.random() - 0.5);
  const obstacleLanes = shuffled.slice(0, obstacleCount);
  const freeLanes = shuffled.slice(obstacleCount);

  const size = Math.min(width / LANE_COUNT * 0.7, 64);

  obstacleLanes.forEach((lane) => {
    const type = Math.random() < 0.4 ? "pit" : (Math.random() < 0.5 ? "tree" : "rock");
    entities.push({ type, lane, x: laneX(lane), y: -size / 2, size });
  });

  freeLanes.forEach((lane) => {
    if (Math.random() < 0.35) {
      entities.push({ type: "meat", lane, x: laneX(lane), y: -size / 2, size: size * 0.7 });
    }
  });
}

// ---------- 업데이트 ----------
function update(dt) {
  // 레인 이동(부드럽게 목표 레인 중심으로)
  const targetX = laneX(player.lane);
  const moveStep = LANE_MOVE_SPEED * dt;
  const diff = targetX - player.x;
  player.x += Math.max(-moveStep, Math.min(moveStep, diff));

  if (player.jumpFrames > 0) player.jumpFrames = Math.max(0, player.jumpFrames - dt);
  if (invincibleFrames > 0) invincibleFrames = Math.max(0, invincibleFrames - dt);

  // 거리 진행 (끝없이 누적되며, 100m마다 레벨업)
  const speed = currentSpeed();
  distancePx += speed * dt;
  const newDistanceM = Math.floor(distancePx / PX_PER_METER);
  if (newDistanceM > distanceM) {
    score += (newDistanceM - distanceM) * METER_SCORE;
    distanceM = newDistanceM;

    const newLevel = Math.floor(distanceM / LEVEL_DISTANCE) + 1;
    if (newLevel > level) {
      level = newLevel;
      spawnInterval = currentSpawnInterval();
      showLevelUpToast(`레벨 ${level}!`);
    }
    updateHud();
  }

  // 스폰
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnInterval = currentSpawnInterval();
    spawnWave();
  }

  // 장애물/먹이 이동 + 충돌
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    e.y += speed * dt;

    const sameLane = e.lane === player.lane;
    const nearRow = Math.abs(e.y - player.y) < COLLIDE_BAND;

    if (sameLane && nearRow) {
      if (e.type === "meat") {
        entities.splice(i, 1);
        meatEaten++;
        score += MEAT_SCORE;
        if (meatEaten % MEAT_PER_LIFE === 0) {
          const healed = lives < MAX_LIVES;
          lives = Math.min(MAX_LIVES, lives + 1);
          if (healed) showLevelUpToast(`고기 ${meatEaten}개! 목숨 +1 ❤️`);
        }
        updateHud();
        continue;
      }

      const avoided = e.type === "pit" && player.jumpFrames > 0;
      if (!avoided) {
        if (invincibleFrames > 0) {
          // 무적 중에는 목숨이 안 깎입니다. 닿은 장애물은 그 자리에서 지워서
          // 무적이 풀리자마자 같은 장애물에 다시 맞는 것을 막습니다.
          entities.splice(i, 1);
          continue;
        }
        entities.splice(i, 1);
        lives--;
        invincibleFrames = HIT_INVINCIBLE_FRAMES;
        updateHud();
        if (lives <= 0) {
          endGame();
          return;
        }
        continue;
      }
    }

    if (e.y - e.size / 2 > height) {
      entities.splice(i, 1);
    }
  }
}

// ---------- 그리기 ----------
function drawPlayer() {
  const img = selectedCharacter.img;
  const flashHidden = invincibleFrames > 0 && Math.floor(invincibleFrames / 6) % 2 === 0;
  if (flashHidden) return;

  const jumpOffset = player.jumpFrames > 0
    ? Math.sin((1 - player.jumpFrames / JUMP_DURATION_FRAMES) * Math.PI) * JUMP_HEIGHT
    : 0;
  const cy = player.y - jumpOffset;

  if (img.loaded) {
    const ratio = img.naturalWidth / img.naturalHeight;
    let dw = player.w, dh = player.h;
    if (ratio > 1) dh = dw / ratio; else dw = dh * ratio;
    ctx.drawImage(img, player.x - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x, cy, player.w / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd54f";
    ctx.fill();
    ctx.strokeStyle = "#f57f17";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  // 점프 중 그림자(구덩이 위로 뛰어넘는 느낌을 주기 위해)
  if (player.jumpFrames > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + player.h * 0.4, player.w * 0.32, player.w * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

const ENTITY_EMOJI = { pit: "🕳️", tree: "🌳", rock: "🪨", meat: "🍖" };

function drawEntity(e) {
  ctx.font = `${e.size}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ENTITY_EMOJI[e.type], e.x, e.y);
}

// ---------- 배경 꾸미기 (숲속 오솔길 느낌) ----------
// 화면 폭/높이에 대한 비율(xf/yf)로 저장해두면 리사이즈되어도 다시 계산할
// 필요 없이 항상 같은 자리에 흩어져 보입니다.
const BG_LEAF_COUNT = 16;
const bgLeaves = Array.from({ length: BG_LEAF_COUNT }, () => ({
  xf: Math.random(),
  yf: Math.random(),
  scale: 0.6 + Math.random() * 0.7,
  rot: Math.random() * Math.PI * 2,
  tuft: Math.random() < 0.5,
}));

function drawForestBackground() {
  ctx.save();

  // 위쪽 한 켠에서 은은하게 비쳐드는 햇살
  const glow = ctx.createRadialGradient(
    width * 0.78, height * 0.06, 0,
    width * 0.78, height * 0.06, width * 0.65
  );
  glow.addColorStop(0, "rgba(255,250,210,0.35)");
  glow.addColorStop(1, "rgba(255,250,210,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, playHeight);

  // 바닥에 흩어진 나뭇잎/풀숲
  bgLeaves.forEach((leaf) => {
    ctx.save();
    ctx.translate(leaf.xf * width, leaf.yf * playHeight);
    ctx.rotate(leaf.rot);
    ctx.scale(leaf.scale, leaf.scale);
    if (leaf.tuft) {
      ctx.fillStyle = "rgba(90,140,60,0.35)";
      ctx.beginPath();
      ctx.moveTo(-7, 7);
      ctx.lineTo(0, -9);
      ctx.lineTo(7, 7);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(190,150,60,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  ctx.restore();
}

function drawLaneGuides() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  for (let i = 1; i < LANE_COUNT; i++) {
    const x = (width / LANE_COUNT) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, playHeight);
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  drawForestBackground();
  drawLaneGuides();
  entities.forEach(drawEntity);
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

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function nameOrAnon(r) {
  return r.name ? escapeHtml(r.name) : "익명";
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
    li.innerHTML = `<span>${i + 1}위</span><span>${nameOrAnon(r)}</span><span>${r.score}점</span>`;
    ol.appendChild(li);
  });

  if (rank > 5) {
    const li = document.createElement("li");
    li.classList.add("me");
    li.innerHTML = `<span>${rank}위</span><span>${nameOrAnon(rankings[rank - 1])}</span><span>${rankings[rank - 1].score}점 (내 기록)</span>`;
    ol.appendChild(li);
  }

  rankingListEl.appendChild(ol);
}

// ---------- 게임오버 후 이름 등록(선택) ----------
let currentEntryTs = null;

function resetNameEntry() {
  nameInputEl.value = "";
  nameEntryEl.classList.remove("hidden");
  nameSavedMsgEl.classList.add("hidden");
}

function registerName() {
  if (currentEntryTs == null) return;
  const name = nameInputEl.value.trim().slice(0, 8);
  const rankings = loadRankings();
  const idx = rankings.findIndex((r) => r.ts === currentEntryTs);
  if (idx >= 0) {
    rankings[idx].name = name;
    localStorage.setItem(RANKING_KEY, JSON.stringify(rankings));
    const rank = rankings
      .slice()
      .sort((a, b) => b.score - a.score || a.ts - b.ts)
      .findIndex((r) => r.ts === currentEntryTs) + 1;
    renderRanking({ rank, rankings, entryTs: currentEntryTs });
  }
  nameEntryEl.classList.add("hidden");
  nameSavedMsgEl.textContent = name ? `"${name}"(으)로 등록 완료!` : "이름 없이 저장했어요.";
  nameSavedMsgEl.classList.remove("hidden");
}

nameSubmitBtn.addEventListener("click", registerName);
nameInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") registerName();
});

// ---------- 시작/종료 ----------
function startGame() {
  resetGame();
  running = true;
  selectScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  controls.classList.remove("hidden");
  cancelAnimationFrame(rafId);
  lastTimestamp = null;
  rafId = requestAnimationFrame(loop);
  armBackTrap();
}

function endGame() {
  running = false;
  clearBackTrap();
  cancelAnimationFrame(rafId);
  hud.classList.add("hidden");
  controls.classList.add("hidden");
  gameoverHitImg.src = selectedCharacter.hitSrc || selectedCharacter.src;
  gameoverHitImg.classList.remove("hidden");
  gameoverTitleEl.textContent = "게임 오버!";
  finalScoreEl.textContent = `점수: ${score} (레벨 ${level} · ${distanceM}m 도달)`;
  const rankInfo = saveScoreAndGetRank(score);
  currentEntryTs = rankInfo.entryTs;
  resetNameEntry();
  renderRanking(rankInfo);
  gameoverScreen.classList.remove("hidden");
}

restartBtn.addEventListener("click", () => {
  gameoverScreen.classList.add("hidden");
  selectScreen.classList.remove("hidden");
});

pauseContinueBtn.addEventListener("click", () => {
  togglePause();
});

pauseRestartBtn.addEventListener("click", () => {
  startGame();
});

pauseSelectBtn.addEventListener("click", () => {
  running = false;
  paused = false;
  clearBackTrap();
  cancelAnimationFrame(rafId);
  pauseScreen.classList.add("hidden");
  hud.classList.add("hidden");
  controls.classList.add("hidden");
  selectScreen.classList.remove("hidden");
});
