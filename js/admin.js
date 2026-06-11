(() => {
  "use strict";

  const AdminApp = (() => {
    const ADMIN_KEY = "lsts_admin_session";
    const ADMIN_EMAIL = "rodrigokamunga@hotmail.com";
    const PAGE_SIZE = 5;
    const MOBILE_QUERY = "(max-width: 768px)";

    const ALLOWED_FORMATS_TENNIS = [
      "1 set no AD + um super tie-break",
      "2 sets sem vantagem + um super tie-break",
      "2 sets com vantagem + um super tie-break",
      "3 sets com vantagem",
      "1 set com vantagem",
      "1 set pro de 8 games no AD + um super tie-break"
    ];

    const ALLOWED_FORMATS_BEACH = [
      "1 set no AD + um super tie-break",
      "2 sets sem vantagem + um super tie-break"
    ];

    const ALLOWED_SURFACES = ["Rápida", "Saibro", "Grama"];

    const state = {
      allMatches: [],
      filteredMatches: [],
      currentPage: 1,
      filtersVisible: true,
      currentUser: null,
      currentProfileName: "",
      unsubscribe: null,
      initialized: false,
      isMobile: window.matchMedia(MOBILE_QUERY).matches,
      resizeTimer: null,
      mobileMql: window.matchMedia(MOBILE_QUERY)
    };

    const el = {
      showFormBtn: document.getElementById("showFormBtn"),
      showFormBtnBottom: document.getElementById("showFormBtnBottom"),
      toggleMatchesBtn: document.getElementById("toggleMatchesBtn"),
      toggleMatchesBtnBottom: document.getElementById("toggleMatchesBtnBottom"),
      logoutBtnBottom: document.getElementById("logoutBtnBottom"),
      matchFormWrapper: document.getElementById("matchFormWrapper"),
      form: document.getElementById("matchForm"),
      tbody: document.getElementById("matchesTable"),
      msg: document.getElementById("adminMsg"),
      dialog: document.getElementById("detailsDialog"),
      detailsContent: document.getElementById("detailsContent"),
      docId: document.getElementById("docId"),
      modality: document.getElementById("modality"),
      categoryName: document.getElementById("categoryName"),
      tournamentName: document.getElementById("tournamentName"),
      surfaceType: document.getElementById("surfaceType"),
      surfaceTypeWrapper: document.getElementById("surfaceTypeWrapper"),
      gameFormat: document.getElementById("gameFormat"),
      matchFormat: document.getElementById("matchFormat"),
      matchDateTime: document.getElementById("matchDateTime"),
      court: document.getElementById("court"),
      tournamentStage: document.getElementById("tournamentStage"),
      player1: document.getElementById("player1"),
      player2: document.getElementById("player2"),
      player3: document.getElementById("player3"),
      player4: document.getElementById("player4"),
      player3Wrapper: document.getElementById("player3Wrapper"),
      player4Wrapper: document.getElementById("player4Wrapper"),
      probPlayer1: document.getElementById("probPlayer1"),
      probPlayer2: document.getElementById("probPlayer2"),
      probPlayer1Wrapper: document.getElementById("probPlayer1Wrapper"),
      probPlayer2Wrapper: document.getElementById("probPlayer2Wrapper"),
      winnerByWO: document.getElementById("winnerByWO"),
      status: document.getElementById("status"),
      formTitle: document.getElementById("formTitle"),
      logoutBtn: document.getElementById("logoutBtn"),
      clearBtn: document.getElementById("clearBtn"),
      cancelBtn: document.getElementById("cancelBtn"),
      closeDialogBtn: document.getElementById("closeDialogBtn"),
      filterPlayers: document.getElementById("filterPlayers"),
      filterModality: document.getElementById("filterModality"),
      filterGameFormat: document.getElementById("filterGameFormat"),
      filterCategory: document.getElementById("filterCategory"),
      filterTournament: document.getElementById("filterTournament"),
      filterStatus: document.getElementById("filterStatus"),
      clearFiltersBtn: document.getElementById("clearFiltersBtn"),
      prevPageBtn: document.getElementById("prevPageBtn"),
      nextPageBtn: document.getElementById("nextPageBtn"),
      pageInfo: document.getElementById("pageInfo"),
      totalPagesEl: document.getElementById("totalPages"),
      itemsShown: document.getElementById("itemsShown"),
      itemsTotal: document.getElementById("itemsTotal"),
      matchesSection: document.getElementById("matchesSection"),
      filtersBar: document.getElementById("filtersBar")
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

      normalizeText(text = "") {
        return String(text || "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      },

      isAdmin(user) {
        return U.normalizeText(user?.email) === U.normalizeText(ADMIN_EMAIL);
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

      getCreatedAtMs(match) {
        const val = match?.createdAt;
        if (!val) return 0;
        if (typeof val.toDate === "function") {
          const d = val.toDate();
          return isNaN(d.getTime()) ? 0 : d.getTime();
        }
        if (typeof val === "number") return val;
        const d = new Date(val);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      },

      formatDuration(seconds) {
        const total = Number(seconds || 0);
        const h = String(Math.floor(total / 3600)).padStart(2, "0");
        const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
        const s = String(total % 60).padStart(2, "0");
        return `${h}:${m}:${s}`;
      },

      formatMatchFormat(value) {
        const text = String(value || "").trim();
        const legacyMap = {
          "1 set sem vantagem + um supertiebreak de 10 pontos": "1 set no AD + um super tie-break",
          "1 set no ad + um super tie-break": "1 set no AD + um super tie-break",
          "2 sets sem vantagem + um supertiebreak de 10 pontos": "2 sets sem vantagem + um super tie-break",
          "2 sets sem vantagem + um super tie-break": "2 sets sem vantagem + um super tie-break",
          "2 sets com vantagem + um supertiebreak de 10 pontos": "2 sets com vantagem + um super tie-break",
          "2 sets com vantagem + um super tie-break": "2 sets com vantagem + um super tie-break",
          "3 sets com vantagem": "3 sets com vantagem",
          "1 set com vantagem": "1 set com vantagem",
          "1 set pro de 8 games sem vantagem + um supertiebreak de 10 pontos": "1 set pro de 8 games no AD + um super tie-break",
          "1 set pro de 8 games no ad + um super tie-break": "1 set pro de 8 games no AD + um super tie-break"
        };
        const low = text.toLowerCase();
        return legacyMap[low] || text || "-";
      },

      normalizeScore(score = {}) {
        return {
          points1: Number(score.points1 || 0),
          points2: Number(score.points2 || 0),
          games1: Number(score.games1 || 0),
          games2: Number(score.games2 || 0),
          sets1: Number(score.sets1 || 0),
          sets2: Number(score.sets2 || 0),
          tieBreakMode: score.tieBreakMode === "tb7" || score.tieBreakMode === "super10" ? score.tieBreakMode : null,
          tieBreakPoints1: Number(score.tieBreakPoints1 || 0),
          tieBreakPoints2: Number(score.tieBreakPoints2 || 0),
          lastTieBreakMode: score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10" ? score.lastTieBreakMode : null,
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

      getWinnerPosition(score, d) {
        const status = String(d?.status || "").trim().toLowerCase();
        const woWinner = String(d?.winnerByWO || "").trim().toLowerCase();

        if (status === "wo") {
          if (woWinner === "player1") return 1;
          if (woWinner === "player2") return 2;
        }

        if (Number(score.sets1 || 0) > Number(score.sets2 || 0)) return 1;
        if (Number(score.sets2 || 0) > Number(score.sets1 || 0)) return 2;
        return null;
      },

      getWONumberOrName(d) {
        const status = String(d?.status || "").trim().toLowerCase();
        if (status !== "wo") return "";
        const woWinner = String(d?.winnerByWO || "").trim().toLowerCase();
        if (woWinner === "player1") return d?.player1 || "Jogador 1";
        if (woWinner === "player2") return d?.player2 || "Jogador 2";
        return "";
      },

      getSetDisplay(setObj) {
        if (!setObj) return { p1: "--", p2: "--" };
        const g1 = Number(setObj.games1 ?? 0);
        const g2 = Number(setObj.games2 ?? 0);
        const tb1 = Number(setObj.tieBreakPoints1 ?? 0);
        const tb2 = Number(setObj.tieBreakPoints2 ?? 0);
        const isTB = setObj.tieBreakMode === "tb7" || setObj.tieBreakMode === "super10";
        if (isTB && (tb1 > 0 || tb2 > 0)) {
          const p1Won = tb1 > tb2;
          return { p1: String(p1Won ? 7 : 6), p2: String(p1Won ? 6 : 7) };
        }
        return { p1: String(g1), p2: String(g2) };
      },

      isLegacyMatch(data) {
        return !String(data?.ownerId || "").trim();
      },

      isDoublesFormatValue(gameFormat) {
        const value = String(gameFormat || "").trim();
        return value === "Duplas" || value === "Duplas Mistas";
      },

      getTeam1NameFromData(d) {
        const gameFormat = String(d?.gameFormat || "Simples").trim();
        const p1 = d?.player1 || "Jogador 1";
        const p2 = d?.player2 || "Jogador 2";
        return U.isDoublesFormatValue(gameFormat) ? `${p1}/${p2}` : p1;
      },

      getTeam2NameFromData(d) {
        const gameFormat = String(d?.gameFormat || "Simples").trim();
        const p3 = d?.player3 || "Jogador 3";
        const p4 = d?.player4 || "Jogador 4";
        return U.isDoublesFormatValue(gameFormat) ? `${p3}/${p4}` : (d?.player2 || "Jogador 2");
      },

      getMatchDisplayHTML(d) {
        const team1 = U.getTeam1NameFromData(d);
        const team2 = U.getTeam2NameFromData(d);
        return `${U.escapeHtml(team1)} <span class="vs-separator">X</span> ${U.escapeHtml(team2)}`;
      },

      getMatchDisplayHTMLMobile(d) {
        const team1 = U.getTeam1NameFromData(d);
        const team2 = U.getTeam2NameFromData(d);
        const isDoubles = U.isDoublesFormatValue(d?.gameFormat);

        if (isDoubles) {
          return `${U.escapeHtml(team1)} <span class="vs-separator">X</span><br>${U.escapeHtml(team2)}`;
        }

        return `${U.escapeHtml(team1)} <span class="vs-separator">X</span> ${U.escapeHtml(team2)}`;
      },

      getMatchSetCount(d) {
        const mf = U.normalizeText(U.formatMatchFormat(d?.matchFormat || ""));
        if (mf.includes("3 sets")) return 3;
        if (mf.includes("2 sets")) return 2;
        return 1;
      },

      getSetCountFromMatch(d) {
        const text = U.normalizeText(U.formatMatchFormat(d?.matchFormat || ""));
        if (text.includes("3 sets")) return 3;
        if (text.includes("2 sets")) return 2;
        return 1;
      }
    };

    function setMsg(text) {
      if (el.msg) el.msg.textContent = text || "";
    }

    function goLogin() {
      window.location.replace("login.html");
    }

    function fillPlayer1Field() {
      if (!el.player1) return;
      if (U.isAdmin(state.currentUser)) {
        el.player1.readOnly = false;
        el.player1.removeAttribute("readonly");
        el.player1.placeholder = "Nome do Jogador 1";
        if (!el.player1.value.trim()) {
          el.player1.value = state.currentProfileName || state.currentUser?.displayName || "";
        }
      } else {
        el.player1.value = state.currentProfileName || state.currentUser?.displayName || "";
        el.player1.readOnly = true;
        el.player1.setAttribute("readonly", "readonly");
      }
    }

    function setFieldVisible(wrapper, visible) {
      if (!wrapper) return;
      wrapper.style.display = visible ? "block" : "none";
    }

    function getGameFormat() {
      return String(el.gameFormat?.value || "").trim();
    }

    function updateProbabilitiesVisibility() {
      setFieldVisible(el.probPlayer1Wrapper, false);
      setFieldVisible(el.probPlayer2Wrapper, false);
      if (el.probPlayer1) el.probPlayer1.value = "50";
      if (el.probPlayer2) el.probPlayer2.value = "50";
    }

    function updatePlayersVisibility() {
      const isDoubles = U.isDoublesFormatValue(getGameFormat());
      setFieldVisible(el.player3Wrapper, isDoubles);
      setFieldVisible(el.player4Wrapper, isDoubles);
      if (el.player3) {
        el.player3.required = isDoubles;
        if (!isDoubles) el.player3.value = "";
      }
      if (el.player4) {
        el.player4.required = isDoubles;
        if (!isDoubles) el.player4.value = "";
      }
    }

    function updateMatchFormatOptions() {
      const modality = String(el.modality?.value || "").trim();
      if (!el.matchFormat) return;
      const options = modality === "Beach Tênis" ? ALLOWED_FORMATS_BEACH : ALLOWED_FORMATS_TENNIS;
      const current = el.matchFormat.value;
      el.matchFormat.innerHTML =
        `<option value="">Selecione o formato da partida</option>` +
        options.map(opt => `<option value="${opt}">${opt}</option>`).join("");
      if (options.includes(current)) el.matchFormat.value = current;
    }

    function updateSurfaceVisibility() {
      const beach = String(el.modality?.value || "").trim() === "Beach Tênis";
      setFieldVisible(el.surfaceTypeWrapper, !beach);
      if (el.surfaceType) {
        el.surfaceType.required = !beach;
        if (beach) el.surfaceType.value = "";
      }
    }

    function handleModalityChange() {
      updateMatchFormatOptions();
      updateSurfaceVisibility();
    }

    function handleGameFormatChange() {
      updatePlayersVisibility();
      updateProbabilitiesVisibility();
    }

    function showForm() {
      if (el.matchFormWrapper) el.matchFormWrapper.style.display = "block";
      el.matchFormWrapper?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function hideForm() {
      if (el.matchFormWrapper) el.matchFormWrapper.style.display = "none";
    }

    function clearForm() {
      if (el.form) el.form.reset();
      if (el.docId) el.docId.value = "";
      if (el.status) el.status.value = "scheduled";
      if (el.winnerByWO) el.winnerByWO.value = "";
      if (el.probPlayer1) el.probPlayer1.value = "50";
      if (el.probPlayer2) el.probPlayer2.value = "50";
      if (el.formTitle) el.formTitle.textContent = "Nova partida";
      if (el.tournamentName) el.tournamentName.value = "";
      if (el.player2) el.player2.value = "";
      if (el.player3) el.player3.value = "";
      if (el.player4) el.player4.value = "";
      if (el.modality) el.modality.value = "";
      if (el.gameFormat) el.gameFormat.value = "";
      fillPlayer1Field();
      handleModalityChange();
      handleGameFormatChange();
      setMsg("");
    }

    function clearFilters() {
      if (el.filterPlayers) el.filterPlayers.value = "";
      if (el.filterModality) el.filterModality.value = "";
      if (el.filterGameFormat) el.filterGameFormat.value = "";
      if (el.filterCategory) el.filterCategory.value = "";
      if (el.filterTournament) el.filterTournament.value = "";
      if (el.filterStatus) el.filterStatus.value = "";
      refreshList();
    }

    function fillForm(data, id) {
      if (el.docId) el.docId.value = id || "";
      if (el.modality) el.modality.value = data?.modality || "";
      if (el.categoryName) el.categoryName.value = data?.categoryName || "";
      if (el.tournamentName) el.tournamentName.value = data?.tournamentName || "";
      if (el.surfaceType) el.surfaceType.value = data?.surfaceType || "";
      if (el.gameFormat) el.gameFormat.value = data?.gameFormat || "";
      if (el.matchFormat) el.matchFormat.value = data?.matchFormat || "";
      if (el.matchDateTime) el.matchDateTime.value = data?.matchDateTime || "";
      if (el.court) el.court.value = data?.court || "";
      if (el.tournamentStage) el.tournamentStage.value = data?.tournamentStage || "";

      if (el.player1) {
        el.player1.value = data?.player1 || state.currentProfileName || "";
        if (U.isAdmin(state.currentUser)) {
          el.player1.readOnly = false;
          el.player1.removeAttribute("readonly");
        } else {
          el.player1.readOnly = true;
          el.player1.setAttribute("readonly", "readonly");
        }
      }

      if (el.player2) el.player2.value = data?.player2 || "";
      if (el.player3) el.player3.value = data?.player3 || "";
      if (el.player4) el.player4.value = data?.player4 || "";

      if (el.probPlayer1) el.probPlayer1.value = data?.probPlayer1 ?? "50";
      if (el.probPlayer2) el.probPlayer2.value = data?.probPlayer2 ?? "50";

      if (el.winnerByWO) {
        el.winnerByWO.value = "";
        el.winnerByWO.selectedIndex = 0;
      }

      if (el.status) el.status.value = data?.status || "scheduled";
      if (el.formTitle) el.formTitle.textContent = id ? "Editando partida" : "Nova partida";

      handleModalityChange();
      handleGameFormatChange();
    }

    function buildPublicLink(id) {
      return `${location.origin}${location.pathname.replace("admin.html", "player.html")}?id=${id}`;
    }

    function renderEmpty(message) {
      return `<tr><td colspan="7" class="empty-card">${U.escapeHtml(message)}</td></tr>`;
    }

    function sortLocalMatches() {
      state.allMatches.sort((a, b) => {
        const ta = U.getCreatedAtMs(a.data);
        const tb = U.getCreatedAtMs(b.data);
        if (tb !== ta) return tb - ta;
        return 0;
      });
    }

    function applyFilters() {
      const p = el.filterPlayers?.value.trim().toLowerCase() || "";
      const m = el.filterModality?.value.trim().toLowerCase() || "";
      const g = el.filterGameFormat?.value.trim().toLowerCase() || "";
      const c = el.filterCategory?.value.trim().toLowerCase() || "";
      const t = el.filterTournament?.value.trim().toLowerCase() || "";
      const s = el.filterStatus?.value.trim().toLowerCase() || "";

      state.filteredMatches = state.allMatches.filter(({ data }) => {
        const ownerId = String(data.ownerId || "").trim();
        const isOwnedByCurrentUser = state.currentUser && ownerId === state.currentUser.uid;
        const isLegacy = U.isLegacyMatch(data);

        const shouldShow = U.isAdmin(state.currentUser)
          ? isOwnedByCurrentUser
          : (isOwnedByCurrentUser || isLegacy);

        if (!shouldShow) return false;

        const playerText = `${data.player1 || ""} ${data.player2 || ""} ${data.player3 || ""} ${data.player4 || ""}`.toLowerCase();
        const modalityText = String(data.modality || "").toLowerCase();
        const gameFormatText = String(data.gameFormat || "").toLowerCase();
        const categoryText = String(data.categoryName || "").toLowerCase();
        const tournamentText = String(data.tournamentName || "").toLowerCase();
        const statusText = String(data.status || "scheduled").toLowerCase();

        return (
          (!p || playerText.includes(p)) &&
          (!m || modalityText === m) &&
          (!g || gameFormatText === g) &&
          (!c || categoryText.includes(c)) &&
          (!t || tournamentText.includes(t)) &&
          (!s || statusText === s)
        );
      });

      state.currentPage = 1;
      renderPagination();
      renderCurrentPage();

      if (!state.filteredMatches.length && state.currentUser) {
        const playerName = state.currentProfileName || state.currentUser?.displayName || "este usuário";
        setMsg(`Nenhuma partida encontrada para ${playerName}.`);
      }
    }

    function renderPagination() {
      const totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
      if (state.currentPage > totalPages) state.currentPage = totalPages;
      if (state.currentPage < 1) state.currentPage = 1;

      const start = (state.currentPage - 1) * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, state.filteredMatches.length);

      if (el.pageInfo) el.pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
      if (el.totalPagesEl) el.totalPagesEl.textContent = String(totalPages);
      if (el.prevPageBtn) el.prevPageBtn.disabled = state.currentPage <= 1;
      if (el.nextPageBtn) el.nextPageBtn.disabled = state.currentPage >= totalPages;
      if (el.itemsTotal) el.itemsTotal.textContent = String(state.filteredMatches.length);
      if (el.itemsShown) el.itemsShown.textContent = String(state.filteredMatches.length ? end : 0);
    }

    function getMatchDuration(d) {
      if (d?.durationSeconds && Number(d.durationSeconds) > 0) {
        return U.formatDuration(d.durationSeconds);
      }
      const started = d?.startedAt?.toDate ? d.startedAt.toDate() : (d?.startedAt ? new Date(d.startedAt) : null);
      const finished = d?.finishedAt?.toDate ? d.finishedAt.toDate() : (d?.finishedAt ? new Date(d.finishedAt) : null);
      if (started && finished && !isNaN(started.getTime()) && !isNaN(finished.getTime()) && finished >= started) {
        return U.formatDuration(Math.floor((finished.getTime() - started.getTime()) / 1000));
      }
      return "-";
    }

    function detectSetCountFromMatch(d) {
      const text = U.normalizeText(U.formatMatchFormat(d?.matchFormat || ""));
      if (text.includes("3 sets")) return 3;
      if (text.includes("2 sets")) return 2;
      return 1;
    }

    function renderGeneralBlock(d) {
      const teamHTML = U.getMatchDisplayHTML(d);
      const statusText = String(d?.status || "").trim().toLowerCase();
      const situationLabel = statusText === "finished" ? "Finalizada"
        : statusText === "wo" ? "Finalizada por WO"
        : statusText === "live" ? "Em andamento"
        : "Jogos do dia";
      const woWinner = U.getWONumberOrName(d);

      return ` <section class="detail-section detail-section-general"> <div class="detail-section-header"> <h4>Dados gerais</h4> <span class="detail-section-subtitle">Informações da partida</span> </div> <div class="detail-info-grid"> <div class="detail-info-item"><span>Modalidade</span><strong>${U.escapeHtml(d.modality || "-")}</strong></div> <div class="detail-info-item"><span>Formato do jogo</span><strong>${U.escapeHtml(d.gameFormat || "-")}</strong></div> <div class="detail-info-item"><span>Categoria</span><strong>${U.escapeHtml(d.categoryName || "-")}</strong></div> <div class="detail-info-item"><span>Torneio</span><strong>${U.escapeHtml(d.tournamentName || "-")}</strong></div> <div class="detail-info-item"><span>Tipo de piso</span><strong>${U.escapeHtml(d.surfaceType || "-")}</strong></div> <div class="detail-info-item"><span>Formato</span><strong>${U.escapeHtml(U.formatMatchFormat(d.matchFormat || "-"))}</strong></div> <div class="detail-info-item"><span>Data e hora</span><strong>${U.escapeHtml(d.matchDateTime ? new Date(d.matchDateTime).toLocaleString("pt-BR") : "-")}</strong></div> <div class="detail-info-item"><span>Quadra</span><strong>${U.escapeHtml(d.court || "-")}</strong></div> <div class="detail-info-item"><span>Fase</span><strong>${U.escapeHtml(d.tournamentStage || "-")}</strong></div> <div class="detail-info-item"><span>Situação</span><strong>${U.escapeHtml(situationLabel)}</strong></div> <div class="detail-info-item"><span>Jogadores</span><strong style="white-space:pre-line;">${teamHTML}</strong></div> <div class="detail-info-item"><span>Vencedor por WO</span><strong>${U.escapeHtml(woWinner)}</strong></div> </div> </section> `;
    }

    function renderScoreBlock(d) {
      const score = U.normalizeScore(d.score || {});
      const history = Array.isArray(score.setHistory) ? score.setHistory : [];
      const set1 = U.getSetDisplay(history[0]);
      const set2 = U.getSetDisplay(history[1]);
      const set3 = U.getSetDisplay(history[2]);
      const duration = getMatchDuration(d);
      const status = String(d?.status || "").trim().toLowerCase();
      const isWO = status === "wo";
      const winnerPos = U.getWinnerPosition(score, d);
      const teamHTML = U.getMatchDisplayHTML(d);
      const setCount = detectSetCountFromMatch(d);

      const pointsText =
        (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10" ||
         score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10")
          ? `${Number(score.tieBreakPoints1 || score.lastTieBreakPoints1 || 0)}x${Number(score.tieBreakPoints2 || score.lastTieBreakPoints2 || 0)}`
          : `${Number(score.points1 || 0)}x${Number(score.points2 || 0)}`;

      const setLine = (label, setObj) =>
        `<div class="detail-score-line"><span>${label}</span><strong>${U.escapeHtml(setObj.p1)} x ${U.escapeHtml(setObj.p2)}</strong></div>`;

      let setsHtml = "";
      if (setCount >= 1) setsHtml += setLine("1º set", set1);
      if (setCount >= 2) setsHtml += setLine("2º set", set2);
      if (setCount >= 3) setsHtml += setLine("3º set", set3);

      let resultBadge = "";
      let rowClass = "";

      if (winnerPos === 1) {
        rowClass = "winner-row";
        resultBadge = `<span class="winner-badge">${isWO ? "WO VENCEDOR" : "VENCEU"}</span>`;
      } else if (winnerPos === 2) {
        rowClass = "loser-row";
        resultBadge = `<span class="winner-badge loser-badge">PERDEU</span>`;
      }

      return ` <section class="detail-section detail-section-score"> <div class="detail-section-header"> <h4>Placar</h4> <span class="detail-section-subtitle">Situação atual da partida</span> </div> <div class="detail-score-card single-score-card"> <div class="detail-score-row ${rowClass}"> <div class="detail-player-title"> <span style="white-space:pre-line;">${teamHTML}</span> ${resultBadge} </div> ${ isWO ? `<div class="detail-score-line"><span>Situação</span><strong>FINALIZADA POR WO</strong></div>` : ` ${setsHtml} <div class="detail-pill" style="margin-top:10px;"> <span>Pontos</span><strong>${U.escapeHtml(pointsText)}</strong> </div> ` } </div> <div class="detail-pill" style="margin-top:12px;"> <span>Duração da partida</span><strong>${U.escapeHtml(duration)}</strong> </div> </div> </section> `;
    }

    function renderSummaryBlock(d) {
      const score = U.normalizeScore(d.score || {});
      const totalPoints1 = Number(score.totalPoints1 || 0);
      const totalPoints2 = Number(score.totalPoints2 || 0);
      const breakPointsWon1 = Number(score.breakPointsWon1 || 0);
      const breakPointsChances1 = Number(score.breakPointsChances1 || 0);
      const breakPointsWon2 = Number(score.breakPointsWon2 || 0);
      const breakPointsChances2 = Number(score.breakPointsChances2 || 0);
      const team1HTML = U.escapeHtml(U.getTeam1NameFromData(d));
      const team2HTML = U.escapeHtml(U.getTeam2NameFromData(d));

      return ` <section class="detail-section detail-section-summary"> <div class="detail-section-header"> <h4>Resumo da partida</h4> <span class="detail-section-subtitle">Estatísticas gerais</span> </div> <div class="detail-summary-grid"> <div class="detail-summary-card"> <div class="detail-player-title">${team1HTML}</div> <div class="detail-summary-line"><span>Pontos totais</span><strong>${totalPoints1}</strong></div> <div class="detail-summary-line"><span>Break points</span><strong>${breakPointsWon1}/${breakPointsChances1}</strong></div> </div> <div class="detail-summary-card"> <div class="detail-player-title">${team2HTML}</div> <div class="detail-summary-line"><span>Pontos totais</span><strong>${totalPoints2}</strong></div> <div class="detail-summary-line"><span>Break points</span><strong>${breakPointsWon2}/${breakPointsChances2}</strong></div> </div> </div> </section> `;
    }

    function detailsHTML(d) {
      try {
        return `<div class="details-layout">${renderGeneralBlock(d)}${renderScoreBlock(d)}${renderSummaryBlock(d)}</div>`;
      } catch (err) {
        console.error("Erro ao montar detalhes:", err, d);
        return `<div class="details-layout"><p>Erro ao carregar os detalhes da partida.</p></div>`;
      }
    }

    function toggleFiltersBar() {
      state.filtersVisible = !state.filtersVisible;

      if (el.filtersBar) {
        el.filtersBar.style.display = state.filtersVisible ? "" : "none";
      }

      if (el.toggleMatchesBtnBottom) {
        const icon = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-icon");
        const label = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-label");
        if (icon) icon.textContent = state.filtersVisible ? "🔎" : "📋";
        if (label) label.textContent = state.filtersVisible ? "Filtros" : "Lista";
      }

      if (el.toggleMatchesBtn) {
        el.toggleMatchesBtn.textContent = state.filtersVisible ? "Ocultar filtros" : "Exibir filtros";
      }
    }

    function refreshList() {
      sortLocalMatches();
      applyFilters();
      if (!state.filteredMatches.length && state.currentUser) {
        const playerName = state.currentProfileName || state.currentUser?.displayName || "este usuário";
        setMsg(`Nenhuma partida encontrada para ${playerName}.`);
        if (el.tbody) el.tbody.innerHTML = renderEmpty(`Nenhuma partida encontrada para ${playerName}.`);
      }
    }

    function listenMatches() {
      if (!state.currentUser) return;

      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }

      const query = __db.collection("matches").where("ownerId", "==", state.currentUser.uid);

      state.unsubscribe = query.onSnapshot(
        (snapshot) => {
          state.allMatches = snapshot.docs.map(docSnap => ({
            docSnap,
            data: docSnap.data()
          }));
          refreshList();
        },
        (err) => {
          console.error(err);
          setMsg("Não foi possível carregar suas partidas. Verifique as regras do Firestore.");
        }
      );
    }

    function updateAuthState(user) {
      if (!user) {
        state.currentUser = null;
        state.currentProfileName = "";
        if (el.tbody) el.tbody.innerHTML = renderEmpty("Usuário não autenticado.");
        setMsg("Usuário não autenticado.");
        return;
      }

      state.currentUser = user;
      state.currentProfileName = String(user.displayName || "").trim() || user.email || "";

      fillPlayer1Field();
      listenMatches();
    }

    function rowHTML(docSnap) {
      const d = docSnap.data();
      const statusText = String(d.status || "scheduled").toLowerCase();
      const labelMap = {
        scheduled: "Jogos do dia",
        live: "Em andamento",
        finished: "Finalizada",
        wo: "WO"
      };
      const label = labelMap[statusText] || (d.status || "scheduled");

      return ` <tr> <td> <div class="players-cell"> <strong style="display:block;line-height:1.15;"> ${U.getMatchDisplayHTML(d)} </strong> </div> </td> <td>${U.escapeHtml(d.modality || "-")}</td> <td>${U.escapeHtml(d.gameFormat || "-")}</td> <td title="${U.escapeHtml(d.categoryName || "-")}">${U.escapeHtml(d.categoryName || "-")}</td> <td title="${U.escapeHtml(d.tournamentName || "-")}">${U.escapeHtml(d.tournamentName || "-")}</td> <td><span class="status-tag status-${statusText}">${U.escapeHtml(label)}</span></td> <td class="col-actions-center"> <div class="admin-actions action-cell"> <div class="action-top-row"> <button type="button" class="admin-action-btn icon-btn" data-action="open" data-id="${docSnap.id}" title="Abrir partida">▶</button> <button type="button" class="admin-action-btn icon-btn" data-action="detail" data-id="${docSnap.id}" title="Detalhar">👁️</button> </div> <div class="action-bottom-row"> <button type="button" class="admin-action-btn icon-btn" data-action="edit" data-id="${docSnap.id}" title="Editar">✏️</button> <button type="button" class="admin-action-btn icon-btn danger" data-action="delete" data-id="${docSnap.id}" title="Excluir">🗑️</button> </div> </div> </td> </tr> `;
    }

    function mobileCardHTML(docSnap) {
      const d = docSnap.data();
      const statusText = String(d.status || "scheduled").toLowerCase();
      const labelMap = {
        scheduled: "Jogos do dia",
        live: "Em andamento",
        finished: "Finalizada",
        wo: "WO"
      };
      const label = labelMap[statusText] || (d.status || "scheduled");
      const date = d.matchDateTime ? new Date(d.matchDateTime).toLocaleString("pt-BR") : "-";

      return ` <tr class="mobile-match-row"> <td colspan="7"> <div class="mobile-match-card status-${statusText}"> <div class="mobile-match-card-top"> <span class="status-tag status-${statusText}">${U.escapeHtml(label)}</span> <span class="mobile-match-date">${U.escapeHtml(date)}</span> </div> <div class="mobile-match-players"> <strong>${U.getMatchDisplayHTMLMobile(d)}</strong> </div> <div class="mobile-match-meta"> <div><strong>Modalidade:</strong> ${U.escapeHtml(d.modality || "-")}</div> <div><strong>Formato:</strong> ${U.escapeHtml(d.gameFormat || "-")}</div> <div><strong>Categoria:</strong> ${U.escapeHtml(d.categoryName || "-")}</div> <div><strong>Torneio:</strong> ${U.escapeHtml(d.tournamentName || "-")}</div> <div><strong>Fase:</strong> ${U.escapeHtml(d.tournamentStage || "-")}</div> </div> <div class="mobile-match-actions"> <button type="button" class="admin-action-btn icon-btn" data-action="open" data-id="${docSnap.id}" title="Abrir link">▶</button> <button type="button" class="admin-action-btn icon-btn" data-action="detail" data-id="${docSnap.id}" title="Detalhar">👁️</button> <button type="button" class="admin-action-btn icon-btn" data-action="edit" data-id="${docSnap.id}" title="Editar">✏️</button> <button type="button" class="admin-action-btn icon-btn danger" data-action="delete" data-id="${docSnap.id}" title="Excluir">🗑️</button> </div> </div> </td> </tr> `;
    }

    function renderCurrentPage() {
      const start = (state.currentPage - 1) * PAGE_SIZE;
      const pageItems = state.filteredMatches.slice(start, start + PAGE_SIZE);
      if (!el.tbody) return;

      el.tbody.innerHTML = pageItems.length
        ? pageItems.map(({ docSnap }) => state.isMobile ? mobileCardHTML(docSnap) : rowHTML(docSnap)).join("")
        : renderEmpty("Nenhuma partida encontrada.");
    }

    function onResize() {
      clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(() => {
        const wasMobile = state.isMobile;
        state.isMobile = window.matchMedia(MOBILE_QUERY).matches;

        if (wasMobile !== state.isMobile) {
          renderPagination();
          renderCurrentPage();
        }
      }, 80);
    }

    function bindEvents() {
      const session = localStorage.getItem(ADMIN_KEY);
      if (session !== "1") return goLogin();

      el.showFormBtn?.addEventListener("click", () => {
        showForm();
        fillPlayer1Field();
      });

      el.showFormBtnBottom?.addEventListener("click", () => {
        showForm();
        fillPlayer1Field();
      });

      el.toggleMatchesBtnBottom?.addEventListener("click", toggleFiltersBar);
      el.toggleMatchesBtn?.addEventListener("click", toggleFiltersBar);

      const logout = async () => {
        try {
          localStorage.removeItem(ADMIN_KEY);
          await __auth.signOut();
          goLogin();
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      };

      el.logoutBtn?.addEventListener("click", logout);
      el.logoutBtnBottom?.addEventListener("click", logout);

      el.clearBtn?.addEventListener("click", clearForm);
      el.cancelBtn?.addEventListener("click", () => {
        clearForm();
        hideForm();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      el.closeDialogBtn?.addEventListener("click", () => el.dialog.close());

      el.clearFiltersBtn?.addEventListener("click", clearFilters);

      el.filterPlayers?.addEventListener("input", refreshList);
      el.filterModality?.addEventListener("change", refreshList);
      el.filterGameFormat?.addEventListener("change", refreshList);
      el.filterCategory?.addEventListener("input", refreshList);
      el.filterTournament?.addEventListener("input", refreshList);
      el.filterStatus?.addEventListener("change", refreshList);

      el.modality?.addEventListener("change", handleModalityChange);
      el.gameFormat?.addEventListener("change", handleGameFormatChange);

      el.prevPageBtn?.addEventListener("click", () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderPagination();
          renderCurrentPage();
        }
      });

      el.nextPageBtn?.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderPagination();
          renderCurrentPage();
        }
      });

      el.form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        setMsg("Salvando...");

        const selectedModality = String(el.modality?.value || "").trim();
        const selectedGameFormat = String(el.gameFormat?.value || "").trim();
        const selectedFormat = String(el.matchFormat?.value || "").trim();
        const selectedSurface = String(el.surfaceType?.value || "").trim();

        if (!["Tênis", "Beach Tênis"].includes(selectedModality)) {
          return setMsg("Selecione uma modalidade válida.");
        }

        if (!["Simples", "Duplas", "Duplas Mistas"].includes(selectedGameFormat)) {
          return setMsg("Selecione um formato de jogo válido.");
        }

        const allowedFormats = selectedModality === "Beach Tênis" ? ALLOWED_FORMATS_BEACH : ALLOWED_FORMATS_TENNIS;
        if (!allowedFormats.includes(selectedFormat)) {
          return setMsg("Formato inválido para a modalidade selecionada.");
        }

        if (selectedModality !== "Beach Tênis" && !ALLOWED_SURFACES.includes(selectedSurface)) {
          return setMsg("Selecione um tipo de piso válido.");
        }

        const isDoubles = selectedGameFormat === "Duplas" || selectedGameFormat === "Duplas Mistas";
        const woWinner = String(el.winnerByWO?.value || "").trim();
        const player1Name = U.isAdmin(state.currentUser)
          ? (el.player1?.value.trim() || state.currentProfileName || "")
          : (state.currentProfileName || state.currentUser?.displayName || "");

        const data = {
          ownerId: state.currentUser?.uid || "",
          ownerEmail: state.currentUser?.email || "",
          ownerName: player1Name,

          modality: selectedModality,
          categoryName: el.categoryName?.value.trim() || "",
          tournamentName: el.tournamentName?.value.trim() || "",
          surfaceType: selectedModality === "Beach Tênis" ? "" : selectedSurface,
          gameFormat: selectedGameFormat,
          matchFormat: selectedFormat,
          matchDateTime: el.matchDateTime?.value || "",
          court: el.court?.value.trim() || "",
          tournamentStage: el.tournamentStage?.value.trim() || "",

          player1: player1Name,
          player2: el.player2?.value.trim() || "",
          player3: isDoubles ? (el.player3?.value.trim() || "") : "",
          player4: isDoubles ? (el.player4?.value.trim() || "") : "",

          probPlayer1: 50,
          probPlayer2: 50,

          winnerByWO: woWinner,
          status: woWinner ? "wo" : (el.status?.value || "scheduled"),

          score: {
            points1: 0,
            points2: 0,
            games1: 0,
            games2: 0,
            sets1: 0,
            sets2: 0,
            tieBreakMode: null,
            tieBreakPoints1: 0,
            tieBreakPoints2: 0,
            lastTieBreakMode: null,
            lastTieBreakPoints1: 0,
            lastTieBreakPoints2: 0,
            setHistory: [],
            server: "player1",
            totalPoints1: 0,
            totalPoints2: 0,
            breakPointsWon1: 0,
            breakPointsWon2: 0,
            breakPointsChances1: 0,
            breakPointsChances2: 0
          },

          durationSeconds: 0,
          startedAt: null,
          finishedAt: null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
          if (el.docId?.value) {
            await __db.collection("matches").doc(el.docId.value).update(data);
            setMsg(woWinner ? "Partida salva como WO." : "Partida atualizada com sucesso!");
          } else {
            await __db.collection("matches").add({
              ...data,
              matchId: `JOGO-${Date.now().toString().slice(-6)}`,
              publicLinkId: crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now()).slice(-8),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setMsg(woWinner ? "Partida cadastrada como WO." : "Partida cadastrada com sucesso!");
          }

          clearForm();
          hideForm();
          refreshList();
        } catch (err) {
          console.error("Erro ao salvar partida:", err);
          setMsg(err.message || "Erro ao salvar a partida.");
        }
      });

      el.tbody?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const { id, action } = btn.dataset;
        const ref = __db.collection("matches").doc(id);

        try {
          if (action === "delete" && confirm("Excluir esta partida?")) {
            await ref.delete();
            setMsg("Partida excluída.");
            return;
          }

          if (action === "edit") {
            const snap = await ref.get();
            if (snap.exists) {
              fillForm(snap.data(), id);
              showForm();
            }
            return;
          }

          if (action === "detail") {
            const snap = await ref.get();
            if (snap.exists) {
              try {
                el.detailsContent.innerHTML = detailsHTML(snap.data());
                if (el.dialog && typeof el.dialog.showModal === "function") {
                  el.dialog.showModal();
                } else {
                  alert("Não foi possível abrir a tela de detalhes.");
                }
              } catch (err) {
                console.error("Erro ao abrir detalhes:", err);
                setMsg("Erro ao abrir os detalhes da partida.");
              }
            }
            return;
          }

          if (action === "open") {
            window.location.href = buildPublicLink(id);
          }
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });
    }

    function attachResponsiveListeners() {
      if (state.mobileMql.addEventListener) {
        state.mobileMql.addEventListener("change", onResize);
      } else if (state.mobileMql.addListener) {
        state.mobileMql.addListener(onResize);
      }

      window.addEventListener("resize", onResize, { passive: true });
      window.addEventListener("orientationchange", onResize, { passive: true });
    }

    function init() {
      if (state.initialized) return;
      state.initialized = true;

      bindEvents();
      attachResponsiveListeners();

      state.filtersVisible = true;
      if (el.filtersBar) el.filtersBar.style.display = "";
      if (el.toggleMatchesBtnBottom) {
        const icon = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-icon");
        const label = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-label");
        if (icon) icon.textContent = "🔎";
        if (label) label.textContent = "Filtros";
      }

      if (localStorage.getItem(ADMIN_KEY) !== "1") {
        goLogin();
        return;
      }

      if (typeof __auth === "undefined" || typeof __db === "undefined") {
        setMsg("Firebase não carregado corretamente.");
        return;
      }

      __auth.onAuthStateChanged(updateAuthState);
      if (__auth.currentUser) updateAuthState(__auth.currentUser);

      hideForm();
      fillPlayer1Field();
      handleModalityChange();
      handleGameFormatChange();
      refreshList();
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => AdminApp.init());
})();
