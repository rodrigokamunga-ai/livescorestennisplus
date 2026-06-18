(() => {
  "use strict";

  const AdminApp = (() => {
    const ADMIN_KEY = "lsts_admin_session";
    const BIOMETRIC_SESSION_KEY = "lsts_biometric_session";
    const BIOMETRIC_UID_KEY = "lsts_biometric_uid";
    const BIOMETRIC_CURRENT_KEY = "lsts_biometric_current";
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
      mobileMql: window.matchMedia(MOBILE_QUERY),
      biometricMode: false
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
      categoryNameWrapper: document.getElementById("categoryNameWrapper"),
      tournamentName: document.getElementById("tournamentName"),
      tournamentNameWrapper: document.getElementById("tournamentNameWrapper"),
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
      clearBtn: document.getElementById("clearBtn"),
      cancelBtn: document.getElementById("cancelBtn"),
      closeDialogBtn: document.getElementById("closeDialogBtn"),
      filterPlayers: document.getElementById("filterPlayers"),
      filterGameFormat: document.getElementById("filterGameFormat"),
      filterTournament: document.getElementById("filterTournament"),
      filterStatus: document.getElementById("filterStatus"),
      filterYear: document.getElementById("filterYear"),
      clearFiltersBtn: document.getElementById("clearFiltersBtn"),
      prevPageBtn: document.getElementById("prevPageBtn"),
      nextPageBtn: document.getElementById("nextPageBtn"),
      pageInfo: document.getElementById("pageInfo"),
      totalPagesEl: document.getElementById("totalPages"),
      itemsShown: document.getElementById("itemsShown"),
      itemsTotal: document.getElementById("itemsTotal"),
      matchesSection: document.getElementById("matchesSection"),
      filtersBar: document.getElementById("filtersBar"),

      scoreFieldsWrapper: document.getElementById("scoreFieldsWrapper"),
      scoreSet1Wrapper: document.getElementById("scoreSet1Wrapper"),
      scoreSet2Wrapper: document.getElementById("scoreSet2Wrapper"),
      scoreSet3Wrapper: document.getElementById("scoreSet3Wrapper"),

      scoreTieBreakSet1Wrapper: document.getElementById("scoreTieBreakSet1Wrapper"),
      scoreTieBreakSet2Wrapper: document.getElementById("scoreTieBreakSet2Wrapper"),
      scoreSuperTieBreakWrapper: document.getElementById("scoreSuperTieBreakWrapper"),
      scoreTieBreakSet3Wrapper: document.getElementById("scoreTieBreakSet3Wrapper"),

      set1Player1: document.getElementById("set1Player1"),
      set1Player2: document.getElementById("set1Player2"),
      set2Player1: document.getElementById("set2Player1"),
      set2Player2: document.getElementById("set2Player2"),
      set3Player1: document.getElementById("set3Player1"),
      set3Player2: document.getElementById("set3Player2"),

      tbSet1Player1: document.getElementById("tbSet1Player1"),
      tbSet1Player2: document.getElementById("tbSet1Player2"),
      tbSet2Player1: document.getElementById("tbSet2Player1"),
      tbSet2Player2: document.getElementById("tbSet2Player2"),
      tbSuperPlayer1: document.getElementById("tbSuperPlayer1"),
      tbSuperPlayer2: document.getElementById("tbSuperPlayer2"),
      tbSet3Player1: document.getElementById("tbSet3Player1"),
      tbSet3Player2: document.getElementById("tbSet3Player2")
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
        if (isDoubles) return `${U.escapeHtml(team1)} <span class="vs-separator">X</span><br>${U.escapeHtml(team2)}`;
        return `${U.escapeHtml(team1)} <span class="vs-separator">X</span> ${U.escapeHtml(team2)}`;
      },
      getStatusLabel(status = "") {
        const s = String(status || "").trim().toLowerCase();
        const map = { scheduled: "Jogos do dia", live: "Em andamento", finished: "Finalizada", wo: "WO", suspended: "Suspensa" };
        return map[s] || status || "Jogos do dia";
      }
    };

    function setMsg(text) { if (el.msg) el.msg.textContent = text || ""; }
    function goLogin() { window.location.replace("login.html"); }
    function hasAdminSession() { return localStorage.getItem(ADMIN_KEY) === "1"; }
    function hasBiometricSession() { return localStorage.getItem(BIOMETRIC_SESSION_KEY) === "1"; }
    function getBiometricUid() { return localStorage.getItem(BIOMETRIC_UID_KEY) || ""; }

    function getBiometricCurrentUser() {
      try {
        const raw = localStorage.getItem(BIOMETRIC_CURRENT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return { uid: parsed.uid || "", email: parsed.email || "", displayName: parsed.displayName || "" };
      } catch (_) { return null; }
    }

    function fillPlayer1Field() {
      if (!el.player1) return;
      el.player1.value = state.currentProfileName || state.currentUser?.displayName || "";
      el.player1.readOnly = true;
      el.player1.setAttribute("readonly", "readonly");
      el.player1.style.pointerEvents = "none";
      el.player1.style.opacity = "0.95";
    }

    function setFieldVisible(wrapper, visible) {
      if (wrapper) wrapper.style.display = visible ? "block" : "none";
    }

    function getGameFormat() { return String(el.gameFormat?.value || "").trim(); }
    function getSelectedStatus() { return String(el.status?.value || "").trim().toLowerCase(); }
    function getSelectedMatchFormat() { return String(el.matchFormat?.value || "").trim(); }

    function getExpectedSetCount() {
      const format = U.normalizeText(getSelectedMatchFormat());
      if (format.includes("3 sets")) return 3;
      if (format.includes("2 sets")) return 2;
      return 1;
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
      if (!el.matchFormat) return;
      const current = el.matchFormat.value;
      el.matchFormat.innerHTML = `<option value="">Selecione o formato da partida</option>` + ALLOWED_FORMATS_TENNIS.map(opt => `<option value="${opt}">${opt}</option>`).join("");
      if (ALLOWED_FORMATS_TENNIS.includes(current)) el.matchFormat.value = current;
    }

    function updateSurfaceVisibility() {
      setFieldVisible(el.surfaceTypeWrapper, true);
      if (el.surfaceType) el.surfaceType.required = true;
    }

    function handleModalityChange() {
      updateMatchFormatOptions();
      updateSurfaceVisibility();
      updateTournamentStageVisibility();
      updateScoreFieldsVisibility();
    }

    function handleGameFormatChange() {
      updatePlayersVisibility();
      updateProbabilitiesVisibility();
      updateScoreFieldsVisibility();
    }

    function updateTournamentStageVisibility() {
      const stage = String(el.tournamentStage?.value || "").trim().toLowerCase();
      const showTournament = stage !== "ranking" && stage !== "treino";
      const showCategory = stage !== "treino";
      setFieldVisible(el.tournamentNameWrapper, showTournament);
      setFieldVisible(el.categoryNameWrapper, showCategory);
      if (el.tournamentName) {
        el.tournamentName.required = showTournament;
        if (!showTournament) el.tournamentName.value = "";
      }
      if (el.categoryName) {
        el.categoryName.required = showCategory;
        if (!showCategory) el.categoryName.value = "";
      }
    }

    function clearScoreFields() {
      [
        el.set1Player1, el.set1Player2, el.set2Player1, el.set2Player2, el.set3Player1, el.set3Player2,
        el.tbSet1Player1, el.tbSet1Player2, el.tbSet2Player1, el.tbSet2Player2, el.tbSuperPlayer1, el.tbSuperPlayer2,
        el.tbSet3Player1, el.tbSet3Player2
      ].forEach(input => { if (input) input.value = ""; });
    }

    function getMatchRuleConfig() {
      const format = U.normalizeText(getSelectedMatchFormat());
      return {
        oneSetAdSuper: format.includes("1 set no ad + um super tie-break"),
        twoSetsNoAdSuper: format.includes("2 sets sem vantagem + um super tie-break"),
        twoSetsAdSuper: format.includes("2 sets com vantagem + um super tie-break"),
        threeSetsAd: format.includes("3 sets com vantagem"),
        oneSetAd: format.includes("1 set com vantagem"),
        oneSetPro8AdSuper: format.includes("1 set pro de 8 games no ad + um super tie-break")
      };
    }

    function getTieBreakModeForSet(setIndex, p1, p2) {
      const cfg = getMatchRuleConfig();

      if (cfg.oneSetAdSuper) {
        if ((p1 === 7 && p2 === 6) || (p1 === 6 && p2 === 7)) return "tb7";
        return null;
      }

      if (cfg.oneSetAd) {
        if ((p1 === 7 && p2 === 6) || (p1 === 6 && p2 === 7)) return "tb7";
        return null;
      }

      if (cfg.oneSetPro8AdSuper) {
        if (p1 === 7 && p2 === 7) return "super10";
        return null;
      }

      if (cfg.twoSetsNoAdSuper) {
        if (setIndex === 1 || setIndex === 2) {
          if ((p1 === 7 && p2 === 6) || (p1 === 6 && p2 === 7)) return "tb7";
          return null;
        }
        if (setIndex === 3) return "super10";
      }

      if (cfg.twoSetsAdSuper) {
        if (setIndex === 1 || setIndex === 2) {
          if ((p1 === 7 && p2 === 6) || (p1 === 6 && p2 === 7)) return "tb7";
          return null;
        }
        if (setIndex === 3) return "super10";
      }

      if (cfg.threeSetsAd) {
        if ((p1 === 7 && p2 === 6) || (p1 === 6 && p2 === 7)) return "tb7";
        return null;
      }

      return null;
    }

    function isMatchAlreadyDecidedAfterTwoSets() {
      const setCount = getExpectedSetCount();
      if (setCount < 3) return false;

      const s1p1 = Number(el.set1Player1?.value || 0);
      const s1p2 = Number(el.set1Player2?.value || 0);
      const s2p1 = Number(el.set2Player1?.value || 0);
      const s2p2 = Number(el.set2Player2?.value || 0);

      const set1Winner = s1p1 > s1p2 ? 1 : s1p2 > s1p1 ? 2 : null;
      const set2Winner = s2p1 > s2p2 ? 1 : s2p2 > s2p1 ? 2 : null;

      return set1Winner && set2Winner && set1Winner === set2Winner;
    }

    function placeTieBreakWrappers() {
      const moveAfter = (wrapper, target) => {
        if (!wrapper || !target || !target.parentElement) return;
        if (wrapper.parentElement !== target.parentElement) return;
        target.insertAdjacentElement("afterend", wrapper);
      };

      moveAfter(el.scoreTieBreakSet1Wrapper, el.scoreSet1Wrapper);
      moveAfter(el.scoreTieBreakSet2Wrapper, el.scoreSet2Wrapper);
      moveAfter(el.scoreTieBreakSet3Wrapper, el.scoreSet3Wrapper);

      if (el.scoreSuperTieBreakWrapper) {
        if (el.scoreSet3Wrapper && el.scoreSet3Wrapper.style.display !== "none") {
          moveAfter(el.scoreSuperTieBreakWrapper, el.scoreSet3Wrapper);
        } else if (el.scoreSet2Wrapper && el.scoreSet2Wrapper.style.display !== "none") {
          moveAfter(el.scoreSuperTieBreakWrapper, el.scoreSet2Wrapper);
        } else {
          moveAfter(el.scoreSuperTieBreakWrapper, el.scoreSet1Wrapper);
        }
      }
    }

    function updateScoreFieldsVisibility() {
      const isFinished = getSelectedStatus() === "finished";
      const setCount = getExpectedSetCount();
      const matchDecided = isMatchAlreadyDecidedAfterTwoSets();
    
      const cfg = getMatchRuleConfig();
    
      const set1p1 = Number(el.set1Player1?.value || 0);
      const set1p2 = Number(el.set1Player2?.value || 0);
      const set2p1 = Number(el.set2Player1?.value || 0);
      const set2p2 = Number(el.set2Player2?.value || 0);
      const set3p1 = Number(el.set3Player1?.value || 0);
      const set3p2 = Number(el.set3Player2?.value || 0);
    
      const mode1 = setCount >= 1 ? getTieBreakModeForSet(1, set1p1, set1p2) : null;
      const mode2 = setCount >= 2 ? getTieBreakModeForSet(2, set2p1, set2p2) : null;
      const mode3 = setCount >= 3 && !matchDecided ? getTieBreakModeForSet(3, set3p1, set3p2) : null;
    
      const splitSets =
        (set1p1 > set1p2 && set2p2 > set2p1) ||
        (set1p2 > set1p1 && set2p1 > set2p2);
    
      const needsSuperBecauseOneSetAdSuper = cfg.oneSetAdSuper && mode1 === "tb7";
      const needsSuperBecauseTwoSetsSuper =
        (cfg.twoSetsNoAdSuper || cfg.twoSetsAdSuper) && splitSets;
    
      setFieldVisible(el.scoreFieldsWrapper, isFinished);
      setFieldVisible(el.scoreSet1Wrapper, isFinished && setCount >= 1);
      setFieldVisible(el.scoreSet2Wrapper, isFinished && setCount >= 2);
      setFieldVisible(el.scoreSet3Wrapper, isFinished && setCount >= 3 && !matchDecided);
    
      if (!isFinished) {
        setFieldVisible(el.scoreTieBreakSet1Wrapper, false);
        setFieldVisible(el.scoreTieBreakSet2Wrapper, false);
        setFieldVisible(el.scoreTieBreakSet3Wrapper, false);
        setFieldVisible(el.scoreSuperTieBreakWrapper, false);
        clearScoreFields();
        return;
      }
    
      const showTieBreakSet1 = mode1 === "tb7" && !cfg.oneSetAdSuper;
      const showTieBreakSet2 = mode2 === "tb7";
      const showTieBreakSet3 = mode3 === "tb7";
    
      setFieldVisible(el.scoreTieBreakSet1Wrapper, showTieBreakSet1);
      setFieldVisible(el.scoreTieBreakSet2Wrapper, showTieBreakSet2);
      setFieldVisible(el.scoreTieBreakSet3Wrapper, showTieBreakSet3);
    
      const showSuperTieBreak =
        mode1 === "super10" ||
        mode2 === "super10" ||
        mode3 === "super10" ||
        needsSuperBecauseOneSetAdSuper ||
        needsSuperBecauseTwoSetsSuper;
    
      setFieldVisible(el.scoreSuperTieBreakWrapper, showSuperTieBreak);
    
      if (el.tbSet1Player1) el.tbSet1Player1.required = showTieBreakSet1;
      if (el.tbSet1Player2) el.tbSet1Player2.required = showTieBreakSet1;
      if (el.tbSet2Player1) el.tbSet2Player1.required = showTieBreakSet2;
      if (el.tbSet2Player2) el.tbSet2Player2.required = showTieBreakSet2;
      if (el.tbSet3Player1) el.tbSet3Player1.required = showTieBreakSet3;
      if (el.tbSet3Player2) el.tbSet3Player2.required = showTieBreakSet3;
    
      if (el.tbSuperPlayer1) el.tbSuperPlayer1.required = showSuperTieBreak;
      if (el.tbSuperPlayer2) el.tbSuperPlayer2.required = showSuperTieBreak;
    
      if (el.scoreTieBreakSet1Wrapper) el.scoreTieBreakSet1Wrapper.style.order = "11";
      if (el.scoreTieBreakSet2Wrapper) el.scoreTieBreakSet2Wrapper.style.order = "21";
      if (el.scoreTieBreakSet3Wrapper) el.scoreTieBreakSet3Wrapper.style.order = "31";
      if (el.scoreSuperTieBreakWrapper) el.scoreSuperTieBreakWrapper.style.order = "40";
    
      placeTieBreakWrappers();
    }

    function normalizeGameScore(a, b) {
      const n1 = Number(a);
      const n2 = Number(b);
      if (Number.isNaN(n1) || Number.isNaN(n2)) return { error: "Informe números válidos." };
      if (n1 < 0 || n2 < 0) return { error: "O placar não pode ser negativo." };

      const max = Math.max(n1, n2);
      const min = Math.min(n1, n2);

      if (max > 7) return { error: "Placar inválido." };
      if (n1 === 6 && n2 === 6) return { tie: true };

      if (max === 7) {
        if (min !== 5 && min !== 6 && min !== 7) return { error: "7 games só é válido contra 5, 6 ou 7." };
        return { tie: true };
      }

      if (max === 6) {
        if (min <= 4) return { tie: false };
        if (min === 5) return { error: "6x5 não é válido." };
        return { error: "Placar inválido." };
      }

      return { tie: false };
    }

    
    function validateTieBreakPoints(v1, v2, mode = "tb7") {
      const a = Number(v1);
      const b = Number(v2);
    
      if (Number.isNaN(a) || Number.isNaN(b)) {
        return false;
      }
    
      if (a < 0 || b < 0) {
        return false;
      }
    
      const max = Math.max(a, b);
      const min = Math.min(a, b);
      const diff = max - min;
    
      if (mode === "tb7") {
        // Tie-break normal:
        // 7x1 até 7x6 são válidos
        // acima disso precisa diferença de 2
        if (max < 7) return false;
    
        if (max === 7) {
          return min <= 6;
        }
    
        return diff >= 2;
      }
    
      if (mode === "super10") {
        // Super tie-break:
        // 10x4 até 10x9 são válidos
        // 10x10 em diante precisa diferença de 2
        if (max < 10) return false;
    
        if (max === 10) {
          return min <= 9;
        }
    
        return diff >= 2;
      }
    
      return false;
    }


    function validateScoreForm() {
  const setCount = getExpectedSetCount();
  const matchDecided = isMatchAlreadyDecidedAfterTwoSets();
  const cfg = getMatchRuleConfig();

  if (setCount >= 1) {
    const r1 = normalizeGameScore(el.set1Player1?.value, el.set1Player2?.value);
    if (r1.error) return `1º set: ${r1.error}`;
  }

  if (setCount >= 2) {
    const r2 = normalizeGameScore(el.set2Player1?.value, el.set2Player2?.value);
    if (r2.error) return `2º set: ${r2.error}`;
  }

  if (setCount >= 3 && !matchDecided) {
    const r3 = normalizeGameScore(el.set3Player1?.value, el.set3Player2?.value);
    if (r3.error) return `3º set: ${r3.error}`;
  }

  const s1 = getTieBreakModeForSet(1, Number(el.set1Player1?.value || 0), Number(el.set1Player2?.value || 0));
  const s2 = setCount >= 2 ? getTieBreakModeForSet(2, Number(el.set2Player1?.value || 0), Number(el.set2Player2?.value || 0)) : null;
  const s3 = setCount >= 3 && !matchDecided ? getTieBreakModeForSet(3, Number(el.set3Player1?.value || 0), Number(el.set3Player2?.value || 0)) : null;

  const needsTB1 = s1 === "tb7" && !cfg.oneSetAdSuper;
  const needsTB2 = s2 === "tb7";
  const needsTB3 = s3 === "tb7";

  const splitSets =
    (Number(el.set1Player1?.value || 0) > Number(el.set1Player2?.value || 0) &&
     Number(el.set2Player2?.value || 0) > Number(el.set2Player1?.value || 0)) ||
    (Number(el.set1Player2?.value || 0) > Number(el.set1Player1?.value || 0) &&
     Number(el.set2Player1?.value || 0) > Number(el.set2Player2?.value || 0));

  const needsSuper =
    cfg.oneSetAdSuper
      ? true
      : (cfg.twoSetsNoAdSuper || cfg.twoSetsAdSuper)
        ? splitSets
        : (s1 === "super10" || s2 === "super10" || s3 === "super10");

  if (needsTB1) {
    const v1 = Number(el.tbSet1Player1?.value || 0);
    const v2 = Number(el.tbSet1Player2?.value || 0);
    if (!(v1 > 0 || v2 > 0)) return "Informe os pontos do tie-break do 1º set.";
    if (!validateTieBreakPoints(v1, v2, "tb7")) return "Valor inválido.";
  }

  if (needsTB2) {
    const v1 = Number(el.tbSet2Player1?.value || 0);
    const v2 = Number(el.tbSet2Player2?.value || 0);
    if (!(v1 > 0 || v2 > 0)) return "Informe os pontos do tie-break do 2º set.";
    if (!validateTieBreakPoints(v1, v2, "tb7")) return "Valor inválido.";
  }

  if (needsTB3) {
    const v1 = Number(el.tbSet3Player1?.value || 0);
    const v2 = Number(el.tbSet3Player2?.value || 0);
    if (!(v1 > 0 || v2 > 0)) return "Informe os pontos do tie-break do 3º set.";
    if (!validateTieBreakPoints(v1, v2, "tb7")) return "Valor inválido.";
  }

  if (needsSuper) {
    const v1 = Number(el.tbSuperPlayer1?.value || 0);
    const v2 = Number(el.tbSuperPlayer2?.value || 0);
    if (!(v1 > 0 || v2 > 0)) return "Informe os pontos do super tie-break.";
    if (!validateTieBreakPoints(v1, v2, "super10")) return "Valor inválido.";
  }

  return null;
}




    function showForm() {
      if (el.matchFormWrapper) el.matchFormWrapper.style.display = "block";
      el.matchFormWrapper?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function hideForm() {
      if (el.matchFormWrapper) el.matchFormWrapper.style.display = "none";
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
      };
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
      if (el.set1Player1) el.set1Player1.value = "";
      if (el.set1Player2) el.set1Player2.value = "";
      if (el.set2Player1) el.set2Player1.value = "";
      if (el.set2Player2) el.set2Player2.value = "";
      if (el.set3Player1) el.set3Player1.value = "";
      if (el.set3Player2) el.set3Player2.value = "";
      [
        el.tbSet1Player1, el.tbSet1Player2,
        el.tbSet2Player1, el.tbSet2Player2,
        el.tbSet3Player1, el.tbSet3Player2,
        el.tbSuperPlayer1, el.tbSuperPlayer2
      ].forEach(input => { if (input) input.value = ""; });

      if (el.modality) {
        el.modality.value = "Tênis";
        el.modality.disabled = true;
      }

      if (el.gameFormat) el.gameFormat.disabled = false;
      if (el.gameFormat) el.gameFormat.value = "";
      if (el.matchFormat) {
        el.matchFormat.value = "";
        el.matchFormat.disabled = false;
      }
      if (el.tournamentStage) el.tournamentStage.value = "";

      fillPlayer1Field();
      handleModalityChange();
      handleGameFormatChange();
      updateTournamentStageVisibility();
      updateScoreFieldsVisibility();
      setMsg("");
    }

    function clearFilters() {
      if (el.filterPlayers) el.filterPlayers.value = "";
      if (el.filterGameFormat) el.filterGameFormat.value = "";
      if (el.filterTournament) el.filterTournament.value = "";
      if (el.filterStatus) el.filterStatus.value = "";
      if (el.filterYear) el.filterYear.value = "";
      refreshList();
    }

    function getFormattedSetFromInput(p1, p2, setIndex = 1) {
      const res = normalizeGameScore(p1, p2);
      if (res.error) return { error: res.error };
    
      const n1 = Number(p1);
      const n2 = Number(p2);
      const mode = getTieBreakModeForSet(setIndex, n1, n2);
    
      let tieBreakPoints1 = 0;
      let tieBreakPoints2 = 0;
    
      if (mode === "tb7") {
        if (setIndex === 1) {
          tieBreakPoints1 = Number(el.tbSet1Player1?.value || 0);
          tieBreakPoints2 = Number(el.tbSet1Player2?.value || 0);
        } else if (setIndex === 2) {
          tieBreakPoints1 = Number(el.tbSet2Player1?.value || 0);
          tieBreakPoints2 = Number(el.tbSet2Player2?.value || 0);
        } else if (setIndex === 3) {
          tieBreakPoints1 = Number(el.tbSet3Player1?.value || 0);
          tieBreakPoints2 = Number(el.tbSet3Player2?.value || 0);
        }
      }
    
      if (mode === "super10") {
        tieBreakPoints1 = Number(el.tbSuperPlayer1?.value || 0);
        tieBreakPoints2 = Number(el.tbSuperPlayer2?.value || 0);
      }
    
      return {
        games1: n1,
        games2: n2,
        tieBreakMode: mode,
        tieBreakPoints1,
        tieBreakPoints2
      };
    }

    function buildSetHistoryFromForm() {
      const setCount = getExpectedSetCount();
      const history = [];
      const cfg = getMatchRuleConfig();
    
      if (setCount >= 1) {
        const set1 = getFormattedSetFromInput(el.set1Player1?.value, el.set1Player2?.value, 1);
        if (set1.error) return { error: set1.error };
    
        const isOneSetAdSuper = cfg.oneSetAdSuper;
    
        if (isOneSetAdSuper) {
          const super1 = Number(el.tbSuperPlayer1?.value || 0);
          const super2 = Number(el.tbSuperPlayer2?.value || 0);
        
          history.push({
            games1: Number(set1.games1 || 0),
            games2: Number(set1.games2 || 0),
            tieBreakMode: "tb7",
            tieBreakPoints1: super1,
            tieBreakPoints2: super2,
            lastTieBreakMode: "tb7",
            lastTieBreakPoints1: super1,
            lastTieBreakPoints2: super2
          });
        
        
        } else {
          history.push({
            games1: Number(set1.games1 || 0),
            games2: Number(set1.games2 || 0),
            tieBreakMode: set1.tieBreakMode || null,
            tieBreakPoints1: Number(set1.tieBreakPoints1 || 0),
            tieBreakPoints2: Number(set1.tieBreakPoints2 || 0)
          });
        }
      }
    
      if (setCount >= 2) {
        const set2 = getFormattedSetFromInput(el.set2Player1?.value, el.set2Player2?.value, 2);
        if (set2.error) return { error: set2.error };
    
        history.push({
          games1: Number(set2.games1 || 0),
          games2: Number(set2.games2 || 0),
          tieBreakMode: set2.tieBreakMode || null,
          tieBreakPoints1: Number(set2.tieBreakPoints1 || 0),
          tieBreakPoints2: Number(set2.tieBreakPoints2 || 0)
        });
      }
    
      if (setCount >= 3) {
        const set3 = getFormattedSetFromInput(el.set3Player1?.value, el.set3Player2?.value, 3);
        if (set3.error) return { error: set3.error };
    
        history.push({
          games1: Number(set3.games1 || 0),
          games2: Number(set3.games2 || 0),
          tieBreakMode: set3.tieBreakMode || null,
          tieBreakPoints1: Number(set3.tieBreakPoints1 || 0),
          tieBreakPoints2: Number(set3.tieBreakPoints2 || 0)
        });
      }
    
      return { history };
    }

    function getSetWinner(setObj) {
      if (!setObj) return null;

      const g1 = Number(setObj.games1 || 0);
      const g2 = Number(setObj.games2 || 0);
      const tbMode = String(setObj.tieBreakMode || "").trim();

      if (tbMode === "super10" || tbMode === "tb7") {
        const tb1 = Number(setObj.tieBreakPoints1 || 0);
        const tb2 = Number(setObj.tieBreakPoints2 || 0);
        if (tb1 > tb2) return 1;
        if (tb2 > tb1) return 2;
        return null;
      }

      if (g1 > g2) return 1;
      if (g2 > g1) return 2;
      return null;
    }

    function fillForm(data, id) {
      if (el.docId) el.docId.value = id || "";
      if (el.modality) {
        el.modality.value = "Tênis";
        el.modality.disabled = true;
      }
      if (el.categoryName) el.categoryName.value = data?.categoryName || "";
      if (el.tournamentName) el.tournamentName.value = data?.tournamentName || "";
      if (el.surfaceType) el.surfaceType.value = data?.surfaceType || "";
      if (el.gameFormat) {
        el.gameFormat.value = data?.gameFormat || "";
        el.gameFormat.disabled = false;
      }
      if (el.matchFormat) {
        el.matchFormat.value = data?.matchFormat || "";
        el.matchFormat.disabled = String(data?.status || "").trim().toLowerCase() === "finished";
      }
      if (el.matchDateTime) el.matchDateTime.value = data?.matchDateTime || "";
      if (el.court) el.court.value = data?.court || "";
      if (el.tournamentStage) el.tournamentStage.value = data?.tournamentStage || "";
      if (el.status) el.status.value = data?.status || "scheduled";

      if (el.player1) {
        el.player1.value = data?.player1 || state.currentProfileName || "";
        el.player1.readOnly = true;
        el.player1.setAttribute("readonly", "readonly");
        el.player1.style.pointerEvents = "none";
        el.player1.style.opacity = "0.95";
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

      const history = Array.isArray(data?.score?.setHistory) ? data.score.setHistory : [];

      if (el.set1Player1) el.set1Player1.value = history[0]?.games1 ?? "";
      if (el.set1Player2) el.set1Player2.value = history[0]?.games2 ?? "";
      if (el.set2Player1) el.set2Player1.value = history[1]?.games1 ?? "";
      if (el.set2Player2) el.set2Player2.value = history[1]?.games2 ?? "";
      if (el.set3Player1) el.set3Player1.value = history[2]?.games1 ?? "";
      if (el.set3Player2) el.set3Player2.value = history[2]?.games2 ?? "";

      if (el.tbSet1Player1) el.tbSet1Player1.value = history[0]?.tieBreakPoints1 ?? "";
      if (el.tbSet1Player2) el.tbSet1Player2.value = history[0]?.tieBreakPoints2 ?? "";
      if (el.tbSet2Player1) el.tbSet2Player1.value = history[1]?.tieBreakPoints1 ?? "";
      if (el.tbSet2Player2) el.tbSet2Player2.value = history[1]?.tieBreakPoints2 ?? "";
      if (el.tbSet3Player1) el.tbSet3Player1.value = history[2]?.tieBreakPoints1 ?? "";
      if (el.tbSet3Player2) el.tbSet3Player2.value = history[2]?.tieBreakPoints2 ?? "";

      if (el.tbSuperPlayer1) el.tbSuperPlayer1.value = history.find(s => s?.tieBreakMode === "super10")?.tieBreakPoints1 ?? "";
      if (el.tbSuperPlayer2) el.tbSuperPlayer2.value = history.find(s => s?.tieBreakMode === "super10")?.tieBreakPoints2 ?? "";

      if (el.formTitle) el.formTitle.textContent = id ? "Editando partida" : "Nova partida";

      handleModalityChange();
      handleGameFormatChange();
      updateTournamentStageVisibility();
      updateScoreFieldsVisibility();
      lockMatchFormatIfFinished();
    }

    function buildPublicLink(id) {
      return `${location.origin}${location.pathname.replace("admin.html", "player.html")}?id=${id}`;
    }

    function renderEmpty(message) {
      return `<tr><td colspan="5" class="empty-card">${U.escapeHtml(message)}</td></tr>`;
    }

    function sortLocalMatches() {
      state.allMatches.sort((a, b) => U.getCreatedAtMs(b.data) - U.getCreatedAtMs(a.data));
    }

    function getMatchYear(d) {
      const raw = d?.matchDateTime || d?.createdAt || d?.updatedAt || null;
      if (!raw) return "";
      if (typeof raw?.toDate === "function") {
        const dt = raw.toDate();
        return isNaN(dt.getTime()) ? "" : String(dt.getFullYear());
      }
      const dt = new Date(raw);
      return isNaN(dt.getTime()) ? "" : String(dt.getFullYear());
    }

    function populateYearFilter() {
      if (!el.filterYear) return;

      const current = el.filterYear.value || "";
      const years = [...new Set(
        state.allMatches
          .map(({ data }) => getMatchYear(data))
          .filter(Boolean)
      )].sort((a, b) => Number(b) - Number(a));

      el.filterYear.innerHTML = `<option value="">Todos os anos</option>` +
        years.map(y => `<option value="${y}">${y}</option>`).join("");

      if (current && years.includes(current)) {
        el.filterYear.value = current;
      }
    }

    function applyFilters() {
      const p = el.filterPlayers?.value.trim().toLowerCase() || "";
      const g = el.filterGameFormat?.value.trim().toLowerCase() || "";
      const t = el.filterTournament?.value.trim().toLowerCase() || "";
      const s = el.filterStatus?.value.trim().toLowerCase() || "";
      const y = el.filterYear?.value.trim() || "";

      state.filteredMatches = state.allMatches.filter(({ data }) => {
        const ownerId = String(data.ownerId || "").trim();
        const isOwnedByCurrentUser = state.currentUser && ownerId === state.currentUser.uid;
        const isLegacy = U.isLegacyMatch(data);
        const shouldShow = U.isAdmin(state.currentUser)
          ? isOwnedByCurrentUser
          : (isOwnedByCurrentUser || isLegacy);

        if (!shouldShow) return false;

        const playerText = `${data.player1 || ""} ${data.player2 || ""} ${data.player3 || ""} ${data.player4 || ""}`.toLowerCase();
        const gameFormatText = String(data.gameFormat || "").trim().toLowerCase();
        const tournamentText = String(data.tournamentName || "").toLowerCase();
        const statusText = String(data.status || "scheduled").trim().toLowerCase();
        const yearText = getMatchYear(data);

        return (!p || playerText.includes(p)) &&
               (!g || gameFormatText === g) &&
               (!t || tournamentText.includes(t)) &&
               (!s || statusText === s) &&
               (!y || yearText === y);
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
      if (d?.durationSeconds && Number(d.durationSeconds) > 0) return U.formatDuration(d.durationSeconds);

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
      const situationLabel = statusText === "wo" ? "Finalizada por WO" : U.getStatusLabel(statusText);
      const woWinner = U.getWONumberOrName(d);

      return ` <section class="detail-section detail-section-general"> <div class="detail-section-header"> <h4>Dados gerais</h4> <span class="detail-section-subtitle">Informações da partida</span> </div> <div class="detail-info-grid"> <div class="detail-info-item"><span>Modalidade</span><strong>${U.escapeHtml(d.modality || "-")}</strong></div> <div class="detail-info-item"><span>Formato do jogo</span><strong>${U.escapeHtml(d.gameFormat || "-")}</strong></div> <div class="detail-info-item"><span>Categoria</span><strong>${U.escapeHtml(d.categoryName || "-")}</strong></div> <div class="detail-info-item"><span>Torneio</span><strong>${U.escapeHtml(d.tournamentName || "-")}</strong></div> <div class="detail-info-item"><span>Tipo de piso</span><strong>${U.escapeHtml(d.surfaceType || "-")}</strong></div> <div class="detail-info-item"><span>Formato</span><strong>${U.escapeHtml(U.formatMatchFormat(d.matchFormat || "-"))}</strong></div> <div class="detail-info-item"><span>Data e hora</span><strong>${U.escapeHtml(d.matchDateTime ? new Date(d.matchDateTime).toLocaleString("pt-BR") : "-")}</strong></div> <div class="detail-info-item"><span>Quadra</span><strong>${U.escapeHtml(d.court || "-")}</strong></div> <div class="detail-info-item"><span>Fase</span><strong>${U.escapeHtml(d.tournamentStage || "-")}</strong></div> <div class="detail-info-item"><span>Situação</span><strong>${U.escapeHtml(situationLabel)}</strong></div> <div class="detail-info-item"><span>Jogadores</span><strong style="white-space:pre-line;">${teamHTML}</strong></div> <div class="detail-info-item"><span>Vencedor por WO</span><strong>${U.escapeHtml(woWinner)}</strong></div> </div> </section>`;
    }

    function getSetDisplayFromHistory(setObj) {
      if (!setObj) return { text: "--" };

      const g1 = Number(setObj.games1 ?? 0);
      const g2 = Number(setObj.games2 ?? 0);
      const tb1 = Number(setObj.tieBreakPoints1 ?? 0);
      const tb2 = Number(setObj.tieBreakPoints2 ?? 0);
      const mode = String(setObj.tieBreakMode || "").trim();

      if (mode === "super10" && (tb1 > 0 || tb2 > 0)) {
        return { text: `${tb1}x${tb2} (super tie-break)` };
      }

      if (mode === "tb7" && (tb1 > 0 || tb2 > 0)) {
        return {
          text: `${g1}x${g2} (${tb1}-${tb2})`
        };
      }

      return { text: `${g1}x${g2}` };
    }

    function renderScoreBlock(d) {
      const score = U.normalizeScore(d.score || {});
      const history = Array.isArray(score.setHistory) ? score.setHistory : [];

      const set1 = getSetDisplayFromHistory(history[0]);
      const set2 = getSetDisplayFromHistory(history[1]);
      const set3 = getSetDisplayFromHistory(history[2]);

      const duration = getMatchDuration(d);
      const status = String(d?.status || "").trim().toLowerCase();
      const isWO = status === "wo";
      const winnerPos = U.getWinnerPosition(score, d);
      const teamHTML = U.getMatchDisplayHTML(d);
      const setCount = detectSetCountFromMatch(d);

      const sets = [];
      if (setCount >= 1 && history[0]) sets.push(set1.text);
      if (setCount >= 2 && history[1]) sets.push(set2.text);
      if (setCount >= 3 && history[2]) sets.push(set3.text);

      const placar = sets.join(" • ");

      let resultBadge = "";
      let rowClass = "";

      if (winnerPos === 1) {
        rowClass = "winner-row";
        resultBadge = `<span class="winner-badge">${isWO ? "WO VENCEDOR" : "VENCEU"}</span>`;
      } else if (winnerPos === 2) {
        rowClass = "loser-row";
        resultBadge = `<span class="winner-badge loser-badge">PERDEU</span>`;
      }

      return ` <section class="detail-section detail-section-score"> <div class="detail-section-header"> <h4>Placar</h4> <span class="detail-section-subtitle">Situação atual da partida</span> </div> <div class="detail-score-card single-score-card"> <div class="detail-score-row ${rowClass}"> <div class="detail-player-title"> <span style="white-space:pre-line;">${teamHTML}</span> ${resultBadge} </div> ${ isWO ? ` <div class="detail-score-line"> <span>Situação</span> <strong>FINALIZADA POR WO</strong> </div> ` : ` <div class="detail-pill" style="margin-top:10px;"> <span>Placar da partida</span> <strong>${U.escapeHtml(placar || "--")}</strong> </div> ` } </div> <div class="detail-pill" style="margin-top:12px;"> <span>Duração da partida</span> <strong>${U.escapeHtml(duration)}</strong> </div> </div> </section> `;
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

      return ` <section class="detail-section detail-section-summary"> <div class="detail-section-header"> <h4>Resumo da partida</h4> <span class="detail-section-subtitle">Estatísticas gerais</span> </div> <div class="detail-summary-grid"> <div class="detail-summary-card"> <div class="detail-player-title">${team1HTML}</div> <div class="detail-summary-line"><span>Pontos totais</span><strong>${totalPoints1}</strong></div> <div class="detail-summary-line"><span>Break points</span><strong>${breakPointsWon1}/${breakPointsChances1}</strong></div> </div> <div class="detail-summary-card"> <div class="detail-player-title">${team2HTML}</div> <div class="detail-summary-line"><span>Pontos totais</span><strong>${totalPoints2}</strong></div> <div class="detail-summary-line"><span>Break points</span><strong>${breakPointsWon2}/${breakPointsChances2}</strong></div> </div> </div> </section>`;
    }

    function detailsHTML(d) {
      try {
        return `<div class="details-layout">${renderGeneralBlock(d)}${renderScoreBlock(d)}${renderSummaryBlock(d)}</div>`;
      } catch (err) {
        console.error("Erro ao montar detalhes:", err, d);
        return `<div class="details-layout"><p>Erro ao carregar os detalhes da partida.</p></div>`;
      }
    }

    function lockMatchFormatIfFinished() {
      if (!el.matchFormat) return;
      const isEditing = Boolean(el.docId?.value);
      const isFinished = String(el.status?.value || "").trim().toLowerCase() === "finished";
      el.matchFormat.disabled = isEditing && isFinished;
    }

    function toggleFiltersBar() {
      state.filtersVisible = !state.filtersVisible;
      if (el.filtersBar) el.filtersBar.style.display = state.filtersVisible ? "" : "none";

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
          state.allMatches = snapshot.docs.map(docSnap => ({ docSnap, data: docSnap.data() }));
          populateYearFilter();
          refreshList();
        },
        (err) => {
          console.error(err);
          setMsg("Não foi possível carregar suas partidas. Verifique as regras do Firestore.");
        }
      );
    }

    async function buildBiometricFallbackUser() {
      const biometricCurrent = getBiometricCurrentUser();
      const uid = biometricCurrent?.uid || getBiometricUid();
      if (!uid || typeof __db === "undefined") return null;

      try {
        const profileSnap = await __db.collection("profiles").doc(uid).get();
        const profileData = profileSnap.exists ? (profileSnap.data() || {}) : {};
        const userSnap = await __db.collection("users").doc(uid).get();
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};

        return {
          uid,
          email: biometricCurrent?.email || userData.email || profileData.email || "",
          displayName: biometricCurrent?.displayName || profileData.displayName || userData.displayName || ""
        };
      } catch (err) {
        console.error("Erro ao montar usuário biométrico:", err);
        return {
          uid,
          email: biometricCurrent?.email || "",
          displayName: biometricCurrent?.displayName || ""
        };
      }
    }

    async function updateAuthState(user) {
      const localSession = hasAdminSession();
      const biometricSession = hasBiometricSession();

      if (!user && !localSession && !biometricSession) {
        state.currentUser = null;
        state.currentProfileName = "";
        if (el.tbody) el.tbody.innerHTML = renderEmpty("Usuário não autenticado.");
        setMsg("Usuário não autenticado.");
        goLogin();
        return;
      }

      if (!user && biometricSession) {
        state.biometricMode = true;
        const fallbackUser = await buildBiometricFallbackUser();

        if (!fallbackUser || !fallbackUser.uid) {
          state.currentUser = null;
          state.currentProfileName = "";
          if (el.tbody) el.tbody.innerHTML = renderEmpty("Usuário não autenticado.");
          setMsg("Usuário não autenticado.");
          goLogin();
          return;
        }

        state.currentUser = fallbackUser;
        state.currentProfileName = String(fallbackUser.displayName || "").trim() || "Usuário";
        fillPlayer1Field();
        listenMatches();
        refreshList();
        return;
      }

      state.biometricMode = false;
      state.currentUser = user;
      state.currentProfileName = String(user.displayName || "").trim() || user.email || "";
      fillPlayer1Field();
      listenMatches();
      refreshList();
    }

    function rowHTML(docSnap) {
      const d = docSnap.data();
      const statusText = String(d.status || "scheduled").trim().toLowerCase();
      const label = U.getStatusLabel(statusText);

      return ` <tr> <td> <div class="players-cell"> <strong style="display:block;line-height:1.15;"> ${U.getMatchDisplayHTML(d)} </strong> </div> </td> <td>${U.escapeHtml(d.gameFormat || "-")}</td> <td title="${U.escapeHtml(d.tournamentName || "-")}">${U.escapeHtml(d.tournamentName || "-")}</td> <td><span class="status-tag status-${statusText}">${U.escapeHtml(label)}</span></td> <td class="col-actions-center"> <div class="admin-actions action-cell"> <div class="action-top-row"> <button type="button" class="admin-action-btn icon-btn" data-action="open" data-id="${docSnap.id}" title="Abrir partida">▶</button> <button type="button" class="admin-action-btn icon-btn" data-action="detail" data-id="${docSnap.id}" title="Detalhar">👁️</button> </div> <div class="action-bottom-row"> <button type="button" class="admin-action-btn icon-btn" data-action="edit" data-id="${docSnap.id}" title="Editar">✏️</button> <button type="button" class="admin-action-btn icon-btn danger" data-action="delete" data-id="${docSnap.id}" title="Excluir">🗑️</button> </div> </div> </td> </tr>`;
    }

    function mobileCardHTML(docSnap) {
      const d = docSnap.data();
      const statusText = String(d.status || "scheduled").trim().toLowerCase();
      const label = U.getStatusLabel(statusText);
      const date = d.matchDateTime ? new Date(d.matchDateTime).toLocaleString("pt-BR") : "-";

      return ` <tr class="mobile-match-row"> <td colspan="5"> <div class="mobile-match-card status-${statusText}"> <div class="mobile-match-card-top"> <span class="status-tag status-${statusText}">${U.escapeHtml(label)}</span> <span class="mobile-match-date">${U.escapeHtml(date)}</span> </div> <div class="mobile-match-players"> <strong>${U.getMatchDisplayHTMLMobile(d)}</strong> </div> <div class="mobile-match-meta"> <div><strong>Formato:</strong> ${U.escapeHtml(d.gameFormat || "-")}</div> <div><strong>Torneio:</strong> ${U.escapeHtml(d.tournamentName || "-")}</div> <div><strong>Fase:</strong> ${U.escapeHtml(d.tournamentStage || "-")}</div> </div> <div class="mobile-match-actions"> <button type="button" class="admin-action-btn icon-btn" data-action="open" data-id="${docSnap.id}" title="Abrir link">▶</button> <button type="button" class="admin-action-btn icon-btn" data-action="detail" data-id="${docSnap.id}" title="Detalhar">👁️</button> <button type="button" class="admin-action-btn icon-btn" data-action="edit" data-id="${docSnap.id}" title="Editar">✏️</button> <button type="button" class="admin-action-btn icon-btn danger" data-action="delete" data-id="${docSnap.id}" title="Excluir">🗑️</button> </div> </div> </td> </tr>`;
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

    function handleStatusChange() {
      updateScoreFieldsVisibility();
      lockMatchFormatIfFinished();
    }

    function bindEvents() {
      if (!hasAdminSession() && !hasBiometricSession()) return goLogin();

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
          localStorage.removeItem(BIOMETRIC_SESSION_KEY);
          localStorage.removeItem(BIOMETRIC_CURRENT_KEY);
          localStorage.removeItem(BIOMETRIC_UID_KEY);
          if (__auth?.currentUser) await __auth.signOut();
          goLogin();
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      };

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
      el.filterGameFormat?.addEventListener("change", refreshList);
      el.filterTournament?.addEventListener("input", refreshList);
      el.filterStatus?.addEventListener("change", refreshList);
      el.filterYear?.addEventListener("change", refreshList);

      el.gameFormat?.addEventListener("change", handleGameFormatChange);
      el.tournamentStage?.addEventListener("change", updateTournamentStageVisibility);
      el.status?.addEventListener("change", handleStatusChange);
      el.matchFormat?.addEventListener("change", updateScoreFieldsVisibility);

      el.set1Player1?.addEventListener("input", updateScoreFieldsVisibility);
      el.set1Player2?.addEventListener("input", updateScoreFieldsVisibility);
      el.set2Player1?.addEventListener("input", updateScoreFieldsVisibility);
      el.set2Player2?.addEventListener("input", updateScoreFieldsVisibility);
      el.set3Player1?.addEventListener("input", updateScoreFieldsVisibility);
      el.set3Player2?.addEventListener("input", updateScoreFieldsVisibility);

      el.tbSet1Player1?.addEventListener("input", updateScoreFieldsVisibility);
      el.tbSet1Player2?.addEventListener("input", updateScoreFieldsVisibility);
      el.tbSet2Player1?.addEventListener("input", updateScoreFieldsVisibility);
      el.tbSet2Player2?.addEventListener("input", updateScoreFieldsVisibility);
      el.tbSet3Player1?.addEventListener("input", updateScoreFieldsVisibility);
      el.tbSet3Player2?.addEventListener("input", updateScoreFieldsVisibility);
      el.tbSuperPlayer1?.addEventListener("input", updateScoreFieldsVisibility);
      el.tbSuperPlayer2?.addEventListener("input", updateScoreFieldsVisibility);

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

        const selectedModality = "Tênis";
        const selectedGameFormat = String(el.gameFormat?.value || "").trim();
        const selectedFormat = String(el.matchFormat?.value || "").trim();
        const selectedSurface = String(el.surfaceType?.value || "").trim();
        const selectedStatus = String(el.status?.value || "").trim();

        if (!["Simples", "Duplas", "Duplas Mistas"].includes(selectedGameFormat)) return setMsg("Selecione um formato de jogo válido.");
        if (!ALLOWED_FORMATS_TENNIS.includes(selectedFormat)) return setMsg("Formato inválido para a modalidade selecionada.");
        if (!ALLOWED_SURFACES.includes(selectedSurface)) return setMsg("Selecione um tipo de piso válido.");

        const isDoubles = selectedGameFormat === "Duplas" || selectedGameFormat === "Duplas Mistas";
        const woWinner = String(el.winnerByWO?.value || "").trim();
        const player1Name = state.currentProfileName || state.currentUser?.displayName || "";

        try {
          const isEditing = Boolean(el.docId?.value);
          const ref = isEditing ? __db.collection("matches").doc(el.docId.value) : null;
          let previousData = null;

          if (isEditing) {
            const snap = await ref.get();
            if (!snap.exists) return setMsg("Partida não encontrada para edição.");
            previousData = snap.data() || {};
          }

          const preserveScore = previousData?.score || defaultScore();
          let finalScore = isEditing ? preserveScore : defaultScore();

          if (selectedStatus === "finished") {
            const scoreValidation = validateScoreForm();
            if (scoreValidation) return setMsg(scoreValidation);
          
            const built = buildSetHistoryFromForm();
            if (built?.error) return setMsg(built.error);
          
            const history = built.history || [];
            const score = defaultScore();
            score.setHistory = history;
          
            const lastWithTB = [...history].reverse().find(s => s.tieBreakMode);
            if (lastWithTB) {
              score.tieBreakMode = lastWithTB.tieBreakMode || null;
              score.tieBreakPoints1 = lastWithTB.tieBreakPoints1 || 0;
              score.tieBreakPoints2 = lastWithTB.tieBreakPoints2 || 0;
              score.lastTieBreakMode = lastWithTB.tieBreakMode || null;
              score.lastTieBreakPoints1 = lastWithTB.tieBreakPoints1 || 0;
              score.lastTieBreakPoints2 = lastWithTB.tieBreakPoints2 || 0;
            }
          
            // Conta sets vencidos corretamente
            if (history[0]) {
              const w1 = getSetWinner(history[0]);
              if (w1 === 1) score.sets1 += 1;
              if (w1 === 2) score.sets2 += 1;
            }
          
            if (history[1]) {
              const w2 = getSetWinner(history[1]);
              if (w2 === 1) score.sets1 += 1;
              if (w2 === 2) score.sets2 += 1;
            }
          
            if (history[2]) {
              const w3 = getSetWinner(history[2]);
              if (w3 === 1) score.sets1 += 1;
              if (w3 === 2) score.sets2 += 1;
            }
          
            finalScore = score;
          }
          
          const data = {
            ownerId: state.currentUser?.uid || "",
            ownerEmail: state.currentUser?.email || "",
            ownerName: player1Name,
          
            modality: selectedModality,
            categoryName: el.categoryName?.value.trim() || "",
            tournamentName: el.tournamentName?.value.trim() || "",
            surfaceType: selectedSurface,
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
            status: woWinner ? "wo" : selectedStatus,
            score: finalScore,
          
            durationSeconds: isEditing ? (previousData.durationSeconds || 0) : 0,
            startedAt: isEditing ? (previousData.startedAt || null) : null,
            finishedAt: isEditing ? (previousData.finishedAt || null) : null,
            accumulatedSeconds: isEditing ? (previousData.accumulatedSeconds || 0) : 0,
          
            matchId: isEditing
              ? (previousData.matchId || `JOGO-${Date.now().toString().slice(-6)}`)
              : `JOGO-${Date.now().toString().slice(-6)}`,
          
            publicLinkId: isEditing
              ? (previousData.publicLinkId || (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now()).slice(-8)))
              : (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now()).slice(-8)),
          
            // campos públicos
            shareEnabled: true,
            shareToken: isEditing
              ? (previousData.shareToken || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Date.now()).slice(-8)))
              : (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Date.now()).slice(-8)),
          
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          };

          if (isEditing) {
            await ref.update(data);
            setMsg(woWinner ? "Partida salva como WO." : "Partida atualizada com sucesso!");
          } else {
            await __db.collection("matches").add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
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
          if (action === "delete" && confirm("Deseja excluir a partida?")) {
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
                if (el.dialog && typeof el.dialog.showModal === "function") el.dialog.showModal();
                else alert("Não foi possível abrir a tela de detalhes.");
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
      if (state.mobileMql.addEventListener) state.mobileMql.addEventListener("change", onResize);
      else if (state.mobileMql.addListener) state.mobileMql.addListener(onResize);

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

      if (!hasAdminSession() && !hasBiometricSession()) {
        goLogin();
        return;
      }

      if (typeof __auth === "undefined" || typeof __db === "undefined") {
        setMsg("Firebase não carregado corretamente.");
        return;
      }

      __auth.onAuthStateChanged((user) => {
        updateAuthState(user);
      });

      if (__auth.currentUser) updateAuthState(__auth.currentUser);
      else if (hasBiometricSession()) updateAuthState(null);

      hideForm();
      fillPlayer1Field();
      handleModalityChange();
      handleGameFormatChange();
      updateTournamentStageVisibility();
      updateScoreFieldsVisibility();
      refreshList();
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => AdminApp.init());
})();



              
