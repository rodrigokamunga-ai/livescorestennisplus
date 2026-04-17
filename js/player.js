const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const matchTitle = document.getElementById("matchTitle");
const matchSubTitle = document.getElementById("matchSubTitle");
const matchDateTimeTop = document.getElementById("matchDateTimeTop");
const durationEl = document.getElementById("duration");
const statusLabel = document.getElementById("statusLabel");
const msg = document.getElementById("playerMsg");

const points1 = document.getElementById("points1");
const points2 = document.getElementById("points2");
const games1 = document.getElementById("games1");
const games2 = document.getElementById("games2");
const sets1 = document.getElementById("sets1");
const sets2 = document.getElementById("sets2");

const editGames1 = document.getElementById("editGames1");
const editGames2 = document.getElementById("editGames2");

const startBtn = document.getElementById("startBtn");
const finishBtn = document.getElementById("finishBtn");
const resetScoreBtn = document.getElementById("resetScoreBtn");

const player1Name = document.getElementById("player1Name");
const player2Name = document.getElementById("player2Name");

const servePlayer1 = document.getElementById("servePlayer1");
const servePlayer2 = document.getElementById("servePlayer2");
const serveOption1 = servePlayer1?.closest(".serve-option-inline");
const serveOption2 = servePlayer2?.closest(".serve-option-inline");

let timer = null;
let localStartedAt = null;

function setMsg(text) {
  if (msg) msg.textContent = text || "";
}

function durationText(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  if (value.toDate && typeof value.toDate === "function") {
    return value.toDate().toLocaleString("pt-BR");
  }
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toLocaleString("pt-BR");
  return value;
}

function mapStatus(status) {
  if (status === "live") return "EM ANDAMENTO";
  if (status === "finished") return "FINALIZADA";
  if (status === "wo") return "FINALIZADA POR WO";
  return "NÃO INICIADA";
}

function defaultScore() {
  return {
    points1: 0,
    points2: 0,
    games1: 0,
    games2: 0,
    sets1: 0,
    sets2: 0,
    tieBreakMode: null,
    tieBreakPoints1: 0,
    tieBreakPoints2: 0,
    setHistory: [],
    server: "player1"
  };
}

function normalizeScore(score = {}) {
  return {
    ...defaultScore(),
    ...score,
    setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
    tieBreakMode: score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
      ? score.tieBreakMode
      : null,
    server: score.server || "player1"
  };
}

function tennisPointLabel(points) {
  switch (points) {
    case 0: return "0";
    case 1: return "15";
    case 2: return "30";
    case 3: return "40";
    default: return "40";
  }
}

function tennisDeuceAdv(points1, points2) {
  if (points1 >= 3 && points2 >= 3) {
    if (points1 === points2) return "DEUCE";
    if (points1 === points2 + 1) return "AD1";
    if (points2 === points1 + 1) return "AD2";
  }
  return null;
}

function getPointText(score) {
  if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
    return {
      p1: String(score.tieBreakPoints1 ?? 0),
      p2: String(score.tieBreakPoints2 ?? 0)
    };
  }

  const deuceAdv = tennisDeuceAdv(score.points1, score.points2);

  if (deuceAdv === "DEUCE") return { p1: "40", p2: "40" };
  if (deuceAdv === "AD1") return { p1: "AD", p2: "40" };
  if (deuceAdv === "AD2") return { p1: "40", p2: "AD" };

  return {
    p1: tennisPointLabel(score.points1),
    p2: tennisPointLabel(score.points2)
  };
}

function updateServeUI(data) {
  const server = data.server || data.score?.server || "player1";

  if (servePlayer1) servePlayer1.checked = server === "player1";
  if (servePlayer2) servePlayer2.checked = server === "player2";

  if (serveOption1) serveOption1.classList.toggle("is-serving", server === "player1");
  if (serveOption2) serveOption2.classList.toggle("is-serving", server === "player2");
}

function renderInfoTop(data) {
  if (matchDateTimeTop) {
    matchDateTimeTop.textContent = formatDateTime(data.matchDateTime);
  }

  if (matchTitle) {
    matchTitle.textContent = `${data.player1 || "Jogador 1"} x ${data.player2 || "Jogador 2"}`;
  }

  if (matchSubTitle) {
    matchSubTitle.innerHTML = `Categoria: <strong>${data.categoryName || "-"}</strong> • Formato: <strong>${data.matchFormat || "-"}</strong> • Fase: <strong>${data.tournamentStage || "-"}</strong> • Quadra: <strong>${data.court || "-"}</strong>`;
  }
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startTimer(fromDate) {
  stopTimer();

  if (!fromDate) return;

  localStartedAt = fromDate;
  if (durationEl) durationEl.textContent = durationText(Date.now() - localStartedAt.getTime());

  timer = setInterval(() => {
    if (!localStartedAt || !durationEl) return;
    durationEl.textContent = durationText(Date.now() - localStartedAt.getTime());
  }, 1000);
}

function isMatchFinished(score, matchFormat) {
  const text = (matchFormat || "").toLowerCase();

  const setsToWin =
    text.includes("1 set com vantagem") ||
    text.includes("1 set sem vantagem") ||
    text.includes("1 set pro")
      ? 1
      : 2;

  return score.sets1 >= setsToWin || score.sets2 >= setsToWin;
}

function getMatchWinner(score, matchFormat) {
  const text = (matchFormat || "").toLowerCase();

  const setsToWin =
    text.includes("1 set com vantagem") ||
    text.includes("1 set sem vantagem") ||
    text.includes("1 set pro")
      ? 1
      : 2;

  if (score.sets1 >= setsToWin) return 1;
  if (score.sets2 >= setsToWin) return 2;
  return 0;
}

function renderMatch(data) {
  const score = normalizeScore(data.score);

  if (player1Name) player1Name.textContent = data.player1 || "Jogador 1";
  if (player2Name) player2Name.textContent = data.player2 || "Jogador 2";

  const pts = getPointText(score);
  if (points1) points1.textContent = pts.p1;
  if (points2) points2.textContent = pts.p2;

  if (games1) games1.textContent = score.games1 ?? 0;
  if (games2) games2.textContent = score.games2 ?? 0;
  if (sets1) sets1.textContent = score.sets1 ?? 0;
  if (sets2) sets2.textContent = score.sets2 ?? 0;

  if (editGames1) editGames1.value = score.games1 ?? 0;
  if (editGames2) editGames2.value = score.games2 ?? 0;

  if (statusLabel) statusLabel.textContent = mapStatus(data.status);

  if (startBtn) startBtn.disabled = data.status === "live";
  if (finishBtn) finishBtn.disabled = data.status !== "live";

  renderInfoTop(data);
  updateServeUI(data);

  if (data.status === "live") {
    const started = data.startedAt?.toDate
      ? data.startedAt.toDate()
      : (data.startedAt ? new Date(data.startedAt) : null);

    if (started && !isNaN(started.getTime())) {
      startTimer(started);
    } else {
      stopTimer();
      if (durationEl) durationEl.textContent = "00:00:00";
    }
  } else {
    stopTimer();
    const savedSeconds = data.durationSeconds || 0;
    if (durationEl) durationEl.textContent = durationText(savedSeconds * 1000);
  }
}

function loadMatch() {
  if (!id) {
    setMsg("ID da partida não informado.");
    return;
  }

  __db.collection("matches").doc(id).onSnapshot(
    (snap) => {
      if (!snap.exists) {
        setMsg("Partida não encontrada.");
        return;
      }

      renderMatch(snap.data());
    },
    (err) => {
      console.error(err);
      setMsg(err.message);
    }
  );
}

async function saveScore(updateFn) {
  if (!id) return;

  const ref = __db.collection("matches").doc(id);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      setMsg("Partida não encontrada.");
      return;
    }

    const data = snap.data();
    const score = normalizeScore(data.score);
    const result = updateFn(score, data) || {};

    score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];
    score.server = score.server || data.server || "player1";
    score.tieBreakMode = score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
      ? score.tieBreakMode
      : null;

    const finished = isMatchFinished(score, data.matchFormat);
    const winner = getMatchWinner(score, data.matchFormat);

    await ref.update({
      score: {
        ...score,
        setHistory: score.setHistory
      },
      server: score.server,
      status: finished ? "finished" : data.status,
      finishedAt: finished ? firebase.firestore.FieldValue.serverTimestamp() : (data.finishedAt || null),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      winnerByWO: winner ? (winner === 1 ? "player1" : "player2") : (data.winnerByWO || ""),
      startedAt: data.startedAt || null,
      durationSeconds: data.durationSeconds || 0
    });

    if (result.tieBreakStarted) {
      setMsg("Tie-break iniciado.");
    }
  } catch (err) {
    console.error(err);
    setMsg(err.message);
  }
}

if (startBtn) {
  startBtn.addEventListener("click", async () => {
    if (!id) return;

    try {
      const startedAt = firebase.firestore.Timestamp.now();

      await __db.collection("matches").doc(id).update({
        status: "live",
        startedAt,
        durationSeconds: 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      startTimer(startedAt.toDate());
      setMsg("Partida iniciada.");
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
}

if (finishBtn) {
  finishBtn.addEventListener("click", async () => {
    if (!id) return;

    try {
      const ref = __db.collection("matches").doc(id);
      const snap = await ref.get();

      if (!snap.exists) {
        setMsg("Partida não encontrada.");
        return;
      }

      const data = snap.data();

      let durationSeconds = data.durationSeconds || 0;
      const started = data.startedAt?.toDate
        ? data.startedAt.toDate()
        : (data.startedAt ? new Date(data.startedAt) : null);

      if (started && !isNaN(started.getTime())) {
        durationSeconds = Math.floor((Date.now() - started.getTime()) / 1000);
      }

      stopTimer();

      const score = normalizeScore(data.score);

      await ref.update({
        status: data.winnerByWO ? "wo" : "finished",
        finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
        durationSeconds,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        score: {
          ...score,
          setHistory: Array.isArray(score.setHistory) ? score.setHistory : []
        },
        server: score.server || data.server || "player1",
        startedAt: data.startedAt || null
      });

      if (durationEl) durationEl.textContent = durationText(durationSeconds * 1000);
      setMsg("Partida finalizada.");
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
}

if (resetScoreBtn) {
  resetScoreBtn.addEventListener("click", async () => {
    if (!id) return;

    try {
      await __db.collection("matches").doc(id).update({
        score: defaultScore(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      setMsg("Placar zerado.");
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
}

document.querySelectorAll("[data-delta]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const target = btn.dataset.target;
    const delta = Number(btn.dataset.delta);

    await saveScore((score, data) => {
      const player = target === "player1" ? 1 : 2;

      if (delta > 0) {
        const result = updateScoreWithPoint(score, player, data.matchFormat);
        if (result.tieBreakStarted) setMsg("Tie-break iniciado.");
      } else {
        if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
          if (player === 1) score.tieBreakPoints1 = Math.max(0, score.tieBreakPoints1 - 1);
          if (player === 2) score.tieBreakPoints2 = Math.max(0, score.tieBreakPoints2 - 1);
        } else {
          removePoint(score, player);
        }
      }

      score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];
      score.server = score.server || data.server || "player1";
      score.tieBreakMode = score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
        ? score.tieBreakMode
        : null;
    });
  });
});

document.querySelectorAll("[data-save]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const target = btn.dataset.save;
    const value = Number(target === "player1-games" ? editGames1?.value : editGames2?.value);

    try {
      const ref = __db.collection("matches").doc(id);
      const snap = await ref.get();

      if (!snap.exists) {
        setMsg("Partida não encontrada.");
        return;
      }

      const data = snap.data();
      const score = normalizeScore(data.score);

      if (target === "player1-games") {
        score.games1 = value;
      } else if (target === "player2-games") {
        score.games2 = value;
      }

      score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];
      score.server = score.server || data.server || "player1";

      await ref.update({
        score: {
          ...score,
          setHistory: score.setHistory
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        server: score.server
      });

      setMsg("Games atualizados.");
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
});

if (servePlayer1) {
  servePlayer1.addEventListener("change", async () => {
    if (!id) return;

    try {
      const ref = __db.collection("matches").doc(id);
      const snap = await ref.get();

      if (!snap.exists) {
        setMsg("Partida não encontrada.");
        return;
      }

      const data = snap.data();
      const score = normalizeScore(data.score);

      score.server = "player1";
      score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];

      await ref.update({
        score: {
          ...score,
          setHistory: score.setHistory
        },
        server: "player1",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      updateServeUI({ server: "player1" });
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
}

if (servePlayer2) {
  servePlayer2.addEventListener("change", async () => {
    if (!id) return;

    try {
      const ref = __db.collection("matches").doc(id);
      const snap = await ref.get();

      if (!snap.exists) {
        setMsg("Partida não encontrada.");
        return;
      }

      const data = snap.data();
      const score = normalizeScore(data.score);

      score.server = "player2";
      score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];

      await ref.update({
        score: {
          ...score,
          setHistory: score.setHistory
        },
        server: "player2",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      updateServeUI({ server: "player2" });
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
}

loadMatch();