// ===== 게임별 랭킹 보기 =====
// 각 게임의 localStorage 랭킹 키를 그대로 읽어옵니다(같은 origin이라
// 게임 폴더가 달라도 전부 공유됩니다). 정렬/표시 방식은 각 게임의
// saveRunAndGetRank / compareRuns 로직과 동일하게 맞춥니다.

const RANK_GAMES = [
  { id: "0001", title: "똥피하기", key: "ddongpihagi-rankings", format: "score" },
  { id: "0002", title: "쭈채Run", key: "juchaerun-lanes-rankings", format: "score" },
  { id: "0003", title: "기억력 게임", key: "gieokryeok-rankings", format: "run" },
  { id: "0004", title: "벌레 소탕", key: "bugsweep-rankings", format: "score" },
];

const TOP_N = 10;

const slideNumberEl = document.getElementById("slideNumber");
const slideTitleEl = document.getElementById("slideTitle");
const rankListEl = document.getElementById("rankList");
const rankEmptyEl = document.getElementById("rankEmpty");
const dotsEl = document.getElementById("dots");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

RANK_GAMES.forEach(() => {
  const dot = document.createElement("div");
  dot.className = "dot";
  dotsEl.appendChild(dot);
});
const dotEls = Array.from(dotsEl.children);

let index = 0;

function loadEntries(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}

function sortScoreEntries(entries) {
  return entries.slice().sort((a, b) => b.score - a.score || a.ts - b.ts);
}

// 기억력 게임(0003)은 클리어 여부 + 시간/점수로 정렬합니다(게임 안쪽
// compareRuns와 동일).
function sortRunEntries(entries) {
  return entries.slice().sort((a, b) => {
    if (a.cleared !== b.cleared) return a.cleared ? -1 : 1;
    if (a.cleared) return a.timeMs - b.timeMs;
    return b.score - a.score;
  });
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatLabel(entry, format) {
  if (format === "run") {
    return entry.cleared ? `${formatTime(entry.timeMs)} 클리어` : `${entry.score}점`;
  }
  return `${entry.score}점`;
}

function render() {
  const game = RANK_GAMES[index];
  slideNumberEl.textContent = game.id;
  slideTitleEl.textContent = game.title;

  const raw = loadEntries(game.key);
  const sorted = game.format === "run" ? sortRunEntries(raw) : sortScoreEntries(raw);
  const top = sorted.slice(0, TOP_N);

  rankListEl.innerHTML = "";
  if (top.length === 0) {
    rankEmptyEl.classList.remove("hidden");
  } else {
    rankEmptyEl.classList.add("hidden");
    top.forEach((entry, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${i + 1}위</span><span>${formatLabel(entry, game.format)}</span>`;
      rankListEl.appendChild(li);
    });
  }

  dotEls.forEach((d, i) => d.classList.toggle("active", i === index));
}

// 허브와 동일하게 끝에서 끝으로도 막힘없이 순환합니다.
function goTo(i) {
  index = ((i % RANK_GAMES.length) + RANK_GAMES.length) % RANK_GAMES.length;
  render();
}

prevBtn.addEventListener("click", () => goTo(index - 1));
nextBtn.addEventListener("click", () => goTo(index + 1));

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") goTo(index - 1);
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") goTo(index + 1);
});

// 스와이프로도 넘길 수 있게(허브와 동일한 방식)
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
