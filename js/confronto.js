(() => {
  "use strict";

  const PAGE_SIZE = 5;

  const state = {
    currentPage: 1,
    items: [],
    currentFilter: "all",
    ownerProfilePhoto: "",
    opponentProfilePhoto: "",
    ownerProfile: null,
    opponentProfile: null,
    currentOwnerId: "",
    currentPlayer1: "",
    currentPlayer2: "",
    currentOpponentId: "",
    searchModal: null,
    searchInput: null,
    searchResults: null,
    searchStatus: null,
    searchTimeout: null,
    historicalPlayersCache: [],
    allOwnerMatches: [],
    currentProfileName: "",
    currentUser: null,
    matchId: "",
    matchDataFromUrl: null,
    h2hMode: false
  };

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function normalize(text = "") {
    return String(text)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function safeValue(value) {
    const v = String(value ?? "").trim();
    return v ? v : "-";
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "";
  }

  function show(el) {
    if (el) el.classList.remove("hidden");
  }

  function hide(el) {
    if (el) el.classList.add("hidden");
  }

  function samePair(a1, a2, b1, b2) {
    const A1 = normalize(a1);
    const A2 = normalize(a2);
    const B1 = normalize(b1);
    const B2 = normalize(b2);

    if (!A1 || !A2 || !B1 || !B2) return false;

    return (
      (A1 === B1 && A2 === B2) ||
      (A1 === B2 && A2 === B1)
    );
  }

  function getGameFormat(match) {
    return String(match?.gameFormat || "").trim().toLowerCase();
  }

  function isDoubles(match) {
    const gf = String(match?.gameFormat || "").trim().toLowerCase();
    return gf === "duplas" || gf === "duplas mistas";
  }

  function getWinner(data) {
    const status = String(data?.status || "").trim().toLowerCase();
    const score = data?.score || {};

    if (status === "wo") {
      const winnerByWO = String(data?.winnerByWO || "").trim().toLowerCase();
      if (winnerByWO === "player1") return 1;
      if (winnerByWO === "player2") return 2;
      return null;
    }

    if (status === "ret") {
      const winnerByRet = String(data?.winnerByRet || "").trim().toLowerCase();
      if (winnerByRet === "player1") return 1;
      if (winnerByRet === "player2") return 2;
      return null;
    }

    const s1 = Number(score.sets1 || 0);
    const s2 = Number(score.sets2 || 0);

    if (s1 > s2) return 1;
    if (s2 > s1) return 2;
    return null;
  }

  function getSetDisplayFromHistory(setObj) {
    if (!setObj) return "--";

    const g1 = Number(setObj.games1 ?? 0);
    const g2 = Number(setObj.games2 ?? 0);
    const tb1 = Number(setObj.tieBreakPoints1 ?? 0);
    const tb2 = Number(setObj.tieBreakPoints2 ?? 0);
    const mode = String(setObj.tieBreakMode || "").trim();

    if ((mode === "super10" || mode === "tb7") && (tb1 > 0 || tb2 > 0)) {
      const winnerIs1 = tb1 > tb2;
      return `${winnerIs1 ? "7x6" : "6x7"} (${tb1}-${tb2})`;
    }

    if (g1 > 0 || g2 > 0) {
      return `${g1}x${g2}`;
    }

    return "--";
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(d);
  }

  function getStatusIcon(status) {
    const s = normalize(status);
    if (s === "wo") return "close-circle-outline";
    if (s === "ret") return "hand-left-outline";
    return "checkmark-circle-outline";
  }

  function abbreviateFullName(name = "") {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "-";
    if (parts.length === 1) return parts[0];
    const first = parts[0].charAt(0).toUpperCase() + ".";
    const last = parts[parts.length - 1];
    return `${first} ${last}`;
  }

  function renderCountryFlag(countryValue = "") {
    const raw = String(countryValue || "").trim().toUpperCase();

    const map = {
      BR: "🇧🇷",
      BRA: "🇧🇷",
      PT: "🇵🇹",
      PRT: "🇵🇹",
      US: "🇺🇸",
      USA: "🇺🇸",
      UK: "🇬🇧",
      GBR: "🇬🇧",
      ES: "🇪🇸",
      ESP: "🇪🇸",
      FR: "🇫🇷",
      FRA: "🇫🇷",
      IT: "🇮🇹",
      ITA: "🇮🇹",
      AR: "🇦🇷",
      ARG: "🇦🇷",
      CL: "🇨🇱",
      CHI: "🇨🇱",
      CO: "🇨🇴",
      COL: "🇨🇴",
      DE: "🇩🇪",
      GER: "🇩🇪",
      AU: "🇦🇺",
      AUS: "🇦🇺",
      CA: "🇨🇦",
      CAN: "🇨🇦",
      MX: "🇲🇽",
      MEX: "🇲🇽"
    };

    const flag = map[raw];
    if (flag) return `${flag}`;
    return raw || "-";
  }

  function getMatchStatusLabel(data, winner, p1, p2) {
    const status = normalize(data?.status || "");

    const isDoublesMatch =
      normalize(data?.gameFormat || "") === "duplas" ||
      normalize(data?.gameFormat || "") === "duplas mistas" ||
      !!(data?.player3 || data?.player4 || data?.player3Name || data?.player4Name);

    const team1A = data?.player1 || data?.player1Name || p1 || "";
    const team1B = data?.player2 || data?.player2Name || p2 || "";
    const team2A = data?.player3 || data?.player3Name || "";
    const team2B = data?.player4 || data?.player4Name || "";

    const team1Label = isDoublesMatch
      ? `${abbreviateFullName(team1A)} / ${abbreviateFullName(team1B)}`
      : abbreviateFullName(team1A);

    const team2Label = isDoublesMatch
      ? `${abbreviateFullName(team2A)} / ${abbreviateFullName(team2B)}`
      : abbreviateFullName(team2A || p2 || "");

    if (status === "wo") {
      if (winner === 1) {
        return isDoublesMatch ? `WO — ${team1Label} venceram` : `WO — ${team1Label} venceu`;
      }
      if (winner === 2) {
        return isDoublesMatch ? `WO — ${team2Label} venceram` : `WO — ${team2Label} venceu`;
      }
      return "WO";
    }

    if (status === "ret") {
      if (winner === 1) {
        return isDoublesMatch ? `Desistência — ${team1Label} venceram` : `Desistência — ${team1Label} venceu`;
      }
      if (winner === 2) {
        return isDoublesMatch ? `Desistência — ${team2Label} venceram` : `Desistência — ${team2Label} venceu`;
      }
      return "Desistência";
    }

    if (winner === 1) {
      return isDoublesMatch ? `${team1Label} venceram` : `${team1Label} venceu`;
    }

    if (winner === 2) {
      return isDoublesMatch ? `${team2Label} venceram` : `${team2Label} venceu`;
    }

    return "Sem vencedor definido";
  }

  function buildMatchLine(data) {
    const isDoubleMatch =
      String(data?.gameFormat || "").trim().toLowerCase() === "duplas" ||
      String(data?.gameFormat || "").trim().toLowerCase() === "duplas mistas" ||
      !!(data?.player3 || data?.player4 || data?.player3Name || data?.player4Name);

    const p1 = data?.player1 || data?.player1Name || data?.ownerName || "Jogador 1";
    const p2 = data?.player2 || data?.player2Name || data?.opponentName || "Jogador 2";
    const p3 = data?.player3 || data?.player3Name || data?.player3FullName || "";
    const p4 = data?.player4 || data?.player4Name || data?.player4FullName || "";

    const p1Short = abbreviateFullName(p1);
    const p2Short = abbreviateFullName(p2);
    const p3Short = p3 ? abbreviateFullName(p3) : "";
    const p4Short = p4 ? abbreviateFullName(p4) : "";

    const score = data?.score || {};
    const history = Array.isArray(score.setHistory) ? score.setHistory : [];
    const status = String(data?.status || "").trim().toLowerCase();
    const date = formatDateTime(data?.matchDateTime);

    const setText = history
      .map(getSetDisplayFromHistory)
      .filter(t => t && t !== "--")
      .join(" • ");

    const winner = getWinner(data);
    const resultText = getMatchStatusLabel(data, winner, p1, p2);
    const statusIcon = getStatusIcon(status);

    const title = isDoubleMatch
      ? `${p1Short} / ${p2Short} x ${p3Short || "?"}${p3Short && p4Short ? " / " : ""}${p4Short || ""}`
      : `${p1Short} x ${p2Short}`;

    const scoreText = setText || `${safeValue(score.sets1 ?? 0)} x ${safeValue(score.sets2 ?? 0)}`;

    return ` <div class="match-item"> <div class="match-top"> <div class="match-players"> <ion-icon name="people-outline"></ion-icon> <span class="match-players-name">${title}</span> </div> </div> <div class="match-line"> <ion-icon name="trophy-outline"></ion-icon> <span class="match-score">${scoreText}</span> </div> <div class="match-line"> <ion-icon name="calendar-outline"></ion-icon> <span class="match-datetime">${date}</span> </div> <div class="match-line"> <ion-icon name="${statusIcon}"></ion-icon> <span class="match-status">${resultText}</span> </div> </div>`;
  }

  function getAvatarInitial(name = "") {
    const initial = String(name || "?").trim().charAt(0).toUpperCase();
    return initial || "?";
  }

  function normalizePhotoSrc(photo = "") {
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

  function getPhotoFromProfile(profile = {}, fallback = "") {
    const raw =
      profile?.photoBase64 ||
      profile?.photoURL ||
      profile?.photoUrl ||
      profile?.avatarUrl ||
      profile?.profilePhoto ||
      profile?.imageUrl ||
      profile?.photo ||
      profile?.foto ||
      fallback ||
      "";

    return normalizePhotoSrc(raw);
  }

  function setPlayerAvatar({ name, imgEl, placeholderEl, photoURL }) {
    const initial = getAvatarInitial(name);

    if (placeholderEl) {
      placeholderEl.textContent = initial;
      placeholderEl.style.display = "flex";
    }

    if (!imgEl) return;

    const url = normalizePhotoSrc(photoURL);

    if (!url) {
      imgEl.removeAttribute("src");
      hide(imgEl);
      show(placeholderEl);
      return;
    }

    imgEl.alt = name ? `Foto de ${name}` : "Foto do jogador";
    imgEl.src = url;

    imgEl.onload = () => {
      show(imgEl);
      hide(placeholderEl);
    };

    imgEl.onerror = () => {
      imgEl.removeAttribute("src");
      hide(imgEl);
      show(placeholderEl);
    };

    show(imgEl);
    hide(placeholderEl);
  }

  function getCurrentAuthUser() {
    try {
      if (typeof __auth !== "undefined" && __auth?.currentUser) {
        return __auth.currentUser;
      }

      if (typeof firebase !== "undefined" && firebase.auth) {
        return firebase.auth().currentUser;
      }
    } catch (err) {
      console.error("Erro ao obter usuário autenticado:", err);
    }

    return null;
  }

  function waitForAuthUser(timeoutMs = 7000) {
    return new Promise((resolve) => {
      const already = getCurrentAuthUser();
      if (already) return resolve(already);

      const start = Date.now();

      const timer = setInterval(() => {
        const user = getCurrentAuthUser();
        if (user) {
          clearInterval(timer);
          resolve(user);
          return;
        }

        if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, 200);
    });
  }

  function extractNamesFromMatchData(d = {}) {
    const rawNames = [
      d.player1,
      d.player2,
      d.player1Name,
      d.player2Name,
      d.ownerName,
      d.opponentName,
      d.winnerName,
      d.loserName,
      d.player1?.name,
      d.player2?.name,
      d.owner?.name,
      d.opponent?.name,
      d.players?.[0]?.name,
      d.players?.[1]?.name,
      d.players?.[0],
      d.players?.[1],
      d.team1?.player1,
      d.team1?.player2,
      d.team2?.player1,
      d.team2?.player2
    ];

    return rawNames
      .map((name) => String(name || "").trim())
      .filter((name) => !!normalize(name));
  }

  async function getLoggedUserProfile() {
    if (typeof __db === "undefined") return null;

    const authUser = getCurrentAuthUser();
    if (!authUser) return null;

    const authEmail = String(authUser.email || "").trim().toLowerCase();
    const authDisplayName = String(authUser.displayName || "").trim();
    const authUid = String(authUser.uid || "").trim();

    try {
      const collections = ["profiles", "users"];

      for (const col of collections) {
        const snap = await __db.collection(col).get();

        let exact = null;
        let fallback = null;

        snap.forEach((doc) => {
          const d = doc.data() || {};

          const docId = String(doc.id || "").trim();
          const uid = String(d.uid || "").trim();
          const ownerId = String(d.ownerId || "").trim();
          const email = String(d.email || "").trim().toLowerCase();
          const displayName = String(d.displayName || d.name || d.fullName || "").trim();
          const playerId = String(d.playerId || "").trim();

          const byUid =
            docId === authUid ||
            uid === authUid ||
            ownerId === authUid ||
            playerId === authUid;

          const byEmail =
            authEmail &&
            email &&
            email === authEmail;

          const byName =
            authDisplayName &&
            normalize(displayName) === normalize(authDisplayName);

          if (byUid || byEmail || byName) {
            exact = { id: doc.id, collection: col, ...d };
          } else if (!fallback && authDisplayName && normalize(displayName).includes(normalize(authDisplayName))) {
            fallback = { id: doc.id, collection: col, ...d };
          }
        });

        if (exact) return exact;
        if (fallback) return fallback;
      }
    } catch (err) {
      console.error("Erro ao buscar perfil do usuário logado:", err);
    }

    return null;
  }

  async function getOpponentProfile(identifier) {
    if (!identifier || typeof __db === "undefined") return null;

    try {
      const id = String(identifier).trim();
      const collections = ["profiles", "users"];

      for (const col of collections) {
        const snap = await __db.collection(col).get();
        let found = null;

        snap.forEach((doc) => {
          if (found) return;

          const d = doc.data() || {};
          const docId = String(doc.id || "").trim();
          const uid = String(d.uid || "").trim();
          const ownerId = String(d.ownerId || "").trim();
          const email = String(d.email || "").trim().toLowerCase();
          const displayName = String(d.displayName || d.name || d.fullName || "").trim();
          const playerId = String(d.playerId || "").trim();

          const matches =
            docId === id ||
            uid === id ||
            ownerId === id ||
            playerId === id ||
            normalize(displayName) === normalize(id) ||
            normalize(email) === normalize(id);

          if (matches) {
            found = { id: doc.id, collection: col, ...d };
          }
        });

        if (found) return found;
      }
    } catch (err) {
      console.error("Erro ao buscar perfil do adversário:", err);
    }

    return null;
  }

  async function findProfileByName(name) {
    if (!name || typeof __db === "undefined") return null;

    try {
      const query = normalize(name);
      const collections = ["profiles", "users"];

      for (const col of collections) {
        const snap = await __db.collection(col).get();

        let exact = null;
        let partial = [];

        snap.forEach((doc) => {
          const d = doc.data() || {};

          const displayName =
            d.displayName ||
            d.name ||
            d.fullName ||
            d.nome ||
            d.ownerName ||
            d.playerName ||
            "";

          const norm = normalize(displayName);
          if (!norm) return;

          if (norm === query) {
            exact = { id: doc.id, collection: col, ...d };
          } else if (norm.includes(query)) {
            partial.push({ id: doc.id, collection: col, ...d });
          }
        });

        if (exact) return exact;
        if (partial.length) return partial[0];
      }
    } catch (err) {
      console.error("Erro ao buscar perfil por nome:", err);
    }

    return null;
  }

  async function getPlayersFromMatches() {
    if (typeof __db === "undefined") return [];

    const map = new Map();

    try {
      const snap = await __db.collection("matches")
        .where("ownerId", "==", state.currentOwnerId)
        .get();

      snap.forEach((doc) => {
        const d = doc.data() || {};
        const names = extractNamesFromMatchData(d);

        names.forEach((name) => {
          const value = String(name || "").trim();
          const norm = normalize(value);
          if (!value || !norm) return;

          if (!map.has(norm)) {
            map.set(norm, {
              id: value,
              collection: "matches",
              displayName: value,
              name: value,
              photoBase64: ""
            });
          }
        });
      });
    } catch (err) {
      console.error("Erro ao ler jogadores de matches:", err);
    }

    return Array.from(map.values());
  }

  function dedupeProfilesByName(results = []) {
    const seen = new Set();

    return results.filter((item) => {
      const name = normalize(item.displayName || item.name || item.ownerName || "");
      if (!name) return false;

      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }

  async function searchProfilesByName(term) {
    if (!term || typeof __db === "undefined") return [];

    const query = normalize(term);
    const results = [];

    try {
      const collections = ["profiles", "users"];

      for (const col of collections) {
        const snap = await __db.collection(col).get();

        snap.forEach((doc) => {
          const d = doc.data() || {};

          const displayName =
            d.displayName ||
            d.name ||
            d.fullName ||
            d.nome ||
            d.ownerName ||
            d.playerName ||
            "";

          const norm = normalize(displayName);
          if (!norm) return;

          if (norm.includes(query) || query.includes(norm)) {
            results.push({
              id: doc.id,
              collection: col,
              ...d
            });
          }
        });
      }

      const historical = await getPlayersFromMatches();

      historical.forEach((p) => {
        const displayName = p.displayName || p.name || "";
        const norm = normalize(displayName);
        if (!norm) return;

        if (norm.includes(query) || query.includes(norm)) {
          results.push(p);
        }
      });
    } catch (err) {
      console.error("Erro ao pesquisar perfis:", err);
    }

    const seen = new Map();

    for (const item of results) {
      const displayName = normalize(item.displayName || item.name || item.ownerName || "");
      if (!displayName) continue;

      if (!seen.has(displayName)) {
        seen.set(displayName, item);
      } else {
        const current = seen.get(displayName);
        const currentScore = Object.keys(current || {}).length;
        const newScore = Object.keys(item || {}).length;

        if (newScore > currentScore) {
          seen.set(displayName, item);
        }
      }
    }

    return Array.from(seen.values());
  }

  function calculateAge(birthDate) {
    if (!birthDate) return "-";

    let d = birthDate;
    if (birthDate?.toDate) {
      d = birthDate.toDate();
    } else {
      d = new Date(birthDate);
    }

    if (isNaN(d.getTime())) return "-";

    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
      age--;
    }

    return Number.isFinite(age) && age >= 0 ? String(age) : "-";
  }

  function buildProfileStyleId(displayName = "", uid = "") {
    const name = normalize(displayName).replace(/[^a-z0-9]/g, "");
    const shortUid = String(uid || "").replace(/[^a-z0-9]/gi, "").slice(0, 4).toLowerCase();
    return `${name}_${shortUid}_id`;
  }

  function getPlayerMatchResult(match, playerName) {
    const nameNorm = normalize(playerName || "");
    if (!nameNorm) return null;

    const status = normalize(match.status || "");
    const gameFormat = String(match?.gameFormat || "").trim().toLowerCase();
    const isDoublesMatch =
      gameFormat === "duplas" ||
      gameFormat === "duplas mistas" ||
      !!(match?.player3 || match?.player4 || match?.player3Name || match?.player4Name);

    if (isDoublesMatch) {
      const team1A = normalize(match.player1 || match.player1Name || "");
      const team1B = normalize(match.player2 || match.player2Name || "");
      const team2A = normalize(match.player3 || match.player3Name || "");
      const team2B = normalize(match.player4 || match.player4Name || "");

      const playerInTeam1 = team1A === nameNorm || team1B === nameNorm;
      const playerInTeam2 = team2A === nameNorm || team2B === nameNorm;

      if (!playerInTeam1 && !playerInTeam2) return null;

      if (status === "wo") {
        const winnerByWO = normalize(match.winnerByWO || "");
        if (winnerByWO === "player1") return playerInTeam1 ? "win" : "loss";
        if (winnerByWO === "player2") return playerInTeam2 ? "win" : "loss";
        return null;
      }

      if (status === "ret") {
        const winnerByRet = normalize(match.winnerByRet || "");
        if (winnerByRet === "player1") return playerInTeam1 ? "win" : "loss";
        if (winnerByRet === "player2") return playerInTeam2 ? "win" : "loss";
        return null;
      }

      const score = match.score || {};
      const s1 = Number(score.sets1 || 0);
      const s2 = Number(score.sets2 || 0);

      if (s1 > s2) return playerInTeam1 ? "win" : "loss";
      if (s2 > s1) return playerInTeam2 ? "win" : "loss";

      return null;
    }

    const p1 = normalize(match.player1 || match.player1Name || match.ownerName || "");
    const p2 = normalize(match.player2 || match.player2Name || match.opponentName || "");

    const isPlayer1 = p1 === nameNorm;
    const isPlayer2 = p2 === nameNorm;

    if (!isPlayer1 && !isPlayer2) return null;

    if (status === "wo") {
      const wo = normalize(match.winnerByWO || "");
      if (wo === "player1") return isPlayer1 ? "win" : "loss";
      if (wo === "player2") return isPlayer2 ? "win" : "loss";
    }

    if (status === "ret") {
      const ret = normalize(match.winnerByRet || "");
      if (ret === "player1") return isPlayer1 ? "win" : "loss";
      if (ret === "player2") return isPlayer2 ? "win" : "loss";
    }

    const score = match.score || {};
    const s1 = Number(score.sets1 || 0);
    const s2 = Number(score.sets2 || 0);

    if (s1 > s2) return isPlayer1 ? "win" : "loss";
    if (s2 > s1) return isPlayer2 ? "win" : "loss";

    return null;
  }

  function isPlayerTournamentChampion(match, playerName) {
    const stage = normalize(match.tournamentStage || "");
    if (stage !== "final") return false;
    return getPlayerMatchResult(match, playerName) === "win";
  }

  function getPlayerStatsFromMatches(playerName) {
    const nameNorm = normalize(playerName || "");

    if (!nameNorm || !Array.isArray(state.allOwnerMatches) || !state.allOwnerMatches.length) {
      return {
        total: 0,
        wins: 0,
        losses: 0,
        titles: 0,
        winsPct: "0.0",
        lossesPct: "0.0"
      };
    }

    let wins = 0;
    let losses = 0;
    let titles = 0;
    let total = 0;

    state.allOwnerMatches.forEach((match) => {
      const status = String(match.status || "").trim().toLowerCase();
      if (status !== "finished" && status !== "wo" && status !== "ret") return;

      const gameFormat = String(match?.gameFormat || "").trim().toLowerCase();
      const isDoublesMatch =
        gameFormat === "duplas" ||
        gameFormat === "duplas mistas" ||
        !!(match?.player3 || match?.player4 || match?.player3Name || match?.player4Name);

      let appears = false;

      if (isDoublesMatch) {
        const team1A = normalize(match.player1 || match.player1Name || "");
        const team1B = normalize(match.player2 || match.player2Name || "");
        const team2A = normalize(match.player3 || match.player3Name || "");
        const team2B = normalize(match.player4 || match.player4Name || "");

        appears =
          team1A === nameNorm ||
          team1B === nameNorm ||
          team2A === nameNorm ||
          team2B === nameNorm;
      } else {
        const candidates = [
          match.player1,
          match.player2,
          match.player3,
          match.player4,
          match.player1Name,
          match.player2Name,
          match.ownerName,
          match.opponentName
        ]
          .map((v) => normalize(v || ""))
          .filter(Boolean);

        appears = candidates.some((p) =>
          p === nameNorm || p.includes(nameNorm) || nameNorm.includes(p)
        );
      }

      if (!appears) return;

      total++;

      const result = getPlayerMatchResult(match, playerName);
      if (result === "win") wins++;
      if (result === "loss") losses++;

      if (isPlayerTournamentChampion(match, playerName)) {
        titles++;
      }
    });

    const winsPct = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
    const lossesPct = total > 0 ? ((losses / total) * 100).toFixed(1) : "0.0";

    return {
      total,
      wins,
      losses,
      titles,
      winsPct,
      lossesPct
    };
  }

  function formatComparisonMeta(leftProfile = {}, rightProfile = {}, h2h = {}) {
    const leftCountryRaw = safeValue(leftProfile.country || leftProfile.countryName);
    const rightCountryRaw = safeValue(rightProfile.country || rightProfile.countryName);

    const leftCity = safeValue(leftProfile.city || leftProfile.cidade || leftProfile.cityName);
    const rightCity = safeValue(rightProfile.city || rightProfile.cidade || rightProfile.cityName);

    const leftAge = calculateAge(leftProfile.birthDate || leftProfile.dateOfBirth || leftProfile.nascimento || leftProfile.dob);
    const rightAge = calculateAge(rightProfile.birthDate || rightProfile.dateOfBirth || rightProfile.nascimento || rightProfile.dob);

    const leftHeight = safeValue(leftProfile.height || leftProfile.altura);
    const rightHeight = safeValue(rightProfile.height || rightProfile.altura);

    const leftWeight = safeValue(leftProfile.weight || leftProfile.peso);
    const rightWeight = safeValue(rightProfile.weight || rightProfile.peso);

    const leftForehand = safeValue(leftProfile.forehand || leftProfile.dominantHand || leftProfile.hand || leftProfile.maoDominante);
    const rightForehand = safeValue(rightProfile.forehand || rightProfile.dominantHand || rightProfile.hand || rightProfile.maoDominante);

    const leftBackhandRaw = safeValue(leftProfile.backhand || leftProfile.backhandStyle || leftProfile.tipoBackhand);
    const rightBackhandRaw = safeValue(rightProfile.backhand || rightProfile.backhandStyle || rightProfile.tipoBackhand);

    const leftBackhand =
      leftBackhandRaw === "duas_maos" ? "duas mãos" :
      leftBackhandRaw === "uma_mao" ? "uma mão" :
      leftBackhandRaw;

    const rightBackhand =
      rightBackhandRaw === "duas_maos" ? "duas mãos" :
      rightBackhandRaw === "uma_mao" ? "uma mão" :
      rightBackhandRaw;

    const leftName = leftProfile.displayName || leftProfile.name || leftProfile.fullName || "Jogador 1";
    const rightName = rightProfile.displayName || rightProfile.name || rightProfile.fullName || "Jogador 2";

    const leftStats = getPlayerStatsFromMatches(leftName);
    const rightStats = getPlayerStatsFromMatches(rightName);

    const h2hWins1 = Number(h2h.wins1 || 0);
    const h2hWins2 = Number(h2h.wins2 || 0);
    const h2hTotal = Math.max(1, h2hWins1 + h2hWins2);

    const pct1 = ((h2hWins1 / h2hTotal) * 100).toFixed(1);
    const pct2 = ((h2hWins2 / h2hTotal) * 100).toFixed(1);

    const rows = [
      ["Vitórias no histórico", String(h2hWins1), String(h2hWins2)],
      ["% do confronto", `${pct1}%`, `${pct2}%`],
      ["País", renderCountryFlag(leftCountryRaw), renderCountryFlag(rightCountryRaw)],
      ["Cidade", leftCity, rightCity],
      ["Idade", leftAge, rightAge],
      ["Altura", leftHeight, rightHeight],
      ["Peso", leftWeight, rightWeight],
      ["Mão dominante", leftForehand, rightForehand],
      ["Backhand", leftBackhand, rightBackhand],
      ["Partidas", String(leftStats.total), String(rightStats.total)],
      ["Vitórias", `${leftStats.wins} (${leftStats.winsPct}%)`, `${rightStats.wins} (${rightStats.winsPct}%)`],
      ["Derrotas", `${leftStats.losses} (${leftStats.lossesPct}%)`, `${rightStats.losses} (${rightStats.lossesPct}%)`],
      ["Títulos", String(leftStats.titles), String(rightStats.titles)]
    ];

    return rows.map(([label, left, right], index) => {
      const isTopRow = index === 0;
      const isPercentRow = index === 1;

      return ` <div class="confronto-comparison-row ${isTopRow ? "comparison-top-row" : ""} ${isPercentRow ? "comparison-percent-row" : ""}"> <div class="confronto-comparison-value left">${left}</div> <div class="confronto-comparison-label">${label}</div> <div class="confronto-comparison-value right">${right}</div> </div>`;
    }).join("");
  }

  function setCenterMeta(leftProfile, rightProfile, h2h = {}) {
    const metaEl = document.getElementById("centerProfileMeta");
    if (!metaEl) return;
    metaEl.innerHTML = formatComparisonMeta(leftProfile || {}, rightProfile || {}, h2h || {});
  }

  function renderPageItems(items) {
    const list = document.getElementById("confrontoMatchesList");
    if (!list) return;

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const start = (state.currentPage - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);

    if (pageItems.length) {
      list.innerHTML = pageItems.map(item => item.html).join("");
    } else {
      list.innerHTML = `<div class="confronto-empty">Nenhum jogo encontrado.</div>`;
    }

    setText("pageInfo", `Página ${state.currentPage} de ${totalPages}`);

    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;
  }

  function updateFilterButtons() {
    document.querySelectorAll(".confronto-filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === state.currentFilter);
    });
  }

  function applyFilter() {
    let filtered = [...state.items];

    if (state.currentFilter === "simples") {
      filtered = filtered.filter((m) => !isDoubles(m.data));
    } else if (state.currentFilter === "duplas") {
      filtered = filtered.filter((m) => isDoubles(m.data));
    }

    state.currentPage = 1;
    renderPageItems(filtered);

    setText(
      "matchesLabelSecondary",
      filtered.length ? `${filtered.length} jogo(s)` : "Nenhum jogo encontrado"
    );

    return filtered;
  }

  function updateUrlAndReloadOpponent(opponentProfile) {
    if (!opponentProfile) return;

    const params = new URLSearchParams(window.location.search);
    params.set("player2", opponentProfile.displayName || opponentProfile.name || "");
    if (opponentProfile.uid || opponentProfile.id || opponentProfile.playerId) {
      params.set("opponentId", opponentProfile.uid || opponentProfile.id || opponentProfile.playerId);
    } else {
      params.delete("opponentId");
    }

    window.location.search = params.toString();
  }

  function createSearchModalIfNeeded() {
    if (state.searchModal) return;

    const overlay = document.createElement("div");
    overlay.className = "confronto-search-modal hidden";
    overlay.id = "confrontoSearchModal";
    overlay.innerHTML = ` <div class="confronto-search-modal-card"> <div class="confronto-search-modal-head"> <div> <h3>Pesquisar adversário</h3> <p class="muted">Digite o nome para listar os jogadores encontrados.</p> </div> <button type="button" class="confronto-search-modal-close" id="closeSearchModalBtn">×</button> </div> <div class="confronto-search-modal-body"> <input type="text" id="searchOpponentInput" class="confronto-search-modal-input" placeholder="Digite o nome do adversário" autocomplete="off" /> <div id="searchOpponentStatus" class="confronto-search-modal-status muted"></div> <div id="searchOpponentResults" class="confronto-search-results"></div> </div> </div>`;

    document.body.appendChild(overlay);

    state.searchModal = overlay;
    state.searchInput = overlay.querySelector("#searchOpponentInput");
    state.searchResults = overlay.querySelector("#searchOpponentResults");
    state.searchStatus = overlay.querySelector("#searchOpponentStatus");

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSearchModal();
    });

    overlay.querySelector("#closeSearchModalBtn")?.addEventListener("click", closeSearchModal);

    state.searchInput?.addEventListener("input", () => {
      clearTimeout(state.searchTimeout);
      const term = state.searchInput.value.trim();

      state.searchTimeout = setTimeout(() => {
        runOpponentSearch(term);
      }, 250);
    });

    state.searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSearchModal();
    });
  }

  function openSearchModal() {
    createSearchModalIfNeeded();
    show(state.searchModal);

    if (state.searchInput) {
      state.searchInput.value = "";
      state.searchInput.focus();
    }

    if (state.searchStatus) {
      state.searchStatus.textContent = "Digite um nome para pesquisar.";
    }

    if (state.searchResults) {
      state.searchResults.innerHTML = "";
    }
  }

  function closeSearchModal() {
    if (!state.searchModal) return;
    hide(state.searchModal);
  }

  function getFullPlayerDisplay(profile, fallbackLabel) {
    const displayName =
      profile?.displayName ||
      profile?.name ||
      profile?.fullName ||
      profile?.ownerName ||
      profile?.playerName ||
      profile?.nome ||
      fallbackLabel ||
      "";

    return String(displayName).trim() || fallbackLabel || "Sem nome";
  }

  function renderSearchResults(results, currentOpponentId = "") {
    if (!state.searchResults) return;

    const cleanResults = dedupeProfilesByName(results || []);

    if (!cleanResults.length) {
      state.searchResults.innerHTML = `<div class="confronto-search-empty">Nenhum adversário encontrado.</div>`;
      return;
    }

    state.searchResults.innerHTML = cleanResults.map((profile, index) => {
      const displayName = getFullPlayerDisplay(profile, "Sem nome");
      const photo = getPhotoFromProfile(profile);
      const initials = getAvatarInitial(displayName);

      const uid =
        profile.uid ||
        profile.id ||
        profile.playerId ||
        profile.ownerId ||
        "";

      const selected = currentOpponentId && uid && uid === currentOpponentId ? "selected" : "";
      const idFormatted = buildProfileStyleId(displayName, uid);

      const country = safeValue(profile.country || profile.countryName);
      const city = safeValue(profile.city || profile.cidade || profile.cityName);
      const age = calculateAge(profile.birthDate || profile.dateOfBirth || profile.nascimento || profile.dob);

      return ` <button type="button" class="confronto-search-result ${selected}" data-index="${index}"> <div class="confronto-search-result-avatar"> ${photo ? `<img src="${photo}" alt="Foto de ${displayName}" />` : `<span>${initials}</span>`} </div> <div class="confronto-search-result-info"> <div class="confronto-search-result-name">${displayName}</div> <div class="confronto-search-result-meta"> <div><strong>ID:</strong> ${idFormatted}</div> <div><strong>País:</strong> ${country}</div> <div><strong>Cidade:</strong> ${city} - <strong>Idade:</strong> ${age}</div> </div> </div> </button>`;
    }).join("");

    state.searchResults.querySelectorAll(".confronto-search-result").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.index);
        const selected = cleanResults[index];
        closeSearchModal();
        updateUrlAndReloadOpponent(selected);
      });
    });
  }

  async function runOpponentSearch(term) {
    if (!state.searchStatus || !state.searchResults) return;

    const query = String(term || "").trim();
    if (!query) {
      state.searchStatus.textContent = "Digite um nome para pesquisar.";
      state.searchResults.innerHTML = "";
      return;
    }

    if (typeof __db === "undefined") {
      state.searchStatus.textContent = "Firebase não disponível.";
      return;
    }

    state.searchStatus.textContent = "Pesquisando...";
    state.searchResults.innerHTML = "";

    try {
      const results = dedupeProfilesByName(await searchProfilesByName(query));

      results.sort((a, b) => {
        const A = normalize(getFullPlayerDisplay(a, ""));
        const B = normalize(getFullPlayerDisplay(b, ""));
        return A.localeCompare(B);
      });

      state.searchStatus.textContent = results.length
        ? `${results.length} resultado(s) encontrado(s). Clique em um para trocar o adversário.`
        : "Nenhum adversário encontrado.";

      renderSearchResults(results, state.currentOpponentId);
    } catch (err) {
      console.error("Erro ao pesquisar adversário:", err);
      state.searchStatus.textContent = "Erro ao pesquisar adversário.";
      state.searchResults.innerHTML = "";
    }
  }

  function bindPlayerVisuals({ name, sideImgEl, sidePlaceholderEl, centerImgEl, centerPlaceholderEl, sideNameId, centerNameId, photoURL }) {
    setText(sideNameId, name);
    setText(centerNameId, name);

    setPlayerAvatar({
      name,
      imgEl: sideImgEl,
      placeholderEl: sidePlaceholderEl,
      photoURL
    });

    setPlayerAvatar({
      name,
      imgEl: centerImgEl,
      placeholderEl: centerPlaceholderEl,
      photoURL
    });
  }

  function calculateSimulationScore(stats = {}, h2hWins = 0, h2hTotal = 0) {
    const titles = Number(stats.titles || 0);
    const wins = Number(stats.wins || 0);
    const losses = Number(stats.losses || 0);
    const total = Number(stats.total || 0);

    const h2hFactor = h2hTotal > 0 ? (h2hWins / h2hTotal) : 0;

    const score =
      (titles * 10) +
      (h2hFactor * 6) +
      (wins * 3) +
      (losses * -2) +
      (total * 1);

    return Math.max(0, score);
  }

  function getSimulationVerdict(chance1, chance2, player1Name, player2Name) {
    const diff = Math.abs(chance1 - chance2);

    if (diff <= 7) {
      return "Confronto equilibrado";
    }

    const winner = chance1 > chance2 ? player1Name : player2Name;

    if (diff >= 18) {
      return `Favorito da partida: ${winner}`;
    }

    return `Leve vantagem para ${winner}`;
  }

  function animateSimulationBar(el, targetPercent, colorClass) {
    if (!el) return;

    el.classList.remove("bar-green", "bar-red", "bar-neutral");
    if (colorClass) el.classList.add(colorClass);

    requestAnimationFrame(() => {
      el.style.width = `${Math.max(0, Math.min(100, targetPercent))}%`;
    });
  }

  function renderSimulationResult(player1Name, player2Name, h2h = {}) {
    const card = document.getElementById("simulationResult");
    const name1El = document.getElementById("simPlayer1Name");
    const name2El = document.getElementById("simPlayer2Name");
    const chance1El = document.getElementById("simPlayer1Chance");
    const chance2El = document.getElementById("simPlayer2Chance");
    const detailsEl = document.getElementById("simulationDetails");
    const bar1 = document.getElementById("simBarPlayer1");
    const bar2 = document.getElementById("simBarPlayer2");
    const verdictEl = document.getElementById("simulationVerdict");

    if (!card || !name1El || !name2El || !chance1El || !chance2El || !detailsEl || !bar1 || !bar2 || !verdictEl) return;

    const stats1 = getPlayerStatsFromMatches(player1Name);
    const stats2 = getPlayerStatsFromMatches(player2Name);

    const h2hWins1 = Number(h2h.wins1 || 0);
    const h2hWins2 = Number(h2h.wins2 || 0);
    const h2hTotal = Math.max(1, h2hWins1 + h2hWins2);

    const score1 = calculateSimulationScore(stats1, h2hWins1, h2hTotal);
    const score2 = calculateSimulationScore(stats2, h2hWins2, h2hTotal);

    const totalScore = Math.max(1, score1 + score2);

    const chance1 = Number(((score1 / totalScore) * 100).toFixed(1));
    const chance2 = Number(((score2 / totalScore) * 100).toFixed(1));

    const winnerIs1 = chance1 > chance2;
    const diff = Math.abs(chance1 - chance2);

    name1El.textContent = player1Name;
    name2El.textContent = player2Name;
    chance1El.textContent = `${chance1.toFixed(1)}%`;
    chance2El.textContent = `${chance2.toFixed(1)}%`;

    verdictEl.textContent = getSimulationVerdict(chance1, chance2, player1Name, player2Name);
    detailsEl.innerHTML = "";

    show(card);

    bar1.style.width = "0%";
    bar2.style.width = "0%";

    if (chance1 === chance2) {
      animateSimulationBar(bar1, 50, "bar-neutral");
      animateSimulationBar(bar2, 50, "bar-neutral");
    } else if (winnerIs1) {
      animateSimulationBar(bar1, chance1, "bar-green");
      animateSimulationBar(bar2, chance2, "bar-red");
    } else {
      animateSimulationBar(bar1, chance1, "bar-red");
      animateSimulationBar(bar2, chance2, "bar-green");
    }

    verdictEl.classList.remove("verdict-equal", "verdict-green");
    if (diff <= 7) {
      verdictEl.classList.add("verdict-equal");
    } else {
      verdictEl.classList.add("verdict-green");
    }
  }

  function handleSimulateMatch() {
    const player1Name = state.currentPlayer1 || "Jogador 1";
    const player2Name = state.currentPlayer2 || "";

    if (!player2Name || player2Name === "Pesquisar adversário") {
      alert("Selecione um adversário antes de simular a partida.");
      return;
    }

    const h2h = {
      wins1: state.simWins1 || 0,
      wins2: state.simWins2 || 0
    };

    renderSimulationResult(player1Name, player2Name, h2h);
  }

  async function loadMatchFromUrl() {
    const matchId = getParam("matchId") || getParam("id");
    if (!matchId || typeof __db === "undefined") return null;

    try {
      const snap = await __db.collection("matches").doc(matchId).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    } catch (err) {
      console.error("Erro ao carregar partida da URL:", err);
      return null;
    }
  }

  function getNamesFromMatch(match) {
    const dbl = isDoubles(match);

    if (dbl) {
      const t1a = match.player1 || match.player1Name || "Jogador 1";
      const t1b = match.player2 || match.player2Name || "Jogador 2";
      const t2a = match.player3 || match.player3Name || "Jogador 3";
      const t2b = match.player4 || match.player4Name || "Jogador 4";

      return {
        player1: `${t1a}/${t1b}`,
        player2: `${t2a}/${t2b}`,
        doubles: true
      };
    }

    return {
      player1: match.player1 || match.player1Name || match.ownerName || "Jogador 1",
      player2: match.player2 || match.player2Name || match.opponentName || "Jogador 2",
      doubles: false
    };
  }

  async function init() {
    const player1 = getParam("player1");
    const player2 = getParam("player2");
    const opponentId = getParam("opponentId");
    const ownerIdFromUrl = getParam("ownerId");
    const matchId = getParam("matchId") || getParam("id");

    const subtitle = document.getElementById("confrontoSubtitle");
    const list = document.getElementById("confrontoMatchesList");
    const emptyState = document.getElementById("emptyState");

    const imgPlayer1Side = document.getElementById("imgPlayer1Side");
    const imgPlayer2Side = document.getElementById("imgPlayer2Side");
    const ph1Side = document.getElementById("player1AvatarPlaceholderSide");
    const ph2Side = document.getElementById("player2AvatarPlaceholderSide");

    const imgPlayer1Center = document.getElementById("imgPlayer1");
    const imgPlayer2Center = document.getElementById("imgPlayer2");
    const ph1Center = document.getElementById("player1AvatarPlaceholder");
    const ph2Center = document.getElementById("player2AvatarPlaceholder");

    const setInitialUi = () => {
      setText("player1NameSide", "Jogador 1");
      setText("player1NameCenter", "Jogador 1");
      setText("player2NameSide", "Pesquisar adversário");
      setText("player2NameCenter", "Jogador 2");
      setText("confrontoScore", "0 : 0");
      setText("matchesLabel", "Pesquise um adversário");
      setText("matchesLabelSecondary", "Nenhum confronto definido ainda");
      setText("pageInfo", "Página 1 de 1");

      if (list) {
        list.innerHTML = `<div class="confronto-empty">Nenhum confronto definido. Clique em <strong>Pesquisar adversário</strong> para iniciar.</div>`;
      }

      show(emptyState);
    };

    setInitialUi();

    if (typeof __db === "undefined") {
      if (subtitle) hide(subtitle);
      if (list) {
        list.innerHTML = `<div class="confronto-empty">Firebase não disponível nesta página.</div>`;
      }
      show(emptyState);
      return;
    }

    const authUser = await waitForAuthUser();
    state.currentUser = authUser || null;

    state.currentOwnerId = ownerIdFromUrl || authUser?.uid || "";
    state.currentPlayer1 = player1 || "";
    state.currentPlayer2 = player2 || "";
    state.currentOpponentId = opponentId || "";
    state.matchId = matchId || "";
    state.h2hMode = !!matchId;

    const hasDefinedOpponent = Boolean(player2 || opponentId);

    if (!state.currentOwnerId && !state.h2hMode) {
      if (subtitle) hide(subtitle);
      if (list) {
        list.innerHTML = `<div class="confronto-empty">Não foi possível identificar o usuário logado.</div>`;
      }
      show(emptyState);
      return;
    }

    try {
      let matchFromUrl = null;
      if (state.h2hMode) {
        matchFromUrl = await loadMatchFromUrl();
        state.matchDataFromUrl = matchFromUrl;

        if (matchFromUrl) {
          const names = getNamesFromMatch(matchFromUrl);

          state.currentPlayer1 = names.player1;
          state.currentPlayer2 = names.player2;
          state.currentOwnerId = matchFromUrl.ownerId || state.currentOwnerId || authUser?.uid || "";
          state.currentOpponentId = getParam("opponentId") || "";
        }
      }

      const snap = state.currentOwnerId
        ? await __db.collection("matches")
            .where("ownerId", "==", state.currentOwnerId)
            .get()
        : await __db.collection("matches").get();

      state.allOwnerMatches = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      let ownerProfile = await getLoggedUserProfile();
      if (!ownerProfile && player1) {
        ownerProfile = await findProfileByName(player1);
      }

      const resolvedPlayer1Name =
        state.currentPlayer1 ||
        player1 ||
        ownerProfile?.displayName ||
        ownerProfile?.name ||
        ownerProfile?.fullName ||
        authUser?.displayName ||
        "Jogador 1";

      state.currentPlayer1 = resolvedPlayer1Name;
      state.currentProfileName = resolvedPlayer1Name;

      const pageTitleEl = document.getElementById("pageTitle");
      if (pageTitleEl) {
        pageTitleEl.textContent = `Confrontos - ${resolvedPlayer1Name}`;
      }

      document.title = `Confrontos - ${resolvedPlayer1Name}`;

      if (!ownerProfile && authUser) {
        ownerProfile = {
          uid: authUser.uid || "",
          displayName: resolvedPlayer1Name,
          email: authUser.email || "",
          country: "-",
          city: "-",
          birthDate: null,
          height: "-",
          weight: "-",
          forehand: "-",
          backhand: "-",
          wins: 0,
          losses: 0,
          titles: 0
        };
      }

      let opponentProfile = null;
      let resolvedPlayer2Name = "Pesquisar adversário";

      if (state.h2hMode && state.matchDataFromUrl) {
        const names = getNamesFromMatch(state.matchDataFromUrl);
        resolvedPlayer2Name = names.player2 || "Jogador 2";
        state.currentPlayer2 = resolvedPlayer2Name;
      } else if (hasDefinedOpponent) {
        if (opponentId) {
          opponentProfile = await getOpponentProfile(opponentId);
        }

        if (!opponentProfile && player2) {
          opponentProfile = await findProfileByName(player2);
        }

        resolvedPlayer2Name =
          player2 ||
          opponentProfile?.displayName ||
          opponentProfile?.name ||
          opponentProfile?.fullName ||
          "Adversário";

        state.currentPlayer2 = resolvedPlayer2Name;
      } else {
        state.currentPlayer2 = "";
      }

      state.ownerProfile = ownerProfile;
      state.opponentProfile = opponentProfile;

      state.ownerProfilePhoto = getPhotoFromProfile(ownerProfile);
      state.opponentProfilePhoto = getPhotoFromProfile(opponentProfile);

      bindPlayerVisuals({
        name: resolvedPlayer1Name,
        sideImgEl: imgPlayer1Side,
        sidePlaceholderEl: ph1Side,
        centerImgEl: imgPlayer1Center,
        centerPlaceholderEl: ph1Center,
        sideNameId: "player1NameSide",
        centerNameId: "player1NameCenter",
        photoURL: state.ownerProfilePhoto
      });

      if (state.h2hMode && state.matchDataFromUrl) {
        bindPlayerVisuals({
          name: resolvedPlayer2Name,
          sideImgEl: imgPlayer2Side,
          sidePlaceholderEl: ph2Side,
          centerImgEl: imgPlayer2Center,
          centerPlaceholderEl: ph2Center,
          sideNameId: "player2NameSide",
          centerNameId: "player2NameCenter",
          photoURL: ""
        });
      } else if (hasDefinedOpponent) {
        bindPlayerVisuals({
          name: resolvedPlayer2Name,
          sideImgEl: imgPlayer2Side,
          sidePlaceholderEl: ph2Side,
          centerImgEl: imgPlayer2Center,
          centerPlaceholderEl: ph2Center,
          sideNameId: "player2NameSide",
          centerNameId: "player2NameCenter",
          photoURL: state.opponentProfilePhoto
        });
      } else {
        bindPlayerVisuals({
          name: "Pesquisar adversário",
          sideImgEl: imgPlayer2Side,
          sidePlaceholderEl: ph2Side,
          centerImgEl: imgPlayer2Center,
          centerPlaceholderEl: ph2Center,
          sideNameId: "player2NameSide",
          centerNameId: "player2NameCenter",
          photoURL: ""
        });
      }

      let items = [];
      let wins1 = 0;
      let wins2 = 0;

      if (state.h2hMode && state.matchDataFromUrl) {
        const d = state.matchDataFromUrl;
        const status = String(d.status || "").trim().toLowerCase();
        if (status === "finished" || status === "wo" || status === "ret") {
          const winner = getWinner(d);
          if (winner === 1) wins1++;
          if (winner === 2) wins2++;

          items.push({
            dateMs: d.matchDateTime ? new Date(d.matchDateTime).getTime() : 0,
            html: buildMatchLine(d),
            data: d
          });
        }
      } else {
        snap.forEach((doc) => {
          const d = doc.data() || {};

          const gameFormat = String(d.gameFormat || "").trim().toLowerCase();
          const isDoublesMatch = gameFormat === "duplas" || gameFormat === "duplas mistas";

          let pairMatches = false;

          if (isDoublesMatch) {
            const team1A = d.player1 || d.player1Name || "";
            const team1B = d.player2 || d.player2Name || "";
            const team2A = d.player3 || d.player3Name || "";
            const team2B = d.player4 || d.player4Name || "";

            const player1InTeam1 =
              normalize(team1A) === normalize(resolvedPlayer1Name) ||
              normalize(team1B) === normalize(resolvedPlayer1Name);

            const player1InTeam2 =
              normalize(team2A) === normalize(resolvedPlayer1Name) ||
              normalize(team2B) === normalize(resolvedPlayer1Name);

            pairMatches = player1InTeam1 || player1InTeam2;
          } else {
            const matchP1 = d.player1 || d.player1Name || d.ownerName || "";
            const matchP2 = d.player2 || d.player2Name || d.opponentName || "";
            pairMatches = samePair(matchP1, matchP2, resolvedPlayer1Name, resolvedPlayer2Name);
          }

          if (!pairMatches) return;

          const status = String(d.status || "").trim().toLowerCase();
          if (status !== "finished" && status !== "wo" && status !== "ret") return;

          const winner = getWinner(d);
          if (winner === 1) wins1++;
          if (winner === 2) wins2++;

          items.push({
            dateMs: d.matchDateTime ? new Date(d.matchDateTime).getTime() : 0,
            html: buildMatchLine(d),
            data: d
          });
        });

        items.sort((a, b) => b.dateMs - a.dateMs);
      }

      state.items = items;
      state.currentPage = 1;
      state.simWins1 = wins1;
      state.simWins2 = wins2;

      setText("confrontoScore", `${wins1} : ${wins2}`);
      setText(
        "matchesLabel",
        items.length ? `${items.length} jogo(s) encontrado(s)` : "Nenhum jogo encontrado"
      );
      setText(
        "matchesLabelSecondary",
        items.length ? `${items.length} jogo(s)` : "Nenhum jogo encontrado"
      );

      const filtered = applyFilter();
      renderPageItems(filtered);

      setCenterMeta(ownerProfile || {}, opponentProfile || {}, {
        wins1,
        wins2
      });

      if (!items.length) {
        if (list) {
          list.innerHTML = `<div class="confronto-empty">Nenhum jogo finalizado entre esses jogadores.</div>`;
        }
        show(emptyState);
      } else {
        hide(emptyState);
      }

      const historical = await getPlayersFromMatches();
      state.historicalPlayersCache = historical;
    } catch (err) {
      console.error("Erro ao carregar confronto:", err);
      if (subtitle) hide(subtitle);
      if (list) {
        list.innerHTML = `<div class="confronto-empty">Não foi possível carregar os dados do confronto.</div>`;
      }
      show(emptyState);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("btnSearchOpponent")?.addEventListener("click", () => {
      openSearchModal();
    });

    document.getElementById("btnSimulateMatch")?.addEventListener("click", handleSimulateMatch);

    document.querySelectorAll(".confronto-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.currentFilter = btn.dataset.filter || "all";
        state.currentPage = 1;
        updateFilterButtons();
        const filtered = applyFilter();
        renderPageItems(filtered);
      });
    });

    updateFilterButtons();
    await init();

    document.getElementById("prevPageBtn")?.addEventListener("click", () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        const filtered = applyFilter();
        renderPageItems(filtered);
      }
    });

    document.getElementById("nextPageBtn")?.addEventListener("click", () => {
      const filtered = applyFilter();
      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderPageItems(filtered);
      }
    });
  });
})();
