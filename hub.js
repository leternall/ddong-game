// ===== 게임 허브 (게임 선택 화면) =====

const GAMES = [
  {
    id: "0001",
    title: "똥피하기",
    desc: "떨어지는 똥을 피해라!",
    path: "games/0001-ddong-pihagi/index.html",
    thumb: "games/0001-ddong-pihagi/assets/thumb.png?v=2",
    ready: true,
  },
  {
    id: "0002",
    title: "쭈채Run",
    desc: "장애물 피해 끝까지 달려라!",
    path: "games/0002-juchaerun/index.html",
    thumb: "games/0002-juchaerun/assets/thumb.png?v=6",
    ready: true,
  },
  {
    id: "0003",
    title: "기억력 게임",
    desc: "카드를 뒤집어 짝을 맞춰라!",
    path: "games/0003-card-match/index.html",
    thumb: "games/0003-card-match/assets/thumb.png?v=2",
    ready: true,
  },
  {
    id: "TBD",
    title: "다음 게임 준비중",
    desc: "",
    emoji: "❓",
    ready: false,
  },
];

const slideEl = document.getElementById("slide");
const slideNumberEl = document.getElementById("slideNumber");
const thumbImgEl = document.getElementById("thumbImg");
const thumbFallbackEl = document.getElementById("thumbFallback");
const slideTitleEl = document.getElementById("slideTitle");
const slideDescEl = document.getElementById("slideDesc");
const dotsEl = document.getElementById("dots");
const startBtn = document.getElementById("startBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

GAMES.forEach(() => {
  const dot = document.createElement("div");
  dot.className = "dot";
  dotsEl.appendChild(dot);
});
const dotEls = Array.from(dotsEl.children);

let index = 0;

function render() {
  const game = GAMES[index];

  slideEl.classList.toggle("not-ready", !game.ready);
  slideNumberEl.textContent = game.id;
  slideTitleEl.textContent = game.title;
  slideDescEl.textContent = game.desc;

  if (game.thumb) {
    thumbImgEl.src = game.thumb;
    thumbImgEl.classList.remove("hidden");
    thumbFallbackEl.classList.add("hidden");
  } else {
    thumbFallbackEl.textContent = game.emoji || "🎮";
    thumbFallbackEl.classList.remove("hidden");
    thumbImgEl.classList.add("hidden");
  }

  startBtn.disabled = !game.ready;
  startBtn.textContent = game.ready ? "시작하기" : "준비중";

  dotEls.forEach((d, i) => d.classList.toggle("active", i === index));
}

// 끝에서 끝으로도 막힘없이 순환합니다(0001 이전 → TBD, TBD 다음 → 0001).
function goTo(i) {
  index = ((i % GAMES.length) + GAMES.length) % GAMES.length;
  render();
}

function enter() {
  const game = GAMES[index];
  if (!game.ready) return;
  location.href = game.path;
}

prevBtn.addEventListener("click", () => goTo(index - 1));
nextBtn.addEventListener("click", () => goTo(index + 1));
startBtn.addEventListener("click", enter);
document.getElementById("thumbWrap").addEventListener("click", enter);

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") goTo(index - 1);
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") goTo(index + 1);
  if (e.key === "Enter" || e.key === " ") enter();
});

// ---------- 좌우 스와이프 + 아래로 당겨서 새로고침 ----------
// 두 제스처 모두 손가락 시작점이 같아서(터치 시작), 하나의 touchstart/move/end
// 세트로 같이 다루고 끝에서 더 크게 움직인 축(가로/세로)으로 어느 쪽인지 가릅니다.
const pullIndicator = document.getElementById("pullRefresh");
const pullIndicatorText = document.getElementById("pullRefreshText");
const PULL_RESISTANCE = 0.45; // 손가락 이동량보다 인디케이터가 덜 내려오게(저항감)
const PULL_THRESHOLD = 70;    // 이만큼 내려오면 손을 뗐을 때 새로고침
const PULL_MAX = 90;          // 인디케이터가 내려오는 최대 거리
let refreshing = false;

let touchStartX = null;
let touchStartY = null;
let pullStartY = null;
let pullDistance = 0;

document.body.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  // 허브는 세로 스크롤이 없어 항상 맨 위이므로, 새로고침 중이 아니면 당기기로 취급합니다.
  pullStartY = !refreshing ? t.clientY : null;
  pullDistance = 0;
  pullIndicator.classList.add("dragging");
}, { passive: true });

document.body.addEventListener("touchmove", (e) => {
  if (pullStartY == null) return;
  const rawDy = e.touches[0].clientY - pullStartY;
  if (rawDy <= 0) {
    pullDistance = 0;
    pullIndicator.style.transform = "translateY(0px)";
    pullIndicator.classList.remove("ready");
    return;
  }
  pullDistance = Math.min(PULL_MAX, rawDy * PULL_RESISTANCE);
  pullIndicator.style.transform = `translateY(${pullDistance}px)`;
  const ready = pullDistance >= PULL_THRESHOLD;
  pullIndicator.classList.toggle("ready", ready);
  pullIndicatorText.textContent = ready ? "손을 떼면 새로고침" : "아래로 당겨서 새로고침";
}, { passive: true });

document.body.addEventListener("touchend", (e) => {
  const changed = e.changedTouches[0];
  const dx = touchStartX != null ? changed.clientX - touchStartX : 0;
  const dy = touchStartY != null ? changed.clientY - touchStartY : 0;

  pullIndicator.classList.remove("dragging");

  if (pullDistance >= PULL_THRESHOLD) {
    refreshing = true;
    pullIndicator.classList.add("spinning");
    pullIndicator.classList.remove("ready");
    pullIndicatorText.textContent = "새로고침 중...";
    pullIndicator.style.transform = `translateY(${PULL_MAX}px)`;
    setTimeout(() => location.reload(), 300);
  } else {
    pullIndicator.classList.remove("ready");
    pullIndicator.style.transform = "translateY(0px)";
    // 세로로 당기던 제스처가 아니라 가로로 민 경우에만 게임 넘기기로 처리합니다.
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx > 0) goTo(index - 1);
      else goTo(index + 1);
    }
  }

  touchStartX = null;
  touchStartY = null;
  pullStartY = null;
  pullDistance = 0;
}, { passive: true });

render();
