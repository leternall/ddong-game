// ===== 벌레 소탕: 가로등 아래 벌레를 미사일로 잡는 갤러그류 게임 =====

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const scoreEl = document.getElementById("score");
const bugCountEl = document.getElementById("bugCount");
const spraysEl = document.getElementById("sprays");

const controls = document.getElementById("controls");
const leftBtn = document.getElementById("leftBtn");
const sprayBtn = document.getElementById("sprayBtn");
const rightBtn = document.getElementById("rightBtn");

const selectScreen = document.getElementById("select-screen");
const characterListEl = document.getElementById("character-list");

const pauseScreen = document.getElementById("pause-screen");
const pauseContinueBtn = document.getElementById("pauseContinueBtn");
const pauseRestartBtn = document.getElementById("pauseRestartBtn");
const pauseSelectBtn = document.getElementById("pauseSelectBtn");

const gameoverScreen = document.getElementById("gameover-screen");
const gameoverHitImg = document.getElementById("gameoverHitImg");
const finalScoreEl = document.getElementById("finalScore");
const rankMessageEl = document.getElementById("rankMessage");
const rankingListEl = document.getElementById("rankingList");
const restartBtn = document.getElementById("restartBtn");

const levelupToast = document.getElementById("levelup-toast");

const RANKING_KEY = "bugsweep-rankings";

// 에프킬라를 연상시키도록 직접 그린 파란 스프레이 캔 아이콘(F 로고 + 분사
// 표시). 조작 버튼과 HUD의 보유 개수 표시에서 공유해서 씁니다.
const SPRAY_ICON_SVG = `<svg viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <g stroke="#dff1ff" stroke-width="1.6" stroke-linecap="round" opacity="0.95">
    <line x1="8" y1="7" x2="3" y2="2"/>
    <line x1="11" y1="4.5" x2="9" y2="0.5"/>
    <line x1="5" y1="10" x2="0.5" y2="8"/>
  </g>
  <ellipse cx="12" cy="9" rx="3.2" ry="1.7" fill="#e8452c"/>
  <rect x="10.3" y="10" width="3.4" height="3.2" fill="#2a2a2a"/>
  <rect x="6" y="13" width="12" height="16" rx="2.6" fill="#1565d8" stroke="#0c3e8f" stroke-width="1"/>
  <rect x="7.3" y="14.2" width="2" height="13.8" rx="1" fill="#ffffff" opacity="0.2"/>
  <text x="12.2" y="24.5" text-anchor="middle" font-size="10" font-weight="bold" fill="#ffffff" font-family="Arial, sans-serif">F</text>
</svg>`;
sprayBtn.innerHTML = SPRAY_ICON_SVG;

// ---------- 캐릭터 목록 ----------
// 똥피하기(0001)의 04·08번 캐릭터 그림을 그대로 재사용합니다(에셋 중복 없음).
const CHARACTERS = [
  { id: "panda", name: "닌자 판다", src: "../0001-ddong-pihagi/assets/character_panda.png" },
  { id: "dragon", name: "드래곤", src: "../0001-ddong-pihagi/assets/character_dragon.png" },
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

let player, missiles, bugs, fallingBugs, popEffects, sprayDrops, score, killCount, sprayCount;
let bugSpawnTimer, missileTimer;
let running, paused;
let bossActive;
let moving = { left: false, right: false };

// 휴대폰 하단 제스처/내비게이션 바 높이(안전 영역)를 실측합니다.
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

// 카카오톡 등 인앱 브라우저는 자체 하단 툴바를 얹으면서도 window.innerHeight를
// 그대로(툴바 포함) 보고하는 경우가 있어, visualViewport를 우선 사용합니다.
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
    player.x = Math.max(PLAYER_EDGE_INSET, Math.min(width - PLAYER_EDGE_INSET, player.x));
  }
}
window.addEventListener("resize", resize);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
}

// ---------- 게임 상수 ----------
const PLAYER_SIZE = 100;
// 캐릭터 몸통 절반(=이전 이동 한계)만큼 벽에서 떨어뜨려두면 벌레가 도망칠 수
// 있는 가장자리(벌레 벽 여백 20px)까지 미사일이 닿지 않는 사각지대가
// 생깁니다. 캐릭터가 화면 밖으로 살짝 걸쳐 나가더라도 거의 끝까지 붙을 수
// 있게 해서 그 사각지대를 없앱니다.
const PLAYER_EDGE_INSET = 15;
const PLAYER_SPEED = 8;
const PAUSE_ZONE_MARGIN = 30;
const PAUSE_BUTTON_UNLOCK_DELAY = 400;

const MISSILE_SPEED = 12;
const MISSILE_INTERVAL_FRAMES = 24; // 60fps 기준 약 0.4초마다 자동 발사
const MISSILE_RADIUS = 6.5; // 기존 5px의 1.3배 — 1.5배는 너무 쉬워서 하향
const MISSILE_HIT_RADIUS = 15.6; // 기존 12px의 1.3배

const BUG_START_COUNT = 10;
const BUG_SPAWN_INTERVAL_FRAMES = 30; // 60fps 기준 0.5초
const BUG_GAMEOVER_THRESHOLD = 50;
// 날아다니는 벌레만 사용합니다(지렁이는 날지 않아 컨셉과 안 맞아서 제외).
const BUG_TYPES = ["🦟", "🪰", "🦋"];

const SPRAY_START = 2;
const SPRAY_MAX = 2;
const KILLS_PER_SPRAY = 100;

// 100마리를 잡으면 곧바로 스프레이를 주는 대신, 대왕 벌레(메뚜기/벌)가
// 나타납니다. 3방을 맞아야 죽고, 죽으면 스프레이가 천천히 떨어져서 캐릭터가
// 직접 받아야 스프레이가 늘어납니다.
const BOSS_TYPES = [
  { emoji: "🦗", name: "대왕 초록 메뚜기" },
  { emoji: "🐝", name: "대왕 노란 벌" },
];
const BOSS_HP = 3;
const BOSS_SIZE = 64;
const BOSS_KILL_SCORE = 50;
const SPRAY_DROP_SPEED = 1.2; // 벌레보다 훨씬 천천히 떨어짐
const SPRAY_DROP_CATCH_MARGIN = 20;

resize();

// ---------- 게임 상태 초기화 ----------
function spawnBug() {
  const size = 24 + Math.random() * 10;
  const emoji = BUG_TYPES[Math.floor(Math.random() * BUG_TYPES.length)];
  bugs.push({
    x: Math.random() * width,
    // 처음엔 가로등이 있는 위쪽 절반에서 나타납니다.
    y: Math.random() * (playHeight * 0.5),
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    maxSpeed: 2.6 + Math.random() * 2,
    size,
    emoji,
    hp: 1,
  });
}

function spawnBossBug() {
  if (bossActive) return;
  const type = BOSS_TYPES[Math.floor(Math.random() * BOSS_TYPES.length)];
  bugs.push({
    x: Math.random() * (width - 80) + 40,
    y: Math.random() * (playHeight * 0.4) + 40,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5,
    // 덩치가 커서 일반 벌레보다는 조금 느리게 움직입니다.
    maxSpeed: 1.6 + Math.random() * 0.8,
    size: BOSS_SIZE,
    emoji: type.emoji,
    isBoss: true,
    hp: BOSS_HP,
    maxHp: BOSS_HP,
  });
  bossActive = true;
  showLevelUpToast(`${type.name} 출현!`);
}

function spawnSprayDrop(x, y) {
  sprayDrops.push({ x, y, vy: SPRAY_DROP_SPEED });
}

function resetGame() {
  player = {
    x: width / 2,
    y: playHeight - PLAYER_SIZE / 2 - 10,
    w: PLAYER_SIZE,
    h: PLAYER_SIZE,
  };
  missiles = [];
  bugs = [];
  fallingBugs = [];
  popEffects = [];
  sprayDrops = [];
  score = 0;
  killCount = 0;
  sprayCount = SPRAY_START;
  bossActive = false;
  bugSpawnTimer = 0;
  missileTimer = 0;
  moving.left = false;
  moving.right = false;
  paused = false;
  pauseScreen.classList.add("hidden");

  for (let i = 0; i < BUG_START_COUNT; i++) spawnBug();

  updateHud();
}

function updateHud() {
  scoreEl.textContent = `점수: ${score}`;
  bugCountEl.textContent = `벌레: ${bugs.length}/${BUG_GAMEOVER_THRESHOLD}`;
  spraysEl.innerHTML = "";
  for (let i = 0; i < SPRAY_MAX; i++) {
    const span = document.createElement("span");
    span.innerHTML = SPRAY_ICON_SVG;
    if (i >= sprayCount) span.classList.add("empty");
    spraysEl.appendChild(span);
  }
  sprayBtn.disabled = sprayCount <= 0;
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

// 잡은 벌레 수를 더하고, 100마리 단위를 넘길 때마다 스프레이를 바로 주는
// 대신 대왕 벌레를 등장시킵니다. 여러 마리를 한 번에 잡는 스프레이 사용
// 시에도 정확히 처리되도록 "몇 개의 100 단위를 새로 넘겼는지"로 계산합니다.
function addKills(n) {
  const before = Math.floor(killCount / KILLS_PER_SPRAY);
  killCount += n;
  const after = Math.floor(killCount / KILLS_PER_SPRAY);
  if (after > before) {
    spawnBossBug();
  }
}

// ---------- 일시정지 (0001·0002와 동일한 방식) ----------
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

canvas.addEventListener("touchstart", (e) => {
  if (!running || paused) return;
  if (isInPauseZone(e.touches[0].clientY)) togglePause();
}, { passive: true });

canvas.addEventListener("mousedown", (e) => {
  if (!running || paused) return;
  if (isInPauseZone(e.clientY)) togglePause();
});

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

// ---------- 조작(좌우 이동 / 스프레이) ----------
// 좌우는 누르고 있는 동안 계속 움직입니다(갤러그류라 탭 이동보다 자연스러움).
function bindHold(btn, onDown, onUp) {
  const start = (e) => { e.preventDefault(); onDown(); };
  const end = () => onUp();
  btn.addEventListener("touchstart", start, { passive: false });
  btn.addEventListener("touchend", end);
  btn.addEventListener("touchcancel", end);
  btn.addEventListener("mousedown", start);
  btn.addEventListener("mouseup", end);
  btn.addEventListener("mouseleave", end);
}

bindHold(leftBtn, () => { moving.left = true; }, () => { moving.left = false; });
bindHold(rightBtn, () => { moving.right = true; }, () => { moving.right = false; });

// 스프레이는 일반 벌레는 화면에 있는 만큼 전부 즉시 떨어뜨려 잡지만,
// 대왕 벌레는 에너지가 한 칸만 깎입니다(공짜로 잡히지 않도록).
function useSpray() {
  if (!running || paused) return;
  if (sprayCount <= 0 || bugs.length === 0) return;
  sprayCount--;

  let normalKilled = 0;
  const survivors = [];
  bugs.forEach((b) => {
    if (b.isBoss) {
      b.hp -= 1;
      spawnPopEffect(b.x, b.y, b.size * 0.5);
      if (b.hp <= 0) {
        spawnPopEffect(b.x, b.y, b.size);
        spawnSprayDrop(b.x, b.y);
        bossActive = false;
        score += BOSS_KILL_SCORE;
        addKills(1);
      } else {
        survivors.push(b);
      }
      return;
    }
    normalKilled++;
    fallingBugs.push({
      x: b.x, y: b.y, size: b.size, emoji: b.emoji,
      vy: 2 + Math.random() * 1.5,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 0.25,
    });
  });
  bugs = survivors;
  score += normalKilled * 10;
  if (normalKilled > 0) addKills(normalKilled);
  updateHud();
}

sprayBtn.addEventListener("click", useSpray);

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") moving.left = true;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") moving.right = true;
  if (e.key === " " && !e.repeat) useSpray();
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") moving.left = false;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") moving.right = false;
});

// ---------- 업데이트 ----------
// 미사일은 항상 캐릭터 x좌표에서 수직으로 올라가므로, 벌레가 그 세로줄
// 근처에 있으면 최대한 벗어나려고 하게 만듭니다. 이게 없으면 캐릭터를
// 가만히 둬도 그 줄 위로 지나가는 벌레가 알아서 다 맞아 죽어버려서
// 움직이지 않고도 게임이 되는 문제가 있었습니다.
const MISSILE_LANE_AVOID_RADIUS = 55;
const MISSILE_LANE_AVOID_PUSH = 2.2;
// 불빛(가로등 전구)을 향해 은근히 끌리는 불나방 본능. 사격 라인 회피보다
// 훨씬 약하게 줘서, 캐릭터를 피하는 게 항상 우선이고 그 외엔 불빛 쪽으로
// 모여드는 느낌만 냅니다.
const LIGHT_ATTRACT_FORCE = 0.3;

// drawAlleyBackground()가 그리는 전구 위치와 반드시 같아야 합니다.
function lampPosition() {
  return { x: width / 2, y: playHeight * 0.12 + 16 };
}

function updateBugs(dt) {
  const margin = 20;
  const bugAreaBottom = playHeight * 0.8;
  const lamp = lampPosition();
  bugs.forEach((b) => {
    // 랜덤워크로 "웽웽" 날아다니는 느낌을 냅니다. 방향을 더 자주 크게
    // 바꿔야 미사일을 요리조리 피하는 느낌이 살아서, 가속도를 키웠습니다.
    b.vx += (Math.random() - 0.5) * 1.1 * dt;
    b.vy += (Math.random() - 0.5) * 1.1 * dt;

    // 불빛을 향한 은근한 끌림
    const dxLamp = lamp.x - b.x;
    const dyLamp = lamp.y - b.y;
    const distLamp = Math.hypot(dxLamp, dyLamp) || 1;
    b.vx += (dxLamp / distLamp) * LIGHT_ATTRACT_FORCE * dt;
    b.vy += (dyLamp / distLamp) * LIGHT_ATTRACT_FORCE * dt;

    // 캐릭터의 사격 라인(정수리 위 세로줄) 회피 — 불빛 끌림보다 훨씬 강해서
    // 사격 라인 안에서는 이쪽이 이깁니다.
    const dxFromPlayer = b.x - player.x;
    if (Math.abs(dxFromPlayer) < MISSILE_LANE_AVOID_RADIUS) {
      const dir = dxFromPlayer === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dxFromPlayer);
      const strength = 1 - Math.abs(dxFromPlayer) / MISSILE_LANE_AVOID_RADIUS;
      b.vx += dir * strength * MISSILE_LANE_AVOID_PUSH * dt;
    }

    b.vx = Math.max(-b.maxSpeed, Math.min(b.maxSpeed, b.vx));
    b.vy = Math.max(-b.maxSpeed, Math.min(b.maxSpeed, b.vy));
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < margin) { b.x = margin; b.vx = Math.abs(b.vx); }
    if (b.x > width - margin) { b.x = width - margin; b.vx = -Math.abs(b.vx); }
    if (b.y < margin) { b.y = margin; b.vy = Math.abs(b.vy); }
    if (b.y > bugAreaBottom) { b.y = bugAreaBottom; b.vy = -Math.abs(b.vy); }
  });
}

function updateFallingBugs(dt) {
  for (let i = fallingBugs.length - 1; i >= 0; i--) {
    const b = fallingBugs[i];
    b.y += b.vy * dt;
    b.vy += 0.15 * dt;
    b.rot += b.rotSpeed * dt;
    if (b.y > height + 40) fallingBugs.splice(i, 1);
  }
}

// 미사일에 맞은 벌레는 떨어뜨리지 않고 이 자리에서 "뿅" 하고 짧게 터지는
// 이펙트만 남기고 바로 사라집니다(떨어지는 연출은 스프레이 전용).
const POP_EFFECT_FRAMES = 14;

function spawnPopEffect(x, y, size) {
  popEffects.push({ x, y, size, age: 0 });
}

function updatePopEffects(dt) {
  for (let i = popEffects.length - 1; i >= 0; i--) {
    popEffects[i].age += dt;
    if (popEffects[i].age >= POP_EFFECT_FRAMES) popEffects.splice(i, 1);
  }
}

// 대왕 벌레를 잡으면 떨어지는 스프레이. 캐릭터 몸통 높이에서 x가 가까우면
// "받은" 것으로 치고 스프레이가 늘어나고, 못 받고 지나치면 그냥 사라집니다.
function updateSprayDrops(dt) {
  for (let i = sprayDrops.length - 1; i >= 0; i--) {
    const d = sprayDrops[i];
    d.y += d.vy * dt;

    const caughtX = Math.abs(d.x - player.x) < player.w / 2 + SPRAY_DROP_CATCH_MARGIN;
    const caughtY = d.y >= player.y - player.h / 2 && d.y <= player.y + player.h / 2;
    if (caughtX && caughtY) {
      sprayDrops.splice(i, 1);
      if (sprayCount < SPRAY_MAX) {
        sprayCount++;
        showLevelUpToast("스프레이 획득!");
      } else {
        showLevelUpToast("스프레이 이미 최대!");
      }
      updateHud();
      continue;
    }

    if (d.y > height + 40) sprayDrops.splice(i, 1);
  }
}

function update(dt) {
  // 플레이어 좌우 이동
  const moveStep = PLAYER_SPEED * dt;
  if (moving.left) player.x -= moveStep;
  if (moving.right) player.x += moveStep;
  player.x = Math.max(PLAYER_EDGE_INSET, Math.min(width - PLAYER_EDGE_INSET, player.x));

  // 자동 미사일 발사
  missileTimer += dt;
  if (missileTimer >= MISSILE_INTERVAL_FRAMES) {
    missileTimer = 0;
    missiles.push({ x: player.x, y: player.y - player.h / 2 });
  }
  for (let i = missiles.length - 1; i >= 0; i--) {
    missiles[i].y -= MISSILE_SPEED * dt;
    if (missiles[i].y < -20) missiles.splice(i, 1);
  }

  updateBugs(dt);
  updateFallingBugs(dt);
  updatePopEffects(dt);
  updateSprayDrops(dt);

  // 미사일-벌레 충돌: 일반 벌레는 한 방에 터져 사라지고, 대왕 벌레는
  // 에너지가 1씩 깎이다가 0이 되면 죽으면서 스프레이를 떨어뜨립니다.
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    let hitIndex = -1;
    for (let j = 0; j < bugs.length; j++) {
      const b = bugs[j];
      const dx = m.x - b.x;
      const dy = m.y - b.y;
      const r = b.size / 2 + MISSILE_HIT_RADIUS;
      if (dx * dx + dy * dy < r * r) {
        hitIndex = j;
        break;
      }
    }
    if (hitIndex >= 0) {
      const b = bugs[hitIndex];
      missiles.splice(i, 1);
      b.hp -= 1;
      if (b.hp > 0) {
        spawnPopEffect(b.x, b.y, b.size * 0.5);
        updateHud();
        continue;
      }
      spawnPopEffect(b.x, b.y, b.size);
      bugs.splice(hitIndex, 1);
      if (b.isBoss) {
        spawnSprayDrop(b.x, b.y);
        bossActive = false;
        score += BOSS_KILL_SCORE;
      } else {
        score += 10;
      }
      addKills(1);
      updateHud();
    }
  }

  // 벌레 자연 증가
  bugSpawnTimer += dt;
  if (bugSpawnTimer >= BUG_SPAWN_INTERVAL_FRAMES) {
    bugSpawnTimer = 0;
    spawnBug();
    updateHud();
  }

  if (bugs.length > BUG_GAMEOVER_THRESHOLD) {
    endGame();
  }
}

// ---------- 그리기 ----------
function drawAlleyBackground() {
  ctx.save();

  const lampX = width / 2;
  const lampY = playHeight * 0.12;

  // 가로등 불빛(주변만 밝고 나머지는 어두운 밤 골목 느낌). 화면 대각선
  // 길이만큼 넉넉히 퍼지게 해서 양옆이 뚝 끊긴 검은 여백처럼 보이지
  // 않고 가운데 빛이 자연스럽게 가장자리까지 이어지도록 합니다.
  const glowRadius = Math.hypot(width, playHeight) * 0.75;
  const glow = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, glowRadius);
  glow.addColorStop(0, "rgba(255,244,200,0.55)");
  glow.addColorStop(0.35, "rgba(255,224,140,0.2)");
  glow.addColorStop(0.7, "rgba(70,70,100,0.08)");
  glow.addColorStop(1, "rgba(40,40,60,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, playHeight);

  // 가로등 지지대. 화면 위쪽 밖(건물 처마 등)에서 내려와 등 바로 위에서
  // 끝나고, 등 아래로는 선이 이어지지 않게 합니다.
  ctx.strokeStyle = "rgba(70,70,80,0.9)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(lampX, 0);
  ctx.lineTo(lampX, lampY - 14);
  ctx.stroke();

  // 등 갓: 입체감 나게 사다리꼴 + 밝은 쪽 하이라이트
  ctx.fillStyle = "#33333e";
  ctx.beginPath();
  ctx.moveTo(lampX - 20, lampY - 10);
  ctx.lineTo(lampX + 20, lampY - 10);
  ctx.lineTo(lampX + 11, lampY + 6);
  ctx.lineTo(lampX - 11, lampY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.moveTo(lampX - 17, lampY - 9);
  ctx.lineTo(lampX - 7, lampY - 9);
  ctx.lineTo(lampX - 10, lampY + 4);
  ctx.lineTo(lampX - 15, lampY + 4);
  ctx.closePath();
  ctx.fill();
  // 갓 테두리
  ctx.strokeStyle = "#1a1a20";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lampX - 20, lampY - 10);
  ctx.lineTo(lampX + 20, lampY - 10);
  ctx.lineTo(lampX + 11, lampY + 6);
  ctx.lineTo(lampX - 11, lampY + 6);
  ctx.closePath();
  ctx.stroke();

  // 전구: 겹겹의 글로우로 실제 빛나는 느낌을 냅니다.
  const bulbY = lampY + 16;
  const bulbGlow = ctx.createRadialGradient(lampX, bulbY, 0, lampX, bulbY, 30);
  bulbGlow.addColorStop(0, "rgba(255,255,240,0.95)");
  bulbGlow.addColorStop(0.35, "rgba(255,235,170,0.5)");
  bulbGlow.addColorStop(1, "rgba(255,235,170,0)");
  ctx.fillStyle = bulbGlow;
  ctx.beginPath();
  ctx.arc(lampX, bulbY, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fffbe8";
  ctx.beginPath();
  ctx.arc(lampX, bulbY, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff4c0";
  ctx.beginPath();
  ctx.arc(lampX, bulbY, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlayer() {
  const img = selectedCharacter.img;
  if (img.loaded) {
    const ratio = img.naturalWidth / img.naturalHeight;
    let dw = player.w, dh = player.h;
    if (ratio > 1) dh = dw / ratio; else dw = dh * ratio;
    ctx.drawImage(img, player.x - dw / 2, player.y - dh / 2, dw, dh);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.w / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd54f";
    ctx.fill();
    ctx.strokeStyle = "#f57f17";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

function drawMissile(m) {
  ctx.save();
  ctx.fillStyle = "#ffe066";
  ctx.shadowColor = "#fff176";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(m.x, m.y, MISSILE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBug(b) {
  ctx.save();
  ctx.font = `${b.size}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(b.emoji, b.x, b.y);
  ctx.restore();

  if (b.isBoss) drawBossHpPips(b);
}

// 대왕 벌레 머리 위에 남은 에너지를 점으로 표시합니다.
function drawBossHpPips(b) {
  ctx.save();
  const gap = 11;
  const startX = b.x - ((b.maxHp - 1) * gap) / 2;
  const y = b.y - b.size / 2 - 12;
  for (let i = 0; i < b.maxHp; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * gap, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = i < b.hp ? "#ff5252" : "rgba(255,255,255,0.25)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

// 대왕 벌레가 죽으면 떨어지는 스프레이. 조작 버튼과 같은 파란 캔 + F
// 디자인을 캔버스로 간단히 그려서 통일감을 줍니다.
function drawSprayDrop(d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.shadowColor = "#7ec8ff";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#1565d8";
  ctx.strokeStyle = "#0c3e8f";
  ctx.lineWidth = 1;
  const w = 18, h = 22;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2 + 4, w, h - 4, 3) : ctx.rect(-w / 2, -h / 2 + 4, w, h - 4);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(-3.5, -h / 2 - 3, 7, 6);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("F", 0, 4);
  ctx.restore();
}

function drawFallingBug(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.font = `${b.size}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(b.emoji, 0, 0);
  ctx.restore();
}

function drawPopEffect(p) {
  const t = p.age / POP_EFFECT_FRAMES; // 0(막 터짐) ~ 1(다 사라짐)
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t);
  ctx.strokeStyle = "#fff4c0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, (p.size / 2) * (0.6 + t * 1.3), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffe066";
  const sparkCount = 5;
  for (let k = 0; k < sparkCount; k++) {
    const ang = (k / sparkCount) * Math.PI * 2;
    const dist = (p.size / 2) * (0.5 + t * 1.5);
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  drawAlleyBackground();
  fallingBugs.forEach(drawFallingBug);
  sprayDrops.forEach(drawSprayDrop);
  bugs.forEach(drawBug);
  popEffects.forEach(drawPopEffect);
  missiles.forEach(drawMissile);
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
  finalScoreEl.textContent = `점수: ${score} (${killCount}마리 퇴치)`;
  const rankInfo = saveScoreAndGetRank(score);
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
