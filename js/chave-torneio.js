(() => {
  "use strict";

  const params = new URLSearchParams(
    window.location.search
  );

  const tournamentId =
    params.get("id") || "";

  const db = window.__db;
  const auth = window.__auth;

  const state = {
    user: null,
    tournament: null,
    players: [],
    bracket: {},
    round: "all",

    activeRound: "",
    activeMatch: 0,
    activeSlot: "",

    resultRound: "",
    resultMatch: 0
  };

  const el = {
    name: document.getElementById(
      "bracketTournamentName"
    ),

    meta: document.getElementById(
      "bracketTournamentMeta"
    ),

    board: document.getElementById(
      "bracketBoard"
    ),

    message: document.getElementById(
      "bracketMessage"
    ),

    playerModal: document.getElementById(
      "bracketPlayerModal"
    ),

    playerModalTitle: document.getElementById(
      "bracketModalTitle"
    ),

    playerModalPlayers: document.getElementById(
      "bracketModalPlayers"
    ),

    closePlayerModal: document.getElementById(
      "closeBracketModal"
    ),

    resultModal: document.getElementById(
      "bracketResultModal"
    ),

    resultTitle: document.getElementById(
      "bracketResultTitle"
    ),

    closeResultModal: document.getElementById(
      "closeBracketResultModal"
    ),

    resultPlayer1Name: document.getElementById(
      "resultPlayer1Name"
    ),

    resultPlayer2Name: document.getElementById(
      "resultPlayer2Name"
    ),

    resultSet1Wrapper: document.getElementById(
      "resultSet1Wrapper"
    ),

    resultSet1Player1: document.getElementById(
      "resultSet1Player1"
    ),

    resultSet1Player2: document.getElementById(
      "resultSet1Player2"
    ),

    resultSet2Wrapper: document.getElementById(
      "resultSet2Wrapper"
    ),

    resultSet2Player1: document.getElementById(
      "resultSet2Player1"
    ),

    resultSet2Player2: document.getElementById(
      "resultSet2Player2"
    ),

    resultSet3Wrapper: document.getElementById(
      "resultSet3Wrapper"
    ),

    resultSet3Player1: document.getElementById(
      "resultSet3Player1"
    ),

    resultSet3Player2: document.getElementById(
      "resultSet3Player2"
    ),

    resultSuperTieWrapper: document.getElementById(
      "resultSuperTieWrapper"
    ),

    resultSuperTiePlayer1: document.getElementById(
      "resultSuperTiePlayer1"
    ),

    resultSuperTiePlayer2: document.getElementById(
      "resultSuperTiePlayer2"
    ),

    resultMessage: document.getElementById(
      "bracketResultMessage"
    ),

    cancelResult: document.getElementById(
      "cancelBracketResultBtn"
    ),

    saveResult: document.getElementById(
      "saveBracketResultBtn"
    ),

    saveBracket: document.getElementById(
      "saveBracketBtn"
    ),

    finishBracket: document.getElementById(
      "finishBracketBtn"
    ),

    finishTournament: document.getElementById(
      "finishTournamentBtn"
    ),

    generatePdf: document.getElementById(
      "generateBracketPdfBtn"
    )
  };

  function esc(value = "") {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getBracketShortName(name = "") {
    const text = String(name || "")
      .trim()
      .replace(/\s+/g, " ");
  
    if (!text) {
      return "";
    }
  
    const parts =
      text
        .split(" ")
        .filter(Boolean);
  
    if (parts.length === 1) {
      return parts[0];
    }
  
    const firstName =
      parts[0];
  
    const lastName =
      parts[parts.length - 1];
  
    const initial =
      Array.from(firstName)[0]
        .toUpperCase();
  
    return `${initial}. ${lastName}`;
  }

  function showMessage(text = "", type = "") {
    if (!el.message) return;

    el.message.textContent = text;
    el.message.className =
      `bracket-message ${type}`.trim();
  }

  function showResultMessage(text = "") {
    if (!el.resultMessage) return;

    el.resultMessage.textContent = text;
  }

  function normalizeStatus(value = "") {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");
  }

  function getStatus() {
    return normalizeStatus(
      state.tournament?.status || ""
    );
  }

  function isPrepared() {
    return getStatus() === "preparada";
  }

  function isLive() {
    return [
      "iniciado",
      "andamento",
      "em_andamento"
    ].includes(getStatus());
  }

  function isFinished() {
    return [
      "finalizado",
      "finalizada",
      "concluido",
      "concluida",
      "finished"
    ].includes(getStatus());
  }

  function canEditBracket() {
    return !isLive() && !isFinished();
  }

  function roundsForCount(count) {
    const total = Number(count || 0);

    if (total <= 2) {
      return ["final"];
    }

    if (total <= 4) {
      return ["sf", "final"];
    }

    if (total <= 8) {
      return ["qf", "sf", "final"];
    }

    if (total <= 16) {
      return ["r16", "qf", "sf", "final"];
    }

    if (total <= 32) {
      return [
        "r32",
        "r16",
        "qf",
        "sf",
        "final"
      ];
    }

    return [
      "r64",
      "r32",
      "r16",
      "qf",
      "sf",
      "final"
    ];
  }

  function roundLabel(round) {
    const labels = {
      r64: "R64",
      r32: "R32",
      r16: "R16",
      qf: "QF",
      sf: "SF",
      final: "F"
    };

    return labels[round] || round;
  }

  function matchCount(round) {
    const counts = {
      r64: 32,
      r32: 16,
      r16: 8,
      qf: 4,
      sf: 2,
      final: 1
    };

    return counts[round] || 1;
  }

  function getInitialRound() {
    return roundsForCount(
      state.players.length
    )[0] || "final";
  }

  function getGlobalMatchNumber( round, localIndex ) {
    let number = 1;

    for (const currentRound of roundsForCount(
      state.players.length
    )) {
      if (currentRound === round) {
        return number + localIndex;
      }

      number += matchCount(currentRound);
    }

    return number + localIndex;
  }

  function normalizePlayer(player) {
    if (!player || !player.nome) {
      return null;
    }

    return {
      nome: String(
        player.nome || ""
      ).trim(),

      uid: String(
        player.uid || ""
      ).trim(),

      manual: Boolean(player.manual)
    };
  }

  function getRoundBaseNumber(round) {
    const rounds =
      roundsForCount(
        state.players.length
      );
  
    let number = 1;
  
    for (const currentRound of rounds) {
      if (currentRound === round) {
        return number;
      }
  
      number += matchCount(currentRound);
    }
  
    return number;
  }
  
  function getNextMatchNumber() {
    let highest = 0;
  
    Object.values(state.bracket)
      .flat()
      .forEach((match) => {
        const number =
          Number(match?.matchNumber || 0);
  
        if (number > highest) {
          highest = number;
        }
      });
  
    return highest + 1;
  }
  
  function getMatchNumber( round, index, match ) {
    if (match?.matchNumber) {
      return Number(match.matchNumber);
    }
  
    return (
      getRoundBaseNumber(round) +
      index
    );
  }

  function createEmptyBracket() {
    const bracket = {};
  
    const rounds =
      roundsForCount(
        state.players.length
      );
  
    rounds.forEach((round) => {
      bracket[round] = Array.from(
        {
          length: matchCount(round)
        },
        (_, index) => ({
          enabled: true,
          matchNumber:
            getRoundBaseNumber(round) + index,
          player1: null,
          player2: null,
          matchDateTime: "",
          resultado: null
        })
      );
    });
  
    return bracket;
  }

  function buildInitialBracket() {
    const bracket =
      createEmptyBracket();

    const initialRound =
      getInitialRound();

    const players =
      state.players
        .map(normalizePlayer)
        .filter(Boolean);

    const matches =
      bracket[initialRound] || [];

    for (
      let index = 0;
      index < players.length;
      index += 2
    ) {
      const matchIndex =
        Math.floor(index / 2);

      if (!matches[matchIndex]) {
        break;
      }

      matches[matchIndex].player1 =
        players[index] || null;

      matches[matchIndex].player2 =
        players[index + 1] || null;
    }

    propagateInitialRoundByes(bracket);

    return bracket;
  }

  function normalizeBracket(raw = {}) {
    const expectedRounds =
      roundsForCount(
        state.players.length
      );
  
    const rawRounds =
      Object.keys(raw || {})
        .filter((round) =>
          [
            "r64",
            "r32",
            "r16",
            "qf",
            "sf",
            "final"
          ].includes(round)
        );
  
    const rounds = [
      ...new Set([
        ...expectedRounds,
        ...rawRounds
      ])
    ];
  
    const bracket = {};
  
    rounds.forEach((round) => {
      const rawMatches =
        Array.isArray(raw[round])
          ? raw[round]
          : [];
  
      const minimum =
        matchCount(round);
  
      const total =
        Math.max(
          minimum,
          rawMatches.length
        );
  
      bracket[round] = Array.from(
        {
          length: total
        },
        (_, index) => {
          const match =
            rawMatches[index] || {};
  
          return {
            enabled:
              match.enabled !== false,
  
            matchNumber:
              Number(
                match.matchNumber ||
                getRoundBaseNumber(round) +
                  index
              ),
  
            player1:
              match.player1 || null,
  
            player2:
              match.player2 || null,
  
            matchDateTime:
              String(
                match.matchDateTime || ""
              ),
  
            resultado:
              match.resultado || null
          };
        }
      );
    });
  
    return bracket;
  }

  function isByePlayer(player) {
    return player?.source === "bye";
  }

  function renderSlot( round, matchIndex, slot, player, match ) {
    const empty = !player;
    const bye = isByePlayer(player);
  
    const position =
      slot === "player1"
        ? 1
        : 2;
  
    const showNumber =
      !isLive() &&
      !isFinished();
  
    const fullName =
      player?.nome || "";
  
    const name =
      getBracketShortName(
        fullName
      );
  
    const result =
      match?.resultado || null;
  
    const winnerPosition =
      Number(
        result?.winnerPosition ||
        result?.vencedorPosicao ||
        0
      );
  
    const isWinner =
      winnerPosition === position;
  
    // restante da função...
  
  
    const scoreValues = [];
  
    const sets =
      Array.isArray(result?.sets)
        ? result.sets
        : [];
  
    /* * Mostra somente os números dos sets, * sem os textos "1º set", "2º set" etc. */
    sets.forEach((set) => {
      const value =
        position === 1
          ? set.player1
          : set.player2;
  
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        scoreValues.push(
          String(value)
        );
      }
    });
  
    /* * Adiciona o super tie-break somente * se ele realmente tiver sido salvo. */
    if (result?.superTieBreak) {
      const value =
        position === 1
          ? result.superTieBreak.player1
          : result.superTieBreak.player2;
  
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        scoreValues.push(
          String(value)
        );
      }
    }
  
    const scoreText =
  scoreValues
    .map(
      value => ` <span class="bracket-score-value"> ${esc(value)} </span> `
    )
    .join("");
  
    const classes = [
      "bracket-slot",
      empty ? "empty" : "",
      bye ? "bye" : "",
      isWinner ? "is-winner" : ""
    ]
      .filter(Boolean)
      .join(" ");
  
    return ` <button type="button" class="${classes}" data-round="${esc(round)}" data-match="${matchIndex}" data-slot="${esc(slot)}" aria-label="${ empty ? "Adicionar jogador" : `Jogador ${player.nome}` }" > ${ showNumber && !empty ? ` <span class="bracket-slot-number"> ${position} </span> ` : "" } ${ empty ? ` <ion-icon name="add-outline" class="bracket-empty-add-icon" ></ion-icon> ` : ` <span class="bracket-slot-content"> <span class="bracket-player-name-wrap"> <span class="bracket-slot-name">  ${esc(name)} </span> ${ isWinner ? ` <ion-icon name="checkmark-outline" class="bracket-winner-icon" title="Vencedor" ></ion-icon> ` : "" } </span> ${
      scoreText
        ? ` <span class="bracket-slot-score"> ${scoreText} </span> `
        : ""
    } </span> ` } </button> `;
  }

  function renderMatchDate( round, matchIndex, match ) {
    if (isFinished()) {
      return match.matchDateTime
        ? ` <div class="bracket-match-date"> <input type="datetime-local" class="bracket-match-date-input" value="${esc( match.matchDateTime )}" disabled > </div> `
        : "";
    }

    return ` <div class="bracket-match-date"> <input type="datetime-local" class="bracket-match-date-input" data-date-round="${esc(round)}" data-date-match="${matchIndex}" value="${esc( match.matchDateTime || "" )}" > </div> `;
  }

  function formatSavedResult(result) {
    if (!result) {
      return "";
    }

    const sets = Array.isArray(
      result.sets
    )
      ? result.sets
      : [];

    const setText = sets
      .map(
        set =>
          `${set.player1 ?? 0} x ${ set.player2 ?? 0 }`
      )
      .join(" · ");

    const superText =
      result.superTieBreak
        ? ` · STB ${ result.superTieBreak.player1 } x ${ result.superTieBreak.player2 }`
        : "";

    return `${setText}${superText}`;
  }

  function renderMatchResult(match) {
    if (!match.resultado) {
      return "";
    }

    const winner =
      match.resultado.vencedor?.nome ||
      "";

    return ` <div class="bracket-match-result"> <span> ${esc( formatSavedResult( match.resultado ) )} </span> ${ winner ? ` <strong> ${esc(winner)} </strong> ` : "" } </div> `;
  }

  function renderResultButton( round, matchIndex, match ) {
    if (
      !isLive() ||
      isFinished() ||
      !match.player1 ||
      !match.player2
    ) {
      return "";
    }

    return ` <button type="button" class="bracket-result-btn" data-result-round="${esc(round)}" data-result-match="${matchIndex}" > <ion-icon name="stats-chart-outline"></ion-icon> <span> ${ match.resultado ? "Editar resultado" : "Informar resultado" } </span> </button> `;
  }

  function renderBoard() {
    if (!el.board) {
      return;
    }

    const allRounds =
      roundsForCount(
        state.players.length
      );

    const rounds =
      state.round === "all"
        ? allRounds
        : allRounds.filter(
            round =>
              round === state.round
          );

    if (!state.players.length) {
      el.board.innerHTML = ` <div class="bracket-message"> Nenhum jogador cadastrado neste torneio. </div> `;

      return;
    }

    el.board.innerHTML =
      rounds
        .map(round => {
          const matches =
            state.bracket[round] || [];

          const activeMatches =
            matches.filter(
              match =>
                match.enabled !== false
            );

          return ` <section class="bracket-round-column" data-round-column="${esc(round)}" > <div class="bracket-round-title">
          <span> ${esc( roundLabel(round) )} </span>
        </div> ${ canEditBracket() ? ` <button type="button" class="bracket-add-game" data-add-round="${esc(round)}" title="Adicionar jogo" > <ion-icon name="add-outline"></ion-icon> </button> ` : "" } <div class="bracket-round-matches"> ${activeMatches .map(match => { const index = matches.indexOf(match); return ` <article class="bracket-match"> <div class="bracket-match-label"> Jogo ${
  getMatchNumber(
    round,
    index,
    match
  )
} </div>${renderSlot(
  round,
  index,
  "player1",
  match.player1,
  match
)}

${renderSlot(
  round,
  index,
  "player2",
  match.player2,
  match
)} ${renderMatchDate( round, index, match )}  ${renderResultButton( round, index, match )} ${ canEditBracket() ? ` <button type="button" class="bracket-remove-game" data-remove-round="${esc(round)}" data-remove-match="${index}" title="Excluir jogo" > <ion-icon name="trash-outline"></ion-icon> </button> ` : "" } </article> `; }) .join("")} </div> </section> `;
        })
        .join("");
  }

  function isPlayerAlreadyUsed( player, currentRound = "", currentMatch = 0, currentSlot = "" ) {
    if (!player) {
      return false;
    }
  
    return Object.entries(
      state.bracket
    ).some(([round, matches]) =>
      matches.some((match, matchIndex) => {
        if (
          match.enabled === false
        ) {
          return false;
        }
  
        const positions = [
          {
            player: match.player1,
            slot: "player1"
          },
          {
            player: match.player2,
            slot: "player2"
          }
        ];
  
        return positions.some((position) => {
          const existing =
            position.player;
  
          if (!existing) {
            return false;
          }
  
          const sameCurrentPosition =
            round === currentRound &&
            matchIndex === currentMatch &&
            position.slot === currentSlot;
  
          if (sameCurrentPosition) {
            return false;
          }
  
          if (
            player.uid &&
            existing.uid
          ) {
            return (
              player.uid ===
              existing.uid
            );
          }
  
          return (
            String(existing.nome || "")
              .trim()
              .toLowerCase() ===
            String(player.nome || "")
              .trim()
              .toLowerCase()
          );
        });
      })
    );
  }

  function openPlayerModal( round, matchIndex, slot ) {
    if (isFinished()) {
      return;
    }

    const match =
      state.bracket?.[round]?.[matchIndex];

    if (!match) {
      return;
    }

    if (isByePlayer(match[slot])) {
      showMessage(
        "Este jogador avançou por BYE e não pode ser substituído.",
        "error"
      );

      return;
    }

    state.activeRound = round;
    state.activeMatch = matchIndex;
    state.activeSlot = slot;

    if (el.playerModalTitle) {
      el.playerModalTitle.textContent =
        `${roundLabel(round)} · Jogo ${ getGlobalMatchNumber( round, matchIndex ) }`;
    }

    if (el.playerModalPlayers) {
      const playersHtml =
      state.players
        .map((player, index) => {
          const alreadyUsed =
            isPlayerAlreadyUsed(
              player,
              round,
              matchIndex,
              slot
            );
    
          return ` <button type="button" class="bracket-player-option ${ alreadyUsed ? "disabled" : "" }" data-player-index="${index}" ${alreadyUsed ? "disabled" : ""} > <span> ${index + 1}. ${esc(player.nome)} </span> ${ alreadyUsed ? ` <ion-icon name="checkmark-circle-outline" ></ion-icon> ` : ` <ion-icon name="add-outline" ></ion-icon> ` } </button> `;
        })
        .join("");
    
    el.playerModalPlayers.innerHTML = ` <button type="button" class="bracket-player-option remove" data-action="remove" > <span> Retirar jogador </span> <ion-icon name="trash-outline"></ion-icon> </button> ${playersHtml} `;    }

    if (el.playerModal) {
      el.playerModal.hidden = false;
      el.playerModal.setAttribute(
        "aria-hidden",
        "false"
      );
    }
  }

  function closePlayerModal() {
    if (!el.playerModal) {
      return;
    }

    el.playerModal.hidden = true;
    el.playerModal.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function addGameToRound(round) {
    if (!canEditBracket()) {
      return;
    }
  
    if (!state.bracket[round]) {
      state.bracket[round] = [];
    }
  
    state.bracket[round].push({
      enabled: true,
  
      matchNumber:
        getNextMatchNumber(),
  
      player1: null,
      player2: null,
      matchDateTime: "",
      resultado: null
    });
  
    renderBoard();
  
    showMessage(
      "Jogo adicionado. Clique em Salvar chave.",
      "success"
    );
  }

  function updateRoundFilters() {
    const rounds =
      roundsForCount(
        state.players.length
      );
  
    document
      .querySelectorAll(".bracket-round")
      .forEach((button) => {
        const round =
          button.dataset.round;
  
        if (round === "all") {
          button.style.display =
            "inline-flex";
  
          return;
        }
  
        button.style.display =
          rounds.includes(round)
            ? "inline-flex"
            : "none";
      });
  }

  function removeGameFromRound( round, matchIndex ) {
    if (!canEditBracket()) {
      return;
    }

    const match =
      state.bracket?.[round]?.[matchIndex];

    if (!match) {
      return;
    }

    match.enabled = false;
    match.player1 = null;
    match.player2 = null;
    match.matchDateTime = "";
    match.resultado = null;

    renderBoard();
    updateRoundFilters();
    

    showMessage(
      "Jogo excluído da chave.",
      "success"
    );
  }

  function removePlayerFromPosition() {
    const match =
      state.bracket?.[
        state.activeRound
      ]?.[state.activeMatch];

    if (!match) {
      closePlayerModal();
      return;
    }

    match[state.activeSlot] = null;

    closePlayerModal();
    renderBoard();

    showMessage(
      "Jogador retirado.",
      "success"
    );
  }

  function assignPlayer(index) {
    if (isFinished()) {
      return;
    }

    const player =
      state.players[index];

    if (!player) {
      return;
    }

    const match =
      state.bracket?.[
        state.activeRound
      ]?.[state.activeMatch];

    if (!match) {
      closePlayerModal();
      return;
    }

    const used =
      Object.values(state.bracket)
        .flat()
        .some(otherMatch => {
          if (
            otherMatch.enabled === false
          ) {
            return false;
          }

          return [
            otherMatch.player1,
            otherMatch.player2
          ].some(existing => {
            if (
              !existing?.uid ||
              !player.uid
            ) {
              return false;
            }

            return (
              existing.uid === player.uid &&
              existing !==
                match[state.activeSlot]
            );
          });
        });

    if (used) {
      showMessage(
        "Este jogador já está em outra posição da chave.",
        "error"
      );

      closePlayerModal();
      return;
    }

    match[state.activeSlot] = {
      nome: player.nome,
      uid: player.uid || "",
      manual: Boolean(player.manual)
    };

    closePlayerModal();
    renderBoard();
    updateRoundFilters();

    showMessage(
      "Jogador selecionado.",
      "success"
    );
  }

  async function saveBracket() {
    if (!state.user?.uid) {
      showMessage(
        "Usuário não autenticado.",
        "error"
      );

      return;
    }

    if (isFinished()) {
      showMessage(
        "O torneio finalizado permite somente consulta.",
        "error"
      );

      return;
    }

    try {
      await db
        .collection("torneio")
        .doc(tournamentId)
        .update({
          chave: state.bracket,
          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });

      showMessage(
        "Chave salva com sucesso.",
        "success"
      );
    } catch (error) {
      console.error(
        "Erro ao salvar chave:",
        error
      );

      showMessage(
        "Não foi possível salvar a chave.",
        "error"
      );
    }
  }

  async function finishTournament() {
    if (!state.user?.uid) {
      showMessage(
        "Usuário não autenticado.",
        "error"
      );

      return;
    }

    if (isFinished()) {
      return;
    }

    const confirmed =
      window.confirm(
        "Deseja finalizar o torneio?"
      );

    if (!confirmed) {
      return;
    }

    try {
      await db
        .collection("torneio")
        .doc(tournamentId)
        .update({
          status: "finalizado",
          statusLabel: "Finalizado",

          finishedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp(),

          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });

      state.tournament.status =
        "finalizado";

      state.tournament.statusLabel =
        "Finalizado";

      updateActionVisibility();
      renderBoard();

      showMessage(
        "Torneio finalizado com sucesso!",
        "success"
      );
    } catch (error) {
      console.error(
        "Erro ao finalizar torneio:",
        error
      );

      showMessage(
        "Não foi possível finalizar o torneio.",
        "error"
      );
    }
  }

  function updateActionVisibility() {
    const status =
      getStatus();
  
    const isPreparing =
      status === "preparacao" ||
      status === "em_preparacao";
  
    if (el.saveBracket) {
      el.saveBracket.style.display =
        isFinished()
          ? "none"
          : "inline-flex";
    }
  
    /* * Finalizar chave aparece durante * Em preparação. */
    if (el.finishBracket) {
      el.finishBracket.style.display =
        isPreparing
          ? "inline-flex"
          : "none";
    }
  
    /* * Finalizar torneio aparece durante * Em andamento. */
    if (el.finishTournament) {
      el.finishTournament.style.display =
        isLive()
          ? "inline-flex"
          : "none";
    }
  }

  function clearResultFields() {
    [
      el.resultSet1Player1,
      el.resultSet1Player2,
      el.resultSet2Player1,
      el.resultSet2Player2,
      el.resultSet3Player1,
      el.resultSet3Player2,
      el.resultSuperTiePlayer1,
      el.resultSuperTiePlayer2
    ].forEach(input => {
      if (input) {
        input.value = "";
      }
    });

    showResultMessage("");
  }

  function configureResultFields() {
    const format =
      String(
        state.tournament?.formatoPartida || ""
      ).toLowerCase();
  
    const isTwoSets =
      format.includes("2 sets");
  
    const isThreeSets =
      format.includes("3 sets");
  
    if (el.resultSet2Wrapper) {
      el.resultSet2Wrapper.hidden =
        !isTwoSets && !isThreeSets;
    }
  
    if (el.resultSet3Wrapper) {
      el.resultSet3Wrapper.hidden =
        !isThreeSets;
    }
  
    /* * Sempre começa oculto. */
    if (el.resultSuperTieWrapper) {
      el.resultSuperTieWrapper.hidden =
        true;
    }
  
    updateSuperTieVisibility();
  }

  function updateSuperTieVisibility() {
    if (!el.resultSuperTieWrapper) {
      return;
    }
  
    /* * Primeiro esconde sempre. * Só será exibido se houver 1 set para cada jogador. */
    el.resultSuperTieWrapper.hidden =
      true;
  
    const format =
      String(
        state.tournament?.formatoPartida || ""
      ).toLowerCase();
  
    if (!format.includes("2 sets")) {
      return;
    }
  
    const set1Player1 =
      el.resultSet1Player1?.value;
  
    const set1Player2 =
      el.resultSet1Player2?.value;
  
    const set2Player1 =
      el.resultSet2Player1?.value;
  
    const set2Player2 =
      el.resultSet2Player2?.value;
  
    /* * Não calcula vencedor enquanto * algum set ainda estiver vazio. */
    if (
      set1Player1 === "" ||
      set1Player2 === "" ||
      set2Player1 === "" ||
      set2Player2 === ""
    ) {
      return;
    }
  
    const p1Set1 =
      Number(set1Player1);
  
    const p2Set1 =
      Number(set1Player2);
  
    const p1Set2 =
      Number(set2Player1);
  
    const p2Set2 =
      Number(set2Player2);
  
    const winnerSet1 =
      p1Set1 > p2Set1
        ? 1
        : p2Set1 > p1Set1
          ? 2
          : null;
  
    const winnerSet2 =
      p1Set2 > p2Set2
        ? 1
        : p2Set2 > p1Set2
          ? 2
          : null;
  
    /* * Só exibe quando cada jogador * venceu exatamente um set. */
    const needsSuperTie =
      winnerSet1 &&
      winnerSet2 &&
      winnerSet1 !== winnerSet2;
  
    el.resultSuperTieWrapper.hidden =
      !needsSuperTie;
  }

  function fillResultFields(result = {}) {
    const sets =
      Array.isArray(result.sets)
        ? result.sets
        : [];

    if (sets[0]) {
      el.resultSet1Player1.value =
        sets[0].player1 ?? "";

      el.resultSet1Player2.value =
        sets[0].player2 ?? "";
    }

    if (sets[1]) {
      el.resultSet2Player1.value =
        sets[1].player1 ?? "";

      el.resultSet2Player2.value =
        sets[1].player2 ?? "";
    }

    if (sets[2]) {
      el.resultSet3Player1.value =
        sets[2].player1 ?? "";

      el.resultSet3Player2.value =
        sets[2].player2 ?? "";
    }

    if (result.superTieBreak) {
      el.resultSuperTiePlayer1.value =
        result.superTieBreak.player1 ?? "";

      el.resultSuperTiePlayer2.value =
        result.superTieBreak.player2 ?? "";
    }
  }

  function openResultModal( round, matchIndex ) {
    if (
      !isLive() ||
      isFinished()
    ) {
      return;
    }

    const match =
      state.bracket?.[round]?.[matchIndex];

    if (
      !match ||
      !match.player1 ||
      !match.player2
    ) {
      showMessage(
        "Os dois jogadores precisam estar preenchidos.",
        "error"
      );

      return;
    }

    state.resultRound = round;
    state.resultMatch = matchIndex;

    if (el.resultPlayer1Name) {
      el.resultPlayer1Name.textContent =
        match.player1.nome;
    }

    if (el.resultPlayer2Name) {
      el.resultPlayer2Name.textContent =
        match.player2.nome;
    }

    clearResultFields();

configureResultFields();

if (match.resultado) {
  fillResultFields(
    match.resultado
  );
}

/* * Necessário chamar depois de preencher * os valores salvos. Caso contrário, * o super tie-break continua oculto. */
updateSuperTieVisibility();

    if (el.resultModal) {
      el.resultModal.hidden = false;
      el.resultModal.setAttribute(
        "aria-hidden",
        "false"
      );
    }
  }

  function closeResultModal() {
    if (!el.resultModal) {
      return;
    }

    el.resultModal.hidden = true;
    el.resultModal.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function readNumber(input) {
    if (!input) {
      return null;
    }

    const value =
      String(input.value || "").trim();

    if (!value) {
      return null;
    }

    return Number(value);
  }

  function validateSet(set, label) {
    if (
      set.player1 === null ||
      set.player2 === null
    ) {
      showResultMessage(
        `Informe o placar do ${label}.`
      );

      return false;
    }

    if (
      set.player1 < 0 ||
      set.player2 < 0
    ) {
      showResultMessage(
        `O placar do ${label} não pode ser negativo.`
      );

      return false;
    }

    if (
      set.player1 === set.player2
    ) {
      showResultMessage(
        `O ${label} não pode terminar empatado.`
      );

      return false;
    }

    return true;
  }

  function calculateWinner(result) {
    let sets1 = 0;
    let sets2 = 0;

    result.sets.forEach(set => {
      if (
        Number(set.player1) >
        Number(set.player2)
      ) {
        sets1++;
      }

      if (
        Number(set.player2) >
        Number(set.player1)
      ) {
        sets2++;
      }
    });

    if (sets1 > sets2) {
      return 1;
    }

    if (sets2 > sets1) {
      return 2;
    }

    if (result.superTieBreak) {
      if (
        result.superTieBreak.player1 >
        result.superTieBreak.player2
      ) {
        return 1;
      }

      if (
        result.superTieBreak.player2 >
        result.superTieBreak.player1
      ) {
        return 2;
      }
    }

    return null;
  }

  function buildResult() {
    const result = {
      formato:
        state.tournament?.formatoPartida ||
        "",

      sets: [
        {
          player1: readNumber(
            el.resultSet1Player1
          ),

          player2: readNumber(
            el.resultSet1Player2
          )
        }
      ],

      superTieBreak: null,
      finalizado: true
    };

    if (
      !validateSet(
        result.sets[0],
        "1º set"
      )
    ) {
      return null;
    }

    if (
      el.resultSet2Wrapper &&
      !el.resultSet2Wrapper.hidden
    ) {
      result.sets.push({
        player1: readNumber(
          el.resultSet2Player1
        ),

        player2: readNumber(
          el.resultSet2Player2
        )
      });

      if (
        !validateSet(
          result.sets[1],
          "2º set"
        )
      ) {
        return null;
      }
    }

    if (
      el.resultSet3Wrapper &&
      !el.resultSet3Wrapper.hidden
    ) {
      result.sets.push({
        player1: readNumber(
          el.resultSet3Player1
        ),

        player2: readNumber(
          el.resultSet3Player2
        )
      });

      if (
        !validateSet(
          result.sets[2],
          "3º set"
        )
      ) {
        return null;
      }
    }

    if (
      el.resultSuperTieWrapper &&
      !el.resultSuperTieWrapper.hidden
    ) {
      const player1 =
        readNumber(
          el.resultSuperTiePlayer1
        );
    
      const player2 =
        readNumber(
          el.resultSuperTiePlayer2
        );
    
      if (
        player1 === null ||
        player2 === null
      ) {
        showResultMessage(
          "Informe o placar do super tie-break."
        );
    
        return null;
      }
    
      if (player1 === player2) {
        showResultMessage(
          "O super tie-break não pode terminar empatado."
        );
    
        return null;
      }
    
      result.superTieBreak = {
        player1,
        player2
      };
    }

    const winnerPosition =
      calculateWinner(result);

    if (!winnerPosition) {
      showResultMessage(
        "Não foi possível identificar o vencedor."
      );

      return null;
    }

    result.winnerPosition =
      winnerPosition;

    return result;
  }

  /* * Avança o vencedor para a posição * correta da próxima fase. * * Se a posição 1 da próxima fase contém * um jogador que veio de BYE, o vencedor * entra na posição 2. * * Se a posição 2 contém BYE, o vencedor * entra na posição 1. */
  function advanceWinner( round, matchIndex, winner ) {
    const rounds =
      roundsForCount(
        state.players.length
      );
  
    const currentIndex =
      rounds.indexOf(round);
  
    if (
      currentIndex < 0 ||
      currentIndex >= rounds.length - 1
    ) {
      return {
        advanced: false,
        isLastRound: true
      };
    }
  
    const nextRound =
      rounds[currentIndex + 1];
  
    const preferredIndex =
      Math.floor(matchIndex / 2);
  
    const nextMatches =
      state.bracket[nextRound] || [];
  
    let nextMatch =
      nextMatches[preferredIndex];
  
    if (
      !nextMatch ||
      nextMatch.enabled === false
    ) {
      nextMatch =
        nextMatches.find(
          item =>
            item &&
            item.enabled !== false &&
            (
              !item.player1 ||
              !item.player2
            )
        );
    }
  
    if (!nextMatch) {
      return {
        advanced: false,
        isLastRound: false
      };
    }
  
    const winnerData = {
      nome: winner.nome,
      uid: winner.uid || "",
      manual: Boolean(winner.manual),
      source: "winner",
      sourceRound: round,
      sourceMatch: matchIndex
    };
  
    /* * Se existe jogador em cima, * o vencedor entra embaixo. */
    if (
      nextMatch.player1 &&
      !nextMatch.player2
    ) {
      nextMatch.player2 =
        winnerData;
  
      return {
        advanced: true,
        isLastRound: false
      };
    }
  
    /* * Se existe jogador embaixo, * o vencedor entra em cima. */
    if (
      !nextMatch.player2 &&
      !nextMatch.player1
    ) {
      nextMatch.player1 =
        winnerData;
  
      return {
        advanced: true,
        isLastRound: false
      };
    }
  
    if (!nextMatch.player1) {
      nextMatch.player1 =
        winnerData;
  
      return {
        advanced: true,
        isLastRound: false
      };
    }
  
    if (!nextMatch.player2) {
      nextMatch.player2 =
        winnerData;
  
      return {
        advanced: true,
        isLastRound: false
      };
    }
  
    return {
      advanced: false,
      isLastRound: false
    };
  }

  async function saveResult() {
    const match =
      state.bracket?.[
        state.resultRound
      ]?.[state.resultMatch];
  
    if (!match) {
      return;
    }
  
    const result =
      buildResult();
  
    if (!result) {
      return;
    }
  
    const winner =
      result.winnerPosition === 1
        ? match.player1
        : match.player2;
  
    if (!winner) {
      showResultMessage(
        "Vencedor não encontrado."
      );
  
      return;
    }
  
    result.vencedor = {
      nome: winner.nome,
      uid: winner.uid || ""
    };
  
    match.resultado =
      result;
  
    const rounds =
      roundsForCount(
        state.players.length
      );
  
    const lastRound =
      rounds[rounds.length - 1];
  
    const isLastRound =
      state.resultRound === lastRound;
  
    /* * Só tenta avançar o jogador se * ainda existir uma próxima fase. */
    let advanceResult = {
      advanced: false,
      isLastRound
    };
  
    if (!isLastRound) {
      advanceResult =
        advanceWinner(
          state.resultRound,
          state.resultMatch,
          winner
        );
    }
  
    /* * Se não for a final e não houver * posição na próxima rodada, interrompe. * * Na final, continua normalmente. */
    if (
      !isLastRound &&
      !advanceResult.advanced
    ) {
      showResultMessage(
        "Não foi possível encontrar uma posição vazia na próxima fase."
      );
  
      return;
    }
  
    try {
      await db
        .collection("torneio")
        .doc(tournamentId)
        .update({
          chave: state.bracket,
  
          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });
  
      closeResultModal();
  
      renderBoard();
  
      if (isLastRound) {
        showMessage(
          "Resultado da final salvo com sucesso!",
          "success"
        );
      } else {
        showMessage(
          `${winner.nome} avançou para a próxima fase.`,
          "success"
        );
      }
    } catch (error) {
      console.error(
        "Erro ao salvar resultado:",
        error
      );
  
      showResultMessage(
        "Não foi possível salvar o resultado."
      );
    }
  }
  async function finishBracket() {
    if (!state.user?.uid) {
      showMessage(
        "Usuário não autenticado.",
        "error"
      );
  
      return;
    }
  
    const status =
      getStatus();
  
    const isPreparing =
      status === "preparacao" ||
      status === "em_preparacao";
  
    if (!isPreparing) {
      showMessage(
        "A chave não está em preparação.",
        "error"
      );
  
      return;
    }
  
    const confirmed =
      window.confirm(
        "Podemos finalizar a chave do torneio?"
      );
  
    if (!confirmed) {
      return;
    }
  
    try {
      await db
        .collection("torneio")
        .doc(tournamentId)
        .update({
          chave: state.bracket,
          chavePreparada: true,
          status: "preparada",
          statusLabel: "Preparada",
  
          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });
  
      state.tournament.chavePreparada =
        true;
  
      state.tournament.status =
        "preparada";
  
      state.tournament.statusLabel =
        "Preparada";
  
      updateActionVisibility();
      renderBoard();
  
      showMessage(
        "Chave finalizada com sucesso!",
        "success"
      );
    } catch (error) {
      console.error(
        "Erro ao finalizar chave:",
        error
      );
  
      showMessage(
        "Não foi possível finalizar a chave.",
        "error"
      );
    }
  }

  async function finishTournament() {
    if (!state.user?.uid) {
      showMessage(
        "Usuário não autenticado.",
        "error"
      );

      return;
    }

    if (isFinished()) {
      return;
    }

    const confirmed =
      window.confirm(
        "Deseja finalizar o torneio?"
      );

    if (!confirmed) {
      return;
    }

    try {
      await db
        .collection("torneio")
        .doc(tournamentId)
        .update({
          status: "finalizado",
          statusLabel: "Finalizado",

          finishedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp(),

          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });

      state.tournament.status =
        "finalizado";

      state.tournament.statusLabel =
        "Finalizado";

      updateActions();
      renderBoard();

      showMessage(
        "Torneio finalizado com sucesso!",
        "success"
      );
    } catch (error) {
      console.error(
        "Erro ao finalizar torneio:",
        error
      );

      showMessage(
        "Não foi possível finalizar o torneio.",
        "error"
      );
    }
  }

  function updateActions() {
    if (el.saveBracket) {
      el.saveBracket.style.display =
        isFinished()
          ? "none"
          : "inline-flex";
    }

    if (el.finishBracket) {
      el.finishBracket.style.display =
        isPrepared()
          ? "inline-flex"
          : "none";
    }

    if (el.finishTournament) {
      el.finishTournament.style.display =
        isLive()
          ? "inline-flex"
          : "none";
    }
  }

  function clearResultFields() {
    [
      el.resultSet1Player1,
      el.resultSet1Player2,
      el.resultSet2Player1,
      el.resultSet2Player2,
      el.resultSet3Player1,
      el.resultSet3Player2,
      el.resultSuperTiePlayer1,
      el.resultSuperTiePlayer2
    ].forEach(input => {
      if (input) {
        input.value = "";
      }
    });

    showResultMessage("");
  }

  function configureResultFields() {
    const format =
      String(
        state.tournament?.formatoPartida ||
        ""
      ).toLowerCase();
  
    const isTwoSets =
      format.includes("2 sets");
  
    const isThreeSets =
      format.includes("3 sets");
  
    if (el.resultSet2Wrapper) {
      el.resultSet2Wrapper.hidden =
        !isTwoSets && !isThreeSets;
    }
  
    if (el.resultSet3Wrapper) {
      el.resultSet3Wrapper.hidden =
        !isThreeSets;
    }
  
    if (el.resultSuperTieWrapper) {
      el.resultSuperTieWrapper.hidden =
        true;
    }
  
    updateSuperTieVisibility();
  }

  function fillResultFields(result = {}) {
    const sets =
      Array.isArray(result.sets)
        ? result.sets
        : [];

    if (sets[0]) {
      el.resultSet1Player1.value =
        sets[0].player1 ?? "";

      el.resultSet1Player2.value =
        sets[0].player2 ?? "";
    }

    if (sets[1]) {
      el.resultSet2Player1.value =
        sets[1].player1 ?? "";

      el.resultSet2Player2.value =
        sets[1].player2 ?? "";
    }

    if (sets[2]) {
      el.resultSet3Player1.value =
        sets[2].player1 ?? "";

      el.resultSet3Player2.value =
        sets[2].player2 ?? "";
    }

    if (result.superTieBreak) {
      el.resultSuperTiePlayer1.value =
        result.superTieBreak.player1 ?? "";

      el.resultSuperTiePlayer2.value =
        result.superTieBreak.player2 ?? "";
    }
  }

  function openResultModal( round, matchIndex ) {
    if (
      !isLive() ||
      isFinished()
    ) {
      return;
    }
  
    const match =
      state.bracket?.[round]?.[matchIndex];
  
    if (
      !match ||
      !match.player1 ||
      !match.player2
    ) {
      showMessage(
        "Os dois jogadores precisam estar preenchidos.",
        "error"
      );
  
      return;
    }
  
    state.resultRound = round;
    state.resultMatch = matchIndex;
  
    if (el.resultPlayer1Name) {
      el.resultPlayer1Name.textContent =
        match.player1.nome;
    }
  
    if (el.resultPlayer2Name) {
      el.resultPlayer2Name.textContent =
        match.player2.nome;
    }
  
    clearResultFields();

configureResultFields();

if (match.resultado) {
  fillResultFields(
    match.resultado
  );
}

updateSuperTieVisibility();
  
    updateSuperTieVisibility();
  
    if (el.resultModal) {
      el.resultModal.hidden = false;
      el.resultModal.setAttribute(
        "aria-hidden",
        "false"
      );
    }
  }

  function closeResultModal() {
    if (!el.resultModal) {
      return;
    }

    el.resultModal.hidden = true;
    el.resultModal.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function readTournamentPlayers(data = {}) {
    const source =
      Array.isArray(data.jogadores)
        ? data.jogadores
        : Array.isArray(data.jjogadores)
          ? data.jjogadores
          : Array.isArray(data.players)
            ? data.players
            : [];
  
    return source
      .map((player, index) => {
        if (typeof player === "string") {
          const nome =
            String(player).trim();
  
          if (!nome) {
            return null;
          }
  
          return {
            posicao: index + 1,
            nome,
            uid: "",
            manual: true
          };
        }
  
        const nome =
          String(
            player?.nome ||
            player?.name ||
            player?.displayName ||
            player?.nomeJogador ||
            ""
          ).trim();
  
        if (!nome) {
          return null;
        }
  
        return {
          posicao:
            Number(
              player?.posicao ||
              index + 1
            ),
  
          nome,
  
          uid: String(
            player?.uid ||
            player?.userId ||
            ""
          ).trim(),
  
          manual: Boolean(
            player?.manual) ||
            !String(
              player?.uid ||
              player?.userId ||
              ""
            ).trim()
        };
      })
      .filter(Boolean);
  }

  async function loadTournament() {
    if (!tournamentId) {
      showMessage(
        "Torneio não informado.",
        "error"
      );

      return;
    }

    try {
      const snapshot =
        await db
          .collection("torneio")
          .doc(tournamentId)
          .get();

      if (!snapshot.exists) {
        showMessage(
          "Torneio não encontrado.",
          "error"
        );

        return;
      }

      state.tournament =
        snapshot.data() || {};

        state.players =
        readTournamentPlayers(
          state.tournament
        );

      state.bracket =
        normalizeBracket(
          state.tournament.chave || {}
        );

      if (el.name) {
        el.name.textContent =
          state.tournament.nome ||
          "Torneio";
      }

      if (el.meta) {
        el.meta.textContent =
          `${state.tournament.formatoJogo || "Simples"} · ` +
          `${state.players.length} jogador(es) · ` +
          `${state.tournament.statusLabel || "Em preparação"}`;
      }

      updateActions();
      renderBoard();
    } catch (error) {
      console.error(
        "Erro ao carregar torneio:",
        error
      );

      showMessage(
        "Não foi possível carregar o torneio.",
        "error"
      );
    }
  }

  function generateBracketPdf() {
    const tournamentName =
      state.tournament?.nome ||
      "Torneio";
  
    const rounds =
      roundsForCount(
        state.players.length
      );
  
    const reportHtml =
      rounds
        .map(round => {
          const matches =
            state.bracket?.[round] || [];
  
          const activeMatches =
            matches.filter(
              match =>
                match.enabled !== false
            );
  
          if (!activeMatches.length) {
            return "";
          }
  
          return ` <section class="pdf-round"> <h2>${esc( roundLabel(round) )}</h2> ${activeMatches .map((match, index) => { const p1 = match.player1?.nome || ""; const p2 = match.player2?.nome || ""; const result = formatSavedResult( match.resultado ); const winner = match.resultado ?.vencedor?.nome || ""; return ` <article class="pdf-match"> <strong> Jogo ${ getMatchNumber( round, index, match ) } </strong> <div class="pdf-player"> <span> ${esc(p1)} </span> ${ winner === p1 ? "<b>✓</b>" : "" } </div> <div class="pdf-player"> <span> ${esc(p2)} </span> ${ winner === p2 ? "<b>✓</b>" : "" } </div> ${ result ? ` <div class="pdf-score"> ${esc(result)} </div> ` : "" } ${ match.matchDateTime ? ` <div class="pdf-date"> ${esc( match.matchDateTime )} </div> ` : "" } </article> `; }) .join("")} </section> `;
        })
        .join("");
  
    const printWindow =
      window.open(
        "",
        "_blank",
        "width=1000,height=800"
      );
  
    if (!printWindow) {
      showMessage(
        "Permita a abertura de pop-ups para gerar o PDF.",
        "error"
      );
  
      return;
    }
  
    printWindow.document.write(` <!doctype html> <html lang="pt-BR"> <head> <meta charset="utf-8"> <title> Chave - ${esc(tournamentName)} </title> <style> * { box-sizing: border-box; } body { margin: 0; padding: 24px; color: #17213d; background: #ffffff; font-family: Arial, Helvetica, sans-serif; } h1 { margin: 0 0 6px; color: #071b72; font-size: 24px; } .pdf-subtitle { margin-bottom: 24px; color: #617089; font-size: 13px; } .pdf-round { margin-bottom: 24px; page-break-inside: avoid; } .pdf-round h2 { margin: 0 0 10px; padding-bottom: 7px; color: #05649a; border-bottom: 2px solid #05649a; font-size: 17px; } .pdf-match { display: inline-block; vertical-align: top; width: 220px; min-height: 110px; margin: 0 10px 12px 0; padding: 11px; border: 1px solid #d2d8df; border-radius: 9px; background: #f8fafc; } .pdf-match > strong { display: block; margin-bottom: 7px; color: #617089; font-size: 11px; text-transform: uppercase; } .pdf-player { display: flex; align-items: center; justify-content: space-between; min-height: 25px; padding: 4px 6px; border: 1px solid #d2d8df; border-radius: 5px; background: #ffffff; font-size: 12px; font-weight: 700; } .pdf-player + .pdf-player { margin-top: 5px; } .pdf-player b { color: #17853a; font-size: 16px; } .pdf-score { margin-top: 8px; color: #17213d; font-size: 12px; font-weight: 900; text-align: right; } .pdf-date { margin-top: 7px; color: #617089; font-size: 10px; } @media print { body { padding: 0; } } </style> </head> <body> <h1> Nome do Torneio: ${esc(tournamentName)} </h1> <div class="pdf-subtitle"> Chave do torneio </div> ${reportHtml} </body> </html> `);
  
    printWindow.document.close();
  
    printWindow.focus();
  
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  function bindEvents() {
    document
      .querySelectorAll(".bracket-round")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            document
              .querySelectorAll(
                ".bracket-round"
              )
              .forEach(item =>
                item.classList.remove(
                  "is-active"
                )
              );

            button.classList.add(
              "is-active"
            );

            state.round =
              button.dataset.round ||
              "all";

            renderBoard();
          }
        );
      });

    el.board?.addEventListener(
      "click",
      event => {
        const resultButton =
          event.target.closest(
            "[data-result-round]"
          );

        if (resultButton) {
          openResultModal(
            resultButton.dataset.resultRound,
            Number(
              resultButton.dataset.resultMatch
            )
          );

          return;
        }

        const addButton =
          event.target.closest(
            "[data-add-round]"
          );

        if (addButton) {
          addGameToRound(
            addButton.dataset.addRound
          );

          return;
        }

        const removeButton =
          event.target.closest(
            "[data-remove-round]"
          );

        if (removeButton) {
          removeGameFromRound(
            removeButton.dataset.removeRound,
            Number(
              removeButton.dataset.removeMatch
            )
          );

          return;
        }

        const slotButton =
          event.target.closest(
            "[data-round][data-match][data-slot]"
          );

        if (!slotButton) {
          return;
        }

        openPlayerModal(
          slotButton.dataset.round,
          Number(
            slotButton.dataset.match
          ),
          slotButton.dataset.slot
        );
      }
    );

    el.generatePdf?.addEventListener(
      "click",
      generateBracketPdf
    );

    el.board?.addEventListener(
      "change",
      event => {
        const input =
          event.target.closest(
            ".bracket-match-date-input"
          );

        if (!input || isFinished()) {
          return;
        }

        const match =
          state.bracket?.[
            input.dataset.dateRound
          ]?.[
            Number(
              input.dataset.dateMatch
            )
          ];

        if (!match) {
          return;
        }

        match.matchDateTime =
          input.value || "";

        showMessage(
          "Data alterada. Clique em Salvar chave.",
          "success"
        );
      }
    );

    el.playerModalPlayers?.addEventListener(
      "click",
      event => {
        const removeButton =
          event.target.closest(
            '[data-action="remove"]'
          );

        if (removeButton) {
          removePlayerFromPosition();
          return;
        }

        const playerButton =
          event.target.closest(
            "[data-player-index]"
          );

        if (playerButton) {
          assignPlayer(
            Number(
              playerButton.dataset
                .playerIndex
            )
          );
        }
      }
    );

    el.closePlayerModal?.addEventListener(
      "click",
      closePlayerModal
    );

    el.closeResultModal?.addEventListener(
      "click",
      closeResultModal
    );

    el.cancelResult?.addEventListener(
      "click",
      closeResultModal
    );

    [
      el.resultSet1Player1,
      el.resultSet1Player2,
      el.resultSet2Player1,
      el.resultSet2Player2
    ].forEach((input) => {
      input?.addEventListener(
        "input",
        updateSuperTieVisibility
      );
    });

    el.saveResult?.addEventListener(
      "click",
      saveResult
    );

    el.saveBracket?.addEventListener(
      "click",
      saveBracket
    );

    el.finishBracket?.addEventListener(
      "click",
      finishBracket
    );

    el.finishTournament?.addEventListener(
      "click",
      finishTournament
    );

    el.playerModal?.addEventListener(
      "click",
      event => {
        if (event.target === el.playerModal) {
          closePlayerModal();
        }
      }
    );

    el.resultModal?.addEventListener(
      "click",
      event => {
        if (event.target === el.resultModal) {
          closeResultModal();
        }
      }
    );
  }

  function waitForAuth() {
    return new Promise(resolve => {
      if (auth.currentUser) {
        resolve(auth.currentUser);
        return;
      }

      let resolved = false;

      const unsubscribe =
        auth.onAuthStateChanged(user => {
          if (resolved) {
            return;
          }

          resolved = true;
          unsubscribe();
          resolve(user || 

null);
        });

      setTimeout(() => {
        if (resolved) {
          return;
        }

        resolved = true;
        unsubscribe();
        resolve(auth.currentUser || null);
      }, 5000);
    });
  }

  async function init() {
    if (!db || !auth) {
      showMessage(
        "Firebase não foi carregado corretamente.",
        "error"
      );

      return;
    }

    const user =
      await waitForAuth();

    if (!user?.uid) {
      showMessage(
        "Usuário não autenticado.",
        "error"
      );

      return;
    }

    state.user = user;

    bindEvents();

    await loadTournament();
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();
