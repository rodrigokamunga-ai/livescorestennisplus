(() => {
  "use strict";

  const PAGE_SIZE = 5;

  const state = {
    currentPage: 1,
    items: [],
    filteredItems: [],
    currentFilter: "all",
    searchModal: null,
    searchInput: null,
    searchResults: null,
    searchStatus: null,
    searchTimeout: null,
    currentAthleteProfile: null,
    currentAthleteName: "",
    currentAthleteId: ""
  };

  function normalize(text = "") {
    return String(text)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getCountryFlag(country = "") {
    const c = normalize(country);
  
    const flags = {
      brasil: "🇧🇷",
      brazil: "🇧🇷",
      "br": "🇧🇷",
      "argentina": "🇦🇷",
      "ar": "🇦🇷",
      "chile": "🇨🇱",
      "cl": "🇨🇱",
      "uruguai": "🇺🇾",
      "uy": "🇺🇾",
      "paraguai": "🇵🇾",
      "py": "🇵🇾",
      "espanha": "🇪🇸",
      "spain": "🇪🇸",
      "usa": "🇺🇸",
      "eua": "🇺🇸",
      "estados unidos": "🇺🇸",
      "united states": "🇺🇸",
      "franca": "🇫🇷",
      "france": "🇫🇷",
      "italia": "🇮🇹",
      "italy": "🇮🇹",
      "portugal": "🇵🇹",
      "pt": "🇵🇹"
    };
  
    return flags[c] || "🏳️";
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

  function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(d);
  }

  function abbreviateFullName(name = "") {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "-";
    if (parts.length === 1) return parts[0];
    return `${parts[0].charAt(0).toUpperCase()}. ${parts[parts.length - 1]}`;
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

    imgEl.alt = name ? `Foto de ${name}` : "Foto do atleta";
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

  function waitForAuthUser(timeoutMs = 3000) {
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
      }, 150);
    });
  }

  function isDoubles(match) {
    const gf = normalize(match?.gameFormat || "");
    return (
      gf === "duplas" ||
      gf === "duplas mistas" ||
      !!(match?.player3 || match?.player4 || match?.player3Name || match?.player4Name)
    );
  }

  function getStatusIcon(status) {
    const s = normalize(status);
    if (s === "wo") return "close-circle-outline";
    if (s === "ret") return "hand-left-outline";
    if (s === "finished") return "checkmark-circle-outline";
    if (s === "live") return "time-outline";
    return "checkmark-circle-outline";
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
    const mode = String(setObj.tieBreakMode || setObj.tieBreakMod || "").trim();

    if ((mode === "super10" || mode === "tb7") && (tb1 > 0 || tb2 > 0)) {
      const winnerIs1 = tb1 > tb2;
      return `${winnerIs1 ? "7x6" : "6x7"} (${tb1}-${tb2})`;
    }

    if (g1 > 0 || g2 > 0) return `${g1}x${g2}`;
    return "--";
  }

  function getMatchStageLabel(match = {}) {
    const stage = safeValue(
      match.tournamentStage ||
      match.stage ||
      match.round ||
      match.matchRound ||
      match.phase
    );

    if (stage !== "-") return stage;

    const matchFormat = safeValue(match.matchFormat || match.gameFormat || match.format);
    if (matchFormat !== "-" && matchFormat !== "Simples" && matchFormat !== "Duplas") {
      return matchFormat;
    }

    const categoryName = safeValue(match.categoryName || match.category || match.categoryTitle);
    if (categoryName !== "-") return categoryName;

    return "Partida";
  }

  function getMatchCategoryLabel(match = {}) {
    return safeValue(
      match.categoryName ||
      match.category ||
      match.categoryTitle ||
      match.modality ||
      match.surfaceType
    );
  }

  function getTournamentNameLabel(match = {}) {
    return safeValue(match.tournamentName || match.eventName || match.tournament || "");
  }

  function getPlayerMatchResult(match, playerName) {
    const nameNorm = normalize(playerName || "");
    if (!nameNorm) return null;

    const status = normalize(match.status || "");
    const doubles = isDoubles(match);

    if (doubles) {
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

  function getPlayerStatsFromMatches(playerName) {
    const nameNorm = normalize(playerName || "");

    let total = 0;
    let wins = 0;
    let losses = 0;
    let titles = 0;

    if (!nameNorm || !Array.isArray(state.items) || !state.items.length) {
      return { total, wins, losses, titles };
    }

    state.items.forEach((item) => {
      const match = item.data || {};
      const result = getPlayerMatchResult(match, playerName);
      if (result === null) return;

      total++;
      if (result === "win") wins++;
      if (result === "loss") losses++;

      const stage = normalize(match.tournamentStage || match.stage || match.round || "");
      if ((stage === "final" || stage === "finals" || stage === "finale") && result === "win") {
        titles++;
      }
    });

    return { total, wins, losses, titles };
  }

  async function findProfileByName(name) {
    if (!name || typeof __db === "undefined") return null;

    try {
      const query = normalize(name);
      const collections = ["profiles", "users"];

      for (const col of collections) {
        const snap = await __db.collection(col).get();

        let exact = null;
        let partial = null;

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
          } else if (!partial && norm.includes(query)) {
            partial = { id: doc.id, collection: col, ...d };
          }
        });

        if (exact) return exact;
        if (partial) return partial;
      }
    } catch (err) {
      console.error("Erro ao buscar perfil por nome:", err);
    }

    return null;
  }

  async function searchProfilesByName(term) {
    if (!term || typeof __db === "undefined") return [];

    const query = normalize(term);
    const results = [];

    try {
      for (const col of ["profiles", "users"]) {
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

      const seen = new Set();
      return results.filter((item) => {
        const key = normalize(item.displayName || item.name || item.fullName || "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch (err) {
      console.error("Erro ao pesquisar perfis:", err);
      return [];
    }
  }

  async function getMatchesForAthlete(playerName) {
    if (!playerName || typeof __db === "undefined") return [];

    const results = [];

    try {
      const snap = await __db.collection("matches")
        .where("status", "in", ["finished", "wo", "ret"])
        .get();

      snap.forEach((doc) => {
        const d = doc.data() || {};
        const result = getPlayerMatchResult(d, playerName);

        if (result === null) return;

        results.push({
          id: doc.id,
          data: d,
          dateMs: d.matchDateTime ? new Date(d.matchDateTime).getTime() : 0,
          html: buildMatchLine(d)
        });
      });
    } catch (err) {
      console.error("Erro ao buscar jogos do atleta:", err);
    }

    return results.sort((a, b) => b.dateMs - a.dateMs);
  }

  function buildProfileMeta(profile = {}, stats = { total: 0, wins: 0, losses: 0, titles: 0 }) {
    const country = safeValue(profile.country || profile.countryName);
    const city = safeValue(profile.city || profile.cidade || profile.cityName);
    const age = calculateAge(profile.birthDate || profile.dateOfBirth || profile.nascimento || profile.dob);
    const height = safeValue(profile.height || profile.altura);
    const weight = safeValue(profile.weight || profile.peso);
    const hand = safeValue(profile.hand || profile.dominantHand || profile.maoDominante || profile.forehand);
    const backhandRaw = safeValue(profile.backhand || profile.backhandStyle || profile.tipoBackhand);
    const backhand =
      backhandRaw === "duas_maos" ? "duas mãos" :
      backhandRaw === "uma_mao" ? "uma mão" :
      backhandRaw;

    const rows = [
      ["País", country],
      ["Cidade", city],
      ["Idade", age],
      ["Altura", height],
      ["Peso", weight],
      ["Mão dominante", hand],
      ["Backhand", backhand],
      ["Partidas", String(stats.total || 0)],
      ["Vitórias", String(stats.wins || 0)],
      ["Derrotas", String(stats.losses || 0)],
      ["Títulos", String(stats.titles || 0)]
    ];

    return rows.map(([label, value]) => ` <div class="profile-row"> <div class="profile-label">${label}</div> <div class="profile-value">${value}</div> </div> `).join("");
  }

  function getWinnersLabel(match, winnerSide) {
    const p1 = match?.player1 || match?.player1Name || match?.ownerName || "Jogador 1";
    const p2 = match?.player2 || match?.player2Name || match?.opponentName || "Jogador 2";
    const p3 = match?.player3 || match?.player3Name || "";
    const p4 = match?.player4 || match?.player4Name || "";

    if (winnerSide === "player1") {
      if (isDoubles(match)) {
        return `${abbreviateFullName(p1)} / ${abbreviateFullName(p2)} venceram`;
      }
      return `${safeValue(p1)} venceu`;
    }

    if (winnerSide === "player2") {
      if (isDoubles(match)) {
        return `${abbreviateFullName(p3 || p2)} / ${abbreviateFullName(p4 || "")} venceram`;
      }
      return `${safeValue(p2)} venceu`;
    }

    return "Sem vencedor definido";
  }

  function buildMatchLine(data) {
    const isDoubleMatch = isDoubles(data);

    const p1 = data?.player1 || data?.player1Name || data?.ownerName || "Jogador 1";
    const p2 = data?.player2 || data?.player2Name || data?.opponentName || "Jogador 2";
    const p3 = data?.player3 || data?.player3Name || "";
    const p4 = data?.player4 || data?.player4Name || "";

    const score = data?.score || {};
    const history = Array.isArray(score.setHistory) ? score.setHistory : [];
    const status = String(data?.status || "").trim().toLowerCase();
    const date = formatDateTime(data?.matchDateTime || data?.startedAt || data?.finishedAt);

    const setText = history
      .map(getSetDisplayFromHistory)
      .filter((t) => t && t !== "--")
      .join(" • ");

    const winner = getWinner(data);
    const statusIcon = getStatusIcon(status);

    const title = isDoubleMatch
      ? `${abbreviateFullName(p1)} / ${abbreviateFullName(p2)} x ${abbreviateFullName(p3 || "?")}${p3 && p4 ? " / " : ""}${abbreviateFullName(p4 || "")}`
      : `${abbreviateFullName(p1)} x ${abbreviateFullName(p2)}`;

    const scoreText = setText || `${safeValue(score.sets1 ?? 0)} x ${safeValue(score.sets2 ?? 0)}`;

    const tournamentName = safeValue(data.tournamentName || data.eventName || data.tournament || "");
    const categoryName = safeValue(data.categoryName || data.category || data.categoryTitle || "");
    const stageLabel = safeValue(data.tournamentStage || data.stage || data.round || data.matchRound || data.phase);

    const isTreinoOrRanking =
      normalize(categoryName) === "treino" ||
      normalize(categoryName) === "ranking";

    let resultMessage = "Sem vencedor definido";

    if (status === "wo") {
      const wo = normalize(data.winnerByWO || "");
      if (wo === "player1") {
        resultMessage = `${getWinnersLabel(data, "player1")} por WO`;
      } else if (wo === "player2") {
        resultMessage = `${getWinnersLabel(data, "player2")} por WO`;
      } else {
        resultMessage = "WO";
      }
    } else if (status === "ret") {
      const ret = normalize(data.winnerByRet || "");
      if (ret === "player1") {
        resultMessage = `${getWinnersLabel(data, "player1")} por desistência`;
      } else if (ret === "player2") {
        resultMessage = `${getWinnersLabel(data, "player2")} por desistência`;
      } else {
        resultMessage = "Desistência";
      }
    } else if (winner === 1) {
      resultMessage = getWinnersLabel(data, "player1");
    } else if (winner === 2) {
      resultMessage = getWinnersLabel(data, "player2");
    }

    const infoParts = [];
    if (tournamentName !== "-") infoParts.push(tournamentName);
    if (!isTreinoOrRanking && categoryName !== "-") infoParts.push(categoryName);
    if (stageLabel !== "-") infoParts.push(stageLabel);

    const infoLine = infoParts.join(" | ");

    return ` <div class="match-item"> <div class="match-top"> <div class="match-players"> <ion-icon name="people-outline"></ion-icon> <span class="match-players-name">${title}</span> </div> </div> <div class="match-line"> <ion-icon name="calendar-outline"></ion-icon> <span class="match-datetime">${date}</span> </div> <div class="match-line"> <ion-icon name="medal-outline"></ion-icon> <span>${infoLine || "Partida"}</span> </div> <div class="match-line"> <ion-icon name="trophy-outline"></ion-icon> <span class="match-score">${scoreText}</span> </div> <div class="match-line"> <ion-icon name="${statusIcon}"></ion-icon> <span class="match-status">${resultMessage}</span> </div> </div> `;
  }

  

  function renderPageItems(items) {
    const list = document.getElementById("jogadorMatchesList");
    if (!list) return;

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const start = (state.currentPage - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);

    list.innerHTML = pageItems.length
      ? pageItems.map((item) => item.html).join("")
      : `<div class="jogador-empty">Nenhum jogo encontrado.</div>`;

    setText("pageInfo", `Página ${state.currentPage} de ${totalPages}`);

    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");

    if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;
  }

  function updateFilterButtons() {
    document.querySelectorAll(".jogador-filter-btn").forEach((btn) => {
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

    state.filteredItems = filtered;

    setText(
      "matchesLabelSecondary",
      filtered.length ? `${filtered.length} jogo(s)` : "Nenhum jogo encontrado"
    );

    return filtered;
  }

  function getFullPlayerDisplay(profile, fallbackLabel) {
    return String(
      profile?.displayName ||
      profile?.name ||
      profile?.fullName ||
      profile?.ownerName ||
      profile?.playerName ||
      profile?.nome ||
      fallbackLabel ||
      ""
    ).trim() || fallbackLabel || "Sem nome";
  }

  function renderSearchResults(results) {
    if (!state.searchResults) return;

    if (!results.length) {
      state.searchResults.innerHTML = `<div class="jogador-search-empty">Nenhum atleta encontrado.</div>`;
      return;
    }

    state.searchResults.innerHTML = results.map((profile, index) => {
      const displayName = getFullPlayerDisplay(profile, "Sem nome");
      const photo = getPhotoFromProfile(profile);
      const initials = getAvatarInitial(displayName);

      const country = safeValue(profile.country || profile.countryName);
      const city = safeValue(profile.city || profile.cidade || profile.cityName);
      const age = calculateAge(profile.birthDate || profile.dateOfBirth || profile.nascimento || profile.dob);

      return ` <button type="button" class="jogador-search-result" data-index="${index}"> <div class="jogador-search-result-avatar"> ${photo ? `<img src="${photo}" alt="Foto de ${displayName}" />` : `<span>${initials}</span>`} </div> <div class="jogador-search-result-info"> <div class="jogador-search-result-name">${displayName}</div> <div class="jogador-search-result-meta"> <div><strong>País:</strong> ${country}</div> <div><strong>Cidade:</strong> ${city} - <strong>Idade:</strong> ${age}</div> </div> </div> </button> `;
    }).join("");

    state.searchResults.querySelectorAll(".jogador-search-result").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const index = Number(btn.dataset.index);
        const selected = results[index];
        closeSearchModal();
        await selectAthlete(selected);
      });
    });
  }

  async function runPlayerSearch(term) {
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
      const results = await searchProfilesByName(query);

      results.sort((a, b) => {
        const A = normalize(getFullPlayerDisplay(a, ""));
        const B = normalize(getFullPlayerDisplay(b, ""));
        return A.localeCompare(B);
      });

      state.searchStatus.textContent = results.length
        ? `${results.length} resultado(s) encontrado(s).`
        : "Nenhum atleta encontrado.";

      renderSearchResults(results);
    } catch (err) {
      console.error("Erro ao pesquisar atleta:", err);
      state.searchStatus.textContent = "Erro ao pesquisar atleta.";
      state.searchResults.innerHTML = "";
    }
  }

  function createSearchModalIfNeeded() {
    if (state.searchModal) return;

    const overlay = document.createElement("div");
    overlay.className = "jogador-search-modal hidden";
    overlay.id = "jogadorSearchModal";
    overlay.innerHTML = ` <div class="jogador-search-modal-card"> <div class="jogador-search-modal-head"> <div> <h3>Pesquisar adversário</h3> <p class="muted">Digite o nome do atleta para listar os jogadores encontrados.</p> </div> <button type="button" class="jogador-search-modal-close" id="closeSearchModalBtn">×</button> </div> <div class="jogador-search-modal-body"> <input type="text" id="searchPlayerInput" class="jogador-search-modal-input" placeholder="Digite o nome do atleta" autocomplete="off" /> <div id="searchPlayerStatus" class="jogador-search-modal-status muted"></div> <div id="searchPlayerResults" class="jogador-search-results"></div> </div> </div> `;

    document.body.appendChild(overlay);

    state.searchModal = overlay;
    state.searchInput = overlay.querySelector("#searchPlayerInput");
    state.searchResults = overlay.querySelector("#searchPlayerResults");
    state.searchStatus = overlay.querySelector("#searchPlayerStatus");

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSearchModal();
    });

    overlay.querySelector("#closeSearchModalBtn")?.addEventListener("click", closeSearchModal);

    state.searchInput?.addEventListener("input", () => {
      clearTimeout(state.searchTimeout);
      const term = state.searchInput.value.trim();
      state.searchTimeout = setTimeout(() => runPlayerSearch(term), 250);
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

  function renderAthleteProfile(profile) {
    const name = profile?.displayName || profile?.name || profile?.fullName || "Atleta";
    const photo = getPhotoFromProfile(profile);

    state.currentAthleteProfile = profile || null;
    state.currentAthleteName = name;
    state.currentAthleteId = profile?.uid || profile?.id || profile?.playerId || profile?.ownerId || "";

    setText("pageTitle", `Perfil do atleta - ${name}`);
    setText("subtitle", "Perfil do atleta pesquisado.");
    setText("playerName", name);

    const city = safeValue(profile.city || profile.cidade || profile.cityName);
    const country = safeValue(profile.country || profile.countryName);
    setText(
      "playerMetaLine",
      city !== "-" || country !== "-"
        ? `${city !== "-" ? city : ""}${city !== "-" && country !== "-" ? " • " : ""}${country !== "-" ? country : ""}`
        : "Dados do atleta"
    );

    setPlayerAvatar({
      name,
      imgEl: document.getElementById("imgPlayer"),
      placeholderEl: document.getElementById("playerAvatarPlaceholder"),
      photoURL: photo
    });

    const metaEl = document.getElementById("profileMeta");
    if (metaEl) {
      metaEl.innerHTML = buildProfileMeta(profile || {}, {
        total: 0,
        wins: 0,
        losses: 0,
        titles: 0
      });
    }
  }

  async function selectAthlete(profile) {
    if (!profile) return;

    const athleteName = getFullPlayerDisplay(profile, "Atleta");

    // renderiza o perfil inicial
    renderAthleteProfile(profile);

    setText("matchesLabel", "Carregando jogos...");
    setText("matchesLabelSecondary", "Carregando jogos...");

    const matches = await getMatchesForAthlete(athleteName);

    state.items = matches;
    state.filteredItems = [...matches];
    state.currentPage = 1;

    // recalcula as estatísticas depois de carregar os jogos
    const stats = getPlayerStatsFromMatches(athleteName);

    // atualiza o bloco "Dados do atleta" com os valores reais
    const metaEl = document.getElementById("profileMeta");
    if (metaEl) {
      metaEl.innerHTML = buildProfileMeta(profile || {}, stats);
    }

    setText(
      "matchesLabel",
      matches.length ? `${matches.length} jogo(s) encontrado(s)` : "Nenhum jogo encontrado"
    );
    setText(
      "matchesLabelSecondary",
      matches.length ? `${matches.length} jogo(s)` : "Nenhum jogo encontrado"
    );

    const filtered = applyFilter();
    renderPageItems(filtered);

    const list = document.getElementById("jogadorMatchesList");
    const emptyState = document.getElementById("emptyState");

    if (!matches.length) {
      if (list) {
        list.innerHTML = `<div class="jogador-empty">Nenhum jogo encontrado para este atleta.</div>`;
      }
      show(emptyState);
    } else {
      hide(emptyState);
    }
  }

  function buildProfileMeta(profile = {}, stats = { total: 0, wins: 0, losses: 0, titles: 0 }) {
    const country = safeValue(profile.country || profile.countryName);
    const city = safeValue(profile.city || profile.cidade || profile.cityName);
    const age = calculateAge(profile.birthDate || profile.dateOfBirth || profile.nascimento || profile.dob);
    const height = safeValue(profile.height || profile.altura);
    const weight = safeValue(profile.weight || profile.peso);
    const hand = safeValue(profile.hand || profile.dominantHand || profile.maoDominante || profile.forehand);
    const backhandRaw = safeValue(profile.backhand || profile.backhandStyle || profile.tipoBackhand);
    const backhand =
      backhandRaw === "duas_maos" ? "duas mãos" :
      backhandRaw === "uma_mao" ? "uma mão" :
      backhandRaw;

    const rows = [
      ["País", country],
      ["Cidade", city],
      ["Idade", age],
      ["Altura", height],
      ["Peso", weight],
      ["Mão dominante", hand],
      ["Backhand", backhand],
      ["Partidas", String(stats.total || 0)],
      ["Vitórias", String(stats.wins || 0)],
      ["Derrotas", String(stats.losses || 0)],
      ["Títulos", String(stats.titles || 0)]
    ];

    return rows.map(([label, value]) => ` <div class="profile-row"> <div class="profile-label">${label}</div> <div class="profile-value">${value}</div> </div> `).join("");
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const queryName = params.get("player") || params.get("player1") || params.get("player2") || "";
    const queryId = params.get("playerId") || params.get("opponentId") || "";

    const list = document.getElementById("jogadorMatchesList");
    const emptyState = document.getElementById("emptyState");

    setText("pageInfo", "Página 1 de 1");
    setText("matchesLabel", "Pesquise um atleta");
    setText("matchesLabelSecondary", "Nenhum jogo carregado");

    if (typeof __db === "undefined") {
      if (list) list.innerHTML = `<div class="jogador-empty">Firebase não disponível nesta página.</div>`;
      show(emptyState);
      return;
    }

    await waitForAuthUser();

    let profile = null;

    if (queryId) {
      profile = await findProfileByName(queryId);
    }

    if (!profile && queryName) {
      profile = await findProfileByName(queryName);
    }

    if (profile) {
      await selectAthlete(profile);
    } else {
      if (list) {
        list.innerHTML = `<div class="jogador-empty">Nenhum atleta selecionado. Clique em <strong>Pesquisar adversário</strong>.</div>`;
      }
      show(emptyState);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("btnSearchPlayer")?.addEventListener("click", openSearchModal);

    document.getElementById("prevPageBtn")?.addEventListener("click", () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderPageItems(state.filteredItems);
      }
    });

    document.getElementById("nextPageBtn")?.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(state.filteredItems.length / PAGE_SIZE));
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderPageItems(state.filteredItems);
      }
    });

    document.querySelectorAll(".jogador-filter-btn").forEach((btn) => {
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
  });
})();
