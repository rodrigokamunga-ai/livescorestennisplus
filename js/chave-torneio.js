(() => {
  "use strict";

  const params =
    new URLSearchParams(
      window.location.search
    );

  const tournamentId =
    params.get("id") || "";

  const initialCategoryId =
    params.get("categoryId") || "";

    const publicMode =
  params.get("public") === "1";

  const db =
    window.__db;

  const auth =
    window.__auth;

  const state = {
    user: null,
    tournament: null,
    categories: [],
    category: null,
    categoryId: initialCategoryId,
    players: [],
    bracket: {},
    round: "all",
    format: "Simples",

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

    categorySelect: document.getElementById(
      "bracketCategorySelect"
    ),

    
    backButton: document.querySelector(
      ".bracket-back-btn"
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
    ),

    shareBracket: document.getElementById(
      "shareBracketBtn"
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

  function normalize(value = "") {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");
  }

  function showMessage( text = "", type = "" ) {
    if (!el.message) {
      return;
    }

    el.message.textContent = text;

    el.message.className =
      `bracket-message ${type}`.trim();
  }

  function showResultMessage(text = "") {
    if (el.resultMessage) {
      el.resultMessage.textContent = text;
    }
  }

  function shortName(name = "") {
    const value =
      String(name || "")
        .trim()
        .replace(/\s+/g, " ");
  
    if (!value) {
      return "";
    }
  
    const parts =
      value.split(" ").filter(Boolean);
  
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
  
    return `${initial}.${lastName}`;
  }

  
  function participantName( participant = {} ) {
    /* * Estrutura de uma dupla: * * { * nome: "Rodrigo Camara / Renata Leal", * jogador1: { * nome: "Rodrigo Camara" * }, * jogador2: { * nome: "Renata Leal" * } * } */
  
    if (
      participant.jogador1 &&
      participant.jogador2
    ) {
      return [
        shortName(
          participant.jogador1.nome
        ),
        shortName(
          participant.jogador2.nome
        )
      ]
        .filter(Boolean)
        .join("/");
    }
  
    /* * Compatibilidade caso a dupla esteja salva * somente no campo nome. */
    const rawName =
      String(
        participant.nome ||
        participant.name ||
        ""
      ).trim();
  
    if (rawName.includes("/")) {
      return rawName
        .split("/")
        .map(name =>
          shortName(name.trim())
        )
        .filter(Boolean)
        .join("/");
    }
  
    return shortName(rawName);
  }

  function participantMarkup( participant = {} ) {
    if (
      participant.jogador1 &&
      participant.jogador2
    ) {
      const player1 =
        shortName(
          participant.jogador1.nome || ""
        );
  
      const player2 =
        shortName(
          participant.jogador2.nome || ""
        );
  
      return ` <span class="bracket-double-line"> ${esc(player1)}/ </span> <span class="bracket-double-line"> ${esc(player2)} </span> `;
    }
  
    const name =
      participantName(
        participant
      );
  
    return ` <span class="bracket-single-line"> ${esc(name)} </span> `;
  }

  function getStatus() {
    return normalize(
      state.tournament?.status || ""
    );
  }

  function isPreparing() {
    return [
      "preparacao",
      "em_preparacao"
    ].includes(getStatus());
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
    return (
      !publicMode &&
      !isFinished() &&
      !isLive()
    );
  }

  function readPlayers(data = {}) {
    const source =
      Array.isArray(data.jogadores)
        ? data.jogadores
        : Array.isArray(data.players)
          ? data.players
          : [];

    return source
      .map((player, index) => {
        if (typeof player === "string") {
          const nome =
            player.trim();

          return nome
            ? {
                posicao: index + 1,
                nome,
                uid: "",
                manual: true
              }
            : null;
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

        const uid =
          String(
            player?.uid ||
            player?.userId ||
            ""
          ).trim();

        return {
          posicao:
            Number(
              player?.posicao ||
              index + 1
            ),

          nome,
          uid,

          manual:
            Boolean(player?.manual) ||
            !uid
        };
      })
      .filter(Boolean);
  }

  function normalizeCategory( category = {}, index = 0 ) {
    return {
      id:
        String(
          category.id || ""
        ).trim() ||
        `categoria_${index + 1}`,
  
      nome:
        String(
          category.nome ||
          category.name ||
          `Categoria ${index + 1}`
        ).trim(),
  
      formatoJogo:
        String(
          category.formatoJogo ||
          category.gameFormat ||
          ""
        ).trim(),
  
      formatoPartida:
        String(
          category.formatoPartida ||
          category.matchFormat ||
          ""
        ).trim(),
  
      dataPeriodo:
        String(
          category.dataPeriodo ||
          category.dataHora ||
          ""
        ).trim(),
  
      jogadores:
        readPlayers(category),
  
      duplas:
        Array.isArray(category.duplas)
          ? category.duplas.map(dupla => ({
              id:
                String(dupla.id || "").trim(),
  
              nome:
                dupla.nome ||
                `${dupla.jogador1?.nome || ""} / ${dupla.jogador2?.nome || ""}`,
  
              jogador1: {
                uid:
                  dupla.jogador1?.uid || "",
  
                nome:
                  dupla.jogador1?.nome || ""
              },
  
              jogador2: {
                uid:
                  dupla.jogador2?.uid || "",
  
                nome:
                  dupla.jogador2?.nome || ""
              },
  
              tipo: "dupla"
            }))
          : [],
  
      chave:
        category.chave || null,
  
      chavePreparada:
        Boolean(category.chavePreparada)
    };
  }
  function getRounds() {
    const total =
      Number(state.players.length || 0);

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
    return {
      r64: "R64",
      r32: "R32",
      r16: "R16",
      qf: "QF",
      sf: "SF",
      final: "Final"
    }[round] || round;
  }

  function matchCount(round) {
    return {
      r64: 32,
      r32: 16,
      r16: 8,
      qf: 4,
      sf: 2,
      final: 1
    }[round] || 1;
  }

  function roundBaseNumber(round) {
    let number = 1;

    for (const current of getRounds()) {
      if (current === round) {
        return number;
      }

      number += matchCount(current);
    }

    return number;
  }

  function getMatchNumber( round, index, match ) {
    return Number(
      match?.matchNumber ||
      roundBaseNumber(round) + index
    );
  }

  function createEmptyBracket() {
    const bracket = {};

    for (const round of getRounds()) {
      bracket[round] =
        Array.from(
          {
            length: matchCount(round)
          },
          (_, index) => ({
            enabled: true,

            matchNumber:
              roundBaseNumber(round) +
              index,

            player1: null,
            player2: null,
            matchDateTime: "",
            resultado: null
          })
        );
    }

    return bracket;
  }

  function buildInitialBracket() {
    const bracket =
      createEmptyBracket();

    const initialRound =
      getRounds()[0];

    const matches =
      bracket[initialRound] || [];

    for (
      let index = 0;
      index < state.players.length;
      index += 2
    ) {
      const match =
        matches[Math.floor(index / 2)];

      if (!match) {
        break;
      }

      match.player1 =
        state.players[index] || null;

      match.player2 =
        state.players[index + 1] || null;
    }

    return bracket;
  }

  function normalizeBracket(raw = {}) {
    const bracket =
      createEmptyBracket();

    for (const round of getRounds()) {
      const saved =
        Array.isArray(raw[round])
          ? raw[round]
          : [];

      bracket[round] =
        bracket[round].map(
          (emptyMatch, index) => {
            const savedMatch =
              saved[index] || {};

            return {
              enabled:
                savedMatch.enabled !== false,

              matchNumber:
                Number(
                  savedMatch.matchNumber ||
                  emptyMatch.matchNumber
                ),

              player1:
                savedMatch.player1 || null,

              player2:
                savedMatch.player2 || null,

              matchDateTime:
                savedMatch.matchDateTime || "",

              resultado:
                savedMatch.resultado || null
            };
          }
        );
    }

    return bracket;
  }

  function renderCategorySelector() {
    if (!el.categorySelect) {
      return;
    }
  
    if (!state.categories.length) {
      el.categorySelect.innerHTML = ` <option value=""> Nenhuma categoria cadastrada </option> `;
  
      el.categorySelect.disabled = true;
  
      return;
    }
  
    el.categorySelect.disabled = false;
  
    el.categorySelect.innerHTML =
      state.categories
        .map(category => {
          const categoryName =
            String(
              category.nome || ""
            ).trim();
  
          const categoryFormat =
            String(
              category.formatoJogo || ""
            ).trim();
  
          const label =
            categoryFormat
              ? `${categoryName} — ${categoryFormat}`
              : categoryName;
  
          return ` <option value="${esc(category.id)}" ${ String(category.id) === String(state.categoryId) ? "selected" : "" } > ${esc(label)} </option> `;
        })
        .join("");
  }

  function changeCategory(event) {
    const selectedId =
      event.target.value || "";

    if (!selectedId) {
      return;
    }

    const url =
      new URL(window.location.href);

    url.searchParams.set(
      "id",
      tournamentId
    );

    url.searchParams.set(
      "categoryId",
      selectedId
    );

    window.location.href =
      url.toString();
  }

  function renderSlot( round, matchIndex, slot, player, match ) {
    const position =
      slot === "player1" ? 1 : 2;

    const empty =
      !player;

    const result =
      match?.resultado || {};

    const winnerPosition =
      Number(
        result.winnerPosition || 0
      );

    const isWinner =
      winnerPosition === position;

    const scores = [];

    const sets =
      Array.isArray(result.sets)
        ? result.sets
        : [];

    sets.forEach(set => {
      const value =
        position === 1
          ? set.player1
          : set.player2;

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        scores.push(value);
      }
    });

    if (result.superTieBreak) {
      const value =
        position === 1
          ? result.superTieBreak.player1
          : result.superTieBreak.player2;

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        scores.push(value);
      }
    }

    const classes = [
      "bracket-slot",
      empty ? "empty" : "",
      isWinner ? "is-winner" : ""
    ]
      .filter(Boolean)
      .join(" ");

    return ` <button type="button" class="${classes}" data-round="${esc(round)}" data-match="${matchIndex}" data-slot="${esc(slot)}" aria-label="${ empty ? "Adicionar jogador" : `Participante ${esc( participantName(player) )}` }" > ${ empty ? ` <ion-icon name="add-outline" class="bracket-empty-add-icon" ></ion-icon> ` : ` <span class="bracket-slot-number"> ${position} </span> <span class="bracket-slot-content"> <span class="bracket-player-name-wrap"> <span class="bracket-slot-name"> ${participantMarkup(player)}</span> ${ isWinner ? ` <ion-icon name="checkmark-outline" class="bracket-winner-icon" ></ion-icon> ` : "" } </span> ${ scores.length ? ` <span class="bracket-slot-score"> ${scores .map( score => ` <span class="bracket-score-value"> ${esc(score)} </span> ` ) .join("")} </span> ` : "" } </span> ` } </button> `;
  }

  function renderMatchDate( round, matchIndex, match ) {
    if (isFinished()) {
      return match.matchDateTime
        ? ` <div class="bracket-match-date"> <input type="datetime-local" class="bracket-match-date-input" value="${esc(match.matchDateTime)}" disabled > </div> `
        : "";
    }

    return ` <div class="bracket-match-date"> <input type="datetime-local" class="bracket-match-date-input" data-date-round="${esc(round)}" data-date-match="${matchIndex}" value="${esc(match.matchDateTime || "")}" > </div> `;
  }

  function formatSavedResult(result) {
    if (!result) {
      return "";
    }

    const sets =
      Array.isArray(result.sets)
        ? result.sets
        : [];

    const text =
      sets
        .map(
          set =>
            `${set.player1 ?? 0} x ${set.player2 ?? 0}`
        )
        .join(" · ");

    const tieBreak =
      result.superTieBreak
        ? ` · STB ${result.superTieBreak.player1} x ${result.superTieBreak.player2}`
        : "";

    return `${text}${tieBreak}`;
  }

  function renderMatchResult(match) {
    if (!match.resultado) {
      return "";
    }

    return ` <div class="bracket-match-result"> <span> ${esc( formatSavedResult( match.resultado ) )} </span> <strong> ${esc( match.resultado.vencedor?.nome || "" )} </strong> </div> `;
  }

  function renderResultButton( round, index, match ) {
    if (
      !isLive() ||
      isFinished() ||
      !match.player1 ||
      !match.player2
    ) {
      return "";
    }

    return ` <button type="button" class="bracket-result-btn" data-result-round="${esc(round)}" data-result-match="${index}" > <ion-icon name="stats-chart-outline"></ion-icon> <span> ${ match.resultado ? "Editar resultado" : "Informar resultado" } </span> </button> `;
  }

  function isLongMatchFormat() {
    const format =
      normalize(
        state.category?.formatoPartida ||
        ""
      );
  
    return (
      format.includes("3_sets") ||
      format.includes("2_sets")
    );
  }

  function renderBoard() {
    if (!el.board) {
      return;
    }

    if (!state.players.length) {
      el.board.innerHTML = ` <div class="bracket-message"> Nenhum jogador cadastrado nesta categoria. </div> `;

      return;
    }

    const allRounds =
      getRounds();

    const rounds =
      state.round === "all"
        ? allRounds
        : allRounds.filter(
            round =>
              round === state.round
          );

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

          return ` <section class="bracket-round-column" data-round-column="${esc(round)}" > <div class="bracket-round-title"> <span> ${esc(roundLabel(round))} </span> </div> ${ canEditBracket() ? ` <button type="button" class="bracket-add-game" data-add-round="${esc(round)}" title="Adicionar jogo" > <ion-icon name="add-outline"></ion-icon> </button> ` : "" } <div class="bracket-round-matches"> ${ activeMatches .map(match => { const index = matches.indexOf(match); return ` <article class="bracket-match ${ isLongMatchFormat() ? "bracket-match-long" : "" }"> <div class="bracket-match-label"> Jogo ${getMatchNumber( round, index, match )} </div> ${renderSlot( round, index, "player1", match.player1, match )} ${renderSlot( round, index, "player2", match.player2, match )} ${renderMatchDate( round, index, match )} ${renderMatchResult(match)} ${renderResultButton( round, index, match )} ${ canEditBracket() ? ` <button type="button" class="bracket-remove-game" data-remove-round="${esc(round)}" data-remove-match="${index}" title="Excluir jogo" > <ion-icon name="trash-outline"></ion-icon> </button> ` : "" } </article> `; }) .join("") } </div> </section> `;
        })
        .join("");
  }

  function playerAlreadyUsed( player, currentRound = "", currentMatch = 0, currentSlot = "" ) {
    return Object.entries(
      state.bracket
    ).some(([round, matches]) =>
      matches.some((match, matchIndex) => {
        if (match.enabled === false) {
          return false;
        }

        return [
          ["player1", match.player1],
          ["player2", match.player2]
        ].some(([slot, existing]) => {
          if (!existing) {
            return false;
          }

          if (
            round === currentRound &&
            matchIndex === currentMatch &&
            slot === currentSlot
          ) {
            return false;
          }

          if (
            player.uid &&
            existing.uid
          ) {
            return player.uid === existing.uid;
          }

          return normalize(
            participantName(player)
          ) === normalize(
            participantName(existing)
          );
        });
      })
    );
  }

  function openPlayerModal( round, matchIndex, slot ) {
    if (
      publicMode ||
      isFinished()
    ) {
      return;
    }

    const match =
      state.bracket?.[round]?.[matchIndex];

    if (!match) {
      return;
    }

    state.activeRound = round;
    state.activeMatch = matchIndex;
    state.activeSlot = slot;

    if (el.playerModalTitle) {
      el.playerModalTitle.textContent =
        `${roundLabel(round)} · Jogo ${getMatchNumber( round, matchIndex, match )}`;
    }

    if (el.playerModalPlayers) {
      const players =
        state.players
          .map((player, index) => {
            const used =
              playerAlreadyUsed(
                player,
                round,
                matchIndex,
                slot
              );

            return ` <button type="button" class="bracket-player-option ${ used ? "disabled" : "" }" data-player-index="${index}" ${used ? "disabled" : ""} > <span> ${index + 1}. ${esc(player.nome)} </span> <ion-icon name="${ used ? "checkmark-circle-outline" : "add-outline" }" ></ion-icon> </button> `;
          })
          .join("");

      el.playerModalPlayers.innerHTML = ` <button type="button" class="bracket-player-option remove" data-action="remove" > <span>Retirar jogador</span> <ion-icon name="trash-outline"></ion-icon> </button> ${players} `;
    }

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

  function assignPlayer(index) {
    if (publicMode) {
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
      return;
    }

    if (
      playerAlreadyUsed(
        player,
        state.activeRound,
        state.activeMatch,
        state.activeSlot
      )
    ) {
      showMessage(
        "Este jogador já está em outra posição da chave.",
        "error"
      );

      closePlayerModal();
      return;
    }

    match[state.activeSlot] = {
      id:
        player.id || "",
    
      nome:
        player.nome || "",
    
      uid:
        player.uid || "",
    
      manual:
        Boolean(player.manual),
    
      tipo:
        player.tipo || "simples",
    
      jogador1:
        player.jogador1 || null,
    
      jogador2:
        player.jogador2 || null
    };

    closePlayerModal();
    renderBoard();

    showMessage(
      "Jogador selecionado. Clique em Salvar chave.",
      "success"
    );
  }

  function removePlayer() {
    if (publicMode) {
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

    match[state.activeSlot] = null;

    closePlayerModal();
    renderBoard();

    showMessage(
      "Jogador retirado.",
      "success"
    );
  }

  function addGameToRound(round) {
    if (!canEditBracket()) {
      return;
    }

    if (!state.bracket[round]) {
      state.bracket[round] = [];
    }

    const highest =
      Object.values(state.bracket)
        .flat()
        .reduce(
          (value, match) =>
            Math.max(
              value,
              Number(match.matchNumber || 0)
            ),
          0
        );

    state.bracket[round].push({
      enabled: true,
      matchNumber: highest + 1,
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

  function removeGameFromRound( round, index ) {
    if (!canEditBracket()) {
      return;
    }

    const match =
      state.bracket?.[round]?.[index];

    if (!match) {
      return;
    }

    match.enabled = false;
    match.player1 = null;
    match.player2 = null;
    match.matchDateTime = "";
    match.resultado = null;

    renderBoard();

    showMessage(
      "Jogo removido da chave.",
      "success"
    );
  }

  async function saveCategoryData( changes = {} ) {
    const reference =
      db
        .collection("torneio")
        .doc(tournamentId);

    const snapshot =
      await reference.get();

    if (!snapshot.exists) {
      throw new Error(
        "Torneio não encontrado."
      );
    }

    const data =
      snapshot.data() || {};

    const categories =
      Array.isArray(data.categorias)
        ? data.categorias
        : [];

    const found =
      categories.some(
        category =>
          String(category.id) ===
          String(state.categoryId)
      );

    if (!found) {
      throw new Error(
        "Categoria não encontrada."
      );
    }

    const updated =
      categories.map(category => {
        if (
          String(category.id) !==
          String(state.categoryId)
        ) {
          return category;
        }

        return {
          ...category,
          ...changes
        };
      });

    await reference.update({
      categorias: updated,

      updatedAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp()
    });

    state.tournament.categorias =
      updated;

    state.category =
      updated.find(
        category =>
          String(category.id) ===
          String(state.categoryId)
      );
  }

  async function saveBracket() {

    if (publicMode) {
      showMessage(
        "A consulta pública não permite salvar alterações.",
        "error"
      );
    
      return;
    }
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
      await saveCategoryData({
        chave: state.bracket
      });

      showMessage(
        "Chave da categoria salva com sucesso.",
        "success"
      );
    } catch (error) {
      console.error(
        "Erro ao salvar chave:",
        error
      );

      showMessage(
        error.message ||
          "Não foi possível salvar a chave.",
        "error"
      );
    }
  }

  function configureResultFields() {
    const format =
      String(
        state.category?.formatoPartida ||
        state.tournament?.formatoPartida ||
        ""
      ).toLowerCase();
  
    const twoSets =
      format.includes("2 sets");
  
    const threeSets =
      format.includes("3 sets");
  
    if (el.resultSet2Wrapper) {
      el.resultSet2Wrapper.hidden =
        !twoSets && !threeSets;
    }
  
    /* * Para 3 sets, o terceiro set começa oculto. * Ele será exibido somente se os dois primeiros * sets forem vencidos por jogadores diferentes. */
    if (el.resultSet3Wrapper) {
      el.resultSet3Wrapper.hidden =
        true;
    }
  
    if (el.resultSuperTieWrapper) {
      el.resultSuperTieWrapper.hidden =
        true;
    }
  
    updateThirdSetVisibility();
  }

  function updateThirdSetVisibility() {
    if (!el.resultSet3Wrapper) {
      return;
    }
  
    const format =
      String(
        state.category?.formatoPartida ||
        state.tournament?.formatoPartida ||
        ""
      ).toLowerCase();
  
    const isThreeSets =
      format.includes("3 sets");
  
    /* * Para partidas que não são de 3 sets, * o terceiro set permanece oculto. */
    if (!isThreeSets) {
      el.resultSet3Wrapper.hidden =
        true;
  
      return;
    }
  
    const set1Player1 =
      el.resultSet1Player1?.value || "";
  
    const set1Player2 =
      el.resultSet1Player2?.value || "";
  
    const set2Player1 =
      el.resultSet2Player1?.value || "";
  
    const set2Player2 =
      el.resultSet2Player2?.value || "";
  
    /* * Enquanto o 1º ou o 2º set estiver incompleto, * o 3º set permanece oculto. */
    if (
      set1Player1 === "" ||
      set1Player2 === "" ||
      set2Player1 === "" ||
      set2Player2 === ""
    ) {
      el.resultSet3Wrapper.hidden =
        true;
  
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
  
    /* * Empate não define vencedor do set. * A validação final tratará esse erro. */
    if (
      p1Set1 === p2Set1 ||
      p1Set2 === p2Set2
    ) {
      el.resultSet3Wrapper.hidden =
        true;
  
      return;
    }
  
    const winnerSet1 =
      p1Set1 > p2Set1
        ? 1
        : 2;
  
    const winnerSet2 =
      p1Set2 > p2Set2
        ? 1
        : 2;
  
    /* * Se o mesmo jogador ganhou os dois primeiros sets, * o 3º set não deve ser preenchido. */
    if (
      winnerSet1 === winnerSet2
    ) {
      el.resultSet3Wrapper.hidden =
        true;
  
      /* * Limpa valores antigos do terceiro set, * caso o usuário tenha alterado os dois primeiros sets. */
      if (el.resultSet3Player1) {
        el.resultSet3Player1.value =
          "";
      }
  
      if (el.resultSet3Player2) {
        el.resultSet3Player2.value =
          "";
      }
  
      return;
    }
  
    /* * Se cada jogador ganhou um dos dois primeiros sets, * exibe o terceiro set. */
    el.resultSet3Wrapper.hidden =
      false;
  }

  function updateSuperTieVisibility() {
    if (!el.resultSuperTieWrapper) {
      return;
    }

    const format =
      String(
        state.category?.formatoPartida ||
        state.tournament?.formatoPartida ||
        ""
      ).toLowerCase();

    if (!format.includes("2 sets")) {
      el.resultSuperTieWrapper.hidden =
        true;

      return;
    }

    const values = [
      el.resultSet1Player1?.value,
      el.resultSet1Player2?.value,
      el.resultSet2Player1?.value,
      el.resultSet2Player2?.value
    ];

    if (values.some(value => value === "")) {
      el.resultSuperTieWrapper.hidden =
        true;

      return;
    }

    const set1Winner =
      Number(el.resultSet1Player1.value) >
      Number(el.resultSet1Player2.value)
        ? 1
        : 2;

    const set2Winner =
      Number(el.resultSet2Player1.value) >
      Number(el.resultSet2Player2.value)
        ? 1
        : 2;

    el.resultSuperTieWrapper.hidden =
      set1Winner === set2Winner;
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

  function readNumber(input) {
    if (!input) {
      return null;
    }

    const value =
      String(input.value || "").trim();

    if (!value) {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
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
    let player1Sets = 0;
    let player2Sets = 0;

    result.sets.forEach(set => {
      if (set.player1 > set.player2) {
        player1Sets++;
      }

      if (set.player2 > set.player1) {
        player2Sets++;
      }
    });

    if (player1Sets > player2Sets) {
      return 1;
    }

    if (player2Sets > player1Sets) {
      return 2;
    }

    if (result.superTieBreak) {
      return result.superTieBreak.player1 >
        result.superTieBreak.player2
        ? 1
        : 2;
    }

    return null;
  }

  function buildResult() {
    const result = {
      formato:
        state.category?.formatoPartida ||
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
          "Informe o super tie-break."
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

    const winner =
      calculateWinner(result);

    if (!winner) {
      showResultMessage(
        "Não foi possível identificar o vencedor."
      );

      return null;
    }

    result.winnerPosition =
      winner;

    return result;
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
      publicMode ||
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

/* * Recalcula a visibilidade depois de preencher * os placares salvos. */
updateThirdSetVisibility();
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

  function advanceWinner( round, matchIndex, winner ) {
    const rounds =
      getRounds();

    const currentIndex =
      rounds.indexOf(round);

    if (
      currentIndex < 0 ||
      currentIndex >= rounds.length - 1
    ) {
      return false;
    }

    const nextRound =
      rounds[currentIndex + 1];

    const nextIndex =
      Math.floor(matchIndex / 2);

    const nextMatch =
      state.bracket?.[
        nextRound
      ]?.[nextIndex];

    if (!nextMatch) {
      return false;
    }

    const winnerData = {
      nome: winner.nome,
      uid: winner.uid || "",
      manual: Boolean(winner.manual),
      source: "winner",
      sourceRound: round,
      sourceMatch: matchIndex
    };

    if (!nextMatch.player1) {
      nextMatch.player1 =
        winnerData;

      return true;
    }

    if (!nextMatch.player2) {
      nextMatch.player2 =
        winnerData;

      return true;
    }

    return false;
  }

  async function saveResult() {
    if (publicMode) {
      showResultMessage(
        "A consulta pública não permite informar resultados."
      );
    
      return;
    }
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
      getRounds();

    const finalRound =
      rounds[rounds.length - 1];

    const isFinal =
      state.resultRound === finalRound;

    if (!isFinal) {
      const advanced =
        advanceWinner(
          state.resultRound,
          state.resultMatch,
          winner
        );

      if (!advanced) {
        showResultMessage(
          "Não foi possível avançar o vencedor."
        );

        return;
      }
    }

    try {
      await saveCategoryData({
        chave: state.bracket
      });

      closeResultModal();
      renderBoard();

      showMessage(
        isFinal
          ? "Resultado da final salvo com sucesso."
          : `${winner.nome} avançou para a próxima fase.`,
        "success"
      );
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
    if (publicMode) {
      showMessage(
        "A consulta pública não permite finalizar a chave.",
        "error"
      );
    
      return;
    }
    if (!state.user?.uid) {
      showMessage(
        "Usuário não autenticado.",
        "error"
      );

      return;
    }

    if (!isPreparing()) {
      showMessage(
        "A chave não está em preparação.",
        "error"
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Finalizar a chave da categoria "${state.category?.nome || ""}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await saveCategoryData({
        chave: state.bracket,
        chavePreparada: true
      });

      await db
        .collection("torneio")
        .doc(tournamentId)
        .update({
          status: "preparada",
          statusLabel: "Preparada",

          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });

      state.tournament.status =
        "preparada";

      state.tournament.statusLabel =
        "Preparada";

      updateActions();

      showMessage(
        "Chave da categoria finalizada com sucesso.",
        "success"
      );
    } catch (error) {
      console.error(
        "Erro ao finalizar chave:",
        error
      );

      showMessage(
        error.message ||
          "Não foi possível finalizar a chave.",
        "error"
      );
    }
  }

  async function finishTournament() {
    if (publicMode) {
      showMessage(
        "A consulta pública não permite finalizar o torneio.",
        "error"
      );
    
      return;
    }
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
        "Torneio finalizado com sucesso.",
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
    const locked =
      publicMode ||
      isFinished();
  
    /* * Salvar chave */
    if (el.saveBracket) {
      el.saveBracket.disabled =
        locked;
  
      el.saveBracket.setAttribute(
        "aria-disabled",
        String(locked)
      );
    }
  
    /* * Finalizar chave */
    if (el.finishBracket) {
      el.finishBracket.disabled =
        locked;
  
      el.finishBracket.setAttribute(
        "aria-disabled",
        String(locked)
      );
    }
  
    /* * Finalizar torneio */
    if (el.finishTournament) {
      el.finishTournament.disabled =
        locked;
  
      el.finishTournament.setAttribute(
        "aria-disabled",
        String(locked)
      );
    }
  
    /* * Botão Voltar. * Links não possuem disabled nativo, * por isso usamos classe e aria-disabled. */
    if (el.backButton) {
      el.backButton.classList.toggle(
        "is-disabled",
        publicMode
      );
  
      el.backButton.setAttribute(
        "aria-disabled",
        String(publicMode)
      );
  
      if (publicMode) {
        el.backButton.setAttribute(
          "tabindex",
          "-1"
        );
      } else {
        el.backButton.removeAttribute(
          "tabindex"
        );
      }
    }
  
    /* * Marca visualmente a página pública. */
    document.body.classList.toggle(
      "is-public-view",
      publicMode
    );
  
    /* * Marca visualmente torneio finalizado. */
    document.body.classList.toggle(
      "is-finished-view",
      isFinished()
    );
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

      state.categories =
        Array.isArray(
          state.tournament.categorias
        )
          ? state.tournament.categorias.map(
              normalizeCategory
            )
          : [];

      renderCategorySelector();

      if (!state.categoryId) {
        if (el.name) {
          el.name.textContent =
            state.tournament.nome ||
            "Torneio";
        }

        if (el.meta) {
          el.meta.textContent =
            "Selecione uma categoria para montar a chave.";
        }

        if (el.board) {
          el.board.innerHTML = ` <div class="bracket-message"> Selecione uma categoria acima para visualizar a chave. </div> `;
        }

        return;
      }

      state.category =
        state.categories.find(
          category =>
            String(category.id) ===
            String(state.categoryId)
        );

      if (!state.category) {
        showMessage(
          "Categoria não encontrada neste torneio.",
          "error"
        );

        return;
      }

      state.format =
  String(
    state.category.formatoJogo ||
    "Simples"
  ).trim();

const isDoubles =
  normalize(
    state.category.formatoJogo
  ) === "duplas";

if (isDoubles) {
  state.players =
    Array.isArray(
      state.category.duplas
    )
      ? state.category.duplas
          .map(dupla => ({
            id:
              dupla.id || "",

            nome:
              dupla.nome ||
              `${dupla.jogador1?.nome || ""} / ${dupla.jogador2?.nome || ""}`,

            jogador1:
              dupla.jogador1 || null,

            jogador2:
              dupla.jogador2 || null,

            tipo: "dupla"
          }))
          .filter(
            dupla =>
              dupla.jogador1 &&
              dupla.jogador2
          )
      : [];
} else {
  state.players =
    readPlayers(
      state.category
    );
}

updateFormatButtons();

state.bracket =
  state.category.chave
    ? normalizeBracket(
        state.category.chave
      )
    : buildInitialBracket();
      if (el.categorySelect) {
        el.categorySelect.value =
          state.categoryId;
      }

      if (el.name) {
        el.name.textContent =
          state.tournament.nome ||
          "Torneio";
      }

      if (el.meta) {
        el.meta.textContent =
          `${state.category.nome} — ` +
          `${state.category.formatoJogo || "Formato não informado"} · ` +
          `${state.category.formatoPartida || "Partida não informada"} · ` +
          `${state.players.length} participante(s) · ` +
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
        error.message ||
          "Não foi possível carregar o torneio.",
        "error"
      );
    }
  }

  async function shareBracket() {
    if (!state.categoryId) {
      showMessage(
        "Selecione uma categoria antes de compartilhar.",
        "error"
      );
  
      return;
    }
  
    try {
      await db
        .collection("torneio")
        .doc(tournamentId)
        .update({
          shareEnabled: true,
  
          sharedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });
    } catch (error) {
      console.error(
        "Erro ao habilitar compartilhamento:",
        error
      );
  
      showMessage(
        "Não foi possível liberar o acesso público.",
        "error"
      );
  
      return;
    }
  
    const url =
      new URL(
        window.location.href
      );
  
    url.searchParams.set(
      "id",
      tournamentId
    );
  
    url.searchParams.set(
      "categoryId",
      state.categoryId
    );
  
    url.searchParams.set(
      "public",
      "1"
    );
  
    const shareUrl =
      url.toString();
  
    const title =
      `${state.tournament?.nome || "Torneio"} - ${ state.category?.nome || "Categoria" }`;
  
    try {
      if (
        navigator.share &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({
          title,
          text: title,
          url: shareUrl
        });
  
        return;
      }
  
      if (
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(
          shareUrl
        );
  
        showMessage(
          "Link público copiado.",
          "success"
        );
  
        return;
      }
  
      window.prompt(
        "Copie o link público:",
        shareUrl
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
  
      showMessage(
        "Não foi possível compartilhar a chave.",
        "error"
      );
    }
  }

  function generateBracketPdf() {
    const tournamentName =
      state.tournament?.nome ||
      "Torneio";
  
    const categoryName =
      state.category?.nome ||
      "Categoria";
  
    const content =
      getRounds()
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
  
          return ` <section class="pdf-round"> <h2> ${esc(roundLabel(round))} </h2> ${ activeMatches .map((match, index) => ` <article class="pdf-match"> <strong> Jogo ${getMatchNumber( round, index, match )} </strong> <div class="pdf-player"> ${esc( match.player1?.nome || "A definir" )} </div> <div class="pdf-player"> ${esc( match.player2?.nome || "A definir" )} </div> ${ match.resultado ? ` <div class="pdf-score"> ${esc( formatSavedResult( match.resultado ) )} </div> ` : "" } </article> `) .join("") } </section> `;
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
        "Permita pop-ups para gerar o PDF.",
        "error"
      );
  
      return;
    }
  
    printWindow.document.write(` <!doctype html> <html lang="pt-BR"> <head> <meta charset="utf-8"> <title> ${esc(tournamentName)} </title> <style> body { margin: 0; padding: 24px; color: #17213d; font-family: Arial, sans-serif; } h1 { color: #071b72; } .subtitle { margin-bottom: 24px; color: #617089; } .pdf-round { margin-bottom: 24px; page-break-inside: avoid; } .pdf-round h2 { padding-bottom: 8px; color: #05649a; border-bottom: 2px solid #05649a; } .pdf-match { display: inline-block; width: 220px; min-height: 100px; margin: 0 10px 12px 0; padding: 11px; vertical-align: top; border: 1px solid #d2d8df; border-radius: 8px; background: #f8fafc; } .pdf-match strong { display: block; margin-bottom: 8px; color: #617089; font-size: 11px; } .pdf-player { margin-top: 5px; padding: 7px; border: 1px solid #d2d8df; border-radius: 5px; background: #ffffff; font-size: 12px; font-weight: bold; } .pdf-score { margin-top: 8px; font-size: 12px; font-weight: bold; text-align: right; } </style> </head> <body> <h1> ${esc(tournamentName)} </h1> <div class="subtitle"> Categoria: ${esc(categoryName)} </div> ${content} </body> </html> `);
  
    printWindow.document.close();
    printWindow.focus();
  
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  function updateFormatButtons() {
    const currentFormat =
      normalize(
        state.category?.formatoJogo ||
        state.format ||
        "Simples"
      );
  
    document
      .querySelectorAll(".bracket-toggle")
      .forEach(button => {
        const buttonFormat =
          normalize(
            button.dataset.format || ""
          );
  
        const isSelected =
          buttonFormat === currentFormat;
  
        button.classList.toggle(
          "is-active",
          isSelected
        );
  
        /* * O formato da chave é definido pela categoria. * O outro botão fica desabilitado. */
        button.disabled =
          !isSelected;
  
        button.setAttribute(
          "aria-disabled",
          String(!isSelected)
        );
      });
  }

  function bindEvents() {
    el.backButton?.addEventListener(
      "click",
      event => {
        if (!publicMode) {
          return;
        }
  
        event.preventDefault();
  
        showMessage(
          "O botão Voltar está desabilitado na consulta pública.",
          "error"
        );
      }
    );
  
    el.categorySelect?.addEventListener(
      "change",
      changeCategory
    );
  
    el.generatePdf?.addEventListener(
      "click",
      event => {
        event.preventDefault();
        generateBracketPdf();
      }
    );
  
    el.shareBracket?.addEventListener(
      "click",
      event => {
        event.preventDefault();
        shareBracket();
      }
    );
  
    /* * Filtro Simples/Duplas */
    document
  .querySelectorAll(".bracket-toggle")
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        const selectedFormat =
          normalize(
            button.dataset.format ||
            ""
          );

        const categoryFormat =
          normalize(
            state.category?.formatoJogo ||
            ""
          );

        if (
          selectedFormat !==
          categoryFormat
        ) {
          showMessage(
            `Esta categoria está configurada como "${state.category?.formatoJogo || "não informado"}".`,
            "error"
          );

          updateFormatButtons();

          return;
        }

        state.format =
          button.dataset.format ||
          "Simples";

        updateFormatButtons();
        renderBoard();
      }
    );
  });
  
    /* * Filtro das fases da chave */
    document
      .querySelectorAll(".bracket-round")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const selectedRound =
              button.dataset.round || "all";
  
            state.round =
              selectedRound;
  
            document
              .querySelectorAll(
                ".bracket-round"
              )
              .forEach(item => {
                item.classList.toggle(
                  "is-active",
                  item === button
                );
              });
  
            renderBoard();
          }
        );
      });
  
    
    // restante dos eventos...

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
            Number(input.dataset.dateMatch)
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
          removePlayer();
          return;
        }

        const playerButton =
          event.target.closest(
            "[data-player-index]"
          );

        if (playerButton) {
          assignPlayer(
            Number(
              playerButton.dataset.playerIndex
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
    ].forEach(input => {
      input?.addEventListener(
        "input",
        () => {
          updateThirdSetVisibility();
          updateSuperTieVisibility();
        }
      );
    });

    el.saveBracket?.addEventListener(
      "click",
      saveBracket
    );

    el.saveResult?.addEventListener(
      "click",
      saveResult
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
      if (auth?.currentUser) {
        resolve(auth.currentUser);
        return;
      }

      let finished = false;

      const unsubscribe =
        auth.onAuthStateChanged(user => {
          if (finished) {
            return;
          }

          finished = true;
          unsubscribe();
          resolve(user || null);
        });

      setTimeout(() => {
        if (finished) {
          return;
        }

        finished = true;
        unsubscribe();
        resolve(auth.currentUser || null);
      }, 5000);
    });
  }

  async function init() {
    if (!db) {
      showMessage(
        "Firebase não foi carregado corretamente.",
        "error"
      );
  
      return;
    }
  
    if (publicMode) {
      state.user = null;
  
      bindEvents();
  
      await loadTournament();
  
      updateActions();
  
      return;
    }
  
    if (!auth) {
      showMessage(
        "Firebase Auth não foi carregado corretamente.",
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
  
    updateActions();
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();
