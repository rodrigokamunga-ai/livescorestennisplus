(() => {
  "use strict";

  const PublicApp = (() => {
    const db = firebase.firestore();
    const state = { cachedMatches: [], timer: null };

    const FILTER_KEY = "lsts_live_status_filter";

    const el = {
      filter: document.getElementById("liveStatusFilter"),
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
          case "live":
            return "EM ANDAMENTO";
          case "finished":
            return "FINALIZADA";
          case "wo":
            return "FINALIZADA POR WO";
          default:
            return "NÃO INICIADA";
        }
      },

      statusClass(status) {
        switch (status) {
          case "live":
            return "status-live";
          case "finished":
          case "wo":
            return "status-finished";
          default:
            return "status-scheduled";
        }
      },

      normalizeStatus(status) {
        const s = String(status || "scheduled").trim().toLowerCase();
        if (s === "live") return "live";
        if (s === "finished" || s === "wo") return "finished";
        return "scheduled";
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

      getCurrentSetNumber(score) {
        return (Array.isArray(score?.setHistory) ? score.setHistory.length : 0) + 1;
      },

      tennisPointLabel(points) {
        switch (points) {
          case 0:
            return "0";
          case 1:
            return "15";
          case 2:
            return "30";
          case 3:
            return "40";
          default:
            return "40";
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

      toDate(value) {
        if (!value) return null;
        if (value.toDate && typeof value.toDate === "function") {
          const d = value.toDate();
          return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      },

      getStartedAtMs(match) {
        const started = U.toDate(match.startedAt);
        if (started) return started.getTime();

        const updated = U.toDate(match.updatedAt);
        if (updated) return updated.getTime();

        const matchDate = U.toDate(match.matchDateTime);
        if (matchDate) return matchDate.getTime();

        return null;
      },

      buildDuration(match) {
        const startedMs = U.getStartedAtMs(match);
        const finishedMs = U.toDate(match.finishedAt)?.getTime?.() ?? null;

        if (match.status === "live") {
          return startedMs ? U.durationText(Date.now() - startedMs) : "00:00:00";
        }

        if (match.status === "finished" || match.status === "wo") {
          if (startedMs && finishedMs && finishedMs >= startedMs) {
            return U.durationText(finishedMs - startedMs);
          }

          if (match.durationSeconds && Number(match.durationSeconds) > 0) {
            return U.durationText(Number(match.durationSeconds) * 1000);
          }

          return "00:00:00";
        }

        if (match.durationSeconds && Number(match.durationSeconds) > 0) {
          return U.durationText(Number(match.durationSeconds) * 1000);
        }

        return "00:00:00";
      },

      getPointDisplay(match, score) {
        const history = Array.isArray(score.setHistory) ? score.setHistory : [];
        const lastSet = history.length ? history[history.length - 1] : null;

        const liveTieBreakMode =
          score.tieBreakMode ||
          match.tieBreakMode ||
          lastSet?.tieBreakMode ||
          null;

        const finishedTieBreakMode =
          score.lastTieBreakMode ||
          match.lastTieBreakMode ||
          lastSet?.tieBreakMode ||
          null;

        const isLiveTieBreak =
          match.status === "live" &&
          (liveTieBreakMode === "tb7" || liveTieBreakMode === "super10");

        const isFinishedTieBreak =
          (match.status === "finished" || match.status === "wo") &&
          (finishedTieBreakMode === "tb7" || finishedTieBreakMode === "super10");

        if (isLiveTieBreak) {
          return {
            p1: String(score.tieBreakPoints1 ?? match.tieBreakPoints1 ?? lastSet?.tieBreakPoints1 ?? 0),
            p2: String(score.tieBreakPoints2 ?? match.tieBreakPoints2 ?? lastSet?.tieBreakPoints2 ?? 0)
          };
        }

        if (isFinishedTieBreak) {
          return {
            p1: String(score.lastTieBreakPoints1 ?? match.lastTieBreakPoints1 ?? lastSet?.tieBreakPoints1 ?? 0),
            p2: String(score.lastTieBreakPoints2 ?? match.lastTieBreakPoints2 ?? lastSet?.tieBreakPoints2 ?? 0)
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

          if (setObj.tieBreakMode === "tb7" || setObj.tieBreakMode === "super10") {
            return {
              p1: `${setObj.games1 ?? 0}<sup>${setObj.tieBreakPoints1 ?? 0}</sup>`,
              p2: `${setObj.games2 ?? 0}<sup>${setObj.tieBreakPoints2 ?? 0}</sup>`
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
          : currentSetNumber === 1
            ? { p1: String(score.games1 ?? 0), p2: String(score.games2 ?? 0) }
            : { p1: "--", p2: "--" };

        const set2 = history[1]
          ? formatSet(history[1])
          : currentSetNumber === 2
            ? { p1: String(score.games1 ?? 0), p2: String(score.games2 ?? 0) }
            : { p1: "--", p2: "--" };

        return { set1, set2 };
      },

      getSavedFilter() {
        return localStorage.getItem(FILTER_KEY) || "all";
      },

      saveFilter(value) {
        localStorage.setItem(FILTER_KEY, value || "all");
      },

      isMobile() {
        return window.matchMedia("(max-width: 768px)").matches;
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
      const format = U.escapeHtml(
        U.normalizeText(match.matchFormat, "1 set sem vantagem + um supertiebreak de 10 pontos")
      );
      const status = U.normalizeStatus(match.status);
      const score = U.normalizeScore(match.score);
      const setColumns = U.getSetColumns(score);
      const server = U.getServerPosition(match, score);
      const serverP1 = server === 1 ? "🎾 " : "";
      const serverP2 = server === 2 ? "🎾 " : "";
      const duration = U.buildDuration(match);
      const pointsDisplay = U.getPointDisplay(match, score);

      return ` <article class="public-card match-board compact-match-board" data-status="${status}"> <div class="match-board-top compact-top"> <div class="match-chip">${category}</div> <div class="match-status ${U.statusClass(status)}">${U.statusLabel(status)}</div> </div> <div class="match-format compact-format"> <span>Formato do jogo:</span> <strong>${format}</strong> </div> <div class="match-table-head compact-head"> <div>JOGADOR</div> <div>1º SET</div> <div>2º SET</div> <div>PONTOS</div> </div> <div class="match-player-row compact-row"> <div class="player-name">${serverP1}${p1}</div> <div class="score green">${setColumns.set1.p1}</div> <div class="score green">${setColumns.set2.p1}</div> <div class="score gray">${pointsDisplay.p1 || ""}</div> </div> <div class="match-player-row compact-row"> <div class="player-name">${serverP2}${p2}</div> <div class="score green">${setColumns.set1.p2}</div> <div class="score green">${setColumns.set2.p2}</div> <div class="score gray">${pointsDisplay.p2 || ""}</div> </div> <div class="match-footer compact-footer"> ${stage ? `<span>Fase: <strong>${stage}</strong></span>` : ""} ${duration ? `<span>Duração: <strong>${duration}</strong></span>` : ""} ${court ? `<span>Quadra: <strong>${court}</strong></span>` : ""} ${match.matchDateTime ? `<span>Data: <strong>${formatDateTime(match.matchDateTime)}</strong></span>` : ""} </div> </article> `;
    }

    function getActiveFilter() {
      const saved = U.getSavedFilter();

      if (!U.isMobile()) return "all";

      if (saved === "scheduled" || saved === "live" || saved === "finished" || saved === "all") {
        return saved;
      }

      return "all";
    }

    function applyFilterAndRender(matches) {
      const selectedFilter = getActiveFilter();
      const isMobile = U.isMobile();

      const scheduled = matches
        .filter(m => U.normalizeStatus(m.status) === "scheduled")
        .sort((a, b) => {
          const da = U.toDate(a.matchDateTime)?.getTime() || 0;
          const dbv = U.toDate(b.matchDateTime)?.getTime() || 0;
          return da - dbv;
        });

      const live = matches
        .filter(m => U.normalizeStatus(m.status) === "live")
        .sort((a, b) => {
          const da = U.getStartedAtMs(a) || 0;
          const dbv = U.getStartedAtMs(b) || 0;
          return da - dbv;
        });

      const finished = matches
        .filter(m => U.normalizeStatus(m.status) === "finished")
        .sort((a, b) => {
          const fa = U.toDate(a.finishedAt)?.getTime() || U.getStartedAtMs(a) || 0;
          const fb = U.toDate(b.finishedAt)?.getTime() || U.getStartedAtMs(b) || 0;
          return fb - fa;
        });

      const scheduledVisibleBase = isMobile ? scheduled : scheduled.slice(0, 4);
      const liveVisibleBase = isMobile ? live : live.slice(0, 4);
      const finishedVisibleBase = isMobile ? finished : finished.slice(0, 4);

      const visibleScheduled =
        selectedFilter === "all" || selectedFilter === "scheduled"
          ? scheduledVisibleBase
          : [];

      const visibleLive =
        selectedFilter === "all" || selectedFilter === "live"
          ? liveVisibleBase
          : [];

      const visibleFinished =
        selectedFilter === "all" || selectedFilter === "finished"
          ? finishedVisibleBase
          : [];

      if (el.countScheduled) el.countScheduled.textContent = scheduled.length;
      if (el.countLive) el.countLive.textContent = live.length;
      if (el.countFinished) el.countFinished.textContent = finished.length;

      if (el.scheduledList) {
        el.scheduledList.innerHTML = visibleScheduled.length
          ? visibleScheduled.map(createCard).join("")
          : renderEmpty("Nenhum jogo do dia");
      }

      if (el.liveList) {
        el.liveList.innerHTML = visibleLive.length
          ? visibleLive.map(createCard).join("")
          : renderEmpty("Nenhuma partida em andamento");
      }

      if (el.finishedList) {
        el.finishedList.innerHTML = visibleFinished.length
          ? visibleFinished.map(createCard).join("")
          : renderEmpty("Nenhuma partida finalizada");
      }
    }

    function renderLists(matches) {
      applyFilterAndRender(matches);
    }

    function listenMatches() {
      db.collection("matches").onSnapshot(
        (snapshot) => {
          state.cachedMatches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          state.cachedMatches.sort((a, b) => {
            const da = U.getStartedAtMs(a) || 0;
            const dbv = U.getStartedAtMs(b) || 0;
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
      if (state.cachedMatches.length) {
        renderLists(state.cachedMatches);
      }
    }

    function initFilter() {
      if (!el.filter) return;

      const saved = U.getSavedFilter();
      el.filter.value = saved || "all";

      el.filter.addEventListener("change", () => {
        U.saveFilter(el.filter.value);
        renderLists(state.cachedMatches);
      });
    }

    function init() {
      initFilter();
      listenMatches();
      state.timer = setInterval(refreshLiveDurations, 1000);
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => PublicApp.init());
})();