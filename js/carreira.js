(() => {
  "use strict";

  const CareerApp = (() => {
    const PAGE_SIZE = 5;

    const db = firebase.firestore();

    const state = {
      allMatches: [],
      filteredMatches: [],
      currentUser: null,
      currentProfileName: "",
      unsubscribe: null,
      filtersCollapsed: false,
      currentPage: 1
    };

    const el = {
      profileName: document.getElementById("profileName"),
      playerName: document.getElementById("playerName"),
      stageFilter: document.getElementById("stageFilter"),
      resultFilter: document.getElementById("resultFilter"),
      tournamentSituationFilter: document.getElementById("tournamentSituationFilter"),
      fromDate: document.getElementById("fromDate"),
      toDate: document.getElementById("toDate"),
      applyFilterBtn: document.getElementById("applyFilterBtn"),
      clearFilterBtn: document.getElementById("clearFilterBtn"),
      totalMatches: document.getElementById("totalMatches"),
      totalWins: document.getElementById("totalWins"),
      totalLosses: document.getElementById("totalLosses"),
      totalWo: document.getElementById("totalWo"),
      historyList: document.getElementById("historyList"),
      summaryMessage: document.getElementById("summaryMessage"),
      pageTitle: document.getElementById("pageTitle"),
      subtitle: document.getElementById("subtitle"),
      toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
      toggleFilterBtn: document.getElementById("toggleFilterBtn"),
      careerFiltersToggleBtn: document.getElementById("careerFiltersToggleBtn"),
      filtersToggleBtn: document.getElementById("filtersToggleBtn"),

      // paginação
      prevPageBtn: document.getElementById("prevPageBtn"),
      nextPageBtn: document.getElementById("nextPageBtn"),
      pageInfo: document.getElementById("pageInfo")
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

      normalizeText(value = "") {
        return String(value || "").trim().toLowerCase();
      },

      toDate(value) {
        if (!value) return null;
        if (value && typeof value.toDate === "function") {
          const d = value.toDate();
          return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      },

      formatDate(value) {
        const d = U.toDate(value);
        if (!d) return "-";
        return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
      },

      formatDuration(seconds) {
        const total = Number(seconds || 0);
        const h = String(Math.floor(total / 3600)).padStart(2, "0");
        const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
        const s = String(total % 60).padStart(2, "0");
        return `${h}:${m}:${s}`;
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
          server: score.server || "player1",
          totalPoints1: Number(score.totalPoints1 || 0),
          totalPoints2: Number(score.totalPoints2 || 0),
          breakPointsWon1: Number(score.breakPointsWon1 || 0),
          breakPointsWon2: Number(score.breakPointsWon2 || 0),
          breakPointsChances1: Number(score.breakPointsChances1 || 0),
          breakPointsChances2: Number(score.breakPointsChances2 || 0)
        };
      },

      getCurrentUserProfile(user) {
        if (!user) return "";
        return String(user.displayName || "").trim();
      },

      getMatchFormat(match) {
        const candidates = [
          match?.matchFormat,
          match?.format,
          match?.jogoFormat,
          match?.gameFormat,
          match?.match?.format,
          match?.match?.matchFormat,
          match?.details?.matchFormat,
          match?.details?.format
        ];

        const found = candidates.find((v) => String(v || "").trim());
        return found ? String(found).trim() : "-";
      },

      getSurfaceType(match) {
        const candidates = [
          match?.surfaceType,
          match?.tipoPiso,
          match?.surface,
          match?.courtSurface
        ];

        const found = candidates.find((v) => String(v || "").trim());
        return found ? String(found).trim() : "-";
      },

      getCourt(match) {
        const candidates = [
          match?.court,
          match?.quadra,
          match?.courtName,
          match?.location
        ];

        const found = candidates.find((v) => String(v || "").trim());
        return found ? String(found).trim() : "-";
      },

      getMatchDuration(match) {
        if (match?.durationSeconds && Number(match.durationSeconds) > 0) {
          return U.formatDuration(match.durationSeconds);
        }

        const started = U.toDate(match?.startedAt);
        const finished = U.toDate(match?.finishedAt);

        if (started && finished && finished >= started) {
          return U.formatDuration(Math.floor((finished.getTime() - started.getTime()) / 1000));
        }

        return "-";
      },

      getWinnerPosition(match) {
        const status = U.normalizeText(match.status);
        const woWinner = U.normalizeText(match.winnerByWO);

        if (status === "wo") {
          if (woWinner === "player1") return 1;
          if (woWinner === "player2") return 2;
          return null;
        }

        const score = U.normalizeScore(match.score || {});
        if (score.sets1 > score.sets2) return 1;
        if (score.sets2 > score.sets1) return 2;

        return null;
      },

      getLoggedUserOutcome(match) {
        const target = U.normalizeText(state.currentProfileName || el.playerName?.value || "");
        const winnerPos = U.getWinnerPosition(match);
        const p1 = U.normalizeText(match.player1 || "");
        const p2 = U.normalizeText(match.player2 || "");

        if (!winnerPos) return "unknown";

        if (winnerPos === 1) {
          return p1 === target ? "win" : "loss";
        }

        if (winnerPos === 2) {
          return p2 === target ? "win" : "loss";
        }

        return "unknown";
      },

      isFinalMatch(match) {
        return U.normalizeText(match.tournamentStage) === "final";
      },

      getTournamentSituation(match) {
        if (!U.isFinalMatch(match)) return "";

        const outcome = U.getLoggedUserOutcome(match);
        if (outcome === "win") return "champion";
        if (outcome === "loss") return "runnerup";
        return "";
      },

      getScoreLabel(match) {
        const score = U.normalizeScore(match.score || {});
        const status = U.normalizeText(match.status);

        if (status === "wo") return "WO";

        const history = Array.isArray(score.setHistory) ? score.setHistory : [];

        if (history.length) {
          const sets = history.map((setObj) => {
            const g1 = Number(setObj?.games1 || 0);
            const g2 = Number(setObj?.games2 || 0);
            const tb1 = Number(setObj?.tieBreakPoints1 || 0);
            const tb2 = Number(setObj?.tieBreakPoints2 || 0);
            const isTB = setObj?.tieBreakMode === "tb7" || setObj?.tieBreakMode === "super10";

            if (isTB && (tb1 > 0 || tb2 > 0)) {
              const p1Won = tb1 > tb2;
              return `${p1Won ? 7 : 6}x${p1Won ? 6 : 7} (${tb1}-${tb2})`;
            }

            return `${g1}x${g2}`;
          });

          return sets.join(" ");
        }

        return `${score.sets1}x${score.sets2}`;
      },

      isMatchForLoggedUser(match, currentUser) {
        const ownerId = String(match.ownerId || "").trim();
        const ownedById = currentUser && ownerId && ownerId === currentUser.uid;
        return Boolean(ownedById);
      },

      applyDateFilter(matches, from, to) {
        const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
        const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;

        return matches.filter((m) => {
          const dt = U.toDate(m.matchDateTime);
          if (!dt) return false;

          const ts = dt.getTime();
          if (fromTs !== null && ts < fromTs) return false;
          if (toTs !== null && ts > toTs) return false;
          return true;
        });
      },

      matchOpponentFilter(match, opponentText) {
        if (!opponentText) return true;

        const p1 = U.normalizeText(match.player1 || "");
        const p2 = U.normalizeText(match.player2 || "");
        const query = U.normalizeText(opponentText);

        return p1.includes(query) || p2.includes(query);
      }
    };

    function setSummaryMessage(text) {
      if (el.summaryMessage) el.summaryMessage.textContent = text || "";
    }

    function setDefaultFields(profileName) {
      if (el.profileName) {
        el.profileName.value = profileName || "";
        el.profileName.readOnly = true;
      }

      if (el.playerName) el.playerName.value = "";
    }

    function getFilters() {
      return {
        player: el.playerName?.value?.trim() || "",
        stage: el.stageFilter?.value?.trim() || "",
        result: el.resultFilter?.value?.trim() || "",
        tournamentSituation: el.tournamentSituationFilter?.value?.trim() || "",
        from: el.fromDate?.value || "",
        to: el.toDate?.value || ""
      };
    }

    function computeStats(matches, targetPlayerName) {
      let wins = 0;
      let losses = 0;
      let wo = 0;

      const target = U.normalizeText(targetPlayerName);

      matches.forEach((m) => {
        const winnerPos = U.getWinnerPosition(m);
        const p1 = U.normalizeText(m.player1 || "");
        const p2 = U.normalizeText(m.player2 || "");

        if (U.normalizeText(m.status) === "wo") wo += 1;

        const targetIsP1 = p1 === target;
        const targetIsP2 = p2 === target;

        if ((winnerPos === 1 && targetIsP1) || (winnerPos === 2 && targetIsP2)) {
          wins += 1;
        } else if (targetIsP1 || targetIsP2) {
          losses += 1;
        }
      });

      return { wins, losses, wo };
    }

    function renderSummary(matches) {
      const total = matches.length;
      const targetPlayer = state.currentProfileName || el.playerName?.value?.trim() || "";

      const stats = computeStats(matches, targetPlayer);

      if (el.totalMatches) el.totalMatches.textContent = String(total);
      if (el.totalWins) el.totalWins.textContent = String(stats.wins);
      if (el.totalLosses) el.totalLosses.textContent = String(stats.losses);
      if (el.totalWo) el.totalWo.textContent = String(stats.wo);

      const player = targetPlayer || "Usuário";

      if (el.pageTitle) el.pageTitle.textContent = `Carreira - ${player}`;
      if (el.subtitle) {
        el.subtitle.textContent = `Histórico de partidas finalizadas do usuário logado`;
      }

      if (el.summaryMessage) {
        el.summaryMessage.textContent = total
          ? `Exibindo ${total} partidas finalizadas de ${player}.`
          : `Nenhuma partida finalizada encontrada para ${player}.`;
      }
    }

    function renderPagedHistory(matches) {
      if (!el.historyList) return;

      const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));

      if (state.currentPage > totalPages) state.currentPage = totalPages;
      if (state.currentPage < 1) state.currentPage = 1;

      const start = (state.currentPage - 1) * PAGE_SIZE;
      const pageItems = matches.slice(start, start + PAGE_SIZE);

      if (!pageItems.length) {
        el.historyList.innerHTML = `<div class="empty-card">Nenhuma partida encontrada para os filtros selecionados.</div>`;
      } else {
        const target = U.normalizeText(state.currentProfileName || el.playerName?.value || "");

        el.historyList.innerHTML = pageItems
          .map((m) => {
            const date = U.formatDate(m.matchDateTime);
            const category = U.escapeHtml(m.categoryName || "-");
            const format = U.escapeHtml(U.getMatchFormat(m));
            const surfaceType = U.escapeHtml(U.getSurfaceType(m));
            const court = U.escapeHtml(U.getCourt(m));
            const stage = U.escapeHtml(m.tournamentStage || "-");
            const p1 = U.escapeHtml(m.player1 || "-");
            const p2 = U.escapeHtml(m.player2 || "-");
            const score = U.escapeHtml(U.getScoreLabel(m));
            const duration = U.escapeHtml(U.getMatchDuration(m));
            const winnerPos = U.getWinnerPosition(m);
            const situation = U.getTournamentSituation(m);

            const p1Name = U.normalizeText(m.player1 || "");
            const p2Name = U.normalizeText(m.player2 || "");

            const isWinner =
              winnerPos === 1 ? p1Name === target :
              winnerPos === 2 ? p2Name === target :
              false;

            const cardClass = isWinner ? "career-card career-card-win" : "career-card career-card-loss";

            const situationLabel =
              situation === "champion"
                ? "Campeão"
                : situation === "runnerup"
                  ? "Vice - Campeão"
                  : "";

            return ` <article class="${cardClass}"> <div class="career-card-head"> <div class="career-card-title">${p1} x ${p2}</div> <div class="career-card-result"> ${situationLabel || (isWinner ? "VITÓRIA" : "DERROTA")} </div> </div> <div class="career-grid"> <div class="career-item"> <span>Data</span> <strong>${U.escapeHtml(date)}</strong> </div> <div class="career-item"> <span>Categoria</span> <strong>${category}</strong> </div> <div class="career-item"> <span>Formato</span> <strong>${format}</strong> </div> <div class="career-item"> <span>Fase</span> <strong>${stage}</strong> </div> <div class="career-item"> <span>Tipo de piso</span> <strong>${surfaceType}</strong> </div> <div class="career-item"> <span>Quadra</span> <strong>${court}</strong> </div> <div class="career-item"> <span>Placar</span> <strong>${score}</strong> </div> <div class="career-item"> <span>Duração</span> <strong>${duration}</strong> </div> </div> </article> `;
          })
          .join("");
      }

      if (el.pageInfo) {
        el.pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
      }

      if (el.prevPageBtn) {
        el.prevPageBtn.disabled = state.currentPage <= 1;
      }

      if (el.nextPageBtn) {
        el.nextPageBtn.disabled = state.currentPage >= totalPages;
      }
    }

    function applyFiltersAndRender() {
      const { player, stage, result, tournamentSituation, from, to } = getFilters();

      const base = state.allMatches.filter((m) =>
        U.isMatchForLoggedUser(m, state.currentUser)
      );

      let filtered = base;

      if (player) {
        filtered = filtered.filter((m) => U.matchOpponentFilter(m, player));
      }

      if (stage) {
        filtered = filtered.filter((m) => String(m.tournamentStage || "").trim() === stage);
      }

      if (result === "wins") {
        filtered = filtered.filter((m) => U.getLoggedUserOutcome(m) === "win");
      }

      if (result === "losses") {
        filtered = filtered.filter((m) => U.getLoggedUserOutcome(m) === "loss");
      }

      if (tournamentSituation === "champion") {
        filtered = filtered.filter((m) => U.getTournamentSituation(m) === "champion");
      }

      if (tournamentSituation === "runnerup") {
        filtered = filtered.filter((m) => U.getTournamentSituation(m) === "runnerup");
      }

      filtered = U.applyDateFilter(filtered, from, to);

      state.filteredMatches = filtered;
      state.currentPage = 1;
      renderSummary(filtered);
      renderPagedHistory(filtered);
    }

    function updateToggleButtonUI() {
      const btn =
        el.toggleFiltersBtn ||
        el.toggleFilterBtn ||
        el.careerFiltersToggleBtn ||
        el.filtersToggleBtn;
    
      if (!btn) return;
    
      const icon = btn.querySelector(
        ".career-bottom-icon, .career-btn-icon, .filters-toggle-icon, .toggle-icon"
      );
    
      const label = btn.querySelector(
        ".career-bottom-label, .career-toggle-label, .filters-toggle-label, .btn-label"
      );
    
      const isCollapsed = state.filtersCollapsed;
    
      if (icon) {
        icon.textContent = isCollapsed ? "🔎" : "📋";
      }
    
      if (label) {
        label.textContent = isCollapsed ? "Filtros" : "Lista";
      }
    }

    function setFiltersCollapsed(collapsed) {
      state.filtersCollapsed = !!collapsed;

      const filtersWrap = document.querySelector(".career-filters");
      if (filtersWrap) {
        filtersWrap.classList.toggle("is-collapsed", state.filtersCollapsed);
      }

      updateToggleButtonUI();
    }

    function bindToggleFilters() {
      const btn =
        el.toggleFiltersBtn ||
        el.toggleFilterBtn ||
        el.careerFiltersToggleBtn ||
        el.filtersToggleBtn ||
        document.querySelector("[data-action='toggle-filters']");

      if (!btn) return;

      btn.addEventListener("click", () => {
        setFiltersCollapsed(!state.filtersCollapsed);
      });

      updateToggleButtonUI();
    }

    function bindEvents() {
      el.applyFilterBtn?.addEventListener("click", applyFiltersAndRender);

      el.clearFilterBtn?.addEventListener("click", () => {
        setDefaultFields(state.currentProfileName);
        if (el.stageFilter) el.stageFilter.value = "";
        if (el.resultFilter) el.resultFilter.value = "";
        if (el.tournamentSituationFilter) el.tournamentSituationFilter.value = "";
        if (el.fromDate) el.fromDate.value = "";
        if (el.toDate) el.toDate.value = "";
        state.currentPage = 1;
        applyFiltersAndRender();
      });

      el.prevPageBtn?.addEventListener("click", () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderPagedHistory(state.filteredMatches);
        }
      });

      el.nextPageBtn?.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderPagedHistory(state.filteredMatches);
        }
      });

      bindToggleFilters();
    }

    function listenMatches() {
      if (!state.currentUser) {
        setSummaryMessage("Usuário não autenticado.");
        return;
      }

      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }

      state.unsubscribe = db.collection("matches")
        .where("ownerId", "==", state.currentUser.uid)
        .onSnapshot(
          (snapshot) => {
            state.allMatches = snapshot.docs
              .map((doc) => ({ id: doc.id, ...doc.data() }))
              .filter((m) => {
                const status = U.normalizeText(m.status);
                return status === "finished" || status === "wo";
              });

            applyFiltersAndRender();
          },
          (err) => {
            console.error(err);
            setSummaryMessage(err.message || "Erro ao carregar partidas.");
          }
        );
    }

    function init() {
      if (typeof __auth === "undefined") {
        setSummaryMessage("Firebase Auth não carregado.");
        return;
      }

      bindEvents();

      __auth.onAuthStateChanged((user) => {
        if (!user) {
          state.currentUser = null;
          state.currentProfileName = "";
          setSummaryMessage("Usuário não autenticado.");
          renderPagedHistory([]);
          return;
        }

        state.currentUser = user;
        state.currentProfileName = U.getCurrentUserProfile(user);
        setDefaultFields(state.currentProfileName);
        listenMatches();
      });
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => CareerApp.init());
})();