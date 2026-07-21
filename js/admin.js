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
      filtersVisible: false,
      currentUser: null,
      currentProfileName: "",
      unsubscribe: null,
      initialized: false,
      isMobile: window.matchMedia(MOBILE_QUERY).matches,
      resizeTimer: null,
      mobileMql: window.matchMedia(MOBILE_QUERY),
      biometricMode: false,
      playerSearchTarget: "",
      playerSearchDebounce: null
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
      adminStatsModal: null,
      adminStatsModalBody: null,
      adminStatsModalSubtitle: null,
      adminStatsModalClose: null,
      adminStatsModalCloseFooter: null,

      adminConfrontoModal: null,
      adminConfrontoFrame: null,
      adminConfrontoClose: null,

      docId: document.getElementById("docId"),
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
      tbSet3Player2: document.getElementById("tbSet3Player2"),

      playerSearchModal: document.getElementById("playerSearchModal"),
      closePlayerSearchModalBtn: document.getElementById("closePlayerSearchModalBtn"),
      playerSearchInput: document.getElementById("playerSearchInput"),
      playerSearchStatus: document.getElementById("playerSearchStatus"),
      playerSearchResults: document.getElementById("playerSearchResults")
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
      normalizePlayerName(name = "") {
        return String(name || "")
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
    
        // WO continua funcionando normalmente
        if (status === "wo") {
          if (woWinner === "player1") return 1;
          if (woWinner === "player2") return 2;
          return null;
        }
    
        // Primeiro tenta pelos sets salvos
        const sets1 = Number(score?.sets1 || 0);
        const sets2 = Number(score?.sets2 || 0);
    
        if (sets1 > sets2) return 1;
        if (sets2 > sets1) return 2;
    
        // Fallback: tenta descobrir pelo histórico
        const history = Array.isArray(score?.setHistory) ? score.setHistory : [];
    
        let p1Sets = 0;
        let p2Sets = 0;
    
        for (const setObj of history) {
          if (!setObj) continue;
    
          const g1 = Number(setObj.games1 || 0);
          const g2 = Number(setObj.games2 || 0);
          const tbMode = String(setObj.tieBreakMode || "").trim();
    
          let winner = null;
    
          if (tbMode === "super10" || tbMode === "tb7") {
            const tb1 = Number(setObj.tieBreakPoints1 || 0);
            const tb2 = Number(setObj.tieBreakPoints2 || 0);
    
            if (tb1 > tb2) winner = 1;
            else if (tb2 > tb1) winner = 2;
          } else {
            if (g1 > g2) winner = 1;
            else if (g2 > g1) winner = 2;
          }
    
          if (winner === 1) p1Sets++;
          if (winner === 2) p2Sets++;
        }
    
        if (p1Sets > p2Sets) return 1;
        if (p2Sets > p1Sets) return 2;
    
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
        return U.normalizeText(gameFormat) === "duplas";
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
        const map = {
          scheduled: "Jogos do dia",
          live: "Em andamento",
          finished: "Finalizada",
          wo: "WO",
          ret: "Abandono",
          suspended: "Suspensa"
        };
        return map[s] || status || "Jogos do dia";
      }
    };
    function setMsg(text) { if (el.msg) el.msg.textContent = text || ""; }
    function ensureAdminStatsModal() {
      let modal = document.getElementById("adminStatsModal");
    
      if (modal) {
        el.adminStatsModal = modal;
        el.adminStatsModalBody = modal.querySelector("#adminStatsModalBody");
        el.adminStatsModalSubtitle = modal.querySelector("#adminStatsModalSubtitle");
        el.adminStatsModalClose = modal.querySelector("#closeAdminStatsModal");
        el.adminStatsModalCloseFooter = modal.querySelector("#closeAdminStatsModalFooter");
        return modal;
      }
    
      modal = document.createElement("div");
    
      modal.id = "adminStatsModal";
      modal.className = "admin-stats-modal-overlay";
      modal.setAttribute("aria-hidden", "true");
    
      modal.innerHTML = ` <div class="admin-stats-modal" role="dialog" aria-modal="true" aria-labelledby="adminStatsModalTitle" > <div class="admin-stats-modal-header"> <div> <div class="admin-stats-modal-kicker"> Análise completa </div> <h2 id="adminStatsModalTitle"> Estatísticas da partida </h2> <div id="adminStatsModalSubtitle" class="admin-stats-modal-subtitle" ></div> </div> <button type="button" id="closeAdminStatsModal" class="admin-stats-close" aria-label="Fechar análise" > ✕ </button> </div> <div id="adminStatsModalBody" class="admin-stats-modal-body" ></div> <div class="admin-stats-modal-footer"> <button type="button" id="closeAdminStatsModalFooter" class="admin-stats-close-footer" > Fechar </button> </div> </div> `;
    
      document.body.appendChild(modal);
    
      el.adminStatsModal = modal;
      el.adminStatsModalBody = modal.querySelector("#adminStatsModalBody");
      el.adminStatsModalSubtitle = modal.querySelector("#adminStatsModalSubtitle");
      el.adminStatsModalClose = modal.querySelector("#closeAdminStatsModal");
      el.adminStatsModalCloseFooter = modal.querySelector("#closeAdminStatsModalFooter");
    
      el.adminStatsModalClose?.addEventListener(
        "click",
        closeAdminStatsModal
      );
    
      el.adminStatsModalCloseFooter?.addEventListener(
        "click",
        closeAdminStatsModal
      );
    
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeAdminStatsModal();
        }
      });
    
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeAdminStatsModal();
        }
      });
    
      return modal;
    }
    
    function closeAdminStatsModal() {
      const modal =
        el.adminStatsModal ||
        document.getElementById("adminStatsModal");
    
      if (!modal) return;
    
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    
      document.body.classList.remove("admin-stats-modal-open");
    }
    
    function getAdminStatsSubtitle(match = {}) {
      const dateText = match.matchDateTime
        ? new Date(match.matchDateTime).toLocaleString("pt-BR")
        : "";
    
      const gameFormat = String(
        match.gameFormat || "Simples"
      ).trim();
    
      const stage = String(
        match.tournamentStage || ""
      ).trim();
    
      const parts = [];
    
      if (dateText) parts.push(dateText);
      if (gameFormat) parts.push(gameFormat);
      if (stage) parts.push(stage);
    
      return parts.join(" • ");
    }

    const adminPhotoCache = new Map();

function adminNormalizePhotoSrc(photo = "") {
  const value = String(photo || "").trim();

  if (!value) return "";

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/")
  ) {
    return value;
  }

  if (value.length > 100) {
    return `data:image/jpeg;base64,${value}`;
  }

  return value;
}

function adminGetProfileName(data = {}) {
  return String(
    data.displayName ||
    data.name ||
    data.fullName ||
    data.nome ||
    data.ownerName ||
    data.playerName ||
    ""
  ).trim();
}

function adminGetProfilePhoto(data = {}) {
  return adminNormalizePhotoSrc(
    data.photoBase64 ||
    data.photoURL ||
    data.photoUrl ||
    data.avatarUrl ||
    data.profilePhoto ||
    data.imageUrl ||
    data.photo ||
    ""
  );
}

async function adminFindProfileByName(name = "") {
  const searchName = U.normalizePlayerName(name);

  if (!searchName || typeof __db === "undefined") {
    return null;
  }

  const collections = ["profiles", "users"];

  try {
    for (const collectionName of collections) {
      const snapshot = await __db
        .collection(collectionName)
        .get();

      let exact = null;
      let partial = null;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const profileName = adminGetProfileName(data);
        const normalizedName = U.normalizePlayerName(profileName);

        if (!normalizedName) return;

        const result = {
          id: docSnap.id,
          ...data
        };

        if (normalizedName === searchName) {
          exact = result;
        } else if (!partial && normalizedName.includes(searchName)) {
          partial = result;
        }
      });

      if (exact) return exact;
      if (partial) return partial;
    }
  } catch (err) {
    console.error("Erro ao buscar perfil:", err);
  }

  return null;
}

async function adminLoadPlayerProfile(name = "", uid = "") {
  const cacheKey = String(uid || name || "").trim();

  if (adminPhotoCache.has(cacheKey)) {
    return adminPhotoCache.get(cacheKey);
  }

  let profile = null;

  try {
    if (uid && typeof __db !== "undefined") {
      const profileSnap = await __db
        .collection("profiles")
        .doc(uid)
        .get();

      if (profileSnap.exists) {
        profile = profileSnap.data() || {};
      }

      if (!profile) {
        const userSnap = await __db
          .collection("users")
          .doc(uid)
          .get();

        if (userSnap.exists) {
          profile = userSnap.data() || {};
        }
      }
    }

    if (!profile && name) {
      profile = await adminFindProfileByName(name);
    }
  } catch (err) {
    console.error("Erro ao carregar dados do jogador:", err);
  }

  const result = {
    name: adminGetProfileName(profile || {}) || name || "Jogador",
    photo: adminGetProfilePhoto(profile || {})
  };

  adminPhotoCache.set(cacheKey, result);
  return result;
}

function adminGetTeamPlayers(match, position) {
  const doubles = U.isDoublesFormatValue(match.gameFormat);

  if (position === 1) {
    const players = [
      {
        name: String(match.player1 || match.ownerName || "Jogador 1").trim(),
        uid: String(match.ownerId || "").trim()
      }
    ];

    if (doubles) {
      players.push({
        name: String(match.player2 || "Jogador 2").trim(),
        uid: String(match.player2Id || "").trim()
      });
    }

    return players;
  }

  const players = [
    {
      name: String(match.player3 || match.player2 || "Jogador 2").trim(),
      uid: String(match.player3Id || match.opponentId || "").trim()
    }
  ];

  if (doubles) {
    players.push({
      name: String(match.player4 || "Jogador 4").trim(),
      uid: String(match.player4Id || "").trim()
    });
  }

  return players;
}

function adminInitial(name = "") {
  return String(name || "J")
    .trim()
    .charAt(0)
    .toUpperCase() || "J";
}

function adminRenderPlayerPhoto(profile) {
  const name = profile?.name || "Jogador";
  const photo = profile?.photo || "";

  if (!photo) {
    return ` <div class="admin-stats-player-photo-placeholder"> ${U.escapeHtml(adminInitial(name))} </div> `;
  }

  return ` <img class="admin-stats-player-photo" src="${U.escapeHtml(photo)}" alt="${U.escapeHtml(name)}" /> `;
}

async function adminRenderPlayerTeam(match, position) {
  const players = adminGetTeamPlayers(match, position);

  const profiles = await Promise.all(
    players.map((player) =>
      adminLoadPlayerProfile(player.name, player.uid)
    )
  );

  return ` <div class="admin-stats-player-team"> ${profiles.map((profile) => ` <div class="admin-stats-player-unit"> ${adminRenderPlayerPhoto(profile)} <div class="admin-stats-player-name"> ${U.escapeHtml(profile.name)} </div> </div> `).join("")} </div> `;
}

function adminGetStat(stats, aliases = [], fallback = 0) {
  const source = stats || {};

  for (const alias of aliases) {
    if (
      source[alias] !== undefined &&
      source[alias] !== null &&
      source[alias] !== ""
    ) {
      return source[alias];
    }
  }

  return fallback;
}

function adminNumberStat(stats, aliases = []) {
  const value = Number(adminGetStat(stats, aliases, 0));
  return Number.isFinite(value) ? value : 0;
}

function adminSumStat(stats, aliases = []) {
  return aliases.reduce(
    (total, group) => total + adminNumberStat(stats, group),
    0
  );
}

function adminRatio(won, attempts) {
  return `${Number(won || 0)}/${Number(attempts || 0)}`;
}

function adminParseBarValue(value) {
  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const firstPart = Number(
    String(value || "0").split("/")[0]
  );

  return Number.isFinite(firstPart) ? firstPart : 0;
}

function adminRenderComparisonBar(value1, value2) {
  const p1 = adminParseBarValue(value1);
  const p2 = adminParseBarValue(value2);
  const total = p1 + p2;

  const width1 = total > 0 ? (p1 / total) * 100 : 50;
  const width2 = total > 0 ? (p2 / total) * 100 : 50;

  return ` <div class="admin-stats-comparison"> <div class="admin-stats-comparison-p1" style="width:${width1}%" ></div> <div class="admin-stats-comparison-p2" style="width:${width2}%" ></div> </div> `;
}

function adminRenderStatRow( label, value1, value2, barValue1 = value1, barValue2 = value2 ) {
  return ` <div class="admin-stats-detail-line"> <div class="admin-stats-detail-values"> <span class="admin-stats-value-player1"> ${U.escapeHtml(String(value1 ?? 0))} </span> <span class="admin-stats-value-label"> ${U.escapeHtml(label)} </span> <span class="admin-stats-value-player2"> ${U.escapeHtml(String(value2 ?? 0))} </span> </div> ${adminRenderComparisonBar(barValue1, barValue2)} </div> `;
}

function adminGetScoreText(match) {
  const score = U.normalizeScore(match.score || {});
  const history = Array.isArray(score.setHistory)
    ? score.setHistory
    : [];

  const sets = history
    .map((setObj) => getSetDisplayFromHistory(setObj).text)
    .filter((value) => value && value !== "--");

  const setText = sets.length
    ? sets.join(" • ")
    : "--";

  return `${score.sets1} x ${score.sets2} • ${setText}`;
}

function adminGetDurationText(match) {
  if (
    match.durationSeconds &&
    Number(match.durationSeconds) > 0
  ) {
    return U.formatDuration(match.durationSeconds);
  }

  return getMatchDuration(match);
}

function adminRenderMeta(match) {
  const date = match.matchDateTime
    ? new Date(match.matchDateTime).toLocaleString("pt-BR")
    : "-";

  const duration = adminGetDurationText(match);
  const phase = match.tournamentStage || "-";
  const gameFormat = match.gameFormat || "-";
  const score = adminGetScoreText(match);

  return ` <div class="admin-stats-meta-grid"> <div class="admin-stats-meta-item"> <ion-icon name="calendar-outline"></ion-icon> <span>Data e hora</span> <strong>${U.escapeHtml(date)}</strong> </div> <div class="admin-stats-meta-item"> <ion-icon name="time-outline"></ion-icon> <span>Duração</span> <strong>${U.escapeHtml(duration)}</strong> </div> <div class="admin-stats-meta-item"> <ion-icon name="flag-outline"></ion-icon> <span>Fase da partida</span> <strong>${U.escapeHtml(phase)}</strong> </div> <div class="admin-stats-meta-item"> <ion-icon name="tennisball-outline"></ion-icon> <span>Tipo de jogo</span> <strong>${U.escapeHtml(gameFormat)}</strong> </div> <div class="admin-stats-meta-item admin-stats-meta-score"> <ion-icon name="trophy-outline"></ion-icon> <span>Placar final</span> <strong>${U.escapeHtml(score)}</strong> </div> </div> `;
}

async function renderAdminDetailedStats(match) {
  const stats = match.stats || match.statistics || {};
  const player1 = stats.player1 || stats.p1 || {};
  const player2 = stats.player2 || stats.p2 || {};
  const score = U.normalizeScore(match.score || {});

  const team1Html = await adminRenderPlayerTeam(match, 1);
  const team2Html = await adminRenderPlayerTeam(match, 2);

  const p1FirstServeWon = adminNumberStat(player1, [
    "serve1Won",
    "firstServeWon"
  ]);

  const p2FirstServeWon = adminNumberStat(player2, [
    "serve1Won",
    "firstServeWon"
  ]);

  const p1FirstServeAttempts = adminNumberStat(player1, [
    "serve1Attempts",
    "firstServeAttempts"
  ]);

  const p2FirstServeAttempts = adminNumberStat(player2, [
    "serve1Attempts",
    "firstServeAttempts"
  ]);

  const p1SecondServeWon = adminNumberStat(player1, [
    "serve2Won",
    "secondServeWon"
  ]);

  const p2SecondServeWon = adminNumberStat(player2, [
    "serve2Won",
    "secondServeWon"
  ]);

  const p1SecondServeAttempts = adminNumberStat(player1, [
    "serve2Attempts",
    "secondServeAttempts"
  ]);

  const p2SecondServeAttempts = adminNumberStat(player2, [
    "serve2Attempts",
    "secondServeAttempts"
  ]);

  const p1Winners = adminSumStat(player1, [
    ["winner", "winners"],
    ["forehandWinner", "forehandWinners"],
    ["backhandWinner", "backhandWinners"],
    ["dropshotWinner", "dropShotWinner"]
  ]);

  const p2Winners = adminSumStat(player2, [
    ["winner", "winners"],
    ["forehandWinner", "forehandWinners"],
    ["backhandWinner", "backhandWinners"],
    ["dropshotWinner", "dropShotWinner"]
  ]);

  const p1Unforced = adminSumStat(player1, [
    ["unforcedError", "unforcedErrors", "enf"],
    ["enfFH", "unforcedErrorFH"],
    ["enfBH", "unforcedErrorBH"]
  ]);

  const p2Unforced = adminSumStat(player2, [
    ["unforcedError", "unforcedErrors", "enf"],
    ["enfFH", "unforcedErrorFH"],
    ["enfBH", "unforcedErrorBH"]
  ]);

  const p1Forced = adminSumStat(player1, [
    ["forcedError", "forcedErrors"],
    ["forcedErrorFH"],
    ["forcedErrorBH"]
  ]);

  const p2Forced = adminSumStat(player2, [
    ["forcedError", "forcedErrors"],
    ["forcedErrorFH"],
    ["forcedErrorBH"]
  ]);

  const p1BreakWon = Number(
    score.breakPointsWon1 ||
    player1.breakPointsWon ||
    0
  );

  const p2BreakWon = Number(
    score.breakPointsWon2 ||
    player2.breakPointsWon ||
    0
  );

  const p1BreakChances = Number(
    score.breakPointsChances1 ||
    player1.breakPointsChances ||
    0
  );

  const p2BreakChances = Number(
    score.breakPointsChances2 ||
    player2.breakPointsChances ||
    0
  );

  const p1Performance = adminNumberStat(player1, [
    "serveSuccessPct",
    "performance"
  ]);

  const p2Performance = adminNumberStat(player2, [
    "serveSuccessPct",
    "performance"
  ]);

  const sections = [
    {
      title: "Serviço",
      rows: [
        ["Aces",
          adminNumberStat(player1, ["ace", "aces"]),
          adminNumberStat(player2, ["ace", "aces"])
        ],
        ["Duplas faltas",
          adminNumberStat(player1, ["doubleFault", "doubleFaults"]),
          adminNumberStat(player2, ["doubleFault", "doubleFaults"])
        ],
        ["1º serviço vencido",
          adminRatio(p1FirstServeWon, p1FirstServeAttempts),
          adminRatio(p2FirstServeWon, p2FirstServeAttempts),
          p1FirstServeWon,
          p2FirstServeWon
        ],
        ["2º serviço vencido",
          adminRatio(p1SecondServeWon, p1SecondServeAttempts),
          adminRatio(p2SecondServeWon, p2SecondServeAttempts),
          p1SecondServeWon,
          p2SecondServeWon
        ],
        ["Performance",
          `${p1Performance.toFixed(1)}%`,
          `${p2Performance.toFixed(1)}%`,
          p1Performance,
          p2Performance
        ]
      ]
    },

    {
      title: "Pontos na rede",
      rows: [
        ["Pontos na rede vencidos",
          adminNumberStat(player1, ["netWon", "netPointsWon"]),
          adminNumberStat(player2, ["netWon", "netPointsWon"])
        ],
        ["Pontos na rede perdidos",
          adminNumberStat(player1, ["netLost", "netPointsLost"]),
          adminNumberStat(player2, ["netLost", "netPointsLost"])
        ]
      ]
    },

    {
      title: "Golpes e erros",
      rows: [
        ["Winners", p1Winners, p2Winners],
        ["Erros não forçados", p1Unforced, p2Unforced],
        ["Erros forçados", p1Forced, p2Forced],
        ["Dropshot winners",
          adminNumberStat(player1, ["dropshotWinner", "dropShotWinner"]),
          adminNumberStat(player2, ["dropshotWinner", "dropShotWinner"])
        ],
        ["Dropshot erros",
          adminNumberStat(player1, ["dropshotError", "dropShotError"]),
          adminNumberStat(player2, ["dropshotError", "dropShotError"])
        ]
      ]
    },

    {
      title: "Devolução",
      rows: [
        ["Pontos de devolução vencidos",
          adminNumberStat(player1, ["returnPoint", "returnPointsWon"]),
          adminNumberStat(player2, ["returnPoint", "returnPointsWon"])
        ],
        ["Erros de devolução",
          adminNumberStat(player1, ["returnError", "returnErrors"]),
          adminNumberStat(player2, ["returnError", "returnErrors"])
        ],
        ["Break points vencidos",
          adminRatio(p1BreakWon, p1BreakChances),
          adminRatio(p2BreakWon, p2BreakChances),
          p1BreakWon,
          p2BreakWon
        ]
      ]
    },

    {
      title: "Linha de base",
      rows: [
        ["Pontos vencidos na linha de base",
          adminNumberStat(player1, ["baselinePoint", "baselinePointsWon"]),
          adminNumberStat(player2, ["baselinePoint", "baselinePointsWon"])
        ],
        ["Erros na linha de base",
          adminNumberStat(player1, ["baselineError", "baselineErrors"]),
          adminNumberStat(player2, ["baselineError", "baselineErrors"])
        ]
      ]
    },

    {
      title: "Resumo",
      rows: [
        ["Total de pontos vencidos",
          Number(score.totalPoints1 || player1.totalPointsWon || 0),
          Number(score.totalPoints2 || player2.totalPointsWon || 0)
        ],
        ["Sets", score.sets1, score.sets2],
        ["Games", score.games1, score.games2]
      ]
    }
  ];

  const sectionsHtml = sections.map((section) => {
    const rowsHtml = section.rows.map((row) => {
      return adminRenderStatRow(
        row[0],
        row[1],
        row[2],
        row[3] ?? row[1],
        row[4] ?? row[2]
      );
    }).join("");

    return ` <section class="admin-stats-detail-section"> <h3>${U.escapeHtml(section.title)}</h3> ${rowsHtml} </section> `;
  }).join("");

  return ` <div class="admin-stats-player-header"> <div class="admin-stats-player-card player1"> ${team1Html} </div> <div class="admin-stats-player-card player2"> ${team2Html} </div> </div> ${adminRenderMeta(match)} ${sectionsHtml} `;
}
    
    async function showAdminStatsModal(match) {
      ensureAdminStatsModal();
    
      if (!el.adminStatsModalBody) return;
    
      if (!match) {
        el.adminStatsModalBody.innerHTML = ` <div class="admin-stats-empty"> Nenhuma partida disponível para exibir estatísticas. </div> `;
    
        if (el.adminStatsModalSubtitle) {
          el.adminStatsModalSubtitle.textContent = "";
        }
    
        return;
      }
    
      if (el.adminStatsModalSubtitle) {
        el.adminStatsModalSubtitle.textContent =
          getAdminStatsSubtitle(match);
      }
    
      el.adminStatsModalBody.innerHTML = ` <div class="admin-stats-loading"> Carregando análise da partida... </div> `;
    
      el.adminStatsModal.classList.add("show");
      el.adminStatsModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("admin-stats-modal-open");
    
      try {
        el.adminStatsModalBody.innerHTML =
          await renderAdminDetailedStats(match);
      } catch (err) {
        console.error("Erro ao montar análise completa:", err);
    
        el.adminStatsModalBody.innerHTML = ` <div class="admin-stats-empty"> Não foi possível carregar a análise da partida. </div> `;
      }
    }

    function ensureAdminConfrontoModal() {
      let modal = document.getElementById("adminConfrontoModal");
    
      if (modal) {
        el.adminConfrontoModal = modal;
        el.adminConfrontoFrame = modal.querySelector("#adminConfrontoFrame");
        el.adminConfrontoClose = modal.querySelector("#closeAdminConfrontoModal");
        return modal;
      }
    
      modal = document.createElement("div");
    
      modal.id = "adminConfrontoModal";
      modal.className = "admin-confronto-modal-overlay";
      modal.setAttribute("aria-hidden", "true");
    
      modal.innerHTML = ` <div class="admin-confronto-modal" role="dialog" aria-modal="true" aria-labelledby="adminConfrontoModalTitle" > <div class="admin-confronto-modal-header"> <div> <div class="admin-confronto-modal-kicker"> Análise da partida </div> <h2 id="adminConfrontoModalTitle"> Confronto direto </h2> </div> <button type="button" id="closeAdminConfrontoModal" class="admin-confronto-close" aria-label="Fechar confronto" > ✕ </button> </div> <div class="admin-confronto-modal-body"> <iframe id="adminConfrontoFrame" title="Confronto direto entre jogadores" ></iframe> </div> </div> `;
    
      document.body.appendChild(modal);
    
      el.adminConfrontoModal = modal;
      el.adminConfrontoFrame = modal.querySelector("#adminConfrontoFrame");
      el.adminConfrontoClose = modal.querySelector("#closeAdminConfrontoModal");
    
      el.adminConfrontoClose?.addEventListener(
        "click",
        closeAdminConfrontoModal
      );
    
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeAdminConfrontoModal();
        }
      });
    
      return modal;
    }
    
    function closeAdminConfrontoModal() {
      const modal =
        el.adminConfrontoModal ||
        document.getElementById("adminConfrontoModal");
    
      const frame =
        el.adminConfrontoFrame ||
        document.getElementById("adminConfrontoFrame");
    
      if (!modal) return;
    
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    
      document.body.classList.remove(
        "admin-confronto-modal-open"
      );
    
      if (frame) {
        frame.src = "about:blank";
      }
    }
    
    function buildAdminConfrontoUrl(matchId, data = {}) {
      const url = new URL(
        "confronto.html",
        window.location.href
      );
    
      url.searchParams.set("embedded", "1");
    
      if (matchId) {
        url.searchParams.set("id", matchId);
        url.searchParams.set("matchId", matchId);
      }
    
      if (data.ownerId) {
        url.searchParams.set(
          "ownerId",
          data.ownerId
        );
      }
    
      if (data.player1) {
        url.searchParams.set(
          "player1",
          data.player1
        );
      }
    
      if (data.player2) {
        url.searchParams.set(
          "player2",
          data.player2
        );
      }
    
      if (data.player3) {
        url.searchParams.set(
          "player3",
          data.player3
        );
      }
    
      if (data.player4) {
        url.searchParams.set(
          "player4",
          data.player4
        );
      }
    
      if (data.opponentId) {
        url.searchParams.set(
          "opponentId",
          data.opponentId
        );
      }
    
      if (data.shareToken) {
        url.searchParams.set(
          "shareToken",
          data.shareToken
        );
      }
    
      return url.toString();
    }
    
    function showAdminConfrontoModal(matchId, data = {}) {
      ensureAdminConfrontoModal();
    
      if (!el.adminConfrontoFrame) return;
    
      const url = buildAdminConfrontoUrl(
        matchId,
        data
      );
    
      el.adminConfrontoFrame.src = url;
    
      el.adminConfrontoModal.classList.add("show");
      el.adminConfrontoModal.setAttribute(
        "aria-hidden",
        "false"
      );
    
      document.body.classList.add(
        "admin-confronto-modal-open"
      );
    }

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
      el.matchFormat.innerHTML =
        `<option value="">Selecione o formato da partida</option>` +
        ALLOWED_FORMATS_TENNIS.map(opt => `<option value="${opt}">${opt}</option>`).join("");
      if (ALLOWED_FORMATS_TENNIS.includes(current)) el.matchFormat.value = current;
    }

    function updateSurfaceVisibility() {
      setFieldVisible(el.surfaceTypeWrapper, true);
      if (el.surfaceType) el.surfaceType.required = true;
    }

    function placeScoreBlockAfterStatus() {
      const statusLabel = el.status?.closest("label");
      const scoreWrapper = el.scoreFieldsWrapper;
    
      if (!statusLabel || !scoreWrapper) return;
      if (scoreWrapper.parentElement !== statusLabel.parentElement) return;
    
      statusLabel.insertAdjacentElement("afterend", scoreWrapper);
    }

    function handleModalityChange() {
      updateMatchFormatOptions();
      updateSurfaceVisibility();
      updateTournamentStageVisibility();
      updateScoreFieldsVisibility();
      placeScoreBlockAfterStatus();
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
    
      // Ordem correta dos blocos
      moveAfter(el.scoreTieBreakSet1Wrapper, el.scoreSet1Wrapper);
      moveAfter(el.scoreTieBreakSet2Wrapper, el.scoreSet2Wrapper);
      moveAfter(el.scoreTieBreakSet3Wrapper, el.scoreSet3Wrapper);
    
      // Super tie-break sempre depois do tie-break do 2º set
      if (el.scoreSuperTieBreakWrapper && el.scoreTieBreakSet2Wrapper) {
        moveAfter(el.scoreSuperTieBreakWrapper, el.scoreTieBreakSet2Wrapper);
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
    
      const setControlState = (input, visible) => {
        if (!input) return;
        input.required = !!visible;
        input.disabled = !visible;
        if (!visible) input.value = "";
      };
    
      setFieldVisible(el.scoreFieldsWrapper, isFinished);
      setFieldVisible(el.scoreSet1Wrapper, isFinished && setCount >= 1);
      setFieldVisible(el.scoreSet2Wrapper, isFinished && setCount >= 2);
      setFieldVisible(el.scoreSet3Wrapper, isFinished && setCount >= 3 && !matchDecided);
    
      if (!isFinished) {
        setFieldVisible(el.scoreTieBreakSet1Wrapper, false);
        setFieldVisible(el.scoreTieBreakSet2Wrapper, false);
        setFieldVisible(el.scoreTieBreakSet3Wrapper, false);
        setFieldVisible(el.scoreSuperTieBreakWrapper, false);
    
        [
          el.tbSet1Player1, el.tbSet1Player2,
          el.tbSet2Player1, el.tbSet2Player2,
          el.tbSet3Player1, el.tbSet3Player2,
          el.tbSuperPlayer1, el.tbSuperPlayer2
        ].forEach(input => {
          if (input) {
            input.required = false;
            input.disabled = true;
          }
        });
    
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
    
      setControlState(el.tbSet1Player1, showTieBreakSet1);
      setControlState(el.tbSet1Player2, showTieBreakSet1);
      setControlState(el.tbSet2Player1, showTieBreakSet2);
      setControlState(el.tbSet2Player2, showTieBreakSet2);
      setControlState(el.tbSet3Player1, showTieBreakSet3);
      setControlState(el.tbSet3Player2, showTieBreakSet3);
      setControlState(el.tbSuperPlayer1, showSuperTieBreak);
      setControlState(el.tbSuperPlayer2, showSuperTieBreak);
    
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
    
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (a < 0 || b < 0) return false;
    
      const max = Math.max(a, b);
      const min = Math.min(a, b);
      const diff = max - min;
    
      if (mode === "tb7") {
        if (max < 7) return false;
        if (max === 7) return min <= 6;
        return diff >= 2;
      }
    
      if (mode === "super10") {
        if (max < 10) return false;
        if (max === 10) return min <= 9;
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
        (s1 === "super10" || s2 === "super10" || s3 === "super10") ||
        ((cfg.twoSetsNoAdSuper || cfg.twoSetsAdSuper) && splitSets);

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
        if (!validateTieBreakPoints(v1, v2, "super10")) return "Placar inválido.";
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
      placeScoreBlockAfterStatus();

      setMsg("");
      closePlayerSearchModal();
    }

    function scrollToFiltersBar() {
      const target = document.querySelector("#filtersBar");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function clearFilters() {
      if (el.filterPlayers) el.filterPlayers.value = "";
      if (el.filterGameFormat) el.filterGameFormat.value = "";
      if (el.filterTournament) el.filterTournament.value = "";
      if (el.filterStatus) el.filterStatus.value = "";
      if (el.filterYear) el.filterYear.value = "";
      refreshList();
      setTimeout(() => scrollToFirstCard(), 50);
    }

    function calcAgeFromBirthDate(birthDate) {
      if (!birthDate) return "-";
      const d = new Date(birthDate);
      if (isNaN(d.getTime())) return "-";
      const today = new Date();
      let age = today.getFullYear() - d.getFullYear();
      const m = today.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
      return age;
    }

    function buildShortPlayerId(displayName = "", uid = "") {
      const name = U.normalizePlayerName(displayName).replace(/[^a-z0-9]/g, "");
      const shortUid = String(uid || "").replace(/[^a-z0-9]/gi, "").slice(0, 4).toLowerCase();
      return `${name}_${shortUid}_id`;
    }

    function openPlayerSearchModal(targetField) {
      state.playerSearchTarget = targetField || "";
      if (el.playerSearchInput) el.playerSearchInput.value = "";
      if (el.playerSearchStatus) el.playerSearchStatus.textContent = "Digite o nome para pesquisar.";
      if (el.playerSearchResults) el.playerSearchResults.innerHTML = "";
      if (el.playerSearchModal) el.playerSearchModal.classList.remove("hidden");
      setTimeout(() => { el.playerSearchInput?.focus(); }, 100);
    }

    function closePlayerSearchModal() {
      state.playerSearchTarget = "";
      if (el.playerSearchModal) el.playerSearchModal.classList.add("hidden");
      if (el.playerSearchResults) el.playerSearchResults.innerHTML = "";
      if (el.playerSearchStatus) el.playerSearchStatus.textContent = "";
    }

    async function searchPlayersByName(query) {
      const q = U.normalizePlayerName(query);
      if (!q || q.length < 2) return [];

      try {
        const collectionsToTry = ["users", "profiles"];
        const byUid = new Map();

        for (const collectionName of collectionsToTry) {
          try {
            const snap = await __db.collection(collectionName).get();

            snap.forEach((doc) => {
              const data = doc.data() || {};
              const displayName = String(data.displayName || data.name || data.nome || "").trim();

              const searchText = U.normalizePlayerName(
                [data.displayName, data.searchName, data.name, data.nome, data.email].filter(Boolean).join(" ")
              );

              if (!searchText.includes(q)) return;

              const uid = String(data.uid || doc.id || "").trim();
              const existing = byUid.get(uid);

              const item = {
                id: doc.id,
                uid,
                name: displayName,
                data,
                collection: collectionName
              };

              if (!existing) {
                byUid.set(uid, item);
              } else if (existing.collection !== "profiles" && collectionName === "profiles") {
                byUid.set(uid, item);
              }
            });
          } catch (err) {
            console.warn(`Erro ao buscar na coleção ${collectionName}:`, err);
          }
        }

        return Array.from(byUid.values()).slice(0, 10);
      } catch (err) {
        console.error("Erro geral ao buscar jogadores:", err);
        return [];
      }
    }

    function renderPlayerSearchResults(players) {
      if (!el.playerSearchResults) return;

      if (!players.length) {
        el.playerSearchResults.innerHTML = `<div class="player-search-empty">Nenhum jogador encontrado. Você pode digitar manualmente no campo.</div>`;
        return;
      }

      el.playerSearchResults.innerHTML = players.map((player) => {
        const data = player.data || {};
        const displayName = String(data.displayName || player.name || "").trim();
        const uid = String(data.uid || player.uid || player.id || "").trim();
        const shortId = buildShortPlayerId(displayName, uid);
        const country = String(data.country || "BR").trim();
        const city = String(data.city || "-").trim();
        const age = calcAgeFromBirthDate(data.birthDate);
        const avatarBase64 = String(data.photoBase64 || "").trim();
        const avatarLetter = (displayName.charAt(0) || "?").toUpperCase();

        const avatarHtml = avatarBase64
          ? `<img src="${U.escapeHtml(avatarBase64)}" alt="${U.escapeHtml(displayName)}" />`
          : `<div class="player-search-avatar-placeholder">${U.escapeHtml(avatarLetter)}</div>`;

        return ` <button type="button" class="player-search-card" data-name="${U.escapeHtml(displayName)}" data-id="${U.escapeHtml(shortId)}"> <div class="player-search-avatar">${avatarHtml}</div> <div class="player-search-content"> <div class="player-search-name">${U.escapeHtml(displayName)}</div> <div class="player-search-line"> <strong>ID:</strong> <span>${U.escapeHtml(shortId)}</span> <strong>País:</strong> <span>${U.escapeHtml(country)}</span> </div> <div class="player-search-line"> <strong>Cidade:</strong> <span>${U.escapeHtml(city)}</span> <strong>Idade:</strong> <span>${U.escapeHtml(String(age))}</span> </div> </div> </button> `;
      }).join("");
    }

    function handlePlayerSearchInput() {
      clearTimeout(state.playerSearchDebounce);
      state.playerSearchDebounce = setTimeout(async () => {
        const query = el.playerSearchInput?.value || "";
        if (el.playerSearchStatus) {
          el.playerSearchStatus.textContent = query.trim() ? "Pesquisando..." : "Digite o nome para pesquisar.";
        }

        const players = await searchPlayersByName(query);
        renderPlayerSearchResults(players);

        if (el.playerSearchStatus) {
          el.playerSearchStatus.textContent = players.length
            ? `${players.length} jogador(es) encontrado(s).`
            : "Nenhum jogador encontrado.";
        }
      }, 300);
    }

    function handlePlayerSearchResultClick(e) {
      const btn = e.target.closest(".player-search-card");
      if (!btn) return;

      const name = btn.dataset.name || "";
      const target = state.playerSearchTarget;
      if (!target || !el[target]) return;

      el[target].value = name;
      closePlayerSearchModal();
    }

    function initPlayerSearchModule() {
      closePlayerSearchModal();

      document.querySelectorAll(".search-player-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = btn.dataset.target;
          openPlayerSearchModal(target);
        });
      });

      el.closePlayerSearchModalBtn?.addEventListener("click", closePlayerSearchModal);
      el.playerSearchModal?.addEventListener("click", (e) => {
        if (e.target === el.playerSearchModal) closePlayerSearchModal();
      });
      el.playerSearchInput?.addEventListener("input", handlePlayerSearchInput);
      el.playerSearchResults?.addEventListener("click", handlePlayerSearchResultClick);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && el.playerSearchModal && !el.playerSearchModal.classList.contains("hidden")) {
          closePlayerSearchModal();
        }
      });
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
    
        if (cfg.oneSetAdSuper) {
          const super1 = Number(el.tbSuperPlayer1?.value || 0);
          const super2 = Number(el.tbSuperPlayer2?.value || 0);
    
          history.push({
            games1: Number(set1.games1 || 0),
            games2: Number(set1.games2 || 0),
            tieBreakMode: "super10",
            tieBreakPoints1: super1,
            tieBreakPoints2: super2,
            lastTieBreakMode: "super10",
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
      
        const splitSets =
          (Number(el.set1Player1?.value || 0) > Number(el.set1Player2?.value || 0) &&
            Number(el.set2Player2?.value || 0) > Number(el.set2Player1?.value || 0)) ||
          (Number(el.set1Player2?.value || 0) > Number(el.set1Player1?.value || 0) &&
            Number(el.set2Player1?.value || 0) > Number(el.set2Player2?.value || 0));
      
        if (splitSets) {
          const super1 = Number(el.tbSuperPlayer1?.value || 0);
          const super2 = Number(el.tbSuperPlayer2?.value || 0);
      
          if (super1 > 0 || super2 > 0) {
            history.push({
              games1: 0,
              games2: 0,
              tieBreakMode: "super10",
              tieBreakPoints1: super1,
              tieBreakPoints2: super2
            });
          }
        }
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
        el.matchFormat.disabled = false;
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

      const superSet =
  [...history].reverse().find((s) => s?.tieBreakMode === "super10") ||
  [...history].reverse().find((s) =>
    s?.tieBreakMode === "tb7" &&
    ((Number(s?.tieBreakPoints1 || 0) > 0) || (Number(s?.tieBreakPoints2 || 0) > 0))
  );

if (el.tbSuperPlayer1) el.tbSuperPlayer1.value = superSet?.tieBreakPoints1 ?? "";
if (el.tbSuperPlayer2) el.tbSuperPlayer2.value = superSet?.tieBreakPoints2 ?? "";

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
        const shouldShow = isOwnedByCurrentUser || isLegacy;

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

      if (el.prevPageBtn) {
        const icon = el.prevPageBtn.querySelector(".admin-page-btn-icon ion-icon");
        const label = el.prevPageBtn.querySelector(".admin-page-btn-label");
        if (icon) icon.setAttribute("name", "chevron-back-outline");
        if (label) label.textContent = "Anterior";
      }

      if (el.nextPageBtn) {
        const icon = el.nextPageBtn.querySelector(".admin-page-btn-icon ion-icon");
        const label = el.nextPageBtn.querySelector(".admin-page-btn-label");
        if (icon) icon.setAttribute("name", "chevron-forward-outline");
        if (label) label.textContent = "Próximo";
      }
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

    function getSetDisplayFromHistory(setObj) {
      if (!setObj) return { text: "--" };
    
      const g1 = Number(setObj.games1 ?? 0);
      const g2 = Number(setObj.games2 ?? 0);
      const tb1 = Number(setObj.tieBreakPoints1 ?? 0);
      const tb2 = Number(setObj.tieBreakPoints2 ?? 0);
      const mode = String(setObj.tieBreakMode || "").trim();
      const finalLabel = String(setObj.finalLabel || "").trim();
    
      if (finalLabel) {
        return { text: finalLabel };
      }
    
      // Super tie-break:
      // - Se houver games salvos no set, mostrar como 7x6 (10-5) / 6x7 (10-5)
      // - Se não houver games, mostrar apenas o super tie-break
      if (mode === "super10" && (tb1 > 0 || tb2 > 0)) {
        const winnerIs1 = tb1 > tb2;
    
        if (g1 > 0 || g2 > 0) {
          return {
            text: `${winnerIs1 ? "7x6" : "6x7"} (${tb1}-${tb2})`
          };
        }
    
        return { text: `${tb1}-${tb2}` };
      }
    
      // Tie-break normal do set continua como 7x6 (7-6)
      if (mode === "tb7" && (tb1 > 0 || tb2 > 0)) {
        const winnerIs1 = tb1 > tb2;
        return { text: `${winnerIs1 ? "7x6" : "6x7"} (${tb1}-${tb2})` };
      }
    
      if (g1 > 0 || g2 > 0) {
        return { text: `${g1}x${g2}` };
      }
    
      return { text: "--" };
    }

    function cleanSetHistory(setHistory) {
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
        const display = getSetDisplayFromHistory(item).text;
        const norm = normalizeText(display);

        if (!norm || norm === "--") continue;
        if (seen.has(norm)) continue;

        seen.add(norm);
        cleaned.push(item);
      }

      return cleaned;
    }

    function renderGeneralBlock(d) {
      const teamHTML = U.getMatchDisplayHTML(d);
      const statusText = String(d?.status || "").trim().toLowerCase();
      const stageText = String(d?.tournamentStage || "").trim().toLowerCase();
      const situationLabel = statusText === "wo" ? "Finalizada por WO" : U.getStatusLabel(statusText);
      const woWinner = U.getWONumberOrName(d);
    
      const showCategory = stageText !== "treino";
      const showTournament = stageText !== "treino" && stageText !== "ranking";
    
      return `<section class="detail-section detail-section-general"> <div class="detail-section-header"> <h4>Dados gerais</h4> <span class="detail-section-subtitle">Informações da partida</span> </div> <div class="detail-info-grid"> <div class="detail-info-item"><span>Modalidade</span><strong>${U.escapeHtml(d.modality || "-")}</strong></div> <div class="detail-info-item"><span>Formato do jogo</span><strong>${U.escapeHtml(d.gameFormat || "-")}</strong></div> ${showCategory ? `<div class="detail-info-item"><span>Categoria</span><strong>${U.escapeHtml(d.categoryName || "-")}</strong></div>` : ""} ${showTournament ? `<div class="detail-info-item"><span>Torneio</span><strong>${U.escapeHtml(d.tournamentName || "-")}</strong></div>` : ""} <div class="detail-info-item"><span>Tipo de piso</span><strong>${U.escapeHtml(d.surfaceType || "-")}</strong></div> <div class="detail-info-item"><span>Formato</span><strong>${U.escapeHtml(U.formatMatchFormat(d.matchFormat || "-"))}</strong></div> <div class="detail-info-item"><span>Data e hora</span><strong>${U.escapeHtml(d.matchDateTime ? new Date(d.matchDateTime).toLocaleString("pt-BR") : "-")}</strong></div> <div class="detail-info-item"><span>Quadra</span><strong>${U.escapeHtml(d.court || "-")}</strong></div> <div class="detail-info-item"><span>Fase</span><strong>${U.escapeHtml(d.tournamentStage || "-")}</strong></div> <div class="detail-info-item"><span>Situação</span><strong>${U.escapeHtml(situationLabel)}</strong></div> <div class="detail-info-item"><span>Jogadores</span><strong style="white-space:pre-line;">${teamHTML}</strong></div> <div class="detail-info-item"><span>Vencedor por WO</span><strong>${U.escapeHtml(woWinner)}</strong></div> </div> </section>`;
    }

    function renderScoreBlock(d) {
      const score = U.normalizeScore(d.score || {});
      const history = Array.isArray(score.setHistory) ? score.setHistory : [];
    
      const parts = history
        .slice(0, 3)
        .map((setObj) => {
          const item = getSetDisplayFromHistory(setObj);
          return item?.text && item.text !== "--" ? item.text : null;
        })
        .filter(Boolean);
    
      const placar = parts.join(" • ");
    
      const duration = getMatchDuration(d);
      const status = String(d?.status || "").trim().toLowerCase();
      const isWO = status === "wo";
      const isRET = status === "ret";
    
      const winnerPos = U.getWinnerPosition(score, d);
      const teamHTML = U.getMatchDisplayHTML(d);
    
      let rowClass = "";
      let resultBadge = "";
      let cardClass = "detail-score-card single-score-card";
    
      if (winnerPos === 1) {
        rowClass = "winner-row";
        resultBadge = `<span class="winner-badge">VENCEU</span>`;
        cardClass += " score-winner";
      } else if (winnerPos === 2) {
        rowClass = "loser-row";
        resultBadge = `<span class="winner-badge loser-badge">PERDEU</span>`;
        cardClass += " score-loser";
      }
    
      return ` <section class="detail-section detail-section-score"> <div class="detail-section-header"> <h4>Placar</h4> <span class="detail-section-subtitle">Situação atual da partida</span> </div> <div class="${cardClass}"> <div class="detail-score-row ${rowClass}"> <div class="detail-player-title"> <span style="white-space:pre-line;">${teamHTML}</span> ${resultBadge} </div> <div class="detail-pill" style="margin-top:10px;"> <span>Placar da partida</span> <strong>${U.escapeHtml(placar || "--")}</strong> </div> ${ isWO ? ` <div class="detail-score-line" style="margin-top:10px;"> <span>Situação</span> <strong>FINALIZADA POR WO</strong> </div> ` : isRET ? ` <div class="detail-score-line" style="margin-top:10px;"> <span>Situação</span> <strong>FINALIZADA POR ABANDONO</strong> </div> ` : `` } </div> <div class="detail-pill" style="margin-top:12px;"> <span>Duração da partida</span> <strong>${U.escapeHtml(duration)}</strong> </div> </div> </section> `;
    }
    
    function renderFinalStatsBlock(d) {
      const stats = d?.stats || {};
      const p1 = stats.player1 || {};
      const p2 = stats.player2 || {};
      const score = U.normalizeScore(d?.score || {});
     
      const team1HTML = U.escapeHtml(U.getTeam1NameFromData(d));
      const team2HTML = U.escapeHtml(U.getTeam2NameFromData(d));

      const pct = (won, attempts) => {
        const a = Number(attempts || 0);
        const w = Number(won || 0);
        if (a <= 0) return "0.0%";
        return `${((w / a) * 100).toFixed(1)}%`;
      };

      const totalPoints1 = Number(score.totalPoints1 || p1.totalPointsWon || 0);
      const totalPoints2 = Number(score.totalPoints2 || p2.totalPointsWon || 0);

      const serve1Won1 = Number(p1.serve1Won || 0);
      const serve1Won2 = Number(p2.serve1Won || 0);
      const serve2Won1 = Number(p1.serve2Won || 0);
      const serve2Won2 = Number(p2.serve2Won || 0);

      const winner1 =
        Number(p1.winner || 0) +
        Number(p1.forehandWinner || 0) +
        Number(p1.backhandWinner || 0) +
        Number(p1.dropshotWinner || 0) +
        serve1Won1 +
        serve2Won1;

      const winner2 =
        Number(p2.winner || 0) +
        Number(p2.forehandWinner || 0) +
        Number(p2.backhandWinner || 0) +
        Number(p2.dropshotWinner || 0) +
        serve1Won2 +
        serve2Won2;

      const erro1 =
        Number(p1.erros || 0) +
        Number(p1.unforcedError || 0) +
        Number(p1.forcedError || 0) +
        Number(p1.dropshotError || 0) +
        Number(p1.pointsLost || 0);

      const erro2 =
        Number(p2.erros || 0) +
        Number(p2.unforcedError || 0) +
        Number(p2.forcedError || 0) +
        Number(p2.dropshotError || 0) +
        Number(p2.pointsLost || 0);

      const breakText1 = `${Number(score.breakPointsWon1 || p1.breakPointsWon || 0)}/${Number(score.breakPointsChances1 || p1.breakPointsChances || 0)}`;
      const breakText2 = `${Number(score.breakPointsWon2 || p2.breakPointsWon || 0)}/${Number(score.breakPointsChances2 || p2.breakPointsChances || 0)}`;

      const performanceText1 = Number(p1.serveSuccessPct || 0).toFixed(1) + "%";
      const performanceText2 = Number(p2.serveSuccessPct || 0).toFixed(1) + "%";

      const playerBlock = ( name, totalPoints, winnerTotal, erroTotal, s1Pct, s2Pct, performanceText, breakText ) => ` <div class="detail-summary-card detail-summary-card-vertical"> <div class="detail-player-title">${name}</div> <div class="detail-summary-line"> <span>Pontos totais</span> <strong>${totalPoints}</strong> </div> <div class="detail-summary-line"> <span>Winners</span> <strong>${winnerTotal}</strong> </div> <div class="detail-summary-line"> <span>Erros</span> <strong>${erroTotal}</strong> </div> <div class="detail-summary-line"> <span>Taxa do 1º serviço</span> <strong>${s1Pct}</strong> </div> <div class="detail-summary-line"> <span>Taxa do 2º serviço</span> <strong>${s2Pct}</strong> </div> <div class="detail-summary-line"> <span>Performance</span> <strong>${performanceText}</strong> </div> <div class="detail-summary-line"> <span>Break points</span> <strong>${breakText}</strong> </div> </div> `;

      return ` <section class="detail-section detail-section-final-stats"> <div class="detail-section-header"> <h4>Resumo da Partida</h4> <span class="detail-section-subtitle">Desempenho consolidado dos jogadores</span> </div> <div class="detail-summary-stack"> ${playerBlock( team1HTML, totalPoints1, winner1, erro1, pct(p1.serve1Won, p1.serve1Attempts), pct(p1.serve2Won, p1.serve2Attempts), performanceText1, breakText1 )} ${playerBlock( team2HTML, totalPoints2, winner2, erro2, pct(p2.serve1Won, p2.serve1Attempts), pct(p2.serve2Won, p2.serve2Attempts), performanceText2, breakText2 )} </div> </section> `;
    }

    function detailsHTML(d) {
      try {
        return `<div class="details-layout"> ${renderGeneralBlock(d)} ${renderScoreBlock(d)} ${renderFinalStatsBlock(d)} </div>`;
      } catch (err) {
        console.error("Erro ao montar detalhes:", err, d);
        return `<div class="details-layout"><p>Erro ao carregar os detalhes da partida.</p></div>`;
      }
    }

    function lockMatchFormatIfFinished() {
      if (!el.matchFormat) return;
      el.matchFormat.disabled = false;
    }

    function toggleFiltersBar() {
      state.filtersVisible = !state.filtersVisible;

      if (el.filtersBar) {
        el.filtersBar.style.display = state.filtersVisible ? "" : "none";

        if (state.filtersVisible) {
          setTimeout(() => {
            scrollToFiltersBar();
          }, 50);
        }
      }

      if (el.toggleMatchesBtnBottom) {
        const icon = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-icon ion-icon");
        const label = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-label");

        if (icon) {
          icon.setAttribute("name", state.filtersVisible ? "list-outline" : "search-outline");
        }

        if (label) {
          label.textContent = state.filtersVisible ? "Lista" : "Filtros";
        }
      }

      if (el.toggleMatchesBtn) {
        const icon = el.toggleMatchesBtn.querySelector(".admin-bottom-icon ion-icon");
        const label = el.toggleMatchesBtn.querySelector(".admin-bottom-label");

        if (icon) {
          icon.setAttribute("name", state.filtersVisible ? "list-outline" : "search-outline");
        }

        if (label) {
          label.textContent = state.filtersVisible ? "Lista" : "Filtros";
        }
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

      return ` <tr> <td> <div class="players-cell"> <strong style="display:block;line-height:1.15;"> ${U.getMatchDisplayHTML(d)} </strong> </div> </td> <td>${U.escapeHtml(d.gameFormat || "-")}</td> <td title="${U.escapeHtml(d.tournamentName || "-")}">${U.escapeHtml(d.tournamentName || "-")}</td> <td><span class="status-tag status-${statusText}">${U.escapeHtml(label)}</span></td> <td class="col-actions-center"> <div class="admin-actions action-cell"> <div class="action-top-row"> <button type="button" class="admin-action-btn icon-btn" data-action="open" data-id="${docSnap.id}" title="Jogo"> <span class="admin-action-icon"><ion-icon name="play-outline"></ion-icon></span> <span class="admin-action-label">Jogo</span> </button> <button type="button" class="admin-action-btn icon-btn" data-action="detail" data-id="${docSnap.id}" title="Detalhar"> <span class="admin-action-icon"><ion-icon name="reader-outline"></ion-icon></span> <span class="admin-action-label">Detalhar</span> </button> </div> <div class="action-bottom-row"> <button type="button" class="admin-action-btn icon-btn" data-action="edit" data-id="${docSnap.id}" title="Editar"> <span class="admin-action-icon"><ion-icon name="pencil-outline"></ion-icon></span> <span class="admin-action-label">Editar</span> </button> <button type="button" class="admin-action-btn icon-btn" data-action="confronto" data-id="${docSnap.id}" title="Confronto"> <span class="admin-action-icon"><ion-icon name="flash-outline"></ion-icon></span> <span class="admin-action-label">Confronto</span> </button> <button type="button" class="admin-action-btn icon-btn danger" data-action="delete" data-id="${docSnap.id}" title="Excluir"> <span class="admin-action-icon"><ion-icon name="trash-outline"></ion-icon></span> <span class="admin-action-label">Excluir</span> </button> </div> </div> </td> </tr> `;
    }

    function mobileCardHTML(docSnap) {
      const d = docSnap.data();
    
      const statusText = String(d.status || "scheduled")
        .trim()
        .toLowerCase();
    
      const date = d.matchDateTime
        ? new Date(d.matchDateTime).toLocaleString("pt-BR")
        : "-";
    
      const stage = String(d.tournamentStage || "").trim();
      const stageNormalized = U.normalizeText(stage);
    
      const tournamentName = String(d.tournamentName || "").trim();
      const categoryName = String(d.categoryName || "").trim();
    
      /* * Monta a linha: * * Ranking | Categoria * Treino * Torneio | Categoria | Final */
      const infoParts = [];
    
      if (stageNormalized === "treino") {
        infoParts.push("Treino");
      } else if (stageNormalized === "ranking") {
        infoParts.push("Ranking");
    
        if (categoryName) {
          infoParts.push(categoryName);
        }
      } else {
        if (tournamentName) {
          infoParts.push(tournamentName);
        }
    
        if (categoryName) {
          infoParts.push(categoryName);
        }
    
        if (stage) {
          infoParts.push(stage);
        }
      }
    
      const infoLine = infoParts.length
        ? infoParts.join(" | ")
        : "Partida";
    
      /* * Placar */
      const scoreText = getResultadoPartida(d);
    
      /* * Identifica o vencedor */
      const score = U.normalizeScore(d.score || {});
      const winnerPosition = U.getWinnerPosition(score, d);
    
      const team1Name = U.getTeam1NameFromData(d);
const team2Name = U.getTeam2NameFromData(d);

const isDoubles = U.isDoublesFormatValue(d.gameFormat);

const winnerVerb = isDoubles
  ? "venceram"
  : "venceu";

const winnerPhrase = (teamName, complement = "") => {
  return `${teamName} ${winnerVerb}${complement}`;
};

let winnerText = "Sem vencedor definido";
let winnerClass = "";

const winnerByWO = String(d.winnerByWO || "")
  .trim()
  .toLowerCase();

const winnerByRet = String(d.winnerByRet || "")
  .trim()
  .toLowerCase();

if (statusText === "wo") {
  if (winnerByWO === "player1") {
    winnerText = winnerPhrase(team1Name, " por WO");
    winnerClass = "winner";
  } else if (winnerByWO === "player2") {
    winnerText = winnerPhrase(team2Name, " por WO");
    winnerClass = "winner";
  } else {
    winnerText = "Finalizada por WO";
  }
} else if (statusText === "ret") {
  if (winnerByRet === "player1") {
    winnerText = winnerPhrase(team1Name, " por abandono");
    winnerClass = "winner";
  } else if (winnerByRet === "player2") {
    winnerText = winnerPhrase(team2Name, " por abandono");
    winnerClass = "winner";
  } else if (winnerPosition === 1) {
    winnerText = winnerPhrase(team1Name);
    winnerClass = "winner";
  } else if (winnerPosition === 2) {
    winnerText = winnerPhrase(team2Name);
    winnerClass = "winner";
  } else {
    winnerText = "Partida abandonada";
  }
} else if (winnerPosition === 1) {
  winnerText = winnerPhrase(team1Name);
  winnerClass = "winner";
} else if (winnerPosition === 2) {
  winnerText = winnerPhrase(team2Name);
  winnerClass = "winner";
} else if (statusText === "live") {
  winnerText = "Partida em andamento";
} else if (statusText === "scheduled") {
  winnerText = "Aguardando resultado";
}
    
      return ` <tr class="mobile-match-row"> <td colspan="5"> <article class="mobile-match-card status-${statusText}"> <!-- Jogadores --> <div class="mobile-match-line mobile-match-players-line"> <ion-icon name="people-outline"></ion-icon> <strong class="mobile-match-players-name"> ${U.getMatchDisplayHTMLMobile(d)} </strong> </div> <!-- Data e hora --> <div class="mobile-match-line"> <ion-icon name="calendar-outline"></ion-icon> <span>${U.escapeHtml(date)}</span> </div> <!-- Torneio / categoria / fase --> <div class="mobile-match-line mobile-match-info-line"> <ion-icon name="medal-outline"></ion-icon> <span>${U.escapeHtml(infoLine)}</span> </div> <!-- Placar --> <div class="mobile-match-line"> <ion-icon name="stats-chart-outline"></ion-icon> <span>${U.escapeHtml(scoreText)}</span> </div> <!-- Vencedor --> <div class="mobile-match-line mobile-match-winner-line ${winnerClass}"> <ion-icon name="trophy-outline"></ion-icon> <strong>${U.escapeHtml(winnerText)}</strong> </div> <!-- Ações --> <div class="mobile-match-actions"> <button type="button" class="admin-action-btn icon-btn" data-action="open" data-id="${docSnap.id}" title="Jogo" > <span class="admin-action-icon"> <ion-icon name="play-outline"></ion-icon> </span> <span class="admin-action-label">Jogo</span> </button> <button type="button" class="admin-action-btn icon-btn" data-action="detail" data-id="${docSnap.id}" title="Detalhar" > <span class="admin-action-icon"> <ion-icon name="reader-outline"></ion-icon> </span> <span class="admin-action-label">Detalhar</span> </button> <button type="button" class="admin-action-btn icon-btn" data-action="edit" data-id="${docSnap.id}" title="Editar" > <span class="admin-action-icon"> <ion-icon name="pencil-outline"></ion-icon> </span> <span class="admin-action-label">Editar</span> </button> <button type="button" class="admin-action-btn icon-btn" data-action="confronto" data-id="${docSnap.id}" title="Confronto" > <span class="admin-action-icon"> <ion-icon name="flash-outline"></ion-icon> </span> <span class="admin-action-label">Confronto</span> </button> <button type="button" class="admin-action-btn icon-btn danger" data-action="delete" data-id="${docSnap.id}" title="Excluir" > <span class="admin-action-icon"> <ion-icon name="trash-outline"></ion-icon> </span> <span class="admin-action-label">Excluir</span> </button> </div> </article> </td> </tr> `;
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

    function scrollToFirstCard() {
      const target =
        document.querySelector("#matchesSection") ||
        document.querySelector("#matchesTable") ||
        document.querySelector(".desktop-table") ||
        document.querySelector(".admin-table");

      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    

    function getResultadoPartida(d) {
      const score = U.normalizeScore(d?.score || {});
      const history = Array.isArray(score.setHistory) ? score.setHistory : [];

      if (!history.length) return "-";

      const parts = history
        .map((setObj) => {
          const item = getSetDisplayFromHistory(setObj);
          return item?.text && item.text !== "--" ? item.text : null;
        })
        .filter(Boolean);

      return parts.length ? parts.join(" • ") : "-";
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

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeAdminConfrontoModal();
        }
      });

      function onlyDigitsInput(e) {
        e.target.value = String(e.target.value || "").replace(/\D/g, "");
      }

      [
        el.set1Player1, el.set1Player2,
        el.set2Player1, el.set2Player2,
        el.set3Player1, el.set3Player2,
        el.tbSet1Player1, el.tbSet1Player2,
        el.tbSet2Player1, el.tbSet2Player2,
        el.tbSet3Player1, el.tbSet3Player2,
        el.tbSuperPlayer1, el.tbSuperPlayer2
      ].forEach(input => {
        if (input) input.addEventListener("input", onlyDigitsInput);
      });

      el.prevPageBtn?.addEventListener("click", () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderPagination();
          renderCurrentPage();
          setTimeout(() => {
            scrollToFirstCard();
          }, 50);
        }
      });

      el.nextPageBtn?.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderPagination();
          renderCurrentPage();
          setTimeout(() => {
            scrollToFirstCard();
          }, 50);
        }
      });

      function openAppModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove("hidden");
        modalEl.setAttribute("aria-hidden", "false");
      }

      function closeAppModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.add("hidden");
        modalEl.setAttribute("aria-hidden", "true");
      }

      function showConfirmModal(message) {
        return new Promise((resolve) => {
          const confirmModal = document.getElementById("confirmModal");
          const confirmModalMessage = document.getElementById("confirmModalMessage");
          const confirmModalYesBtn = document.getElementById("confirmModalYesBtn");
          const confirmModalNoBtn = document.getElementById("confirmModalNoBtn");

          if (!confirmModal || !confirmModalMessage || !confirmModalYesBtn || !confirmModalNoBtn) {
            resolve(window.confirm(message));
            return;
          }

          confirmModalMessage.textContent = message;
          openAppModal(confirmModal);

          const cleanup = () => {
            confirmModalYesBtn.removeEventListener("click", onYes);
            confirmModalNoBtn.removeEventListener("click", onNo);
            confirmModal.removeEventListener("click", onBackdrop);
            document.removeEventListener("keydown", onEscape);
          };

          const finish = (value) => {
            cleanup();
            closeAppModal(confirmModal);
            resolve(value);
          };

          const onYes = () => finish(true);
          const onNo = () => finish(false);
          const onBackdrop = (e) => {
            if (e.target === confirmModal) finish(false);
          };
          const onEscape = (e) => {
            if (e.key === "Escape") finish(false);
          };

          confirmModalYesBtn.addEventListener("click", onYes);
          confirmModalNoBtn.addEventListener("click", onNo);
          confirmModal.addEventListener("click", onBackdrop);
          document.addEventListener("keydown", onEscape);
        });
      }

      function showSuccessModal(message) {
        return new Promise((resolve) => {
          const successModal = document.getElementById("successModal");
          const successModalMessage = document.getElementById("successModalMessage");
          const successModalOkBtn = document.getElementById("successModalOkBtn");

          if (!successModal || !successModalMessage || !successModalOkBtn) {
            window.alert(message);
            resolve();
            return;
          }

          successModalMessage.textContent = message;
          openAppModal(successModal);

          const cleanup = () => {
            successModalOkBtn.removeEventListener("click", onOk);
            successModal.removeEventListener("click", onBackdrop);
            document.removeEventListener("keydown", onEscape);
          };

          const finish = () => {
            cleanup();
            closeAppModal(successModal);
            resolve();
          };

          const onOk = () => finish();
          const onBackdrop = (e) => {
            if (e.target === successModal) finish();
          };
          const onEscape = (e) => {
            if (e.key === "Escape") finish();
          };

          successModalOkBtn.addEventListener("click", onOk);
          successModal.addEventListener("click", onBackdrop);
          document.addEventListener("keydown", onEscape);
        });
      }

      el.form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const isEditing = Boolean(el.docId?.value);
        const confirmar = confirm(isEditing ? "Deseja alterar a partida?" : "Deseja cadastrar a partida?");
        if (!confirmar) {
          setMsg("Cadastro cancelado.");
          return;
        }

        setMsg("Salvando...");

        const selectedModality = "Tênis";
        const selectedGameFormat = String(el.gameFormat?.value || "").trim();
        const selectedFormat = String(el.matchFormat?.value || "").trim();
        const selectedSurface = String(el.surfaceType?.value || "").trim();
        const selectedStatus = String(el.status?.value || "").trim();

        if (!["Simples", "Duplas"].includes(selectedGameFormat)) return setMsg("Selecione um formato de jogo válido.");
        if (!ALLOWED_FORMATS_TENNIS.includes(selectedFormat)) return setMsg("Formato inválido para a modalidade selecionada.");
        if (!ALLOWED_SURFACES.includes(selectedSurface)) return setMsg("Selecione um tipo de piso válido.");

        const isDoubles = selectedGameFormat === "Duplas";
        const woWinner = String(el.winnerByWO?.value || "").trim();
        const player1Name = state.currentProfileName || state.currentUser?.displayName || "";
        const player2Name = String(el.player2?.value || "").trim();
        const player3Name = isDoubles ? String(el.player3?.value || "").trim() : "";
        const player4Name = isDoubles ? String(el.player4?.value || "").trim() : "";

        if (!player2Name) return setMsg("Informe o nome do jogador 2.");
        if (isDoubles && !player3Name) return setMsg("Informe o nome do jogador 3.");
        if (isDoubles && !player4Name) return setMsg("Informe o nome do jogador 4.");

        try {
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
            player2: player2Name,
            player3: player3Name,
            player4: player4Name,

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

            shareEnabled: true,
            shareToken: isEditing
              ? (previousData.shareToken || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Date.now()).slice(-8)))
              : (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Date.now()).slice(-8)),

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          };

          if (isEditing) {
            await ref.update(data);
            alert("Partida atualizada com sucesso!");
          } else {
            await __db.collection("matches").add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            alert("Partida cadastrada com sucesso!");
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
    showAdminStatsModal({
      id: snap.id,
      ...snap.data()
    });
  }

  return;
}

          if (action === "open") {
            window.location.href = buildPublicLink(id);
            return;
          }

          if (action === "confronto") {
            const snap = await ref.get();
          
            if (snap.exists) {
              showAdminConfrontoModal(
                snap.id,
                snap.data()
              );
            }
          
            return;
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

    function refreshList() {
      sortLocalMatches();
      applyFilters();

      if (!state.filteredMatches.length && state.currentUser) {
        const playerName = state.currentProfileName || state.currentUser?.displayName || "este usuário";
        setMsg(`Nenhuma partida encontrada para ${playerName}.`);
        if (el.tbody) el.tbody.innerHTML = renderEmpty(`Nenhuma partida encontrada para ${playerName}.`);
      }
    }

    function init() {
      if (state.initialized) return;
      state.initialized = true;

      bindEvents();
      attachResponsiveListeners();

      state.filtersVisible = false;
      if (el.filtersBar) el.filtersBar.style.display = "none";

      if (el.toggleMatchesBtnBottom) {
        const icon = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-icon ion-icon");
        const label = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-label");
        if (icon) icon.setAttribute("name", "search-outline");
        if (label) label.textContent = "Filtros";
      }

      if (el.toggleMatchesBtn) {
        const icon = el.toggleMatchesBtn.querySelector(".admin-bottom-icon ion-icon");
        const label = el.toggleMatchesBtn.querySelector(".admin-bottom-label");
        if (icon) icon.setAttribute("name", "search-outline");
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
      placeScoreBlockAfterStatus();

      initPlayerSearchModule();
      refreshList();
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => AdminApp.init());
})();
      
