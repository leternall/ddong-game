// ===== 클라우드 랭킹 (Firebase Firestore) =====
// 게임(game.js)들과 랭킹 보기 페이지(rankings.js)가 공통으로 쓰는
// Firestore 연동 도우미입니다. 빌드 도구 없는 정적 사이트라 CDN의 ES 모듈을
// 동적 import()로 불러옵니다 — 이 파일 자체는 일반 <script>로 넣어도 됩니다.
//
// 데이터 구조: rankings/{gameId}/entries/{entryId}
//   score: number, name: string(선택), ts: number(등록 시각), rankScore: number(정렬용)
//   (기억력 게임은 cleared: boolean, timeMs: number 도 추가로 저장)
//
// 보안 규칙상 문서는 생성만 가능하고 수정/삭제는 불가능합니다. 그래서 게임
// 오버 시 곧바로 점수를 저장하지 않고, 플레이어가 이름을 등록하거나
// 건너뛰기를 눌렀을 때 그 한 번만 저장합니다.

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA0YiXk0aV29x0kakpamLeRqP4YkeCU7KM",
  authDomain: "juchae-game-app.firebaseapp.com",
  projectId: "juchae-game-app",
  storageBucket: "juchae-game-app.firebasestorage.app",
  messagingSenderId: "432204053673",
  appId: "1:432204053673:web:3749716786972ff4a8bdb8",
};

const FIREBASE_SDK_VERSION = "10.14.1";

let firestorePromise = null;

function loadFirestore() {
  if (!firestorePromise) {
    firestorePromise = (async () => {
      const [{ initializeApp }, firestoreMod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = initializeApp(FIREBASE_CONFIG);
      const db = firestoreMod.getFirestore(app);
      return { db, ...firestoreMod };
    })();
  }
  return firestorePromise;
}

function entriesRef(f, gameId) {
  return f.collection(f.db, "rankings", gameId, "entries");
}

// 점수를 등록합니다. entry에는 score/name/ts/rankScore(+게임별 추가 필드)가 있어야 합니다.
// 성공하면 true, 네트워크 문제 등으로 실패하면 false를 돌려줍니다.
async function submitEntry(gameId, entry) {
  try {
    const f = await loadFirestore();
    await f.addDoc(entriesRef(f, gameId), entry);
    return true;
  } catch (e) {
    console.error("[CloudRanking] submitEntry 실패", e);
    return false;
  }
}

// rankScore 기준 상위 n개를 가져옵니다. 실패하면 null.
async function getTopEntries(gameId, n) {
  try {
    const f = await loadFirestore();
    const q = f.query(entriesRef(f, gameId), f.orderBy("rankScore", "desc"), f.limit(n));
    const snap = await f.getDocs(q);
    return snap.docs.map((d) => d.data());
  } catch (e) {
    console.error("[CloudRanking] getTopEntries 실패", e);
    return null;
  }
}

// 주어진 rankScore보다 높은 기록 수 + 1 = 순위. 실패하면 null.
async function getRank(gameId, rankScore) {
  try {
    const f = await loadFirestore();
    const q = f.query(entriesRef(f, gameId), f.where("rankScore", ">", rankScore));
    const snap = await f.getCountFromServer(q);
    return snap.data().count + 1;
  } catch (e) {
    console.error("[CloudRanking] getRank 실패", e);
    return null;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function nameOrAnon(entry) {
  return entry && entry.name ? escapeHtml(entry.name) : "-";
}

// rankMessageEl / rankingListEl 에 결과를 그립니다.
// rank, top 이 null이면(네트워크 실패) 안내 문구만 보여줍니다.
function renderRanking(rankMessageEl, rankingListEl, { rank, top, entry }) {
  rankingListEl.innerHTML = "";

  if (rank == null || top == null) {
    rankMessageEl.textContent = "랭킹 서버에 연결할 수 없어요.";
    return;
  }

  rankMessageEl.textContent = `역대 ${rank}위!`;

  const heading = document.createElement("h2");
  heading.textContent = "🏆 랭킹 TOP 5";
  rankingListEl.appendChild(heading);

  const ol = document.createElement("ol");
  top.forEach((r, i) => {
    const li = document.createElement("li");
    if (r.ts === entry.ts) li.classList.add("me");
    li.innerHTML = `<span>${i + 1}위</span><span>${r.score}점</span><span>${nameOrAnon(r)}</span>`;
    ol.appendChild(li);
  });

  if (rank > top.length) {
    const li = document.createElement("li");
    li.classList.add("me");
    li.innerHTML = `<span>${rank}위</span><span>${entry.score}점 (내 기록)</span><span>${nameOrAnon(entry)}</span>`;
    ol.appendChild(li);
  }

  rankingListEl.appendChild(ol);
}

window.CloudRanking = {
  submitEntry,
  getTopEntries,
  getRank,
  escapeHtml,
  nameOrAnon,
  renderRanking,
};
