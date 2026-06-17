(() => {
  "use strict";

  const PublicApp = (() => {
    const db = firebase.firestore();

    const state = {
      cachedMatches: [],
      timer: null,
      unsubscribe: null,
      finishedPending: {}
    };

    const FILTER_KEY = "lsts_live_status_filter";
    const FINISHED_DELAY_MS = 60_000;

    const el = {
      filter: document.getElementById("liveStatusFilter"),
      scheduledList: document.getElementById("scheduledList"),
      liveList: document.getElementById("liveList"),
      finishedList: document.getElementById("finishedList"),
      countScheduled: document.getElementById("countScheduled"),
      countLive: document.getElementById("countLive"),
      countFinished: document.getElementById("countFinished")
    };

    // ─── Utilitários ──────────────────────────────────────────────────────

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
        return {
          totalPoints1: Number(summary.totalPoints1 ?? score.totalPoints1 ?? 0),
          totalPoints2: Number(summary.totalPoints2 ?? score.totalPoints2 ?? 0),
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

          if (setObj.tieBreakMode === "tb7") {
            if (tb1 > 0 || tb2 > 0) {
              const p1Won = tb1 > tb2;
              return {
                p1: `${p1Won ? 7 : 6}<sup>${tb1}</sup>`,
                p2: `${p1Won ? 6 : 7}<sup>${tb2}</sup>`
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
                p1: `${p1Won ? 7 : 6}<sup>${tb1}</sup>`,
                p2: `${p1Won ? 6 : 7}<sup>${tb2}</sup>`
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

    // ─── Estilos inline ───────────────────────────────────────────────────

    function injectInlineStyles() {
      if (document.getElementById("publicAppInlineStyles")) return;
      const style = document.createElement("style");
      style.id = "publicAppInlineStyles";
      style.textContent = ` .match-footer-inline { display:flex; align-items:center; gap:8px; flex-wrap:nowrap; white-space:nowrap; overflow:hidden; font-size:12px; } .match-footer-inline span { white-space:nowrap; flex:0 0 auto; } .team-name-compact { white-space:pre-line; display:inline-block; font-weight:700; font-size:0.86rem; line-height:1.15; overflow-wrap:anywhere; word-break:break-word; } .player-name.team-name-compact { text-transform:none !important; } .serve-ball { display:inline-block; width:9px; height:9px; border-radius:50%; background:#d8ff63; box-shadow:0 0 6px rgba(216,255,99,0.75); margin-right:5px; flex-shrink:0; vertical-align:middle; } .tb-active-label { text-align:center; font-size:0.70rem; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; color:#d8ff63; padding:3px 0 2px; } .status-suspended { color: #fbbf24; } .suspended-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px; background: rgba(251,191,36,0.14); border: 1px solid rgba(251,191,36,0.28); color: #fbbf24; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; } .suspended-duration { text-align: center; font-size: 11px; font-weight: 800; color: rgba(251,191,36,0.85); padding: 2px 0 4px; letter-spacing: 0.04em; } .match-footer-finalized { display:flex !important; flex-direction:row !important; align-items:center !important; justify-content:flex-start !important; gap:6px !important; flex-wrap:nowrap !important; white-space:nowrap !important; overflow:hidden !important; width:100% !important; font-size:12px !important; } .match-footer-finalized .footer-item, .match-footer-finalized span { display:inline-flex !important; flex:0 0 auto !important; white-space:nowrap !important; align-items:center !important; } .match-footer-finalized .footer-sep { display:inline-flex !important; opacity:0.45 !important; flex:0 0 auto !important; } .match-footer-live { display:flex; flex-direction:column; gap:4px; font-size:12px; } .match-footer-live-row { display:flex; align-items:center; gap:8px; flex-wrap:nowrap; white-space:nowrap; overflow:hidden; } .match-footer-live-row span { white-space:nowrap; flex:0 0 auto; } .team-col { min-width: 0; } .set-col { text-align: center; } .points-col { text-align: center; } @media (max-width:768px) { .match-footer-inline { gap:6px; font-size:11px; } .team-name-compact { font-size:0.72rem; line-height:1.1; } .match-footer-finalized { font-size:10px !important; gap:4px !important; } .match-footer-live { font-size:10px; gap:3px; } .match-footer-live-row { gap:5px; } } `;
      document.head.appendChild(style);
    }

    // ─── Helpers de partida ───────────────────────────────────────────────

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

    // ─── Probabilidade de vitória ─────────────────────────────────────────

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

      return ` <div class="win-probability-chart"> <div class="win-probability-title">Probabilidade de vitória</div> <div class="win-probability-bar"> <div class="win-probability-segment win-probability-p1" style="width:${p1}%" title="${p1Name} ${p1}%"> ${p1 > 12 ? `${p1}%` : ""} </div> <div class="win-probability-segment win-probability-p2" style="width:${p2}%" title="${p2Name} ${p2}%"> ${p2 > 12 ? `${p2}%` : ""} </div> </div> <div class="win-probability-legend"> <span class="legend-item legend-item-p1">${p1Name} ${p1}%</span> <span class="legend-item legend-item-p2">${p2Name} ${p2}%</span> </div> </div>`;
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

      return ` <div class="match-summary"> <div class="match-summary-title">Resumo da partida</div> <div class="match-summary-grid"> <div class="match-summary-item"> <span class="summary-label">${U.escapeHtml(team1)}</span> <span class="summary-value">Pontos totais: <strong>${s.totalPoints1}</strong></span> <span class="summary-value">Break points: <strong>${bp1}</strong></span> </div> <div class="match-summary-item"> <span class="summary-label">${U.escapeHtml(team2)}</span> <span class="summary-value">Pontos totais: <strong>${s.totalPoints2}</strong></span> <span class="summary-value">Break points: <strong>${bp2}</strong></span> </div> </div> </div>`;
    }

    // ─── Live feed ────────────────────────────────────────────────────────

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

    // ─── Sacador ──────────────────────────────────────────────────────────

    function getServeBall(score, playerPos, isFinished = false, winnerPos = null) {
      if (isFinished && winnerPos) {
        const showForWinner = playerPos === winnerPos;
        return showForWinner ? `<span class="serve-ball" title="Vencedor"></span>` : "";
      }

      const server = score.server || "player1";
      const serving =
        (playerPos === 1 && server === "player1") ||
        (playerPos === 2 && server === "player2");
      return serving ? `<span class="serve-ball" title="Sacador"></span>` : "";
    }

    // ─── Cabeçalho da tabela ──────────────────────────────────────────────

    function buildSetHead(setColumns) {
      const cls = setColumns.hasThreeSets ? "three-set-head"
        : setColumns.hasTwoSets ? "two-set-head"
          : "one-set-head";

      return ` <div class="match-table-head compact-head ${cls}"> <div class="team-label team-col">JOGADOR</div> <div class="set-col">1º SET</div> ${setColumns.hasTwoSets || setColumns.hasThreeSets ? `<div class="set-col">2º SET</div>` : ""} ${setColumns.hasThreeSets ? `<div class="set-col">3º SET</div>` : ""} <div class="points-col">PONTOS</div> </div>`;
    }

    // ─── Linha de jogador ─────────────────────────────────────────────────

    function buildPlayerRow(teamName, setColumns, pts, playerPos, score, isWinner, isWO, isFinished = false, winnerPos = null) {
      const rowCls = setColumns.hasThreeSets ? "three-set-row"
        : setColumns.hasTwoSets ? "two-set-row"
          : "one-set-row";

      const ptsDisplay = (isWO && isWinner) ? "WO" : pts;
      const serveBall = getServeBall(score, playerPos, isFinished, winnerPos);
      const setP = playerPos === 1 ? "p1" : "p2";

      return ` <div class="match-player-row compact-row ${rowCls} ${isWinner ? "winner-row" : ""}"> <div class="player-name team-name-compact team-col ${isWinner ? "winner" : ""}" style="white-space:pre-line;"> ${serveBall}${U.escapeHtml(teamName)} </div> <div class="score green set-col">${setColumns.set1[setP]}</div> ${setColumns.hasTwoSets || setColumns.hasThreeSets ? `<div class="score green set-col">${setColumns.set2?.[setP] ?? "--"}</div>` : ""} ${setColumns.hasThreeSets ? `<div class="score green set-col">${setColumns.set3?.[setP] ?? "--"}</div>` : ""} <div class="score gray points-col">${ptsDisplay}</div> </div>`;
    }

    // ─── Card finalizado ──────────────────────────────────────────────────

    function renderFinalizedCard(match) {
      const team1 = getTeam1Name(match);
      const team2 = getTeam2Name(match);
      const category = U.escapeHtml(U.normalizeText(match.categoryName, ""));
      const tournament = U.escapeHtml(U.normalizeText(match.tournamentName || match.tournament || "", ""));
      const stage = U.escapeHtml(U.normalizeText(match.tournamentStage, ""));
      const status = U.normalizeStatus(match.status);
      const score = U.normalizeScore(match.score);
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
    
      return ` <article class="public-card match-board compact-match-board" data-status="${status}"> <div class="match-board-top compact-top"> ${category ? `<div class="match-chip">${category}</div>` : ""} <div class="match-status ${U.statusClass(status)}">${U.statusLabel(status)}</div> </div> ${buildSetHead(setColumns)} ${buildPlayerRow(team1, setColumns, ptDisp.p1, 1, score, winnerPos === 1, isWO, true, winnerPos)} ${buildPlayerRow(team2, setColumns, ptDisp.p2, 2, score, winnerPos === 2, isWO, true, winnerPos)} <div class="match-footer compact-footer match-footer-finalized"> ${footerParts.join('<span class="footer-sep">-</span>')} </div> </article> `;
    }
    // ─── Card ao vivo (inclui suspensa) ───────────────────────────────────

    function renderLiveCard(match) {
      const team1 = getTeam1Name(match);
      const team2 = getTeam2Name(match);
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

      return ` <article class="public-card match-board compact-match-board" data-status="${isSuspended ? "suspended" : status}"> <div class="match-board-top compact-top"> ${category ? `<div class="match-chip">${category}</div>` : ""} <div class="match-status ${U.statusClass(rawStatus)}">${U.statusLabel(rawStatus)}</div> </div> ${suspendedBadge} ${suspendedDuration} ${!isSuspended && liveFeedMsg ? `<div class="live-feed">${U.escapeHtml(liveFeedMsg)}</div>` : ""} ${tbLabel} ${buildSetHead(setColumns)} ${buildPlayerRow(team1, setColumns, ptDisp.p1, 1, score, false, false)} ${buildPlayerRow(team2, setColumns, ptDisp.p2, 2, score, false, false)} ${!isSuspended ? renderWinProbabilityChart(match) : ""} ${!isSuspended ? renderMatchSummary(match) : ""} <div class="match-footer compact-footer match-footer-live"> ${row1Parts.length ? `<div class="match-footer-live-row">${row1Parts.join('<span class="footer-sep">-</span>')}</div>` : ""} ${row2Parts.length ? `<div class="match-footer-live-row">${row2Parts.join('<span class="footer-sep">-</span>')}</div>` : ""} </div> </article>`;
    }

    // ─── Card agendado ────────────────────────────────────────────────────

    function createScheduledCard(match) {
      const team1 = getTeam1Name(match);
      const team2 = getTeam2Name(match);
      const category = U.escapeHtml(U.normalizeText(match.categoryName, ""));
      const stage = U.escapeHtml(U.normalizeText(match.tournamentStage, ""));
      const status = U.normalizeStatus(match.status);
      const matchDate = match.matchDateTime ? formatDateTime(match.matchDateTime) : "";

      return ` <article class="public-card match-board compact-match-board scheduled-match" data-status="${status}"> <div class="match-board-top compact-top"> ${category ? `<div class="match-chip">${category}</div>` : ""} <div class="match-status ${U.statusClass(status)}">${U.statusLabel(status)}</div> </div> <div class="scheduled-player-line"> <span class="player-name team-name-compact">${U.escapeHtml(team1)}</span> <span class="vs-separator">X</span> <span class="player-name team-name-compact">${U.escapeHtml(team2)}</span> </div> <div class="match-footer compact-footer scheduled-footer"> ${stage || matchDate ? `<span> ${stage ? `<strong>${stage}</strong>` : ""} ${stage && matchDate ? " • " : ""} ${matchDate ? `<strong>${matchDate}</strong>` : ""} </span>` : ""} </div> </article>`;
    }

    // ─── Roteador de cards ────────────────────────────────────────────────

    function createCard(match, forceStatus = null) {
      const rawStatus = match.status || "scheduled";
      const status = forceStatus || U.normalizeStatus(rawStatus);

      if (status === "finished") return renderFinalizedCard(match);
      if (status === "live" || rawStatus === "suspended") return renderLiveCard(match);
      return createScheduledCard(match);
    }

    // ─── Filtro e renderização ────────────────────────────────────────────

    function getActiveFilter() {
      const saved = U.getSavedFilter();
      if (!U.isMobile()) return "all";
      return ["scheduled", "live", "finished", "all"].includes(saved) ? saved : "all";
    }

    function applyFilterAndRender(matches) {
      const filter = getActiveFilter();
      const isMobile = U.isMobile();
      const now = Date.now();
    
      const scheduled = [];
      const live = [];
      const finished = [];
    
      matches.forEach((m) => {
        const rawStatus = String(m.status || "scheduled").trim().toLowerCase();
        const mid = m.id || m.matchId || "";
    
        if (rawStatus === "finished") {
          delete state.finishedPending[mid];
          finished.push({ match: m, forceStatus: null });
        } else if (rawStatus === "wo") {
          delete state.finishedPending[mid];
          finished.push({ match: m, forceStatus: null });
        } else if (rawStatus === "live") {
          delete state.finishedPending[mid];
          live.push({ match: m, forceStatus: null });
        } else if (rawStatus === "suspended") {
          delete state.finishedPending[mid];
          live.push({ match: m, forceStatus: null });
        } else {
          scheduled.push({ match: m, forceStatus: null });
        }
      });
    
      scheduled.sort((a, b) =>
        (U.toDate(a.match.matchDateTime)?.getTime() || 0) -
        (U.toDate(b.match.matchDateTime)?.getTime() || 0)
      );
    
      live.sort((a, b) =>
        (U.getStartedAtMs(a.match) || 0) - (U.getStartedAtMs(b.match) || 0)
      );
    
      finished.sort((a, b) => {
        const fa = U.toDate(a.match.finishedAt)?.getTime() || U.getStartedAtMs(a.match) || 0;
        const fb = U.toDate(b.match.finishedAt)?.getTime() || U.getStartedAtMs(b.match) || 0;
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
          ? visScheduled.map(({ match, forceStatus }) => createCard(match, forceStatus)).join("")
          : renderEmpty("Nenhum jogo do dia");
      }
    
      if (el.liveList) {
        el.liveList.innerHTML = visLive.length
          ? visLive.map(({ match, forceStatus }) => createCard(match, forceStatus)).join("")
          : renderEmpty("Nenhuma partida em andamento");
      }
    
      if (el.finishedList) {
        el.finishedList.innerHTML = visFinished.length
          ? visFinished.map(({ match, forceStatus }) => createCard(match, forceStatus)).join("")
          : renderEmpty("Nenhuma partida finalizada");
      }
    }
    function renderLists(matches) {
      applyFilterAndRender(matches);
    }

    // ─── Firestore ────────────────────────────────────────────────────────

    function listenMatches(currentUser) {
      if (!currentUser) {
        [el.scheduledList, el.liveList, el.finishedList].forEach(
          (e) => e && (e.innerHTML = renderEmpty("Usuário não autenticado"))
        );
        return;
      }

      state.unsubscribe?.();
      state.unsubscribe = null;

      state.unsubscribe = db.collection("matches")
        .where("ownerId", "==", currentUser.uid)
        .onSnapshot(
          (snapshot) => {
            state.cachedMatches = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            state.cachedMatches.sort(
              (a, b) => (U.getStartedAtMs(a) || 0) - (U.getStartedAtMs(b) || 0)
            );
            renderLists(state.cachedMatches);
          },
          (err) => {
            console.error("Erro ao carregar partidas:", err);
            [el.scheduledList, el.liveList, el.finishedList].forEach(
              (e) => e && (e.innerHTML = renderEmpty("Erro ao carregar jogos"))
            );
          }
        );
    }

    function refreshLiveDurations() {
      if (state.cachedMatches.length) renderLists(state.cachedMatches);
    }

    // ─── Filtro ───────────────────────────────────────────────────────────

    function initFilter() {
      if (!el.filter) return;
      el.filter.value = U.getSavedFilter() || "all";
      el.filter.addEventListener("change", () => {
        U.saveFilter(el.filter.value);
        renderLists(state.cachedMatches);
      });
    }

    // ─── Init ─────────────────────────────────────────────────────────────

    function init() {
      injectInlineStyles();
      initFilter();

      if (typeof __auth === "undefined") {
        console.error("Firebase Auth não carregado.");
        return;
      }

      __auth.onAuthStateChanged((user) => {
        if (!user) {
          [el.scheduledList, el.liveList, el.finishedList].forEach(
            (e) => e && (e.innerHTML = renderEmpty("Usuário não autenticado"))
          );
          return;
        }
        listenMatches(user);
      });

      state.timer = setInterval(refreshLiveDurations, 1000);
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => PublicApp.init());
})();
