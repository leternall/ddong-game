// ===== 게임 허브 (게임 선택 화면) =====

const GAMES = [
  {
    id: "0001",
    title: "똥피하기",
    desc: "떨어지는 똥을 피해라!",
    path: "games/0001-ddong-pihagi/index.html",
    thumb: "games/0001-ddong-pihagi/assets/thumb.png",
    ready: true,
  },
  {
    id: "0002",
    title: "쭈채Run",
    desc: "세 줄을 오가며 100m를 달려라!",
    path: "games/0002-juchaerun/index.html",
    thumb: "games/0002-juchaerun/assets/thumb.png",
    ready: true,
  },
  {
    id: "0003",
    title: "기억력 게임",
    desc: "카드를 뒤집어 짝을 맞춰라!",
    path: "games/0003-card-match/index.html",
    thumb: "games/0003-card-match/assets/thumb.png",
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

// 스와이프로도 넘길 수 있게
let touchStartX = null;
document.body.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });

document.body.addEventListener("touchend", (e) => {
  if (touchStartX == null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  touchStartX = null;
  if (dx > 40) goTo(index - 1);
  else if (dx < -40) goTo(index + 1);
}, { passive: true });

render();
