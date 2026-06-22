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
      filtersCollapsed: true,
      currentPage: 1,
      activeCardFilter: null,
      showMatches: false
    };

    const el = {
      profileName: document.getElementById("profileName"),
      playerName: document.getElementById("playerName"),
      gameFormatFilter: document.getElementById("gameFormatFilter"),
      tournamentFilter: document.getElementById("tournamentFilter"),
      stageFilter: document.getElementById("stageFilter"),
      yearFilter: document.getElementById("yearFilter"),
      applyFilterBtn: document.getElementById("applyFilterBtn"),
      clearFilterBtn: document.getElementById("clearFilterBtn"),
      totalMatches: document.getElementById("totalMatches"),
      totalWins: document.getElementById("totalWins"),
      totalLosses: document.getElementById("totalLosses"),
      totalWo: document.getElementById("totalWo"),
      totalTournaments: document.getElementById("totalTournaments"),
      totalChampion: document.getElementById("totalChampion"),
      totalRunnerup: document.getElementById("totalRunnerup"),
      totalRanking: document.getElementById("totalRanking"),
      totalTraining: document.getElementById("totalTraining"),
      totalSimple: document.getElementById("totalSimple"),
      totalDoubles: document.getElementById("totalDoubles"),
      historyList: document.getElementById("historyList"),
      summaryMessage: document.getElementById("summaryMessage"),
      pageTitle: document.getElementById("pageTitle"),
      subtitle: document.getElementById("subtitle"),
      toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
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

      cleanSetHistory(setHistory) {
        const history = Array.isArray(setHistory) ? setHistory : [];

        const normalizeText = (text) =>
          String(text || "")
            .replace(/\((\d+)-(\d+)\)/g, "$1-$2")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

        const seen = new Set();
        const cleaned = [];

        for (const item of history) {
          if (!item) continue;

          const g1 = Number(item?.games1 || 0);
          const g2 = Number(item?.games2 || 0);
          const tb1 = Number(item?.tieBreakPoints1 || 0);
          const tb2 = Number(item?.tieBreakPoints2 || 0);
          const mode = String(item?.tieBreakMode || "").trim();
          const finalLabel = String(item?.finalLabel || "").trim();

          let text = "";

          if (finalLabel) {
            text = finalLabel;
          } else if (mode === "super10" && (tb1 > 0 || tb2 > 0)) {
            text = `${tb1}-${tb2}`;
          } else if (mode === "tb7" && (tb1 > 0 || tb2 > 0)) {
            const winnerIs1 = tb1 > tb2;
            text = `${winnerIs1 ? "7x6" : "6x7"} (${tb1}-${tb2})`;
          } else if (g1 > 0 || g2 > 0) {
            text = `${g1}x${g2}`;
          }

          text = String(text || "").trim();
          if (!text || text === "--") continue;

          const norm = normalizeText(text);
          if (seen.has(norm)) continue;

          seen.add(norm);
          cleaned.push(item);
        }

        return cleaned;
      },

      getScoreLabel(match) {
        const score = U.normalizeScore(match.score || {});
        const status = U.normalizeText(match.status);

        if (status === "wo") return "WO";

        const history = U.cleanSetHistory(score.setHistory);

        const getSetText = (setObj) => {
          if (!setObj) return "";

          const g1 = Number(setObj?.games1 || 0);
          const g2 = Number(setObj?.games2 || 0);
          const tb1 = Number(setObj?.tieBreakPoints1 || 0);
          const tb2 = Number(setObj?.tieBreakPoints2 || 0);
          const mode = String(setObj?.tieBreakMode || "").trim();
          const finalLabel = String(setObj?.finalLabel || "").trim();

          if (finalLabel) return finalLabel;

          if (mode === "super10" && (tb1 > 0 || tb2 > 0)) {
            return `${tb1}-${tb2}`;
          }

          if (mode === "tb7" && (tb1 > 0 || tb2 > 0)) {
            const winnerIs1 = tb1 > tb2;
            return `${winnerIs1 ? "7x6" : "6x7"} (${tb1}-${tb2})`;
          }

          if (g1 > 0 || g2 > 0) {
            return `${g1}x${g2}`;
          }

          return "";
        };

        const parts = history.map(getSetText).filter((t) => t && t !== "--");

        if (parts.length) {
          return parts.join(" • ");
        }

        if (score.sets1 > 0 || score.sets2 > 0) {
          return `${score.sets1}x${score.sets2}`;
        }

        return "--";
      },

      isMatchForLoggedUser(match, currentUser) {
        const ownerId = String(match.ownerId || "").trim();
        return Boolean(currentUser && ownerId && ownerId === currentUser.uid);
      },

      matchOpponentFilter(match, opponentText) {
        if (!opponentText) return true;
        const query = U.normalizeText(opponentText);
        return [match.player1, match.player2, match.player3, match.player4].some((p) =>
          U.normalizeText(p || "").includes(query)
        );
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

    function getAvailableYears(matches) {
      const years = new Set();
      matches.forEach((m) => {
        const d = U.toDate(m.matchDateTime);
        if (d) years.add(String(d.getFullYear()));
      });
      return Array.from(years).sort((a, b) => Number(b) - Number(a));
    }

    function populateYearFilter(matches) {
      if (!el.yearFilter) return;
      const currentValue = el.yearFilter.value;
      const years = getAvailableYears(matches);
      el.yearFilter.innerHTML = `<option value="">Todos os anos</option>`;
      years.forEach((year) => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        el.yearFilter.appendChild(option);
      });
      if (years.includes(currentValue)) el.yearFilter.value = currentValue;
    }

    function populateTournamentFilter(matches) {
      if (!el.tournamentFilter) return;

      const currentValue = el.tournamentFilter.value;
      const tournaments = Array.from(
        new Set(
          matches
            .map((m) => U.getTournamentName(m))
            .filter((name) => name && name !== "-")
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

      el.tournamentFilter.innerHTML = `<option value="">Todos os torneios</option>`;

      tournaments.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        el.tournamentFilter.appendChild(option);
      });

      if (tournaments.includes(currentValue)) {
        el.tournamentFilter.value = currentValue;
      }
    }

    function setSummaryMessage(text) {
      if (el.summaryMessage) el.summaryMessage.textContent = text || "";
    }

    function setDefaultFields(profileName) {
      if (el.profileName) {
        el.profileName.value = profileName || "";
        el.profileName.readOnly = true;
      }
      if (el.playerName) el.playerName.value = "";
      if (el.gameFormatFilter) el.gameFormatFilter.value = "";
      if (el.tournamentFilter) el.tournamentFilter.value = "";
      if (el.stageFilter) el.stageFilter.value = "";
      if (el.yearFilter) el.yearFilter.value = "";
    }

    function getFilters() {
      return {
        player: el.playerName?.value?.trim() || "",
        gameFormat: el.gameFormatFilter?.value?.trim() || "",
        tournament: el.tournamentFilter?.value?.trim() || "",
        stage: el.stageFilter?.value?.trim() || "",
        year: el.yearFilter?.value?.trim() || ""
      };
    }

    function computeStats(matches) {
      let wins = 0,
        losses = 0,
        wo = 0,
        ranking = 0,
        training = 0,
        simple = 0,
        doubles = 0;

      matches.forEach((m) => {
        if (U.normalizeText(m.status) === "wo") wo++;
        const outcome = U.getLoggedUserOutcome(m);
        if (outcome === "win") wins++;
        if (outcome === "loss") losses++;

        const stage = U.normalizeText(m.tournamentStage || "");
        if (stage === "ranking") ranking++;
        if (stage === "treino") training++;

        const gf = U.normalizeText(U.getGameFormat(m));
        if (gf === "simples") simple++;
        if (gf === "duplas" || gf === "duplas mistas") doubles++;
      });

      return { wins, losses, wo, ranking, training, simple, doubles };
    }

    function computeTournamentStats(matches) {
      const tournaments = new Set();
      let champion = 0;
      let runnerup = 0;

      matches.forEach((m) => {
        const stage = U.normalizeText(m.tournamentStage || "");
        if (!TOURNAMENT_STAGES.has(stage)) return;

        const tournamentName = U.normalizeText(String(m.tournamentName || "").trim());
        const year = U.toDate(m.matchDateTime)?.getFullYear() || "";
        const gameFormat = U.normalizeText(U.getGameFormat(m));
        const tournamentKey = `${tournamentName || "sem-nome"}::${year}::${gameFormat || "sem-formato"}`;
        tournaments.add(tournamentKey);

        const situation = U.getTournamentSituation(m);
        if (situation === "champion") champion++;
        if (situation === "runnerup") runnerup++;
      });

      return { tournaments: tournaments.size, champion, runnerup };
    }

    function renderSummary(matches) {
      const total = matches.length;
      const stats = computeStats(matches);
      const tStats = computeTournamentStats(matches);

      const totalPlayed = stats.wins + stats.losses;
      const winPct = totalPlayed > 0 ? Math.round((stats.wins / totalPlayed) * 100) : 0;
      const lossPct = totalPlayed > 0 ? Math.round((stats.losses / totalPlayed) * 100) : 0;

      if (el.totalMatches) el.totalMatches.textContent = String(total);
      if (el.totalWins) el.totalWins.textContent = `${stats.wins} - ${winPct}%`;
      if (el.totalLosses) el.totalLosses.textContent = `${stats.losses} - ${lossPct}%`;
      if (el.totalWo) el.totalWo.textContent = String(stats.wo);
      if (el.totalTournaments) el.totalTournaments.textContent = String(tStats.tournaments);
      if (el.totalChampion) el.totalChampion.textContent = String(tStats.champion);
      if (el.totalRunnerup) el.totalRunnerup.textContent = String(tStats.runnerup);
      if (el.totalRanking) el.totalRanking.textContent = String(stats.ranking);
      if (el.totalTraining) el.totalTraining.textContent = String(stats.training);
      if (el.totalSimple) el.totalSimple.textContent = String(stats.simple);
      if (el.totalDoubles) el.totalDoubles.textContent = String(stats.doubles);

      const player = state.currentProfileName || "Usuário";
      if (el.pageTitle) el.pageTitle.textContent = `Carreira - ${player}`;
      if (el.subtitle) el.subtitle.textContent = "Histórico de partidas finalizadas do usuário";

      if (el.summaryMessage) {
        el.summaryMessage.textContent = total
          ? `Exibindo ${total} partidas finalizadas de ${player}.`
          : `Nenhuma partida finalizada encontrada para ${player}.`;
      }
    }

    function formatTeamName(match) {
      const team1 = U.getTeam1Line(match);
      const team2 = U.getTeam2Line(match);
      if (U.isDoubles(match)) {
        return `${U.escapeHtml(team1)}<br>${U.escapeHtml(team2)}`;
      }
      return `${U.escapeHtml(team1)} x ${U.escapeHtml(team2)}`;
    }

    function getStageIconSvg(stageRaw = "") {
      const stage = U.normalizeText(stageRaw);

      if (stage === "ranking") {
        return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect x="2" y="14" width="4" height="7" rx="1" stroke="currentColor" stroke-width="1.8"/> <rect x="10" y="9" width="4" height="12" rx="1" stroke="currentColor" stroke-width="1.8"/> <rect x="18" y="4" width="4" height="17" rx="1" stroke="currentColor" stroke-width="1.8"/> <path d="M4 10l4-4 4 4 4-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/> </svg> `;
      }

      if (stage === "treino") {
        return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/> <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/> <path d="M12 3c2.4 2.4 3 5.4 3 9s-.6 6.6-3 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <path d="M12 3c-2.4 2.4-3 5.4-3 9s.6 6.6 3 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <path d="M3 12h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg> `;
      }

      if (stage === "final") {
        return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <path d="M5 3h14v8a7 7 0 0 1-14 0V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/> <path d="M5 6H2a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4M19 6h3a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg> `;
      }

      if (stage === "semifinais") {
        return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M12 2l2.6 5.2 5.8.85-4.2 4.1.99 5.77L12 15.2l-5.19 2.72.99-5.77L3.6 8.05l5.8-.85L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/> </svg> `;
      }

      if (stage === "quartas de final") {
        return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/> <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg> `;
      }

      if (stage === "oitavas de final") {
        return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg> `;
      }

      return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" stroke-width="1.8"/> <path d="M3 9h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <path d="M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <circle cx="8.5" cy="14" r="1.2" fill="currentColor"/> <circle cx="12" cy="14" r="1.2" fill="currentColor"/> <circle cx="15.5" cy="14" r="1.2" fill="currentColor"/> </svg> `;
    }

    function getOutcomeIconSvg(outcome, situation) {
      if (situation === "champion") {
        return ` <svg class="career-match-icon outcome" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M12 2l2.6 5.2 5.8.85-4.2 4.1.99 5.77L12 15.2l-5.19 2.72.99-5.77L3.6 8.05l5.8-.85L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/> </svg> `;
      }

      if (situation === "runnerup") {
        return ` <svg class="career-match-icon outcome" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/> <path d="M9 12.5L7.5 21l4.5-2 4.5 2L15 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/> </svg> `;
      }

      if (outcome === "win") {
        return ` <svg class="career-match-icon outcome" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/> <path d="M7.5 12.5l3 3 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </svg> `;
      }

      return ` <svg class="career-match-icon outcome" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/> <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/> </svg> `;
    }

    function renderPagedHistory(matches) {
      if (!el.historyList) return;
    
      const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
      if (state.currentPage > totalPages) state.currentPage = totalPages;
      if (state.currentPage < 1) state.currentPage = 1;
    
      const start = (state.currentPage - 1) * PAGE_SIZE;
      const pageItems = matches.slice(start, start + PAGE_SIZE);
    
      const getStageIconSvg = (stageRaw = "") => {
        const stage = U.normalizeText(stageRaw);
    
        if (stage === "ranking") {
          return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect x="2" y="14" width="4" height="7" rx="1" stroke="currentColor" stroke-width="1.8"/> <rect x="10" y="9" width="4" height="12" rx="1" stroke="currentColor" stroke-width="1.8"/> <rect x="18" y="4" width="4" height="17" rx="1" stroke="currentColor" stroke-width="1.8"/> <path d="M4 10l4-4 4 4 4-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/> </svg> `;
        }
    
        if (stage === "treino") {
          return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/> <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/> <path d="M12 3c2.4 2.4 3 5.4 3 9s-.6 6.6-3 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <path d="M12 3c-2.4 2.4-3 5.4-3 9s.6 6.6 3 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <path d="M3 12h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg> `;
        }
    
        if (stage === "final") {
          return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <path d="M5 3h14v8a7 7 0 0 1-14 0V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/> <path d="M5 6H2a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4M19 6h3a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg> `;
        }
    
        if (stage === "semifinais") {
          return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M12 2l2.6 5.2 5.8.85-4.2 4.1.99 5.77L12 15.2l-5.19 2.72.99-5.77L3.6 8.05l5.8-.85L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/> </svg> `;
        }
    
        if (stage === "quartas de final") {
          return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/> <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg> `;
        }
    
        if (stage === "oitavas de final") {
          return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg> `;
        }
    
        return ` <svg class="career-match-icon stage" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" stroke-width="1.8"/> <path d="M3 9h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <path d="M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <circle cx="8.5" cy="14" r="1.2" fill="currentColor"/> <circle cx="12" cy="14" r="1.2" fill="currentColor"/> <circle cx="15.5" cy="14" r="1.2" fill="currentColor"/> </svg> `;
      };
    
      const getOutcomeIconSvg = (outcome, situation) => {
        if (situation === "champion") {
          return ` <svg class="career-match-icon outcome" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M12 2l2.6 5.2 5.8.85-4.2 4.1.99 5.77L12 15.2l-5.19 2.72.99-5.77L3.6 8.05l5.8-.85L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/> </svg> `;
        }
    
        if (situation === "runnerup") {
          return ` <svg class="career-match-icon outcome" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/> <path d="M9 12.5L7.5 21l4.5-2 4.5 2L15 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/> </svg> `;
        }
    
        if (outcome === "win") {
          return ` <svg class="career-match-icon outcome" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/> <path d="M7.5 12.5l3 3 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </svg> `;
        }
    
        return ` <svg class="career-match-icon outcome" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/> <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/> </svg> `;
      };
    
      const getFormatIconSvg = (gameFormatRaw = "") => {
        const format = U.normalizeText(gameFormatRaw);
    
        if (format === "simples") {
          return ` <svg class="career-match-icon format" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/> <path d="M6 21c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg> `;
        }
    
        if (format === "duplas" || format === "duplas mistas") {
          return ` <svg class="career-match-icon format" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/> <circle cx="16" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/> <path d="M3.8 20c0-2.5 2.1-4.5 4.7-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> <path d="M20.2 20c0-2.5-2.1-4.5-4.7-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/> </svg> `;
        }
    
        return "";
      };
    
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
            const isTreino = U.normalizeText(m.tournamentStage || "") === "treino";
    
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
    
            const stageIcon = getStageIconSvg(m.tournamentStage || "");
            const outcomeIcon = getOutcomeIconSvg(outcome, situation);
            const formatIcon = getFormatIconSvg(m.gameFormat || "");
    
            return ` <article class="${cardClass}"> <div class="career-card-top-icons"> <span class="career-card-icon-slot outcome-slot">${outcomeIcon}</span> <span class="career-card-icon-slot stage-slot">${stageIcon}</span> ${formatIcon ? `<span class="career-card-icon-slot format-slot">${formatIcon}</span>` : ""} </div> <div class="career-card-top-status"> <div class="career-card-result">${resultLabel}</div> </div> <div class="career-card-head"> <div class="career-card-title">${teamDisplay}</div> </div> <div class="career-grid"> <div class="career-item"><span>Data</span><strong>${U.escapeHtml(date)}</strong></div> <div class="career-item"><span>Modalidade</span><strong>${modality}</strong></div> <div class="career-item"><span>Formato do jogo</span><strong>${gameFormat}</strong></div> ${!isTreino ? `<div class="career-item"><span>Categoria</span><strong>${category}</strong></div>` : ""} ${!isTreino ? `<div class="career-item"><span>Torneio</span><strong>${tournament}</strong></div>` : ""} <div class="career-item"><span>Fase</span><strong>${stage}</strong></div> <div class="career-item"><span>Tipo de piso</span><strong>${surfaceType}</strong></div> <div class="career-item"><span>Quadra</span><strong>${court}</strong></div> <div class="career-item"><span>Placar</span><strong>${score}</strong></div> <div class="career-item"><span>Duração</span><strong>${duration}</strong></div> </div> </article> `;
          })
          .join("");
      }
    
      if (el.pageInfo) el.pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
      if (el.prevPageBtn) el.prevPageBtn.disabled = state.currentPage <= 1;
      if (el.nextPageBtn) el.nextPageBtn.disabled = state.currentPage >= totalPages;
    }

    function updateCardFilterUI() {
      document.querySelectorAll(".career-summary-card[data-filter]").forEach((card) => {
        const isActive = card.dataset.filter === state.activeCardFilter;
        card.classList.toggle("career-card-filter-active", isActive);
        card.classList.toggle(
          "career-card-filter-inactive",
          state.activeCardFilter !== null && !isActive
        );
      });
    }

    function applyCardFilter(filterType) {
      state.activeCardFilter = state.activeCardFilter === filterType ? null : filterType;
      state.showMatches = true;

      updateCardFilterUI();

      state.currentPage = 1;
      applyFiltersAndRender();

      setTimeout(() => {
        const list = document.getElementById("historyList");
        if (list) {
          const y = list.getBoundingClientRect().top + window.scrollY - 20;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 80);
    }

    function bindCardFilters() {
      document.querySelectorAll(".career-summary-card[data-filter]").forEach((card) => {
        card.addEventListener("click", () => applyCardFilter(card.dataset.filter));
      });
    }

    function applyFiltersAndRender() {
      const { player, gameFormat, tournament, stage, year } = getFilters();

      let filtered = state.allMatches.filter((m) => U.isMatchForLoggedUser(m, state.currentUser));

      if (state.activeCardFilter === "wins") {
        filtered = filtered.filter((m) => U.getLoggedUserOutcome(m) === "win");
      } else if (state.activeCardFilter === "losses") {
        filtered = filtered.filter((m) => U.getLoggedUserOutcome(m) === "loss");
      } else if (state.activeCardFilter === "champion") {
        filtered = filtered.filter((m) => U.getTournamentSituation(m) === "champion");
      } else if (state.activeCardFilter === "runnerup") {
        filtered = filtered.filter((m) => U.getTournamentSituation(m) === "runnerup");
      } else if (state.activeCardFilter === "tournaments") {
        filtered = filtered.filter((m) =>
          TOURNAMENT_STAGES.has(U.normalizeText(m.tournamentStage || ""))
        );
      } else if (state.activeCardFilter === "ranking") {
        filtered = filtered.filter((m) =>
          U.normalizeText(m.tournamentStage || "") === "ranking"
        );
      } else if (state.activeCardFilter === "training") {
        filtered = filtered.filter((m) =>
          U.normalizeText(m.tournamentStage || "") === "treino"
        );
      } else if (state.activeCardFilter === "simple") {
        filtered = filtered.filter((m) => U.normalizeText(U.getGameFormat(m)) === "simples");
      } else if (state.activeCardFilter === "doubles") {
        filtered = filtered.filter((m) => {
          const gf = U.normalizeText(U.getGameFormat(m));
          return gf === "duplas" || gf === "duplas mistas";
        });
      }

      if (player) filtered = filtered.filter((m) => U.matchOpponentFilter(m, player));
      if (gameFormat) filtered = filtered.filter((m) => U.matchGameFormatFilter(m, gameFormat));
      if (tournament) filtered = filtered.filter((m) => U.matchTournamentFilter(m, tournament));

      if (stage) {
        filtered = filtered.filter((m) => String(m.tournamentStage || "").trim() === stage);
      }

      if (year) {
        filtered = filtered.filter((m) => {
          const d = U.toDate(m.matchDateTime);
          return d && String(d.getFullYear()) === year;
        });
      }

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
      if (filtersWrap) {
        filtersWrap.style.display = state.filtersCollapsed ? "none" : "";
        if (!state.filtersCollapsed) {
          setTimeout(() => {
            const yOffset = -100;
            const y = filtersWrap.getBoundingClientRect().top + window.scrollY + yOffset;
            window.scrollTo({ top: y, behavior: "smooth" });
          }, 50);
        }
      }
      updateToggleButtonUI();
    }

    function bindToggleFilters() {
      el.toggleFiltersBtn?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const scrollPosition = window.scrollY;

        setFiltersCollapsed(!state.filtersCollapsed);

        requestAnimationFrame(() => {
          window.scrollTo({
            top: scrollPosition,
            behavior: "auto"
          });
        });
      });

      updateToggleButtonUI();
    }

    function setSummaryMessageOrDefault() {
      if (el.summaryMessage) {
        el.summaryMessage.textContent = "Selecione um filtro para exibir as partidas finalizadas.";
      }
    }

    function bindEvents() {
      el.applyFilterBtn?.addEventListener("click", () => {
        state.showMatches = true;
        applyFiltersAndRender();

        setTimeout(() => {
          const list = document.getElementById("historyList");
          if (list) {
            const y = list.getBoundingClientRect().top + window.scrollY - 20;
            window.scrollTo({ top: y, behavior: "smooth" });
          }
        }, 80);
      });

      el.clearFilterBtn?.addEventListener("click", () => {
        state.activeCardFilter = null;
        state.showMatches = false;
        updateCardFilterUI();
        setDefaultFields(state.currentProfileName);
        state.currentPage = 1;
        applyFiltersAndRender();

        setTimeout(() => {
          const summary = document.querySelector(".career-summary");
          if (summary) {
            const y = summary.getBoundingClientRect().top + window.scrollY - 16;
            window.scrollTo({ top: y, behavior: "smooth" });
          }
        }, 80);
      });

      el.prevPageBtn?.addEventListener("click", () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderPagedHistory(state.filteredMatches);

          setTimeout(() => {
            const firstCard = document.querySelector("#historyList .career-card");
            if (firstCard) {
              const y = firstCard.getBoundingClientRect().top + window.scrollY - 20;
              window.scrollTo({ top: y, behavior: "smooth" });
            }
          }, 50);
        }
      });

      el.nextPageBtn?.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderPagedHistory(state.filteredMatches);

          setTimeout(() => {
            const firstCard = document.querySelector("#historyList .career-card");
            if (firstCard) {
              const y = firstCard.getBoundingClientRect().top + window.scrollY - 20;
              window.scrollTo({ top: y, behavior: "smooth" });
            }
          }, 50);
        }
      });

      bindToggleFilters();
      bindCardFilters();
    }

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

            populateYearFilter(state.allMatches);
            populateTournamentFilter(state.allMatches);

            if (state.showMatches) {
              applyFiltersAndRender();
            } else {
              renderSummary(state.allMatches);
              renderPagedHistory([]);
              setSummaryMessageOrDefault();
            }
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

      state.filtersCollapsed = true;
      setFiltersCollapsed(true);
      state.showMatches = false;

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
          state.currentProfileName =
            String(fallbackUser.displayName || "").trim() || fallbackUser.email || "";
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
