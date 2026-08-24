// ===== 게임별 랭킹 보기 =====
// 각 게임이 클라우드(Firestore)에 저장한 랭킹을 읽어옵니다. 정렬은 저장할 때
// 이미 계산해 둔 rankScore 기준(cloud-ranking.js 참고)이라 여기서는 그대로
// 상위 N개를 받아 보여주기만 하면 됩니다.

const RANK_GAMES = [
  { id: "0001", title: "똥피하기" },
  { id: "0002", title: "쭈채Run" },
  { id: "0003", title: "기억력 게임" },
  { id: "0004", title: "벌레 소탕" },
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
let requestToken = 0; // 화면을 빨리 넘길 때 늦게 도착한 응답이 최신 화면을 덮어쓰지 않도록 합니다.

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function nameOrAnon(entry) {
  return entry.name ? escapeHtml(entry.name) : "-";
}

async function render() {
  const game = RANK_GAMES[index];
  const myToken = ++requestToken;

  slideNumberEl.textContent = game.id;
  slideTitleEl.textContent = game.title;
  rankListEl.innerHTML = "";
  rankEmptyEl.classList.add("hidden");
  dotEls.forEach((d, i) => d.classList.toggle("active", i === index));

  const top = await window.CloudRanking.getTopEntries(game.id, TOP_N);
  if (myToken !== requestToken) return; // 그새 다른 게임으로 넘어감

  if (top == null) {
    rankEmptyEl.textContent = "랭킹 서버에 연결할 수 없어요";
    rankEmptyEl.classList.remove("hidden");
    return;
  }

  if (top.length === 0) {
    rankEmptyEl.textContent = "아직 기록이 없어요";
    rankEmptyEl.classList.remove("hidden");
  } else {
    top.forEach((entry, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${i + 1}위</span><span>${entry.score}점</span><span>${nameOrAnon(entry)}</span>`;
      rankListEl.appendChild(li);
    });
  }
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
