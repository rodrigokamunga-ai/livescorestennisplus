const db = firebase.firestore();

const scheduledList = document.getElementById("scheduledList");
const liveList = document.getElementById("liveList");
const finishedList = document.getElementById("finishedList");

const countScheduled = document.getElementById("countScheduled");
const countLive = document.getElementById("countLive");
const countFinished = document.getElementById("countFinished");

let cachedMatches = [];
let liveRenderTimer = null;

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(value, fallback = "") {
  const txt = (value ?? fallback).toString().trim();
  return txt || fallback;
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    const d = value.toDate ? value.toDate() : new Date(value);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(d);
  } catch {
    return "";
  }
}

function durationText(ms) {
  if (!ms || ms < 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function statusLabel(status) {
  switch (status) {
    case "live":
      return "EM ANDAMENTO";
    case "finished":
      return "FINALIZADA";
    case "wo":
      return "FINALIZADA POR WO";
    default:
      return "NÃO INICIADA";
  }
}

function statusClass(status) {
  switch (status) {
    case "live":
      return "status-live";
    case "finished":
    case "wo":
      return "status-finished";
    default:
      return "status-scheduled";
  }
}

function normalizeScore(score = {}) {
  return {
    points1: score.points1 || 0,
    points2: score.points2 || 0,
    games1: score.games1 || 0,
    games2: score.games2 || 0,
    sets1: score.sets1 || 0,
    sets2: score.sets2 || 0,
    tieBreakMode: score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
      ? score.tieBreakMode
      : null,
    tieBreakPoints1: score.tieBreakPoints1 || 0,
    tieBreakPoints2: score.tieBreakPoints2 || 0,
    setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
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

function isTieBreakMode(score) {
  return score.tieBreakMode === "tb7" || score.tieBreakMode === "super10";
}

function getPointDisplay(score) {
  if (isTieBreakMode(score)) {
    return `${score.tieBreakPoints1 || 0} x ${score.tieBreakPoints2 || 0}`;
  }

  const deuceAdv = tennisDeuceAdv(score.points1, score.points2);

  if (deuceAdv === "DEUCE") return "40 x 40";
  if (deuceAdv === "AD1") return "AD x 40";
  if (deuceAdv === "AD2") return "40 x AD";

  return `${tennisPointLabel(score.points1)} x ${tennisPointLabel(score.points2)}`;
}

function getSetColumns(score) {
  const history = Array.isArray(score.setHistory) ? score.setHistory : [];

  return {
    set1: history[0]
      ? { p1: history[0].games1 ?? "--", p2: history[0].games2 ?? "--" }
      : { p1: score.games1 ?? "--", p2: score.games2 ?? "--" },
    set2: history[1]
      ? { p1: history[1].games1 ?? "--", p2: history[1].games2 ?? "--" }
      : { p1: history[0] ? (score.games1 ?? "--") : "--", p2: history[0] ? (score.games2 ?? "--") : "--" }
  };
}

function getServerPosition(match, score) {
  const server = String(score.server || match.server || "player1");
  return server === "player2" ? 2 : 1;
}

function getStartedAtMs(match) {
  const started = match.startedAt?.toDate
    ? match.startedAt.toDate()
    : (match.startedAt ? new Date(match.startedAt) : null);

  if (started && !isNaN(started.getTime())) {
    return started.getTime();
  }

  return null;
}

function buildDuration(match) {
  if (match.status === "live") {
    const startedAtMs = getStartedAtMs(match);
    if (startedAtMs) {
      return durationText(Date.now() - startedAtMs);
    }
    return "00:00:00";
  }

  return durationText((match.durationSeconds || 0) * 1000);
}

function createCard(match) {
  const p1 = escapeHtml(normalizeText(match.player1, "JOGADOR 1"));
  const p2 = escapeHtml(normalizeText(match.player2, "JOGADOR 2"));

  const category = escapeHtml(normalizeText(match.categoryName, "ATP 250"));
  const court = escapeHtml(normalizeText(match.court, ""));
  const stage = escapeHtml(normalizeText(match.tournamentStage, ""));
  const format = escapeHtml(normalizeText(match.matchFormat, "2 sets com vantagem + o 3º set um supertiebreak de 10 pontos"));

  const status = match.status || "scheduled";
  const score = normalizeScore(match.score);
  const setColumns = getSetColumns(score);

  const server = getServerPosition(match, score);
  const serverP1 = server === 1 ? "🎾 " : "";
  const serverP2 = server === 2 ? "🎾 " : "";

  const duration = buildDuration(match);
  const pointsDisplay = getPointDisplay(score);
  const [pt1, pt2] = pointsDisplay.split(" x ");

  return ` <article class="public-card match-board compact-match-board"> <div class="match-board-top compact-top"> <div class="match-chip">${category}</div> <div class="match-status ${statusClass(status)}">${statusLabel(status)}</div> </div> <div class="match-format compact-format"> <span>Formato do jogo:</span> <strong>${format}</strong> </div> <div class="match-table-head compact-head"> <div>JOGADOR</div> <div>1º SET</div> <div>2º SET</div> <div>PONTOS</div> </div> <div class="match-player-row compact-row"> <div class="player-name">${serverP1}${p1}</div> <div class="score green">${setColumns.set1.p1}</div> <div class="score green">${setColumns.set2.p1}</div> <div class="score gray">${pt1 || "0"}</div> </div> <div class="match-player-row compact-row"> <div class="player-name">${serverP2}${p2}</div> <div class="score green">${setColumns.set1.p2}</div> <div class="score green">${setColumns.set2.p2}</div> <div class="score gray">${pt2 || "0"}</div> </div> <div class="match-footer compact-footer"> ${stage ? `<span>Fase: <strong>${stage}</strong></span>` : ""} ${duration ? `<span>Duração: <strong>${duration}</strong></span>` : ""} ${court ? `<span>Quadra: <strong>${court}</strong></span>` : ""} ${match.matchDateTime ? `<span>Data: <strong>${formatDateTime(match.matchDateTime)}</strong></span>` : ""} </div> </article> `;
}

function renderEmpty(message) {
  return `<div class="public-card empty-card"><div class="card-title">${escapeHtml(message)}</div></div>`;
}

function renderLists(matches) {
  const scheduled = matches.filter(m => (m.status || "scheduled") === "scheduled");
  const live = matches.filter(m => m.status === "live");
  const finished = matches.filter(m => m.status === "finished" || m.status === "wo");

  if (countScheduled) countScheduled.textContent = scheduled.length;
  if (countLive) countLive.textContent = live.length;
  if (countFinished) countFinished.textContent = finished.length;

  if (scheduledList) {
    scheduledList.innerHTML = scheduled.length
      ? scheduled.map(createCard).join("")
      : renderEmpty("Nenhum jogo do dia");
  }

  if (liveList) {
    liveList.innerHTML = live.length
      ? live.map(createCard).join("")
      : renderEmpty("Nenhuma partida em andamento");
  }

  if (finishedList) {
    finishedList.innerHTML = finished.length
      ? finished.map(createCard).join("")
      : renderEmpty("Nenhuma partida finalizada");
  }
}

function listenMatches() {
  db.collection("matches").onSnapshot(
    (snapshot) => {
      cachedMatches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      cachedMatches.sort((a, b) => {
        const da = a.matchDateTime?.toDate
          ? a.matchDateTime.toDate().getTime()
          : new Date(a.matchDateTime || 0).getTime();

        const dbv = b.matchDateTime?.toDate
          ? b.matchDateTime.toDate().getTime()
          : new Date(b.matchDateTime || 0).getTime();

        return da - dbv;
      });

      renderLists(cachedMatches);
    },
    (error) => {
      console.error("Erro ao carregar partidas:", error);

      if (scheduledList) scheduledList.innerHTML = renderEmpty("Erro ao carregar jogos");
      if (liveList) liveList.innerHTML = renderEmpty("Erro ao carregar jogos");
      if (finishedList) finishedList.innerHTML = renderEmpty("Erro ao carregar jogos");
    }
  );
}

function refreshLiveDurations() {
  if (!cachedMatches.length) return;
  renderLists(cachedMatches);
}

document.addEventListener("DOMContentLoaded", () => {
  listenMatches();

  if (liveRenderTimer) clearInterval(liveRenderTimer);
  liveRenderTimer = setInterval(refreshLiveDurations, 1000);
});