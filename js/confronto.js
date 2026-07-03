(() => {
  "use strict";

  const PAGE_SIZE = 5;

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
    currentProfileName: ""
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

  function getGameFormat(match) {
    return String(match?.gameFormat || "").trim().toLowerCase();
  }

  function isDoubles(match) {
    const gf = getGameFormat(match);
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

  function buildMatchLine(data) {
    const isDoubleMatch =
      String(data?.gameFormat || "").trim().toLowerCase() === "duplas" ||
      String(data?.gameFormat || "").trim().toLowerCase() === "duplas mistas" ||
      !!(data?.player3 || data?.player4 || data?.player3Name || data?.player4Name);

    const p1 = data?.player1 || data?.player1Name || data?.ownerName || "Jogador 1";
    const p2 = data?.player2 || data?.player2Name || data?.opponentName || "Jogador 2";
    const p3 = data?.player3 || data?.player3Name || data?.player3FullName || data?.team1?.player1 || "";
    const p4 = data?.player4 || data?.player4Name || data?.player4FullName || data?.team2?.player2 || "";

    const score = data?.score || {};
    const history = Array.isArray(score.setHistory) ? score.setHistory : [];
    const status = String(data?.status || "").trim().toLowerCase();
    const date = data?.matchDateTime ? new Date(data.matchDateTime).toLocaleString("pt-BR") : "-";

    const setText = history
      .map(getSetDisplayFromHistory)
      .filter(t => t && t !== "--")
      .join(" • ");

    const winner = getWinner(data);

    let resultText = "Sem vencedor";
    if (winner === 1) resultText = `${p1} venceu`;
    if (winner === 2) resultText = `${p2} venceu`;

    if (status === "wo") {
      resultText = winner
        ? `Finalizada por WO • ${winner === 1 ? p1 : p2} venceu`
        : "Finalizada por WO";
    }

    if (status === "ret") {
      resultText = winner
        ? `Finalizada por desistência • ${winner === 1 ? p1 : p2} venceu`
        : "Finalizada por desistência";
    }

    const title = isDoubleMatch
      ? `${p1} / ${p2}${p3 || p4 ? ` x ${p3 || ""}${p3 && p4 ? " / " : ""}${p4 || ""}` : ""}`
      : `${p1} vs ${p2}`;

    return ` <div class="confronto-match-row"> <div class="confronto-match-main"> <div class="confronto-match-title">${title}</div> <div class="confronto-match-score">${setText || "--"}</div> </div> <div class="confronto-match-meta"> <span>${date}</span> <span>${resultText}</span> </div> </div> `;
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
      console.warn("Falha ao carregar foto do jogador:", url);
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

  function getStoredWinsLossesTitles(profile = {}) {
    const winsRaw = profile.wins ?? profile.vitorias ?? profile["vitórias"];
    const lossesRaw = profile.losses ?? profile.derrotas;
    const titlesRaw = profile.titles ?? profile.titulos ?? profile["títulos"];

    const normalizeStored = (value) => {
      const v = String(value ?? "").trim();
      if (!v || v === "-") return null;
      return v;
    };

    return {
      wins: normalizeStored(winsRaw),
      losses: normalizeStored(lossesRaw),
      titles: normalizeStored(titlesRaw)
    };
  }

  function getPlayerMatchResult(match, playerName) {
    const nameNorm = normalize(playerName || "");
    if (!nameNorm) return null;

    const p1 = normalize(match.player1 || match.player1Name || match.ownerName || "");
    const p2 = normalize(match.player2 || match.player2Name || match.opponentName || "");

    const isPlayer1 = p1 === nameNorm;
    const isPlayer2 = p2 === nameNorm;

    if (!isPlayer1 && !isPlayer2) return null;

    const status = normalize(match.status || "");

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

  function isTournamentChampionLoss(match, playerName) {
    const stage = normalize(match.tournamentStage || "");
    if (stage !== "final") return false;
    return getPlayerMatchResult(match, playerName) === "loss";
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

      const appears = candidates.some((p) =>
        p === nameNorm || p.includes(nameNorm) || nameNorm.includes(p)
      );

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

  function formatPlayerMeta(profile = {}, mode = "full") {
    if (!profile) profile = {};

    const country = safeValue(profile.country || profile.countryName);
    const city = safeValue(profile.city || profile.cidade);
    const age = calculateAge(profile.birthDate || profile.dateOfBirth || profile.nascimento || profile.dob);

    const height = safeValue(profile.height || profile.altura);
    const weight = safeValue(profile.weight || profile.peso);

    const forehand = safeValue(profile.forehand || profile.dominantHand || profile.hand || profile.maoDominante);
    const backhandRaw = safeValue(profile.backhand || profile.backhandStyle || profile.tipoBackhand);
    const backhand =
      backhandRaw === "duas_maos" ? "duas mãos" :
      backhandRaw === "uma_mao" ? "uma mão" :
      backhandRaw;

    const playerName = profile.displayName || profile.name || profile.fullName || "";
    const stats = getPlayerStatsFromMatches(playerName);

    const computedId = buildProfileStyleId(
      playerName,
      profile.uid || profile.id || profile.playerId || profile.ownerId || ""
    );

    if (mode === "summary") {
      return ` <div class="confronto-summary-line"> <strong>ID:</strong> ${safeValue(computedId)} - <strong>País:</strong> ${country} </div> <div class="confronto-summary-line"> <strong>Cidade:</strong> ${city} - <strong>Idade:</strong> ${age} </div> `;
    }

    const rows = [
      { label: "País", value: country },
      { label: "Cidade", value: city },
      { label: "Idade", value: age },
      { label: "Altura", value: height },
      { label: "Peso", value: weight },
      { label: "Mão dominante", value: forehand },
      { label: "Backhand", value: backhand },
      { label: "Total de Partidas", value: `${stats.total}` },
      { label: "Vitórias", value: `${stats.wins} (${stats.winsPct}%)` },
      { label: "Derrotas", value: `${stats.losses} (${stats.lossesPct}%)` },
      { label: "Títulos", value: `${stats.titles}` }
    ];

    return rows.map(item => ` <div class="confronto-meta-row"> <span class="confronto-meta-label">${item.label}:</span> <span class="confronto-meta-value">${item.value}</span> </div> `).join("");
  }

  function setPlayerMeta(id, profile, mode = "full") {
    const metaEl = document.getElementById(id);
    if (!metaEl) return;

    metaEl.innerHTML = formatPlayerMeta(profile, mode);
    metaEl.style.display = "block";
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

  function updateFilterButtons() {
    document.querySelectorAll(".confronto-filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === state.currentFilter);
    });
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
    overlay.innerHTML = ` <div class="confronto-search-modal-card"> <div class="confronto-search-modal-head"> <div> <h3>Pesquisar adversário</h3> <p class="muted">Digite o nome para listar os jogadores encontrados.</p> </div> <button type="button" class="confronto-search-modal-close" id="closeSearchModalBtn">×</button> </div> <div class="confronto-search-modal-body"> <input type="text" id="searchOpponentInput" class="confronto-search-modal-input" placeholder="Digite o nome do adversário" autocomplete="off" /> <div id="searchOpponentStatus" class="confronto-search-modal-status muted"></div> <div id="searchOpponentResults" class="confronto-search-results"></div> </div> </div> `;

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
      const city = safeValue(profile.city || profile.cidade);
      const age = calculateAge(profile.birthDate || profile.dateOfBirth || profile.nascimento || profile.dob);

      return ` <button type="button" class="confronto-search-result ${selected}" data-index="${index}"> <div class="confronto-search-result-avatar"> ${photo ? `<img src="${photo}" alt="Foto de ${displayName}" />` : `<span>${initials}</span>`} </div> <div class="confronto-search-result-info"> <div class="confronto-search-result-name">${displayName}</div> <div class="confronto-search-result-meta"> <div><strong>ID:</strong> ${idFormatted}</div> <div><strong>País:</strong> ${country}</div> <div><strong>Cidade:</strong> ${city} - <strong>Idade:</strong> ${age}</div> </div> </div> </button> `;
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

  function isMatchForLoggedUser(match, currentUser) {
    const ownerId = String(match.ownerId || "").trim();
    return Boolean(currentUser && ownerId && ownerId === currentUser.uid);
  }

  function getOwnerNameInMatch(match) {
    const ownerName = String(match.ownerName || "").trim();
    if (ownerName) return ownerName;
    return state.currentProfileName || "";
  }

  function getLoggedUserOutcome(match) {
    const winnerPos = getWinner(match);
    if (!winnerPos) return "unknown";

    const ownerId = String(match.ownerId || "").trim();
    const isOwner = state.currentUser && ownerId === state.currentUser.uid;
    if (!isOwner) return "unknown";

    const ownerName = normalize(getOwnerNameInMatch(match));
    const currentName = normalize(state.currentProfileName || "");
    const p1 = normalize(match.player1 || "");
    const p2 = normalize(match.player2 || "");

    const ownerIsP1 = p1 === ownerName || p1 === currentName;
    const ownerIsP2 = p2 === ownerName || p2 === currentName;

    if (winnerPos === 1) return ownerIsP1 ? "win" : "loss";
    if (winnerPos === 2) return ownerIsP2 ? "win" : "loss";
    return "unknown";
  }

  function getResultType(match) {
    const status = normalize(match.status);
    if (status === "wo") return "WO";
    if (status === "ret") return "RET";
    return "";
  }

  function isTournamentMatch(match) {
    const stage = normalize(match.tournamentStage);
    return TOURNAMENT_STAGES.has(stage);
  }

  function isFinalMatch(match) {
    const stage = normalize(match.tournamentStage);
    return stage === "final";
  }

  function getTournamentSituation(match) {
    if (!isTournamentMatch(match)) return "";
    if (!isFinalMatch(match)) return "";

    const outcome = getLoggedUserOutcome(match);
    if (outcome === "win") return "champion";
    if (outcome === "loss") return "runnerup";
    return "";
  }

  function renderSummary(matches) {
    const total = matches.length;

    const playerName = state.currentPlayer1 || state.currentProfileName || "";

    let wins = 0;
    let losses = 0;
    let wo = 0;
    let ranking = 0;
    let training = 0;
    let simple = 0;
    let doubles = 0;

    matches.forEach((m) => {
      const status = normalize(m.status);
      if (status === "wo" || status === "ret") wo++;

      const result = getPlayerMatchResult(m, playerName);
      if (result === "win") wins++;
      if (result === "loss") losses++;

      const stage = normalize(m.tournamentStage || "");
      if (stage === "ranking") ranking++;
      if (stage === "treino") training++;

      const gf = normalize(getGameFormat(m));
      if (gf === "simples") simple++;
      if (gf === "duplas" || gf === "duplas mistas") doubles++;
    });

    const tournaments = new Set();
    let champion = 0;
    let runnerup = 0;

    matches.forEach((m) => {
      const stage = normalize(m.tournamentStage || "");
      if (!TOURNAMENT_STAGES.has(stage)) return;

      const tournamentName = normalize(String(m.tournamentName || "").trim());
      const year = m.matchDateTime ? (new Date(m.matchDateTime).getFullYear() || "") : "";
      const gameFormat = normalize(getGameFormat(m));
      const tournamentKey = `${tournamentName || "sem-nome"}::${year}::${gameFormat || "sem-formato"}`;
      tournaments.add(tournamentKey);

      if (isPlayerTournamentChampion(m, playerName)) champion++;
      if (isTournamentChampionLoss(m, playerName)) runnerup++;
    });

    const totalPlayed = wins + losses;
    const winPct = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0;
    const lossPct = totalPlayed > 0 ? Math.round((losses / totalPlayed) * 100) : 0;

    setText("totalMatches", String(total));
    setText("totalWins", `${wins} - ${winPct}%`);
    setText("totalLosses", `${losses} - ${lossPct}%`);
    setText("totalWo", String(wo));
    setText("totalTournaments", String(tournaments.size));
    setText("totalChampion", String(champion));
    setText("totalRunnerup", String(runnerup));
    setText("totalRanking", String(ranking));
    setText("totalTraining", String(training));
    setText("totalSimple", String(simple));
    setText("totalDoubles", String(doubles));

    const player = state.currentProfileName || "Usuário";
    const pageTitle = document.getElementById("pageTitle");
    const subtitle = document.getElementById("subtitle");
    const summaryMessage = document.getElementById("summaryMessage");

    if (pageTitle) pageTitle.textContent = `Carreira - ${player}`;
    if (subtitle) subtitle.textContent = "Histórico de partidas finalizadas do usuário";

    if (summaryMessage) {
      summaryMessage.textContent = total
        ? `Exibindo ${total} partidas finalizadas de ${player}.`
        : `Nenhuma partida finalizada encontrada para ${player}.`;
    }
  }

  function renderPagedHistory(matches) {
    const list = document.getElementById("confrontoMatchesList");
    if (!list) return;

    const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const start = (state.currentPage - 1) * PAGE_SIZE;
    const pageItems = matches.slice(start, start + PAGE_SIZE);

    if (!pageItems.length) {
      list.innerHTML = `<div class="confronto-empty">Nenhum jogo encontrado.</div>`;
    } else {
      list.innerHTML = pageItems
        .map((m) => {
          const d = m;
          const date = d.matchDateTime
            ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(d.matchDateTime))
            : "-";

          const gameFormat = safeValue(getGameFormat(d));
          const tournament = safeValue(d.tournamentName || "-");
          const stage = safeValue(d.tournamentStage || "-");
          const score = safeValue(d.score ? `${d.score.sets1 || 0}x${d.score.sets2 || 0}` : "--");
          const outcome = getPlayerMatchResult(d, state.currentPlayer1 || state.currentProfileName);
          const situation = isPlayerTournamentChampion(d, state.currentPlayer1 || state.currentProfileName) ? "champion" : "";
          const resultType = normalize(d.status || "");
          const isWinner = outcome === "win";
          const isTreino = normalize(d.tournamentStage || "") === "treino";

          const cardClass = isWinner
            ? "career-card career-card-win"
            : "career-card career-card-loss";

          const stageNorm = normalize(d.tournamentStage || "");
          const isTournament = TOURNAMENT_STAGES.has(stageNorm);

          const situationLabel =
            isTournament && stageNorm === "final"
              ? situation === "champion"
                ? "🏆 Campeão"
                : situation === "runnerup"
                ? "🥈 Vice-Campeão"
                : ""
              : "";

          const outcomeLabel =
            resultType === "wo"
              ? (isWinner ? "VITÓRIA POR WO" : "DERROTA POR WO")
              : resultType === "ret"
              ? (isWinner ? "VITÓRIA POR ABANDONO" : "DERROTA POR ABANDONO")
              : (situationLabel || (isWinner ? "VITÓRIA" : "DERROTA"));

          const teamDisplay = buildMatchLine(d);

          const formatIcon = (() => {
            const format = normalize(gameFormat);
            if (format === "simples") {
              return `<span class="career-match-icon format">🎾</span>`;
            }
            if (format === "duplas" || format === "duplas mistas") {
              return `<span class="career-match-icon format">👥</span>`;
            }
            return "";
          })();

          return ` <article class="${cardClass}"> <div class="career-card-top-icons"> ${formatIcon ? `<span class="career-card-icon-slot format-slot">${formatIcon}</span>` : ""} </div> <div class="career-card-top-status"> <div class="career-card-result">${outcomeLabel}</div> </div> <div class="career-card-head"> <div class="career-card-title">${teamDisplay}</div> </div> <div class="career-grid"> <div class="career-item"><span>Data</span><strong>${safeValue(date)}</strong></div> <div class="career-item"><span>Formato do jogo</span><strong>${gameFormat}</strong></div> ${!isTreino ? `<div class="career-item"><span>Torneio</span><strong>${tournament}</strong></div>` : ""} ${!isTreino ? `<div class="career-item"><span>Fase</span><strong>${stage}</strong></div>` : ""} <div class="career-item"><span>Placar</span><strong>${score}</strong></div> </div> </article> `;
        })
        .join("");
    }

    const pageInfo = document.getElementById("pageInfo");
    if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;

    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;
  }

  function applyFiltersAndRender() {
    const player = state.currentPlayer1 || state.currentProfileName || "";
    const { gameFormat, tournament, stage, year } = getFilters();

    let filtered = state.allOwnerMatches.filter((m) =>
      isMatchForLoggedUser(m, state.currentUser)
    );

    if (state.currentFilter === "wins") {
      filtered = filtered.filter((m) => getPlayerMatchResult(m, player) === "win");
    } else if (state.currentFilter === "losses") {
      filtered = filtered.filter((m) => getPlayerMatchResult(m, player) === "loss");
    } else if (state.currentFilter === "champion") {
      filtered = filtered.filter((m) => isPlayerTournamentChampion(m, player));
    } else if (state.currentFilter === "runnerup") {
      filtered = filtered.filter((m) => isTournamentChampionLoss(m, player));
    } else if (state.currentFilter === "tournaments") {
      filtered = filtered.filter((m) =>
        TOURNAMENT_STAGES.has(normalize(m.tournamentStage || ""))
      );
    } else if (state.currentFilter === "ranking") {
      filtered = filtered.filter((m) =>
        normalize(m.tournamentStage || "") === "ranking"
      );
    } else if (state.currentFilter === "training") {
      filtered = filtered.filter((m) =>
        normalize(m.tournamentStage || "") === "treino"
      );
    } else if (state.currentFilter === "simple") {
      filtered = filtered.filter((m) => normalize(getGameFormat(m)) === "simples");
    } else if (state.currentFilter === "doubles") {
      filtered = filtered.filter((m) => {
        const gf = normalize(getGameFormat(m));
        return gf === "duplas" || gf === "duplas mistas";
      });
    }

    if (gameFormat) filtered = filtered.filter((m) => normalize(getGameFormat(m)) === normalize(gameFormat));
    if (tournament) filtered = filtered.filter((m) => normalize(String(m.tournamentName || "")) === normalize(tournament));

    if (stage) {
      filtered = filtered.filter((m) => String(m.tournamentStage || "").trim() === stage);
    }

    if (year) {
      filtered = filtered.filter((m) => {
        const d = new Date(m.matchDateTime);
        return !isNaN(d.getTime()) && String(d.getFullYear()) === year;
      });
    }

    filtered.sort((a, b) => {
      const da = a.matchDateTime ? new Date(a.matchDateTime).getTime() : 0;
      const db = b.matchDateTime ? new Date(b.matchDateTime).getTime() : 0;
      return db - da;
    });

    state.items = filtered;
    state.currentPage = 1;

    renderSummary(filtered);
    renderPagedHistory(filtered);
    updateCardFilterUI();
  }

  function updateToggleButtonUI() {
    const btn = document.getElementById("toggleFiltersBtn");
    if (!btn) return;
    const icon = btn.querySelector(".career-bottom-icon");
    const label = btn.querySelector(".career-bottom-label");
    if (icon) icon.textContent = state.currentFilter ? "📋" : "🔎";
    if (label) label.textContent = state.currentFilter ? "Lista" : "Filtros";
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
    const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");
    toggleFiltersBtn?.addEventListener("click", (event) => {
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
    const summaryMessage = document.getElementById("summaryMessage");
    if (summaryMessage) {
      summaryMessage.textContent = "Selecione um filtro para exibir as partidas finalizadas.";
    }
  }

  function updateCardFilterUI() {
    document.querySelectorAll(".career-summary-card[data-filter]").forEach((card) => {
      const isActive = card.dataset.filter === state.currentFilter;
      card.classList.toggle("career-card-filter-active", isActive);
      card.classList.toggle(
        "career-card-filter-inactive",
        state.currentFilter !== null && !isActive
      );
    });
  }

  function bindCardFilters() {
    document.querySelectorAll(".career-summary-card[data-filter]").forEach((card) => {
      card.addEventListener("click", () => {
        state.currentFilter = card.dataset.filter || null;
        state.currentPage = 1;
        applyFiltersAndRender();
        setTimeout(() => {
          const list = document.getElementById("confrontoMatchesList");
          if (list) {
            const y = list.getBoundingClientRect().top + window.scrollY - 20;
            window.scrollTo({ top: y, behavior: "smooth" });
          }
        }, 80);
      });
    });
  }

  function bindEvents() {
    const applyFilterBtn = document.getElementById("applyFilterBtn");
    const clearFilterBtn = document.getElementById("clearFilterBtn");
    const prevPageBtn = document.getElementById("prevPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");

    applyFilterBtn?.addEventListener("click", () => {
      state.currentFilter = "all";
      state.showMatches = true;
      applyFiltersAndRender();

      setTimeout(() => {
        const list = document.getElementById("confrontoMatchesList");
        if (list) {
          const y = list.getBoundingClientRect().top + window.scrollY - 20;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 80);
    });

    clearFilterBtn?.addEventListener("click", () => {
      state.currentFilter = "all";
      state.showMatches = false;
      updateCardFilterUI();

      const gameFormatFilter = document.getElementById("gameFormatFilter");
      const tournamentFilter = document.getElementById("tournamentFilter");
      const stageFilter = document.getElementById("stageFilter");
      const yearFilter = document.getElementById("yearFilter");
      const playerName = document.getElementById("player2");

      if (gameFormatFilter) gameFormatFilter.value = "";
      if (tournamentFilter) tournamentFilter.value = "";
      if (stageFilter) stageFilter.value = "";
      if (yearFilter) yearFilter.value = "";
      if (playerName) playerName.value = "";

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

    prevPageBtn?.addEventListener("click", () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderPagedHistory(state.items);

        setTimeout(() => {
          const firstCard = document.querySelector("#confrontoMatchesList .career-card");
          if (firstCard) {
            const y = firstCard.getBoundingClientRect().top + window.scrollY - 20;
            window.scrollTo({ top: y, behavior: "smooth" });
          }
        }, 50);
      }
    });

    nextPageBtn?.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(state.items.length / PAGE_SIZE));
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderPagedHistory(state.items);

        setTimeout(() => {
          const firstCard = document.querySelector("#confrontoMatchesList .career-card");
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

  async function init() {
    const player1 = getParam("player1");
    const player2 = getParam("player2");
    const opponentId = getParam("opponentId");
    const ownerIdFromUrl = getParam("ownerId");

    const subtitle = document.getElementById("confrontoSubtitle");
    const list = document.getElementById("confrontoMatchesList");
    const emptyState = document.getElementById("emptyState");

    const imgPlayer1 = document.getElementById("imgPlayer1");
    const imgPlayer2 = document.getElementById("imgPlayer2");
    const ph1 = document.getElementById("player1AvatarPlaceholder");
    const ph2 = document.getElementById("player2AvatarPlaceholder");

    if (typeof __db === "undefined") {
      if (subtitle) hide(subtitle);
      if (list) {
        list.innerHTML = `<div class="confronto-empty">Firebase não disponível nesta página.</div>`;
      }
      show(emptyState);
      return;
    }

    const authUser = await waitForAuthUser();

    state.currentOwnerId = ownerIdFromUrl || authUser?.uid || "";
    state.currentPlayer1 = player1;
    state.currentPlayer2 = player2;
    state.currentOpponentId = opponentId || "";

    if (!state.currentOwnerId || !player1 || !player2) {
      if (subtitle) hide(subtitle);
      if (list) {
        list.innerHTML = `<div class="confronto-empty">Parâmetros inválidos para carregar o confronto.</div>`;
      }
      show(emptyState);
      return;
    }

    setText("player1Name", player1);
    setText("player2Name", player2);
    setText("confrontoScore", "0 : 0");
    setText("matchesLabel", "Carregando...");
    setText("matchesLabelSecondary", "Carregando...");
    setText("pageInfo", "Página 1 de 1");

    if (subtitle) {
      subtitle.textContent = "";
      hide(subtitle);
    }

    try {
      let ownerProfile = await getLoggedUserProfile();
      if (!ownerProfile && player1) {
        ownerProfile = await findProfileByName(player1);
      }

      let opponentProfile = null;
      if (opponentId) {
        opponentProfile = await getOpponentProfile(opponentId);
      }
      if (!opponentProfile && player2) {
        opponentProfile = await findProfileByName(player2);
      }

      state.ownerProfile = ownerProfile;
      state.opponentProfile = opponentProfile;

      const ownerPhoto = getPhotoFromProfile(ownerProfile);
      const opponentPhoto = getPhotoFromProfile(opponentProfile);

      state.ownerProfilePhoto = ownerPhoto;
      state.opponentProfilePhoto = opponentPhoto;

      setPlayerAvatar({
        name: player1,
        imgEl: imgPlayer1,
        placeholderEl: ph1,
        photoURL: ownerPhoto
      });

      setPlayerAvatar({
        name: player2,
        imgEl: imgPlayer2,
        placeholderEl: ph2,
        photoURL: opponentPhoto
      });

      const snap = await __db.collection("matches")
        .where("ownerId", "==", state.currentOwnerId)
        .get();

      state.allOwnerMatches = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      setPlayerMeta("player1Meta", ownerProfile || {}, "full");
      setPlayerMeta("player2Meta", opponentProfile || {}, "full");

      let wins1 = 0;
      let wins2 = 0;
      const items = [];

      snap.forEach((doc) => {
        const d = doc.data() || {};

        const matchP1 = d.player1 || d.player1Name || d.ownerName || "";
        const matchP2 = d.player2 || d.player2Name || d.opponentName || "";

        const normalizedPlayer1 = normalize(player1);
        const normalizedPlayer2 = normalize(player2);
        const normalizedMatchP1 = normalize(matchP1);
        const normalizedMatchP2 = normalize(matchP2);

        const pairMatches =
          (normalizedMatchP1.includes(normalizedPlayer1) && normalizedMatchP2.includes(normalizedPlayer2)) ||
          (normalizedMatchP1.includes(normalizedPlayer2) && normalizedMatchP2.includes(normalizedPlayer1)) ||
          samePair(matchP1, matchP2, player1, player2);

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

      state.items = items;

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
    document.getElementById("btnReload")?.addEventListener("click", () => location.reload());

    document.getElementById("btnClose")?.addEventListener("click", () => {
      window.location.href = "admin.html";
    });

    document.getElementById("btnSearchOpponent")?.addEventListener("click", () => {
      openSearchModal();
    });

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
