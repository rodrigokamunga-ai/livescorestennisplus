(() => {
  "use strict";

  const PublicApp = (() => {
    const db = firebase.firestore();
    const state = { cachedMatches: [], timer: null };

    const el = {
      scheduledList: document.getElementById("scheduledList"),
      liveList: document.getElementById("liveList"),
      finishedList: document.getElementById("finishedList"),
      countScheduled: document.getElementById("countScheduled"),
      countLive: document.getElementById("countLive"),
      countFinished: document.getElementById("countFinished")
    };

    const U = {
      escapeHtml(str = "") {
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      },

      normalizeText(value, fallback = "") {
        const txt = (value ?? fallback).toString().trim();
        return txt || fallback;
      },

      durationText(ms) {
        if (!ms || ms < 0) return "00:00:00";
        const s = Math.floor(ms / 1000);
        const h = String(Math.floor(s / 3600)).padStart(2, "0");
        const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
        const sec = String(s % 60).padStart(2, "0");
        return `${h}:${m}:${sec}`;
      },

      statusLabel(status) {
        switch (status) {
          case "live": return "EM ANDAMENTO";
          case "finished": return "FINALIZADA";
          case "wo": return "FINALIZADA POR WO";
          default: return "NÃO INICIADA";
        }
      },

      statusClass(status) {
        switch (status) {
          case "live": return "status-live";
          case "finished":
          case "wo": return "status-finished";
          default: return "status-scheduled";
        }
      },

      normalizeScore(score = {}) {
        return {
          points1: Number(score.points1 || 0),
          points2: Number(score.points2 || 0),
          games1: Number(score.games1 || 0),
          games2: Number(score.games2 || 0),
          sets1: Number(score.sets1 || 0),
          sets2: Number(score.sets2 || 0),
          tieBreakMode:
            score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
              ? score.tieBreakMode
              : null,
          tieBreakPoints1: Number(score.tieBreakPoints1 || 0),
          tieBreakPoints2: Number(score.tieBreakPoints2 || 0),
          lastTieBreakMode:
            score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10"
              ? score.lastTieBreakMode
              : null,
          lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
          lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0),
          setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
          server: score.server || "player1"
        };
      },

      isTieBreakMode(score) {
        return score.tieBreakMode === "tb7" || score.tieBreakMode === "super10";
      },

      getCurrentSetNumber(score) {
        return (Array.isArray(score?.setHistory) ? score.setHistory.length : 0) + 1;
      },

      tennisPointLabel(points) {
        switch (points) {
          case 0: return "0";
          case 1: return "15";
          case 2: return "30";
          case 3: return "40";
          default: return "40";
        }
      },

      tennisDeuceAdv(points1, points2) {
        if (points1 >= 3 && points2 >= 3) {
          if (points1 === points2) return "DEUCE";
          if (points1 === points2 + 1) return "AD1";
          if (points2 === points1 + 1) return "AD2";
        }
        return null;
      },

      getServerPosition(match, score) {
        const server = String(score.server || match.server || "player1");
        return server === "player2" ? 2 : 1;
      },

      getStartedAtMs(match) {
        const started = match.startedAt?.toDate
          ? match.startedAt.toDate()
          : (match.startedAt ? new Date(match.startedAt) : null);
        return started && !isNaN(started.getTime()) ? started.getTime() : null;
      },

      buildDuration(match) {
        if (match.status === "live") {
          const startedAtMs = U.getStartedAtMs(match);
          return startedAtMs ? U.durationText(Date.now() - startedAtMs) : "00:00:00";
        }
        return U.durationText((match.durationSeconds || 0) * 1000);
      },

      getPointDisplay(score) {
        if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
          return {
            p1: String(score.tieBreakPoints1 ?? 0),
            p2: String(score.tieBreakPoints2 ?? 0)
          };
        }

        if (score.lastTieBreakMode === "super10") {
          return {
            p1: String(score.lastTieBreakPoints1 ?? 0),
            p2: String(score.lastTieBreakPoints2 ?? 0)
          };
        }

        const deuceAdv = U.tennisDeuceAdv(score.points1, score.points2);
        if (deuceAdv === "DEUCE") return { p1: "40", p2: "40" };
        if (deuceAdv === "AD1") return { p1: "AD", p2: "40" };
        if (deuceAdv === "AD2") return { p1: "40", p2: "AD" };

        return {
          p1: U.tennisPointLabel(score.points1),
          p2: U.tennisPointLabel(score.points2)
        };
      },

      getSetColumns(score) {
        const history = Array.isArray(score.setHistory) ? score.setHistory : [];

        function formatSet(setObj) {
          if (!setObj) return { p1: "--", p2: "--" };

          if (setObj.tieBreakMode === "tb7") {
            return {
              p1: `${setObj.games1 ?? 0}<sup>${setObj.tieBreakPoints1 ?? 0}</sup>`,
              p2: `${setObj.games2 ?? 0}<sup>${setObj.tieBreakPoints2 ?? 0}</sup>`
            };
          }

          if (setObj.tieBreakMode === "super10") {
            return {
              p1: String(setObj.games1 ?? 0),
              p2: String(setObj.games2 ?? 0)
            };
          }

          return {
            p1: String(setObj.games1 ?? 0),
            p2: String(setObj.games2 ?? 0)
          };
        }

        const currentSetNumber = U.getCurrentSetNumber(score);

        const set1 = history[0]
          ? formatSet(history[0])
          : (currentSetNumber === 1
              ? { p1: String(score.games1 ?? 0), p2: String(score.games2 ?? 0) }
              : { p1: "--", p2: "--" });

        const set2 = history[1]
          ? formatSet(history[1])
          : (currentSetNumber === 2
              ? { p1: String(score.games1 ?? 0), p2: String(score.games2 ?? 0) }
              : { p1: "--", p2: "--" });

        return { set1, set2 };
      }
    };

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

    function renderEmpty(message) {
      return `<div class="public-card empty-card"><div class="card-title">${U.escapeHtml(message)}</div></div>`;
    }

    function createCard(match) {
      const p1 = U.escapeHtml(U.normalizeText(match.player1, "JOGADOR 1"));
      const p2 = U.escapeHtml(U.normalizeText(match.player2, "JOGADOR 2"));
      const category = U.escapeHtml(U.normalizeText(match.categoryName, "ATP 250"));
      const court = U.escapeHtml(U.normalizeText(match.court, ""));
      const stage = U.escapeHtml(U.normalizeText(match.tournamentStage, ""));
      const format = U.escapeHtml(U.normalizeText(match.matchFormat, "2 sets com vantagem + um supertiebreak de 10 pontos"));
      const status = match.status || "scheduled";
      const score = U.normalizeScore(match.score);
      const setColumns = U.getSetColumns(score);
      const server = U.getServerPosition(match, score);
      const serverP1 = server === 1 ? "🎾 " : "";
      const serverP2 = server === 2 ? "🎾 " : "";
      const duration = U.buildDuration(match);
      const pointsDisplay = U.getPointDisplay(score);

      return ` <article class="public-card match-board compact-match-board"> <div class="match-board-top compact-top"> <div class="match-chip">${category}</div> <div class="match-status ${U.statusClass(status)}">${U.statusLabel(status)}</div> </div> <div class="match-format compact-format"> <span>Formato do jogo:</span> <strong>${format}</strong> </div> <div class="match-table-head compact-head"> <div>JOGADOR</div> <div>1º SET</div> <div>2º SET</div> <div>PONTOS</div> </div> <div class="match-player-row compact-row"> <div class="player-name">${serverP1}${p1}</div> <div class="score green">${setColumns.set1.p1}</div> <div class="score green">${setColumns.set2.p1}</div> <div class="score gray">${pointsDisplay.p1 || "0"}</div> </div> <div class="match-player-row compact-row"> <div class="player-name">${serverP2}${p2}</div> <div class="score green">${setColumns.set1.p2}</div> <div class="score green">${setColumns.set2.p2}</div> <div class="score gray">${pointsDisplay.p2 || "0"}</div> </div> 
      
      <div class="match-footer compact-footer"> ${stage ? `<span>Fase: <strong>${stage}</strong></span>`
       : ""} ${duration ? `<span>Duração: <strong>${duration}</strong></span>` : ""} ${court ? `<span>Quadra: 
       <strong>${court}</strong></span>` : ""} ${match.matchDateTime ? `<span>Data: <strong>${formatDateTime(match.matchDateTime)}
       </strong></span>` : ""} </div> </article> `;
    }

    function renderLists(matches) {
      const scheduled = matches.filter(m => (m.status || "scheduled") === "scheduled");
      const live = matches.filter(m => m.status === "live");
      const finished = matches.filter(m => m.status === "finished" || m.status === "wo");

      if (el.countScheduled) el.countScheduled.textContent = scheduled.length;
      if (el.countLive) el.countLive.textContent = live.length;
      if (el.countFinished) el.countFinished.textContent = finished.length;

      if (el.scheduledList) {
        el.scheduledList.innerHTML = scheduled.length
          ? scheduled.map(createCard).join("")
          : renderEmpty("Nenhum jogo do dia");
      }

      if (el.liveList) {
        el.liveList.innerHTML = live.length
          ? live.map(createCard).join("")
          : renderEmpty("Nenhuma partida em andamento");
      }

      if (el.finishedList) {
        el.finishedList.innerHTML = finished.length
          ? finished.map(createCard).join("")
          : renderEmpty("Nenhuma partida finalizada");
      }
    }

    function listenMatches() {
      db.collection("matches").onSnapshot(
        (snapshot) => {
          state.cachedMatches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          state.cachedMatches.sort((a, b) => {
            const da = a.matchDateTime?.toDate
              ? a.matchDateTime.toDate().getTime()
              : new Date(a.matchDateTime || 0).getTime();
            const dbv = b.matchDateTime?.toDate
              ? b.matchDateTime.toDate().getTime()
              : new Date(b.matchDateTime || 0).getTime();
            return da - dbv;
          });
          renderLists(state.cachedMatches);
        },
        (error) => {
          console.error("Erro ao carregar partidas:", error);
          if (el.scheduledList) el.scheduledList.innerHTML = renderEmpty("Erro ao carregar jogos");
          if (el.liveList) el.liveList.innerHTML = renderEmpty("Erro ao carregar jogos");
          if (el.finishedList) el.finishedList.innerHTML = renderEmpty("Erro ao carregar jogos");
        }
      );
    }

    function refreshLiveDurations() {
      if (state.cachedMatches.length) renderLists(state.cachedMatches);
    }

    function init() {
      listenMatches();
      state.timer = setInterval(refreshLiveDurations, 1000);
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => PublicApp.init());
})();