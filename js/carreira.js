(() => {
  "use strict";

  const CareerApp = (() => {
    const PAGE_SIZE = 5;

    const ADMIN_KEY = "lsts_admin_session";
    const BIOMETRIC_SESSION_KEY = "lsts_biometric_session";
    const BIOMETRIC_CURRENT_KEY = "lsts_biometric_current";
    const BIOMETRIC_UID_KEY = "lsts_biometric_uid";

    const getDb = () => (typeof __db !== "undefined" ? __db : firebase.firestore());
    const getAuth = () => (typeof __auth !== "undefined" ? __auth : firebase.auth());

    const state = {
      allMatches: [],
      filteredMatches: [],
      currentUser: null,
      currentProfileName: "",
      currentProfileNameNew: "",
      unsubscribe: null,
      filtersCollapsed: false,
      currentPage: 1
    };

    const el = {
      profileName: document.getElementById("profileName"),
      playerName: document.getElementById("playerName"),
      modalityFilter: document.getElementById("modalityFilter"),
      gameFormatFilter: document.getElementById("gameFormatFilter"),
      tournamentFilter: document.getElementById("tournamentFilter"),
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
      totalTournaments: document.getElementById("totalTournaments"),
      totalChampion: document.getElementById("totalChampion"),
      totalRunnerup: document.getElementById("totalRunnerup"),
      historyList: document.getElementById("historyList"),
      summaryMessage: document.getElementById("summaryMessage"),
      pageTitle: document.getElementById("pageTitle"),
      subtitle: document.getElementById("subtitle"),
      toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
      prevPageBtn: document.getElementById("prevPageBtn"),
      nextPageBtn: document.getElementById("nextPageBtn"),
      pageInfo: document.getElementById("pageInfo")
    };

    // ─── Utilitários ──────────────────────────────────────────────────────────

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
        return String(value || "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      },

      toDate(value) {
        if (!value) return null;
        if (typeof value.toDate === "function") {
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
        const displayName = String(user.displayName || "").trim();
        if (displayName) return displayName;
        const email = String(user.email || "").trim();
        if (email) return email.split("@")[0];
        return "";
      },

      getMatchFormat(match) {
        const found = [
          match?.matchFormat,
          match?.format,
          match?.jogoFormat,
          match?.gameFormat,
          match?.match?.format,
          match?.match?.matchFormat,
          match?.details?.matchFormat,
          match?.details?.format
        ].find((v) => String(v || "").trim());
        return found ? String(found).trim() : "-";
      },

      getSurfaceType(match) {
        const found = [
          match?.surfaceType,
          match?.tipoPiso,
          match?.surface,
          match?.courtSurface
        ].find((v) => String(v || "").trim());
        return found ? String(found).trim() : "-";
      },

      getModalidade(match) {
        const found = [match?.modality, match?.modalidade].find((v) => String(v || "").trim());
        return found ? String(found).trim() : "-";
      },

      getGameFormat(match) {
        const found = [match?.gameFormat, match?.formatoJogo, match?.game_format].find((v) =>
          String(v || "").trim()
        );
        return found ? String(found).trim() : "-";
      },

      getCourt(match) {
        const found = [match?.court, match?.quadra, match?.courtName, match?.location].find((v) =>
          String(v || "").trim()
        );
        return found ? String(found).trim() : "-";
      },

      getTournamentName(match) {
        return String(match?.tournamentName || "").trim() || "-";
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

      isOwnerMatch(match) {
        const ownerId = String(match.ownerId || "").trim();
        if (!state.currentUser) return false;
        return ownerId === state.currentUser.uid;
      },

      getOwnerNameInMatch(match) {
        const ownerName = String(match.ownerName || "").trim();
        if (ownerName) return ownerName;
        return state.currentProfileName || "";
      },

      getLoggedUserOutcome(match) {
        const winnerPos = U.getWinnerPosition(match);
        if (!winnerPos) return "unknown";

        const ownerId = String(match.ownerId || "").trim();
        const isOwner = state.currentUser && ownerId === state.currentUser.uid;

        if (!isOwner) return "unknown";

        const ownerName = U.normalizeText(U.getOwnerNameInMatch(match));
        const currentName = U.normalizeText(state.currentProfileName || "");
        const p1 = U.normalizeText(match.player1 || "");
        const p2 = U.normalizeText(match.player2 || "");

        const ownerIsP1 = p1 === ownerName || p1 === currentName;
        const ownerIsP2 = p2 === ownerName || p2 === currentName;

        if (winnerPos === 1) return ownerIsP1 ? "win" : "loss";
        if (winnerPos === 2) return ownerIsP2 ? "win" : "loss";
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
          return history
            .map((setObj) => {
              const g1 = Number(setObj?.games1 || 0);
              const g2 = Number(setObj?.games2 || 0);
              const tb1 = Number(setObj?.tieBreakPoints1 || 0);
              const tb2 = Number(setObj?.tieBreakPoints2 || 0);
              const isTB =
                setObj?.tieBreakMode === "tb7" || setObj?.tieBreakMode === "super10";
              if (isTB && (tb1 > 0 || tb2 > 0)) {
                const p1Won = tb1 > tb2;
                return `${p1Won ? 7 : 6}x${p1Won ? 6 : 7} (${tb1}-${tb2})`;
              }
              return `${g1}x${g2}`;
            })
            .join(" ");
        }
        return `${score.sets1}x${score.sets2}`;
      },

      isMatchForLoggedUser(match, currentUser) {
        const ownerId = String(match.ownerId || "").trim();
        return Boolean(currentUser && ownerId && ownerId === currentUser.uid);
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
        const query = U.normalizeText(opponentText);
        return [match.player1, match.player2, match.player3, match.player4].some((p) =>
          U.normalizeText(p || "").includes(query)
        );
      },

      matchModalidadeFilter(match, modalityText) {
        if (!modalityText) return true;
        return U.normalizeText(U.getModalidade(match)) === U.normalizeText(modalityText);
      },

      matchGameFormatFilter(match, gameFormatText) {
        if (!gameFormatText) return true;
        return U.normalizeText(U.getGameFormat(match)) === U.normalizeText(gameFormatText);
      },

      matchTournamentFilter(match, tournamentText) {
        if (!tournamentText) return true;
        return U.normalizeText(U.getTournamentName(match)).includes(
          U.normalizeText(tournamentText)
        );
      },

      isDoubles(match) {
        const gf = U.normalizeText(U.getGameFormat(match));
        return gf === "duplas" || gf === "duplas mistas";
      },

      formatPlayerName(name = "") {
        return String(name || "").trim() || "-";
      },

      resolvePlayerName(name, match) {
        const ownerName = U.normalizeText(U.getOwnerNameInMatch(match));
        const currentName = state.currentProfileName || "";
        const normalized = U.normalizeText(name || "");

        if (ownerName && normalized === ownerName && currentName) {
          return currentName;
        }
        return name || "-";
      },

      getTeam1Line(match) {
        const p1 = U.resolvePlayerName(match.player1, match);
        const p2 = U.resolvePlayerName(match.player2, match);
        return U.isDoubles(match)
          ? `${U.formatPlayerName(p1)} / ${U.formatPlayerName(p2)}`
          : U.formatPlayerName(p1);
      },

      getTeam2Line(match) {
        const p3 = U.resolvePlayerName(match.player3, match);
        const p4 = U.resolvePlayerName(match.player4, match);
        if (U.isDoubles(match)) {
          return `${U.formatPlayerName(p3)} / ${U.formatPlayerName(p4)}`;
        }
        return U.formatPlayerName(U.resolvePlayerName(match.player2, match));
      }
    };

    // ─── UI helpers ───────────────────────────────────────────────────────────

    function setSummaryMessage(text) {
      if (el.summaryMessage) el.summaryMessage.textContent = text || "";
    }

    function setDefaultFields(profileName) {
      if (el.profileName) {
        el.profileName.value = profileName || "";
        el.profileName.readOnly = true;
      }
      if (el.playerName) el.playerName.value = "";
      if (el.modalityFilter) el.modalityFilter.value = "";
      if (el.gameFormatFilter) el.gameFormatFilter.value = "";
      if (el.tournamentFilter) el.tournamentFilter.value = "";
    }

    function getFilters() {
      return {
        player: el.playerName?.value?.trim() || "",
        modality: el.modalityFilter?.value?.trim() || "",
        gameFormat: el.gameFormatFilter?.value?.trim() || "",
        tournament: el.tournamentFilter?.value?.trim() || "",
        stage: el.stageFilter?.value?.trim() || "",
        result: el.resultFilter?.value?.trim() || "",
        tournamentSituation: el.tournamentSituationFilter?.value?.trim() || "",
        from: el.fromDate?.value || "",
        to: el.toDate?.value || ""
      };
    }

    // ─── Estatísticas ─────────────────────────────────────────────────────────

    function computeStats(matches) {
      let wins = 0,
        losses = 0,
        wo = 0;

      matches.forEach((m) => {
        if (U.normalizeText(m.status) === "wo") wo++;
        const outcome = U.getLoggedUserOutcome(m);
        if (outcome === "win") wins++;
        if (outcome === "loss") losses++;
      });

      return { wins, losses, wo };
    }

    // ─── Torneios ─────────────────────────────────────────────────────────────

    const TOURNAMENT_STAGES = new Set([
      "primeira rodada",
      "segunda rodada",
      "terceira rodada",
      "oitavas de final",
      "quartas de final",
      "semifinais",
      "final",
      "grupos"
    ]);

    function isTournamentStage(match) {
      return TOURNAMENT_STAGES.has(U.normalizeText(match.tournamentStage || ""));
    }

    function computeTournamentStats(matches) {
      const tournamentsWithName = new Set();
      let tournamentsWithoutName = 0;
      let champion = 0;
      let runnerup = 0;

      matches.forEach((m) => {
        if (!isTournamentStage(m)) return;
        const tName = U.normalizeText(String(m.tournamentName || "").trim());
        if (tName) {
          tournamentsWithName.add(tName);
        } else {
          tournamentsWithoutName++;
        }
        const situation = U.getTournamentSituation(m);
        if (situation === "champion") champion++;
        if (situation === "runnerup") runnerup++;
      });

      return {
        tournaments: tournamentsWithName.size + tournamentsWithoutName,
        champion,
        runnerup
      };
    }

    function renderSummary(matches) {
      const total = matches.length;
      const stats = computeStats(matches);
      const tStats = computeTournamentStats(matches);

      if (el.totalMatches) el.totalMatches.textContent = String(total);
      if (el.totalWins) el.totalWins.textContent = String(stats.wins);
      if (el.totalLosses) el.totalLosses.textContent = String(stats.losses);
      if (el.totalWo) el.totalWo.textContent = String(stats.wo);
      if (el.totalTournaments) el.totalTournaments.textContent = String(tStats.tournaments);
      if (el.totalChampion) el.totalChampion.textContent = String(tStats.champion);
      if (el.totalRunnerup) el.totalRunnerup.textContent = String(tStats.runnerup);

      const player = state.currentProfileName || "Usuário";
      if (el.pageTitle) el.pageTitle.textContent = `Carreira - ${player}`;
      if (el.subtitle) el.subtitle.textContent = "Histórico de partidas finalizadas do usuário";

      if (el.summaryMessage) {
        el.summaryMessage.textContent = total
          ? `Exibindo ${total} partidas finalizadas de ${player}.`
          : `Nenhuma partida finalizada encontrada para ${player}.`;
      }
    }

    // ─── Renderização dos cards ───────────────────────────────────────────────

    function formatTeamName(match) {
      const team1 = U.getTeam1Line(match);
      const team2 = U.getTeam2Line(match);
      if (U.isDoubles(match)) {
        return `${U.escapeHtml(team1)}<br>${U.escapeHtml(team2)}`;
      }
      return `${U.escapeHtml(team1)} x ${U.escapeHtml(team2)}`;
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
        el.historyList.innerHTML = pageItems
          .map((m) => {
            const date = U.formatDate(m.matchDateTime);
            const modality = U.escapeHtml(U.getModalidade(m));
            const gameFormat = U.escapeHtml(U.getGameFormat(m));
            const category = U.escapeHtml(m.categoryName || "-");
            const tournament = U.escapeHtml(U.getTournamentName(m));
            const surfaceTypeRaw =
              U.getModalidade(m) === "Beach Tênis" ? "Areia" : U.getSurfaceType(m);
            const surfaceType = U.escapeHtml(surfaceTypeRaw);
            const court = U.escapeHtml(U.getCourt(m));
            const stage = U.escapeHtml(m.tournamentStage || "-");
            const score = U.escapeHtml(U.getScoreLabel(m));
            const duration = U.escapeHtml(U.getMatchDuration(m));
            const situation = U.getTournamentSituation(m);

            const outcome = U.getLoggedUserOutcome(m);
            const isWinner = outcome === "win";

            const cardClass = isWinner
              ? "career-card career-card-win"
              : "career-card career-card-loss";

            const situationLabel =
              situation === "champion"
                ? "🏆 Campeão"
                : situation === "runnerup"
                ? "🥈 Vice-Campeão"
                : "";

            const resultLabel = situationLabel || (isWinner ? "VITÓRIA" : "DERROTA");

            const teamDisplay = formatTeamName(m);

            return ` <article class="${cardClass}"> <div class="career-card-top-status"> <div class="career-card-result">${resultLabel}</div> </div> <div class="career-card-head"> <div class="career-card-title">${teamDisplay}</div> </div> <div class="career-grid"> <div class="career-item"><span>Data</span><strong>${U.escapeHtml(date)}</strong></div> <div class="career-item"><span>Modalidade</span><strong>${modality}</strong></div> <div class="career-item"><span>Formato do jogo</span><strong>${gameFormat}</strong></div> <div class="career-item"><span>Categoria</span><strong>${category}</strong></div> <div class="career-item"><span>Torneio</span><strong>${tournament}</strong></div> <div class="career-item"><span>Fase</span><strong>${stage}</strong></div> <div class="career-item"><span>Tipo de piso</span><strong>${surfaceType}</strong></div> <div class="career-item"><span>Quadra</span><strong>${court}</strong></div> <div class="career-item"><span>Placar</span><strong>${score}</strong></div> <div class="career-item"><span>Duração</span><strong>${duration}</strong></div> </div> </article> `;
          })
          .join("");
      }

      if (el.pageInfo) el.pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
      if (el.prevPageBtn) el.prevPageBtn.disabled = state.currentPage <= 1;
      if (el.nextPageBtn) el.nextPageBtn.disabled = state.currentPage >= totalPages;
    }

    // ─── Filtros ──────────────────────────────────────────────────────────────

    function applyFiltersAndRender() {
      const {
        player,
        modality,
        gameFormat,
        tournament,
        stage,
        result,
        tournamentSituation,
        from,
        to
      } = getFilters();

      let filtered = state.allMatches.filter((m) => U.isMatchForLoggedUser(m, state.currentUser));

      if (player) filtered = filtered.filter((m) => U.matchOpponentFilter(m, player));
      if (modality) filtered = filtered.filter((m) => U.matchModalidadeFilter(m, modality));
      if (gameFormat) filtered = filtered.filter((m) => U.matchGameFormatFilter(m, gameFormat));
      if (tournament) filtered = filtered.filter((m) => U.matchTournamentFilter(m, tournament));

      if (stage) {
        filtered = filtered.filter((m) => String(m.tournamentStage || "").trim() === stage);
      }

      if (result === "wins") filtered = filtered.filter((m) => U.getLoggedUserOutcome(m) === "win");
      if (result === "losses") filtered = filtered.filter((m) => U.getLoggedUserOutcome(m) === "loss");

      if (tournamentSituation === "champion") {
        filtered = filtered.filter((m) => U.getTournamentSituation(m) === "champion");
      }
      if (tournamentSituation === "runnerup") {
        filtered = filtered.filter((m) => U.getTournamentSituation(m) === "runnerup");
      }

      filtered = U.applyDateFilter(filtered, from, to);

      filtered.sort((a, b) => {
        const da = U.toDate(a.matchDateTime)?.getTime() || 0;
        const db = U.toDate(b.matchDateTime)?.getTime() || 0;
        return db - da;
      });

      state.filteredMatches = filtered;
      state.currentPage = 1;
      renderSummary(filtered);
      renderPagedHistory(filtered);
    }

    // ─── Toggle filtros ───────────────────────────────────────────────────────

    function updateToggleButtonUI() {
      const btn = el.toggleFiltersBtn;
      if (!btn) return;
      const icon = btn.querySelector(".career-bottom-icon");
      const label = btn.querySelector(".career-bottom-label");
      if (icon) icon.textContent = state.filtersCollapsed ? "🔎" : "📋";
      if (label) label.textContent = state.filtersCollapsed ? "Filtros" : "Lista";
    }

    function setFiltersCollapsed(collapsed) {
      state.filtersCollapsed = !!collapsed;
      const filtersWrap = document.getElementById("careerFiltersSection");
      filtersWrap?.classList.toggle("is-collapsed", state.filtersCollapsed);
      updateToggleButtonUI();
    }

    function bindToggleFilters() {
      el.toggleFiltersBtn?.addEventListener("click", () => {
        setFiltersCollapsed(!state.filtersCollapsed);
      });
      updateToggleButtonUI();
    }

    // ─── Eventos ──────────────────────────────────────────────────────────────

    function bindEvents() {
      el.applyFilterBtn?.addEventListener("click", applyFiltersAndRender);

      el.clearFilterBtn?.addEventListener("click", () => {
        setDefaultFields(state.currentProfileName);
        if (el.stageFilter) el.stageFilter.value = "";
        if (el.resultFilter) el.resultFilter.value = "";
        if (el.tournamentSituationFilter) el.tournamentSituationFilter.value = "";
        if (el.fromDate) el.fromDate.value = "";
        if (el.toDate) el.toDate.value = "";
        if (el.tournamentFilter) el.tournamentFilter.value = "";
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

    // ─── Logout ───────────────────────────────────────────────────────────────

    const logoutBtnBottom = document.getElementById("logoutBtnBottom");

    logoutBtnBottom?.addEventListener("click", async () => {
      try {
        localStorage.removeItem(ADMIN_KEY);
        localStorage.removeItem(BIOMETRIC_SESSION_KEY);
        await getAuth().signOut();
        window.location.replace("login.html");
      } catch (err) {
        console.error("Erro ao sair:", err);
      }
    });

    // ─── Firestore / sessão ────────────────────────────────────────────────────

    function getBiometricCurrentUser() {
      try {
        const raw = localStorage.getItem(BIOMETRIC_CURRENT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return {
          uid: parsed.uid || "",
          email: parsed.email || "",
          displayName: parsed.displayName || ""
        };
      } catch (_) {
        return null;
      }
    }

    async function loadCurrentProfileName(user) {
      try {
        const db = getDb();
        const doc = await db.collection("profiles").doc(user.uid).get();
        if (doc.exists && doc.data().displayName) {
          state.currentProfileName = doc.data().displayName.trim();
        } else {
          state.currentProfileName = user.displayName || "";
        }
      } catch {
        state.currentProfileName = user.displayName || "";
      }
    }

    async function buildFallbackUser() {
      const biometricUser = getBiometricCurrentUser();
      if (biometricUser?.uid) {
        try {
          const db = getDb();
          const profileSnap = await db.collection("profiles").doc(biometricUser.uid).get();
          const profileData = profileSnap.exists ? (profileSnap.data() || {}) : {};

          const userSnap = await db.collection("users").doc(biometricUser.uid).get();
          const userData = userSnap.exists ? (userSnap.data() || {}) : {};

          return {
            uid: biometricUser.uid,
            email: biometricUser.email || userData.email || profileData.email || "",
            displayName:
              biometricUser.displayName ||
              profileData.displayName ||
              userData.displayName ||
              ""
          };
        } catch (err) {
          console.warn("Falha ao reconstruir usuário biométrico:", err);
          return biometricUser;
        }
      }

      return null;
    }

    function listenMatches() {
      if (!state.currentUser) {
        setSummaryMessage("Usuário não autenticado.");
        return;
      }

      state.unsubscribe?.();
      state.unsubscribe = null;

      state.unsubscribe = getDb()
        .collection("matches")
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

    // ─── Init ─────────────────────────────────────────────────────────────────

    function init() {
      if (typeof __auth === "undefined") {
        setSummaryMessage("Firebase Auth não carregado.");
        return;
      }

      bindEvents();

      __auth.onAuthStateChanged(async (user) => {
        const hasLocal = localStorage.getItem(ADMIN_KEY) === "1";
        const hasBiometric = localStorage.getItem(BIOMETRIC_SESSION_KEY) === "1";

        if (!user && !hasLocal && !hasBiometric) {
          state.currentUser = null;
          state.currentProfileName = "";
          setSummaryMessage("Usuário não autenticado.");
          renderPagedHistory([]);
          return;
        }

        if (user) {
          state.currentUser = user;
          await loadCurrentProfileName(user);
          setDefaultFields(state.currentProfileName);
          listenMatches();
          return;
        }

        const fallbackUser = await buildFallbackUser();

        if (fallbackUser?.uid) {
          state.currentUser = fallbackUser;
          state.currentProfileName = String(fallbackUser.displayName || "").trim() || fallbackUser.email || "";
          setDefaultFields(state.currentProfileName);
          listenMatches();
          return;
        }

        state.currentUser = null;
        state.currentProfileName = "";
        setSummaryMessage("Usuário não autenticado.");
        renderPagedHistory([]);
      });
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => CareerApp.init());
})();
