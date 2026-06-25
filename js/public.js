(() => {
  "use strict";

  const PublicApp = (() => {
    const db = firebase.firestore();

    const params = new URLSearchParams(window.location.search);
    const ownerId = params.get("ownerId") || "";
    const shareToken = params.get("shareToken") || "";
    const matchId = params.get("id") || "";

    const state = {
      cachedMatches: [],
      timer: null,
      unsubscribe: null,
      unsubscribeSingle: null
    };

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
          case "live": return "EM ANDAMENTO";
          case "suspended": return "SUSPENSA";
          case "finished": return "FINALIZADA";
          case "wo": return "FINALIZADA POR WO";
          default: return "NÃO INICIADA";
        }
      },

      statusClass(status) {
        switch (status) {
          case "live": return "status-live";
          case "suspended": return "status-suspended";
          case "finished":
          case "wo": return "status-finished";
          default: return "status-scheduled";
        }
      },

      normalizeStatus(status) {
        const s = String(status || "scheduled").trim().toLowerCase();
        if (s === "live") return "live";
        if (s === "suspended") return "suspended";
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
          tieBreakMode: score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
            ? score.tieBreakMode
            : null,
          tieBreakPoints1: Number(score.tieBreakPoints1 || 0),
          tieBreakPoints2: Number(score.tieBreakPoints2 || 0),
          lastTieBreakMode: score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10"
            ? score.lastTieBreakMode
            : null,
          lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
          lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0),
          setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
          server: score.server || "player1",
          advantage: score.advantage || null,
          totalPoints1: Number(score.totalPoints1 || 0),
          totalPoints2: Number(score.totalPoints2 || 0),
          breakPointsWon1: Number(score.breakPointsWon1 || 0),
          breakPointsWon2: Number(score.breakPointsWon2 || 0),
          breakPointsChances1: Number(score.breakPointsChances1 || 0),
          breakPointsChances2: Number(score.breakPointsChances2 || 0)
        };
      },

      tennisPointLabel(points) {
        switch (Number(points || 0)) {
          case 0: return "0";
          case 1: return "15";
          case 2: return "30";
          case 3: return "40";
          default: return "40";
        }
      },

      getPointDisplay(score, matchFormat, isFinished = false) {
        if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
          return {
            p1: String(score.tieBreakPoints1 ?? 0),
            p2: String(score.tieBreakPoints2 ?? 0)
          };
        }

        if (
          isFinished &&
          (score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10")
        ) {
          return {
            p1: String(score.lastTieBreakPoints1 ?? 0),
            p2: String(score.lastTieBreakPoints2 ?? 0)
          };
        }

        const fmt = String(matchFormat || "").toLowerCase();
        const noAd = fmt.includes("sem vantagem") || fmt.includes("no ad") || fmt.includes("no-ad");
        const hasAd = fmt.includes("com vantagem") || fmt.includes("3 sets");
        const p1 = score.points1;
        const p2 = score.points2;

        if (hasAd && !noAd) {
          if (score.advantage === "player1") return { p1: "AD", p2: "40" };
          if (score.advantage === "player2") return { p1: "40", p2: "AD" };
          if (p1 >= 3 && p2 >= 3) {
            if (p1 === p2) return { p1: "40", p2: "40" };
            if (p1 > p2) return { p1: "AD", p2: "40" };
            if (p2 > p1) return { p1: "40", p2: "AD" };
          }
          return { p1: U.tennisPointLabel(p1), p2: U.tennisPointLabel(p2) };
        }

        if (noAd) {
          if (p1 === 3 && p2 === 3) return { p1: "40", p2: "40" };
          return { p1: U.tennisPointLabel(p1), p2: U.tennisPointLabel(p2) };
        }

        if (score.advantage === "player1") return { p1: "AD", p2: "40" };
        if (score.advantage === "player2") return { p1: "40", p2: "AD" };
        if (p1 >= 3 && p2 >= 3) {
          if (p1 === p2) return { p1: "40", p2: "40" };
          if (p1 > p2) return { p1: "AD", p2: "40" };
          if (p2 > p1) return { p1: "40", p2: "AD" };
        }
        return { p1: U.tennisPointLabel(p1), p2: U.tennisPointLabel(p2) };
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
        const accumulated = Number(match.accumulatedSeconds || 0);

        if (match.status === "suspended") {
          return U.durationText(accumulated * 1000);
        }

        if (match.status === "live") {
          const started = U.toDate(match.startedAt);
          if (started && !isNaN(started.getTime())) {
            const elapsed = Math.floor((Date.now() - started.getTime()) / 1000);
            return U.durationText((accumulated + elapsed) * 1000);
          }
          return U.durationText(accumulated * 1000);
        }

        if (match.status === "finished" || match.status === "wo") {
          if (match.durationSeconds && Number(match.durationSeconds) > 0) {
            return U.durationText(Number(match.durationSeconds) * 1000);
          }
          const startedMs = U.getStartedAtMs(match);
          const finishedMs = U.toDate(match.finishedAt)?.getTime?.() ?? null;
          if (startedMs && finishedMs && finishedMs >= startedMs) {
            return U.durationText(finishedMs - startedMs);
          }
          return "00:00:00";
        }

        if (match.durationSeconds && Number(match.durationSeconds) > 0) {
          return U.durationText(Number(match.durationSeconds) * 1000);
        }
        return "00:00:00";
      },

      getSavedFilter() { return localStorage.getItem(FILTER_KEY) || "all"; },
      saveFilter(v) { localStorage.setItem(FILTER_KEY, v || "all"); },
      isMobile() { return window.matchMedia("(max-width: 768px)").matches; },

      getMatchSummary(match) {
        const score = U.normalizeScore(match.score || {});
        const summary = match.summary || match.matchSummary || {};
        const stats = match.stats || {};
        const p1Stats = stats.player1 || {};
        const p2Stats = stats.player2 || {};

        const total1 = Number(
          summary.totalPoints1 ??
          score.totalPoints1 ??
          p1Stats.totalPointsWon ??
          0
        );

        const total2 = Number(
          summary.totalPoints2 ??
          score.totalPoints2 ??
          p2Stats.totalPointsWon ??
          0
        );

        return {
          totalPoints1: total1,
          totalPoints2: total2,
          breakPointsWon1: Number(summary.breakPointsWon1 ?? score.breakPointsWon1 ?? 0),
          breakPointsChances1: Number(summary.breakPointsChances1 ?? score.breakPointsChances1 ?? 0),
          breakPointsWon2: Number(summary.breakPointsWon2 ?? score.breakPointsWon2 ?? 0),
          breakPointsChances2: Number(summary.breakPointsChances2 ?? score.breakPointsChances2 ?? 0)
        };
      },

      formatBreakPoints(won, chances) {
        return `${Number(won || 0)} / ${Number(chances || 0)}`;
      },

      getWinnerPosition(match, score) {
        const status = String(match?.status || "").trim().toLowerCase();
        const woWinner = String(match?.winnerByWO || "").trim().toLowerCase();
        if (status === "wo") {
          if (woWinner === "player1") return 1;
          if (woWinner === "player2") return 2;
        }
        if (Number(score.sets1 || 0) > Number(score.sets2 || 0)) return 1;
        if (Number(score.sets2 || 0) > Number(score.sets1 || 0)) return 2;
        return null;
      },

      getLastActionSnapshot(match) {
        const la = match?.lastAction || null;
        if (!la) return null;
        return {
          score: U.normalizeScore(la.score || {}),
          status: String(la.status || "live"),
          winnerByWO: String(la.winnerByWO || ""),
          server: String(la.server || "player1"),
          durationSeconds: Number(la.durationSeconds || 0),
          startedAt: la.startedAt || null,
          finishedAt: la.finishedAt || null
        };
      },

      getSetColumns(match, score) {
        const history = Array.isArray(score.setHistory) ? score.setHistory : [];
        const fmt = String(match.matchFormat || "").toLowerCase();

        const hasTwoSets = fmt.includes("2 sets");
        const hasThreeSets = fmt.includes("3 sets");

        function formatSet(setObj, isCurrent = false, matchStatus = "") {
          if (!setObj) return { p1: "--", p2: "--" };

          const g1 = Number(setObj.games1 ?? 0);
          const g2 = Number(setObj.games2 ?? 0);
          const tb1 = Number(setObj.tieBreakPoints1 ?? 0);
          const tb2 = Number(setObj.tieBreakPoints2 ?? 0);

          const isFinished =
            String(matchStatus || "").toLowerCase() === "finished" ||
            String(matchStatus || "").toLowerCase() === "wo";

          const buildTB = (gamesWinner, tbPoints) => {
            return `<span class="set-score">${gamesWinner}<span class="set-tb">${tbPoints}</span></span>`;
          };

          if (setObj.tieBreakMode === "tb7") {
            if (tb1 > 0 || tb2 > 0) {
              const p1Won = tb1 > tb2;
              return {
                p1: buildTB(p1Won ? 7 : 6, tb1),
                p2: buildTB(p1Won ? 6 : 7, tb2)
              };
            }
          }

          if (setObj.tieBreakMode === "super10") {
            if (!isFinished && isCurrent) {
              return { p1: "6", p2: "6" };
            }

            if (tb1 > 0 || tb2 > 0) {
              const p1Won = tb1 > tb2;
              return {
                p1: buildTB(p1Won ? 7 : 6, tb1),
                p2: buildTB(p1Won ? 6 : 7, tb2)
              };
            }

            return { p1: "6", p2: "6" };
          }

          return { p1: String(g1), p2: String(g2) };
        }

        const currentSetNum = history.length + 1;
        const currentSetData = {
          p1: String(score.games1 ?? 0),
          p2: String(score.games2 ?? 0)
        };

        function getSet(index) {
          if (history[index]) {
            return formatSet(history[index], false, match.status);
          }

          if (currentSetNum === index + 1) {
            const currentIsSuperTB = score.tieBreakMode === "super10";

            if (
              currentIsSuperTB &&
              String(match.status || "").toLowerCase() !== "finished" &&
              String(match.status || "").toLowerCase() !== "wo"
            ) {
              return { p1: "6", p2: "6" };
            }

            return currentSetData;
          }

          return { p1: "--", p2: "--" };
        }

        const set1 = getSet(0);
        const set2 = (hasTwoSets || hasThreeSets) ? getSet(1) : null;
        const set3 = hasThreeSets ? getSet(2) : null;

        return { hasTwoSets, hasThreeSets, set1, set2, set3 };
      },

      isBreakPoint(score, matchFormat) {
        const fmt = String(matchFormat || "").toLowerCase();
        const noAd = fmt.includes("sem vantagem") || fmt.includes("no ad") || fmt.includes("no-ad");
        const hasAd = fmt.includes("com vantagem") || fmt.includes("3 sets");
        const server = score.server || "player1";
        const sp = server === "player1" ? score.points1 : score.points2;
        const rp = server === "player1" ? score.points2 : score.points1;

        if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") return false;
        if (noAd && sp === 3 && rp === 3) return true;
        if (hasAd && !noAd) {
          if (server === "player1" && score.advantage === "player2") return true;
          if (server === "player2" && score.advantage === "player1") return true;
        }
        if (rp === 3 && sp < 3) return true;
        return false;
      }
    };

    function injectInlineStyles() {
      if (document.getElementById("publicAppInlineStyles")) return;
      const style = document.createElement("style");
      style.id = "publicAppInlineStyles";
      style.textContent = ` .match-footer-inline { display:flex; align-items:center; gap:8px; flex-wrap:nowrap; white-space:nowrap; overflow:hidden; font-size:12px; } .match-footer-inline span { white-space:nowrap; flex:0 0 auto; } .team-name-compact { white-space:pre-line; display:inline-block; font-weight:700; font-size:0.86rem; line-height:1.15; overflow-wrap:anywhere; word-break:break-word; } .player-name.team-name-compact { text-transform:none !important; } .serve-ball { display:inline-block; width:9px; height:9px; border-radius:50%; background:#d8ff63; box-shadow:0 0 6px rgba(216,255,99,0.75); margin-right:5px; flex-shrink:0; vertical-align:middle; } .tb-active-label { text-align:center; font-size:0.70rem; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; color:#d8ff63; padding:3px 0 2px; } .status-suspended { color: #fbbf24; } .suspended-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:999px; background:rgba(251,191,36,0.14); border:1px solid rgba(251,191,36,0.28); color:#fbbf24; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; } .suspended-duration { text-align:center; font-size:11px; font-weight:800; color:rgba(251,191,36,0.85); padding:2px 0 4px; letter-spacing:0.04em; } .match-footer-finalized { display:flex !important; flex-direction:row !important; align-items:center !important; justify-content:flex-start !important; gap:6px !important; flex-wrap:nowrap !important; white-space:nowrap !important; overflow:hidden !important; width:100% !important; font-size:12px !important; } .match-footer-finalized .footer-item, .match-footer-finalized span { display:inline-flex !important; flex:0 0 auto !important; white-space:nowrap !important; align-items:center !important; } .match-footer-finalized .footer-sep { display:inline-flex !important; opacity:0.45 !important; flex:0 0 auto !important; } .match-footer-live { display:flex; flex-direction:column; gap:4px; font-size:12px; } .match-footer-live-row { display:flex; align-items:center; gap:8px; flex-wrap:nowrap; white-space:nowrap; overflow:hidden; } .match-footer-live-row span { white-space:nowrap; flex:0 0 auto; } .team-col { min-width:0; } .set-col { text-align:center; } .points-col { text-align:center; } /* Tie-break */ .match-board .set-col { display: inline-flex; align-items: flex-start; justify-content: center; white-space: nowrap; gap: 1px; } .match-board .set-score { display: inline-flex; align-items: flex-start; justify-content: center; white-space: nowrap; line-height: 1; } .match-board .set-tb { font-size: 0.58em !important; line-height: 1 !important; position: relative; top: -0.45em; margin-left: 1px; display: inline-block; } .team-name-compact.doubles-name { white-space: normal !important; line-height: 1.08 !important; } .team-name-compact.doubles-name .name-line { display:block; white-space: normal !important; } .match-summary .summary-label, .match-summary .summary-value, .match-summary-title { word-break: break-word !important; overflow-wrap: anywhere !important; white-space: normal !important; } .match-table-head, .match-player-row { column-gap: 12px !important; } .match-board[data-status="finished"] .match-status.status-finished, .match-status.status-finished { display: inline-flex !important; align-items: center !important; justify-content: center !important; padding: 4px 10px !important; border-radius: 999px !important; background: rgba(239, 68, 68, 0.16) !important; border: 1px solid rgba(239, 68, 68, 0.35) !important; color: #ff5f5f !important; font-weight: 900 !important; letter-spacing: 0.03em !important; text-transform: uppercase !important; } .match-status.status-wo { display: inline-flex !important; align-items: center !important; justify-content: center !important; padding: 4px 10px !important; border-radius: 999px !important; background: rgba(239, 68, 68, 0.16) !important; border: 1px solid rgba(239, 68, 68, 0.35) !important; color: #ff5f5f !important; font-weight: 900 !important; letter-spacing: 0.03em !important; text-transform: uppercase !important; } .stats-block { margin-top: 14px; } .stats-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px; margin-top:10px; } .stat-card { background: rgba(25, 34, 54, 0.82); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 18px; padding: 14px 16px 16px; min-height: 86px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 10px 24px rgba(0,0,0,0.15); } .stat-title { text-align:center; color:#a9c6e6; font-size:0.88rem; line-height:1.15; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:10px; } .stat-values { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:0 10px; } .stat-values span { font-size:1.1rem; font-weight:800; color:#b9ff5f; min-width:44px; text-align:center; } .values-multi span { min-width:64px; } @media (max-width:768px) { .match-footer-inline { gap:6px; font-size:11px; } .team-name-compact { font-size:0.72rem; line-height:1.1; } .match-footer-finalized { font-size:10px !important; gap:4px !important; } .match-footer-live { font-size:10px; gap:3px; } .match-footer-live-row { gap:5px; } .match-table-head, .match-player-row { column-gap: 16px !important; } .team-name-compact.doubles-name { padding-right: 6px !important; } .match-board[data-status="live"] .player-name, .match-board[data-status="suspended"] .player-name, .match-board[data-status="finished"] .player-name { padding-right: 6px !important; } .match-board .set-tb { font-size: 0.55em !important; top: -0.5em !important; margin-left: 1px !important; } .stats-grid { grid-template-columns: 1fr; } .stat-card { min-height: 80px; } } `;
      document.head.appendChild(style);
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

    function renderEmpty(message) {
      return `<div class="public-card empty-card"><div class="card-title">${U.escapeHtml(message)}</div></div>`;
    }

    function getGameFormat(match) {
      return String(match?.gameFormat || "Simples").trim();
    }

    function isDoublesFormat(match) {
      const gf = getGameFormat(match);
      return gf === "Duplas" || gf === "Duplas Mistas";
    }

    function renderPlayerName(match, which) {
      const doubles = isDoublesFormat(match);

      if (!doubles) {
        const single = which === 1
          ? String(match.player1 || "Jogador 1").trim()
          : String(match.player2 || "Jogador 2").trim();
        return `<span class="name-line">${U.escapeHtml(single)}</span>`;
      }

      const p1 = which === 1
        ? String(match.player1 || "Jogador 1").trim()
        : String(match.player3 || "Jogador 3").trim();
      const p2 = which === 1
        ? String(match.player2 || "Jogador 2").trim()
        : String(match.player4 || "Jogador 4").trim();

      return `<span class="name-line">${U.escapeHtml(p1)}/</span> <span class="name-line">${U.escapeHtml(p2)}</span>`;
    }

    function getTeam1Name(match) {
      const p1 = String(match.player1 || "Jogador 1").trim();
      const p2 = String(match.player2 || "Jogador 2").trim();
      return isDoublesFormat(match) ? `${p1}/\n${p2}` : p1;
    }

    function getTeam2Name(match) {
      const p3 = String(match.player3 || "Jogador 3").trim();
      const p4 = String(match.player4 || "Jogador 4").trim();
      return isDoublesFormat(match)
        ? `${p3}/\n${p4}`
        : String(match.player2 || "Jogador 2").trim();
    }

    function getWinProbabilitiesByScore(match) {
      const score = U.normalizeScore(match.score || {});
      let p1 = 50, p2 = 50;

      p1 += (Number(score.sets1 || 0) - Number(score.sets2 || 0)) * 14;
      p2 += (Number(score.sets2 || 0) - Number(score.sets1 || 0)) * 14;
      p1 += (Number(score.games1 || 0) - Number(score.games2 || 0)) * 3;
      p2 += (Number(score.games2 || 0) - Number(score.games1 || 0)) * 3;
      p1 += (Number(score.points1 || 0) - Number(score.points2 || 0)) * 1.5;
      p2 += (Number(score.points2 || 0) - Number(score.points1 || 0)) * 1.5;

      if (score.tieBreakMode) {
        p1 += (Number(score.tieBreakPoints1 || 0) - Number(score.tieBreakPoints2 || 0)) * 4;
        p2 += (Number(score.tieBreakPoints2 || 0) - Number(score.tieBreakPoints1 || 0)) * 4;
      }

      if (score.advantage === "player1") p1 += 5;
      if (score.advantage === "player2") p2 += 5;

      p1 = Math.max(0, Math.min(100, Math.round(p1)));
      p2 = 100 - p1;
      return { p1, p2 };
    }

    function renderWinProbabilityChart(match) {
      const { p1, p2 } = getWinProbabilitiesByScore(match);
      if (p1 <= 0 && p2 <= 0) return "";

      const p1Name = U.escapeHtml(
        isDoublesFormat(match)
          ? getTeam1Name(match).replace(/\n/g, " ")
          : String(match.player1 || "Jogador 1").trim()
      );
      const p2Name = U.escapeHtml(
        isDoublesFormat(match)
          ? getTeam2Name(match).replace(/\n/g, " ")
          : String(match.player2 || "Jogador 2").trim()
      );

      return ` <div class="win-probability-chart"> <div class="win-probability-title">Probabilidade de vitória</div> <div class="win-probability-bar"> <div class="win-probability-segment win-probability-p1" style="width:${p1}%" title="${p1Name} ${p1}%">${p1 > 12 ? `${p1}%` : ""}</div> <div class="win-probability-segment win-probability-p2" style="width:${p2}%" title="${p2Name} ${p2}%">${p2 > 12 ? `${p2}%` : ""}</div> </div> <div class="win-probability-legend"> <span class="legend-item legend-item-p1">${p1Name} ${p1}%</span> <span class="legend-item legend-item-p2">${p2Name} ${p2}%</span> </div> </div> `;
    }

    function renderMatchSummary(match) {
      const team1 = isDoublesFormat(match)
        ? getTeam1Name(match).replace(/\n/g, " ").trim()
        : String(match.player1 || "Jogador 1").trim();

      const team2 = isDoublesFormat(match)
        ? getTeam2Name(match).replace(/\n/g, " ").trim()
        : String(match.player2 || "Jogador 2").trim();

      const s = U.getMatchSummary(match);
      const bp1 = U.formatBreakPoints(s.breakPointsWon1, s.breakPointsChances1);
      const bp2 = U.formatBreakPoints(s.breakPointsWon2, s.breakPointsChances2);

      return ` <div class="match-summary"> <div class="match-summary-title">Resumo da partida</div> <div class="match-summary-grid"> <div class="match-summary-item"> <span class="summary-label">${U.escapeHtml(team1)}</span> <span class="summary-value">Pontos totais: <strong>${s.totalPoints1}</strong></span> <span class="summary-value">Break points: <strong>${bp1}</strong></span> </div> <div class="match-summary-item"> <span class="summary-label">${U.escapeHtml(team2)}</span> <span class="summary-value">Pontos totais: <strong>${s.totalPoints2}</strong></span> <span class="summary-value">Break points: <strong>${bp2}</strong></span> </div> </div> </div> `;
    }

    function renderStatistics(match) {
      const score = U.normalizeScore(match.score || {});
      const stats = match.stats || {};
      const p1 = stats.player1 || {};
      const p2 = stats.player2 || {};

      const fmtPair = (a, b) => {
        const v1 = Number(a ?? 0);
        const v2 = Number(b ?? 0);
        const total = v1 + v2;
        const w1 = total > 0 ? (v1 / total) * 100 : 50;
        const w2 = total > 0 ? (v2 / total) * 100 : 50;

        return ` <div class="stat-values stat-values-pair"> <span>${U.escapeHtml(String(v1))}</span> <span>${U.escapeHtml(String(v2))}</span> </div> <div class="stat-compare-bar"> <div class="stat-compare-p1" style="width:${w1}%"></div> <div class="stat-compare-p2" style="width:${w2}%"></div> </div> <div class="stat-compare-labels"> <span>${w1.toFixed(0)}%</span> <span>${w2.toFixed(0)}%</span> </div> `;
      };

      const fmtTextPair = (a, b) => {
        const v1 = String(a ?? "0");
        const v2 = String(b ?? "0");

        const n1 = Number(String(v1).split("/")[0]) || 0;
        const n2 = Number(String(v2).split("/")[0]) || 0;
        const total = n1 + n2;
        const w1 = total > 0 ? (n1 / total) * 100 : 50;
        const w2 = total > 0 ? (n2 / total) * 100 : 50;

        return ` <div class="stat-values stat-values-textpair"> <span>${U.escapeHtml(v1)}</span> <span>${U.escapeHtml(v2)}</span> </div> <div class="stat-compare-bar"> <div class="stat-compare-p1" style="width:${w1}%"></div> <div class="stat-compare-p2" style="width:${w2}%"></div> </div> <div class="stat-compare-labels"> <span>${w1.toFixed(0)}%</span> <span>${w2.toFixed(0)}%</span> </div> `;
      };

      const pct = (won, attempts) => {
        const a = Number(attempts || 0);
        const w = Number(won || 0);
        if (a <= 0) return "0.0%";
        return `${((w / a) * 100).toFixed(1)}%`;
      };

      const service1Text1 = `${Number(p1.serve1Won || 0)}/${Number(p1.serve1Attempts || 0)}`;
      const service1Text2 = `${Number(p2.serve1Won || 0)}/${Number(p2.serve1Attempts || 0)}`;

      const service2Text1 = `${Number(p1.serve2Won || 0)}/${Number(p1.serve2Attempts || 0)}`;
      const service2Text2 = `${Number(p2.serve2Won || 0)}/${Number(p2.serve2Attempts || 0)}`;

      const service1Pct1 = pct(p1.serve1Won, p1.serve1Attempts);
      const service1Pct2 = pct(p2.serve1Won, p2.serve1Attempts);

      const service2Pct1 = pct(p1.serve2Won, p1.serve2Attempts);
      const service2Pct2 = pct(p2.serve2Won, p2.serve2Attempts);

      const netWon1 = Number(
        p1.netWon ??
        (Number(p1.dropshotWinner || 0) + Number(p1.smashWinner || 0) + Number(p1.voleioWinner || 0))
      );
      const netLost1 = Number(
        p1.netLost ??
        (Number(p1.dropshotError || 0) + Number(p1.smashError || 0) + Number(p1.voleioError || 0))
      );

      const netWon2 = Number(
        p2.netWon ??
        (Number(p2.dropshotWinner || 0) + Number(p2.smashWinner || 0) + Number(p2.voleioWinner || 0))
      );
      const netLost2 = Number(
        p2.netLost ??
        (Number(p2.dropshotError || 0) + Number(p2.smashError || 0) + Number(p2.voleioError || 0))
      );

      const unforcedText1 = `${Number(p1.enfFH || 0)}/${Number(p1.enfBH || 0)}`;
      const unforcedText2 = `${Number(p2.enfFH || 0)}/${Number(p2.enfBH || 0)}`;

      const winnersText1 = `${Number(p1.forehandWinner || 0)}/${Number(p1.backhandWinner || 0)}`;
      const winnersText2 = `${Number(p2.forehandWinner || 0)}/${Number(p2.backhandWinner || 0)}`;

      const dropshotText1 = `${Number(p1.dropshotWinner || 0)}/${Number(p1.dropshotError || 0)}`;
      const dropshotText2 = `${Number(p2.dropshotWinner || 0)}/${Number(p2.dropshotError || 0)}`;

      const bpWon1 = Number(score.breakPointsWon1 || p1.breakPointsWon || 0);
      const bpCh1 = Number(score.breakPointsChances1 || p1.breakPointsChances || 0);
      const bpWon2 = Number(score.breakPointsWon2 || p2.breakPointsWon || 0);
      const bpCh2 = Number(score.breakPointsChances2 || p2.breakPointsChances || 0);

      const breakText1 = `${bpWon1}/${bpCh1}`;
      const breakText2 = `${bpWon2}/${bpCh2}`;

      const performanceText1 = Number(p1.serveSuccessPct || 0).toFixed(1);
      const performanceText2 = Number(p2.serveSuccessPct || 0).toFixed(1);

      return ` <div class="match-summary stats-block"> <div class="match-summary-title">Estatísticas</div> <div class="stats-grid"> <div class="stat-card"> <div class="stat-title">Aces</div> ${fmtPair(p1.ace || 0, p2.ace || 0)} </div> <div class="stat-card"> <div class="stat-title">Duplas faltas</div> ${fmtPair(p1.doubleFault || 0, p2.doubleFault || 0)} </div> <div class="stat-card"> <div class="stat-title">Pontos vencidos<br>1º serviço</div> ${fmtTextPair(service1Text1, service1Text2)} <div class="stat-pct-row"> <span>${service1Pct1}</span> <span>${service1Pct2}</span> </div> </div> <div class="stat-card"> <div class="stat-title">Pontos vencidos<br>2º serviço</div> ${fmtTextPair(service2Text1, service2Text2)} <div class="stat-pct-row"> <span>${service2Pct1}</span> <span>${service2Pct2}</span> </div> </div> <div class="stat-card"> <div class="stat-title">Pontos na rede<br>(vencidos/perdidos)</div> ${fmtTextPair(`${netWon1}/${netLost1}`, `${netWon2}/${netLost2}`)} </div> <div class="stat-card"> <div class="stat-title">Winners<br>(forehand/backhand)</div> ${fmtTextPair(winnersText1, winnersText2)} </div> <div class="stat-card"> <div class="stat-title">Erros não forçados<br>(forehand/backhand)</div> ${fmtTextPair(unforcedText1, unforcedText2)} </div> <div class="stat-card"> <div class="stat-title">Erros forçados</div> ${fmtPair(p1.forcedError || 0, p2.forcedError || 0)} </div> <div class="stat-card"> <div class="stat-title">Pontos de devolução<br>(vencidos/perdidos)</div> ${fmtTextPair( `${Number(p1.returnPoint || 0)}/${Number(p1.returnError || 0)}`, `${Number(p2.returnPoint || 0)}/${Number(p2.returnError || 0)}` )} </div> <div class="stat-card"> <div class="stat-title">Pontos da linha de base<br>(vencidos/perdidos)</div> ${fmtTextPair( `${Number(p1.baselinePoint || 0)}/${Number(p1.baselineError || 0)}`, `${Number(p2.baselinePoint || 0)}/${Number(p2.baselineError || 0)}` )} </div> <div class="stat-card"> <div class="stat-title">Dropshot<br>(winners/erros)</div> ${fmtTextPair(dropshotText1, dropshotText2)} </div> <div class="stat-card"> <div class="stat-title">Break points<br>(vencidos/chances)</div> ${fmtTextPair(breakText1, breakText2)} </div> <div class="stat-card"> <div class="stat-title">Total de pontos vencidos</div> ${fmtPair(p1.totalPointsWon || 0, p2.totalPointsWon || 0)} </div> <div class="stat-card"> <div class="stat-title">Performance</div> ${fmtPair(performanceText1, performanceText2)} </div> </div> </div> `;
    }

    function getLiveFeedMessage(match) {
      if (match.status === "suspended") return "";

      const score = U.normalizeScore(match.score || {});
      const lastAction = U.getLastActionSnapshot(match);

      const p1Raw = String(match.player1 || "Jogador 1").trim();
      const p2Raw = String(match.player2 || "Jogador 2").trim();
      const fmt = String(match.matchFormat || "").toLowerCase();
      const noAd = fmt.includes("sem vantagem") || fmt.includes("no ad");
      const hasAd = fmt.includes("com vantagem") || fmt.includes("3 sets");

      const isTieBreak = score.tieBreakMode === "tb7";
      const isSuperTieBreak = score.tieBreakMode === "super10";

      if (match.status === "live" && !lastAction) return "Partida iniciada";
      if (isSuperTieBreak) return "";
      if (isTieBreak) return "🎾 TIE-BREAK";

      if (hasAd && !noAd) {
        if (score.advantage === "player1") return `VANTAGEM ${p1Raw}`;
        if (score.advantage === "player2") return `VANTAGEM ${p2Raw}`;
        const p1 = score.points1, p2 = score.points2;
        if (p1 >= 3 && p2 >= 3) {
          if (p1 === p2) return "IGUAIS";
          if (p1 > p2) return `VANTAGEM ${p1Raw}`;
          if (p2 > p1) return `VANTAGEM ${p2Raw}`;
        }
      }

      if (noAd && score.points1 === 3 && score.points2 === 3) {
        return "🎯 BREAK POINT — PONTO DECISIVO";
      }

      if (U.isBreakPoint(score, match.matchFormat)) {
        const server = score.server || "player1";
        const rcvName = server === "player1" ? p2Raw : p1Raw;
        return `🔴 BREAK POINT — ${rcvName}`;
      }

      const prevScore = lastAction?.score || null;
      if (prevScore) {
        const nowSets1 = Number(score.sets1 || 0);
        const nowSets2 = Number(score.sets2 || 0);
        const prevSets1 = Number(prevScore.sets1 || 0);
        const prevSets2 = Number(prevScore.sets2 || 0);

        if (nowSets1 > prevSets1) return `🏆 SET ${p1Raw}`;
        if (nowSets2 > prevSets2) return `🏆 SET ${p2Raw}`;

        const nowG1 = Number(score.games1 || 0);
        const nowG2 = Number(score.games2 || 0);
        const prevG1 = Number(prevScore.games1 || 0);
        const prevG2 = Number(prevScore.games2 || 0);

        if (nowG1 > prevG1) return `GAME ${p1Raw}`;
        if (nowG2 > prevG2) return `GAME ${p2Raw}`;
      }

      return "";
    }

    function getServeBall(score, playerPos, isFinished = false, winnerPos = null) {
      if (isFinished && winnerPos) {
        return playerPos === winnerPos ? `<span class="serve-ball" title="Vencedor"></span>` : "";
      }

      const server = score.server || "player1";
      const serving =
        (playerPos === 1 && server === "player1") ||
        (playerPos === 2 && server === "player2");
      return serving ? `<span class="serve-ball" title="Sacador"></span>` : "";
    }

    function buildSetHead(setColumns) {
      const cls = setColumns.hasThreeSets ? "three-set-head"
        : setColumns.hasTwoSets ? "two-set-head"
          : "one-set-head";

      return ` <div class="match-table-head compact-head ${cls}"> <div class="team-label team-col">JOGADOR</div> <div class="set-col">1º SET</div> ${setColumns.hasTwoSets || setColumns.hasThreeSets ? `<div class="set-col">2º SET</div>` : ""} ${setColumns.hasThreeSets ? `<div class="set-col">3º SET</div>` : ""} <div class="points-col">PONTOS</div> </div> `;
    }

    function buildPlayerRow(teamNameHtml, setColumns, pts, playerPos, score, isWinner, isWO, isFinished = false, winnerPos = null) {
      const rowCls = setColumns.hasThreeSets ? "three-set-row"
        : setColumns.hasTwoSets ? "two-set-row"
          : "one-set-row";

      const ptsDisplay = (isWO && isWinner) ? "WO" : pts;
      const serveBall = getServeBall(score, playerPos, isFinished, winnerPos);
      const setP = playerPos === 1 ? "p1" : "p2";

      return ` <div class="match-player-row compact-row ${rowCls} ${isWinner ? "winner-row" : ""}"> <div class="player-name team-name-compact team-col ${isWinner ? "winner" : ""}"> ${serveBall} <span class="team-name-compact-content ${isDoublesFormat(score) ? "doubles-name" : ""}"> ${teamNameHtml} </span> </div> <div class="score green set-col">${setColumns.set1[setP]}</div> ${setColumns.hasTwoSets || setColumns.hasThreeSets ? `<div class="score green set-col">${setColumns.set2?.[setP] ?? "--"}</div>` : ""} ${setColumns.hasThreeSets ? `<div class="score green set-col">${setColumns.set3?.[setP] ?? "--"}</div>` : ""} <div class="score gray points-col">${ptsDisplay}</div> </div> `;
    }

    function renderFinalizedCard(match) {
      const score = U.normalizeScore(match.score);
      const team1Html = renderPlayerName(match, 1);
      const team2Html = renderPlayerName(match, 2);
      const category = U.escapeHtml(U.normalizeText(match.categoryName, ""));
      const tournament = U.escapeHtml(U.normalizeText(match.tournamentName || match.tournament || "", ""));
      const stage = U.escapeHtml(U.normalizeText(match.tournamentStage, ""));
      const status = U.normalizeStatus(match.status);
      const setColumns = U.getSetColumns(match, score);
      const duration = U.buildDuration(match);
      const winnerPos = U.getWinnerPosition(match, score);
      const isWO = String(match.status || "").toLowerCase() === "wo";

      const isThreeSetsFinished = setColumns.hasThreeSets;
      const ptDisp = isThreeSetsFinished
        ? { p1: "", p2: "" }
        : U.getPointDisplay(score, match.matchFormat, true);

      const footerParts = [];
      if (tournament) footerParts.push(`<span class="footer-item">Torneio: <strong>${tournament}</strong></span>`);
      if (stage) footerParts.push(`<span class="footer-item">Fase: <strong>${stage}</strong></span>`);
      if (duration) footerParts.push(`<span class="footer-item">Duração: <strong>${duration}</strong></span>`);

      return ` <article class="public-card match-board compact-match-board" data-status="${status}"> <div class="match-board-top compact-top"> ${category ? `<div class="match-chip">${category}</div>` : ""} <div class="match-status ${U.statusClass(status)}">${U.statusLabel(status)}</div> </div> ${buildSetHead(setColumns)} ${buildPlayerRow(team1Html, setColumns, ptDisp.p1, 1, score, winnerPos === 1, isWO, true, winnerPos)} ${buildPlayerRow(team2Html, setColumns, ptDisp.p2, 2, score, winnerPos === 2, isWO, true, winnerPos)} <div class="match-footer compact-footer match-footer-finalized"> ${footerParts.join('<span class="footer-sep">-</span>')} </div> </article> `;
    }

    function renderLiveCard(match) {
      const team1Html = renderPlayerName(match, 1);
      const team2Html = renderPlayerName(match, 2);
      const category = U.escapeHtml(U.normalizeText(match.categoryName, ""));
      const court = U.escapeHtml(U.normalizeText(match.court, ""));
      const stage = U.escapeHtml(U.normalizeText(match.tournamentStage, ""));
      const rawStatus = match.status || "live";
      const status = U.normalizeStatus(rawStatus);
      const score = U.normalizeScore(match.score);
      const setColumns = U.getSetColumns(match, score);
      const duration = U.buildDuration(match);
      const matchDate = match.matchDateTime ? formatDateTime(match.matchDateTime) : "";
      const liveFeedMsg = getLiveFeedMessage(match);

      const isSuspended = rawStatus === "suspended";
      const isSuperTBActive = score.tieBreakMode === "super10";
      const isTB7Active = score.tieBreakMode === "tb7";

      const ptDisp = U.getPointDisplay(score, match.matchFormat, false);

      const suspendedBadge = isSuspended
        ? `<div class="suspended-badge">⏸ SUSPENSA</div>`
        : "";

      const suspendedDuration = isSuspended
        ? `<div class="suspended-duration">⏱ Duração pausada: ${duration}</div>`
        : "";

      const tbLabel = !isSuspended && isSuperTBActive
        ? `<div class="tb-active-label">🎾 Super Tie-break</div>`
        : !isSuspended && isTB7Active
          ? `<div class="tb-active-label">🎾 Tie-break</div>`
          : "";

      const row1Parts = [];
      if (stage) row1Parts.push(`<span>Fase: <strong>${stage}</strong></span>`);
      if (!isSuspended && duration) row1Parts.push(`<span>Duração: <strong>${duration}</strong></span>`);

      const row2Parts = [];
      if (court) row2Parts.push(`<span>Quadra: <strong>${court}</strong></span>`);
      if (matchDate) row2Parts.push(`<span>Data: <strong>${matchDate}</strong></span>`);

      return ` <article class="public-card match-board compact-match-board" data-status="${isSuspended ? "suspended" : status}"> <div class="match-board-top compact-top"> ${category ? `<div class="match-chip">${category}</div>` : ""} <div class="match-status ${U.statusClass(rawStatus)}">${U.statusLabel(rawStatus)}</div> </div> ${suspendedBadge} ${suspendedDuration} ${!isSuspended && liveFeedMsg ? `<div class="live-feed">${U.escapeHtml(liveFeedMsg)}</div>` : ""} ${tbLabel} ${buildSetHead(setColumns)} ${buildPlayerRow(team1Html, setColumns, ptDisp.p1, 1, score, false, false)} ${buildPlayerRow(team2Html, setColumns, ptDisp.p2, 2, score, false, false)} ${!isSuspended ? renderWinProbabilityChart(match) : ""} ${!isSuspended ? renderMatchSummary(match) : ""} ${!isSuspended ? renderStatistics(match) : ""} <div class="match-footer compact-footer match-footer-live"> ${row1Parts.length ? `<div class="match-footer-live-row">${row1Parts.join('<span class="footer-sep">-</span>')}</div>` : ""} ${row2Parts.length ? `<div class="match-footer-live-row">${row2Parts.join('<span class="footer-sep">-</span>')}</div>` : ""} </div> </article> `;
    }

    function createScheduledCard(match) {
      const team1Html = renderPlayerName(match, 1);
      const team2Html = renderPlayerName(match, 2);
      const category = U.escapeHtml(U.normalizeText(match.categoryName, ""));
      const stage = U.escapeHtml(U.normalizeText(match.tournamentStage, ""));
      const status = U.normalizeStatus(match.status);
      const matchDate = match.matchDateTime ? formatDateTime(match.matchDateTime) : "";

      return ` <article class="public-card match-board compact-match-board scheduled-match" data-status="${status}"> <div class="match-board-top compact-top"> ${category ? `<div class="match-chip">${category}</div>` : ""} <div class="match-status ${U.statusClass(status)}">${U.statusLabel(status)}</div> </div> <div class="scheduled-player-line"> <span class="player-name team-name-compact">${team1Html}</span> <span class="vs-separator">X</span> <span class="player-name team-name-compact">${team2Html}</span> </div> <div class="match-footer compact-footer scheduled-footer"> ${stage || matchDate ? `<span> ${stage ? `<strong>${stage}</strong>` : ""} ${stage && matchDate ? " • " : ""} ${matchDate ? `<strong>${matchDate}</strong>` : ""} </span>` : ""} </div> </article> `;
    }

    function createCard(match) {
      const rawStatus = match.status || "scheduled";
      const status = U.normalizeStatus(rawStatus);
      if (status === "finished") return renderFinalizedCard(match);
      if (status === "live" || rawStatus === "suspended") return renderLiveCard(match);
      return createScheduledCard(match);
    }

    function getActiveFilter() {
      const saved = U.getSavedFilter();
      if (!U.isMobile()) return "all";
      return ["scheduled", "live", "finished", "all"].includes(saved) ? saved : "all";
    }

    function applyFilterAndRender(matches) {
      const filter = getActiveFilter();
      const isMobile = U.isMobile();

      const scheduled = [];
      const live = [];
      const finished = [];

      matches.forEach((m) => {
        const rawStatus = String(m.status || "scheduled").trim().toLowerCase();

        if (rawStatus === "finished" || rawStatus === "wo") finished.push(m);
        else if (rawStatus === "live" || rawStatus === "suspended") live.push(m);
        else scheduled.push(m);
      });

      scheduled.sort((a, b) => (U.toDate(a.matchDateTime)?.getTime() || 0) - (U.toDate(b.matchDateTime)?.getTime() || 0));
      live.sort((a, b) => (U.getStartedAtMs(a) || 0) - (U.getStartedAtMs(b) || 0));
      finished.sort((a, b) => {
        const fa = U.toDate(a.finishedAt)?.getTime() || U.getStartedAtMs(a) || 0;
        const fb = U.toDate(b.finishedAt)?.getTime() || U.getStartedAtMs(b) || 0;
        return fb - fa;
      });

      const visScheduled = filter === "all" || filter === "scheduled"
        ? (isMobile ? scheduled : scheduled.slice(0, 7))
        : [];

      const visLive = filter === "all" || filter === "live"
        ? (isMobile ? live : live.slice(0, 3))
        : [];

      const visFinished = filter === "all" || filter === "finished"
        ? (isMobile ? finished : finished.slice(0, 4))
        : [];

      if (el.countScheduled) el.countScheduled.textContent = scheduled.length;
      if (el.countLive) el.countLive.textContent = live.length;
      if (el.countFinished) el.countFinished.textContent = finished.length;

      if (el.scheduledList) {
        el.scheduledList.innerHTML = visScheduled.length
          ? visScheduled.map((match) => createCard(match)).join("")
          : renderEmpty("Nenhum jogo do dia");
      }

      if (el.liveList) {
        el.liveList.innerHTML = visLive.length
          ? visLive.map((match) => createCard(match)).join("")
          : renderEmpty("Nenhuma partida em andamento");
      }

      if (el.finishedList) {
        el.finishedList.innerHTML = visFinished.length
          ? visFinished.map((match) => createCard(match)).join("")
          : renderEmpty("Nenhuma partida finalizada");
      }
    }

    function renderLists(matches) {
      applyFilterAndRender(matches);
    }

    function listenPublicMatches() {
      state.unsubscribe?.();
      state.unsubscribe = null;

      if (!ownerId) {
        [el.scheduledList, el.liveList, el.finishedList].forEach(
          (e) => e && (e.innerHTML = renderEmpty("Link inválido. Falta o identificador do usuário."))
        );
        return;
      }

      if (!shareToken) {
        [el.scheduledList, el.liveList, el.finishedList].forEach(
          (e) => e && (e.innerHTML = renderEmpty("Link inválido. Falta o token de compartilhamento."))
        );
        return;
      }

      state.unsubscribe = db.collection("matches")
        .where("ownerId", "==", ownerId)
        .where("shareEnabled", "==", true)
        .onSnapshot(
          (snapshot) => {
            state.cachedMatches = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            renderLists(state.cachedMatches);
          },
          (err) => {
            console.error("Erro ao carregar partidas públicas:", err);
            [el.scheduledList, el.liveList, el.finishedList].forEach(
              (e) => e && (e.innerHTML = renderEmpty("Erro ao carregar jogos públicos"))
            );
          }
        );
    }

    function listenSingleMatch() {
      if (!matchId) return;

      state.unsubscribeSingle?.();
      state.unsubscribeSingle = null;

      state.unsubscribeSingle = db.collection("matches")
        .doc(matchId)
        .onSnapshot(
          (snap) => {
            if (!snap.exists) return;

            const match = { id: snap.id, ...snap.data() };

            const idx = state.cachedMatches.findIndex((m) => m.id === match.id);
            if (idx >= 0) {
              state.cachedMatches[idx] = match;
            } else {
              state.cachedMatches.push(match);
            }

            renderLists(state.cachedMatches);
          },
          (err) => {
            console.error("Erro ao escutar partida individual:", err);
          }
        );
    }

    function refreshLiveDurations() {
      if (state.cachedMatches.length) renderLists(state.cachedMatches);
    }

    function initFilter() {
      if (!el.filter) return;
      el.filter.value = U.getSavedFilter() || "all";
      el.filter.addEventListener("change", () => {
        U.saveFilter(el.filter.value);
        renderLists(state.cachedMatches);
      });
    }

    function init() {
      injectInlineStyles();
      initFilter();
      listenPublicMatches();
      listenSingleMatch();
      state.timer = setInterval(refreshLiveDurations, 1000);
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => PublicApp.init());
})();
