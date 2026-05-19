(() => {
  "use strict";

  const PlayersApp = (() => {
    const db = firebase.firestore();

    const state = {
      currentUser: null,
      allMatches: [],
      filteredMatches: [],
      unsubscribe: null
    };

    const el = {
      pageTitle: document.getElementById("pageTitle"),
      subtitle: document.getElementById("subtitle"),
      summaryMessage: document.getElementById("summaryMessage"),
      opponentFilter: document.getElementById("opponentFilter"),
      applyFilterBtn: document.getElementById("applyFilterBtn"),
      clearFilterBtn: document.getElementById("clearFilterBtn"),
      opponentPhoto: document.getElementById("opponentPhoto"),
      currentUserPhoto: document.getElementById("currentUserPhoto"),
      opponentName: document.getElementById("opponentName"),
      currentUserName: document.getElementById("currentUserName"),
      opponentInfo: document.getElementById("opponentInfo"),
      currentUserInfo: document.getElementById("currentUserInfo"),
      opponentWins: document.getElementById("opponentWins"),
      currentUserWins: document.getElementById("currentUserWins"),
      vsLabel: document.getElementById("vsLabel"),
      playersList: document.getElementById("playersList")
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

      getCurrentUserProfile(user) {
        const displayName = String(user?.displayName || "").trim();
        if (displayName) return displayName;

        const email = String(user?.email || "").trim();
        if (email) return email.split("@")[0];

        return "";
      },

      getMatchWinner(match) {
        const status = U.normalizeText(match.status);
        const score = match.score || {};

        if (status === "wo") {
          const wo = U.normalizeText(match.winnerByWO);
          if (wo === "player1") return 1;
          if (wo === "player2") return 2;
        }

        const sets1 = Number(score.sets1 || 0);
        const sets2 = Number(score.sets2 || 0);

        if (sets1 > sets2) return 1;
        if (sets2 > sets1) return 2;

        return null;
      },

      isUserInMatch(match, userName) {
        const p1 = U.normalizeText(match.player1 || "");
        const p2 = U.normalizeText(match.player2 || "");
        const ownerName = U.normalizeText(match.ownerName || "");
        const target = U.normalizeText(userName || "");

        return (
          p1 === target ||
          p2 === target ||
          ownerName === target
        );
      },

      getOpponentName(match, currentUserName) {
        const p1 = String(match.player1 || "").trim();
        const p2 = String(match.player2 || "").trim();
        const current = U.normalizeText(currentUserName);

        if (U.normalizeText(p1) === current) return p2 || "Adversário";
        if (U.normalizeText(p2) === current) return p1 || "Adversário";

        const ownerName = U.normalizeText(match.ownerName || "");
        if (ownerName && ownerName === current) return p2 || p1 || "Adversário";

        return p2 || p1 || "Adversário";
      }
    };

    function setMsg(text) {
      if (el.summaryMessage) el.summaryMessage.textContent = text || "";
    }

    function clearCardResultClasses() {
      const leftCard = document.querySelector(".score-card.left");
      const rightCard = document.querySelector(".score-card.right");

      if (!leftCard || !rightCard) return;

      leftCard.classList.remove("win", "loss", "draw");
      rightCard.classList.remove("win", "loss", "draw");
    }

    function applyCardResultClasses(opponentWins, currentWins) {
      const leftCard = document.querySelector(".score-card.left");
      const rightCard = document.querySelector(".score-card.right");

      if (!leftCard || !rightCard) return;

      leftCard.classList.remove("win", "loss", "draw");
      rightCard.classList.remove("win", "loss", "draw");

      if (opponentWins > currentWins) {
        leftCard.classList.add("win");
        rightCard.classList.add("loss");
      } else if (currentWins > opponentWins) {
        leftCard.classList.add("loss");
        rightCard.classList.add("win");
      } else {
        leftCard.classList.add("draw");
        rightCard.classList.add("draw");
      }
    }

    function resetConfronto() {
      if (el.opponentName) el.opponentName.textContent = "Jogador 1";
      if (el.currentUserName) el.currentUserName.textContent = "Jogador 2";
      if (el.opponentWins) el.opponentWins.textContent = "0";
      if (el.currentUserWins) el.currentUserWins.textContent = "0";
      if (el.opponentInfo) el.opponentInfo.textContent = "";
      if (el.currentUserInfo) el.currentUserInfo.textContent = "";
      if (el.vsLabel) el.vsLabel.textContent = "Wins";

      clearCardResultClasses();

      if (el.pageTitle) {
        el.pageTitle.textContent = "Jogadores";
      }

      setMsg("Selecione um adversário e clique em Filtrar.");
    }

    function renderEmpty(message) {
      if (!el.playersList) return;
      el.playersList.innerHTML = `<div class="empty-card">${U.escapeHtml(message)}</div>`;
    }

    function buildGroups(matches, currentUserName) {
      const groups = new Map();

      matches.forEach((match) => {
        const opponent = U.getOpponentName(match, currentUserName);
        const key = U.normalizeText(opponent);

        if (!groups.has(key)) {
          groups.set(key, {
            opponent,
            currentWins: 0,
            opponentWins: 0,
            matches: []
          });
        }

        const item = groups.get(key);
        item.matches.push(match);

        const winner = U.getMatchWinner(match);
        const p1 = U.normalizeText(match.player1 || "");
        const p2 = U.normalizeText(match.player2 || "");
        const ownerName = U.normalizeText(match.ownerName || "");
        const current = U.normalizeText(currentUserName);

        const currentIsP1 = p1 === current || ownerName === current;
        const currentIsP2 = p2 === current;

        const opponentIsP1 = p1 === key;
        const opponentIsP2 = p2 === key;

        if (winner === 1) {
          if (currentIsP1) item.currentWins += 1;
          if (opponentIsP1) item.opponentWins += 1;
        }

        if (winner === 2) {
          if (currentIsP2) item.currentWins += 1;
          if (opponentIsP2) item.opponentWins += 1;
        }

        if (!currentIsP1 && !currentIsP2) {
          if (winner === 1 && opponentIsP1) item.opponentWins += 1;
          if (winner === 2 && opponentIsP2) item.opponentWins += 1;
        }
      });

      return [...groups.values()].sort((a, b) => {
        const latestA = [...a.matches].sort((x, y) => {
          const da = U.toDate(x.matchDateTime)?.getTime() || 0;
          const db = U.toDate(y.matchDateTime)?.getTime() || 0;
          return db - da;
        })[0];

        const latestB = [...b.matches].sort((x, y) => {
          const da = U.toDate(x.matchDateTime)?.getTime() || 0;
          const db = U.toDate(y.matchDateTime)?.getTime() || 0;
          return db - da;
        })[0];

        const ta = U.toDate(latestA?.matchDateTime)?.getTime() || 0;
        const tb = U.toDate(latestB?.matchDateTime)?.getTime() || 0;
        return tb - ta;
      });
    }

    function renderMatchupCards(groups, currentUserName) {
      if (!el.playersList) return;

      if (!groups.length) {
        renderEmpty("Nenhum confronto encontrado para os filtros aplicados.");
        clearCardResultClasses();
        return;
      }

      el.playersList.innerHTML = groups.map((g) => {
        const lastMatch = [...g.matches].sort((a, b) => {
          const da = U.toDate(a.matchDateTime)?.getTime() || 0;
          const db = U.toDate(b.matchDateTime)?.getTime() || 0;
          return db - da;
        })[0];

        const opponent = U.escapeHtml(g.opponent || "Adversário");
        const current = U.escapeHtml(currentUserName || "Você");
        const lastDate = U.escapeHtml(U.formatDate(lastMatch?.matchDateTime));

        return ` <article class="players-row-card"> <div class="players-row-left"> <div class="players-row-name">${opponent}</div> <div class="players-row-sub">Último jogo: ${lastDate}</div> </div> <div class="players-row-center"> <span class="players-row-vs">X</span> </div> <div class="players-row-right"> <div class="players-row-name">${current}</div> <div class="players-row-sub">Confronto</div> </div> <div class="players-row-score"> <span class="score-win">${g.opponentWins}</span> <span class="score-label">vs</span> <span class="score-win">${g.currentWins}</span> </div> </article> `;
      }).join("");
    }

    function applyFilters() {
      const currentUserName = U.getCurrentUserProfile(state.currentUser);
      const filter = U.normalizeText(el.opponentFilter?.value || "");

      // Se não tiver filtro, tela vazia
      if (!filter) {
        state.filteredMatches = [];
        resetConfronto();
        renderEmpty("Selecione um adversário e clique em Filtrar.");
        return;
      }

      const base = state.allMatches.filter((m) => U.isUserInMatch(m, currentUserName));
      const groups = buildGroups(base, currentUserName).filter((g) => {
        return U.normalizeText(g.opponent).includes(filter);
      });

      state.filteredMatches = groups;

      // Se houver um único grupo filtrado, exibe esse confronto no topo
      if (groups.length === 1) {
        const g = groups[0];

        if (el.opponentName) el.opponentName.textContent = g.opponent || "Adversário";
        if (el.currentUserName) el.currentUserName.textContent = currentUserName || "Jogador logado";
        if (el.opponentWins) el.opponentWins.textContent = String(g.opponentWins);
        if (el.currentUserWins) el.currentUserWins.textContent = String(g.currentWins);
        if (el.opponentInfo) el.opponentInfo.textContent = "";
        if (el.currentUserInfo) el.currentUserInfo.textContent = "";
        if (el.vsLabel) el.vsLabel.textContent = "Wins";
        if (el.pageTitle) el.pageTitle.textContent = `Jogadores - ${currentUserName || "Jogador"}`;

        applyCardResultClasses(g.opponentWins, g.currentWins);

        setMsg(`Confronto encontrado com ${g.opponent}.`);
      } else {
        // Se houver mais de um adversário, mantém o topo vazio/padrão
        resetConfronto();
        setMsg(
          groups.length
            ? `Encontrados ${groups.length} adversários. Refine o filtro para ver um confronto específico.`
            : "Nenhum confronto encontrado."
        );
      }

      renderMatchupCards(groups, currentUserName);
    }

    function listenMatches() {
      if (!state.currentUser) return;

      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }

      const currentUserName = U.getCurrentUserProfile(state.currentUser);

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

            if (el.pageTitle) el.pageTitle.textContent = `Jogadores - ${currentUserName}`;

            // Tela inicia vazia
            resetConfronto();
            renderEmpty("Selecione um adversário e clique em Filtrar.");
          },
          (err) => {
            console.error(err);
            setMsg(err.message || "Erro ao carregar partidas.");
            renderEmpty("Erro ao carregar partidas.");
          }
        );
    }

    function bindEvents() {
      el.applyFilterBtn?.addEventListener("click", applyFilters);

      el.clearFilterBtn?.addEventListener("click", () => {
        if (el.opponentFilter) el.opponentFilter.value = "";
        state.filteredMatches = [];
        resetConfronto();
        renderEmpty("Selecione um adversário e clique em Filtrar.");
      });

      el.opponentFilter?.addEventListener("input", () => {
        // não auto-exibe nada: só prepara o filtro
        if (!String(el.opponentFilter.value || "").trim()) {
          state.filteredMatches = [];
          resetConfronto();
          renderEmpty("Selecione um adversário e clique em Filtrar.");
        }
      });
    }

    function init() {
      bindEvents();
      resetConfronto();

      if (typeof __auth === "undefined" || typeof __db === "undefined") {
        setMsg("Firebase não carregado corretamente.");
        return;
      }

      __auth.onAuthStateChanged((user) => {
        if (!user) {
          state.currentUser = null;
          setMsg("Usuário não autenticado.");
          renderEmpty("Usuário não autenticado.");
          resetConfronto();
          return;
        }

        state.currentUser = user;
        listenMatches();
      });
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => PlayersApp.init());
})();