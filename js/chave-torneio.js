(() => {
  "use strict";

  const params = new URLSearchParams(
    window.location.search
  );

  const tournamentId =
    params.get("id") || "";

  const publicMode =
    params.get("public") === "1";

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

  function shortName(name = "") {
    const text = String(name || "")
      .trim()
      .replace(/\s+/g, " ");

    if (!text) return "";

    const parts = text.split(" ");

    if (parts.length === 1) {
      return parts[0];
    }

    return `${parts[0].charAt(0).toUpperCase()}. ${ parts[parts.length - 1] }`;
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
    const status = normalizeStatus(
      state.tournament?.status || ""
    );

    const label = normalizeStatus(
      state.tournament?.statusLabel || ""
    );

    return [
      "iniciado",
      "andamento",
      "em_andamento"
    ].includes(status) ||
    [
      "iniciado",
      "andamento",
      "em_andamento"
    ].includes(label);
  }

  function isFinished() {
    const status = normalizeStatus(
      state.tournament?.status || ""
    );

    const label = normalizeStatus(
      state.tournament?.statusLabel || ""
    );

    return [
      "finalizado",
      "finalizada",
      "concluido",
      "concluida",
      "finished"
    ].includes(status) ||
    [
      "finalizado",
      "finalizada",
      "concluido",
      "concluida",
      "finished"
    ].includes(label);
  }

  function canEditBracket() {
    return !isLive() && !isFinished();
  }

  function roundsForCount(count) {
    const total = Number(count || 0);

    if (total <= 2) return ["final"];
    if (total <= 4) return ["sf", "final"];
    if (total <= 8) return ["qf", "sf", "final"];
    if (total <= 16) {
      return ["r16", "qf", "sf", "final"];
    }

    if (total <= 32) {
      return ["r32", "r16", "qf", "sf", "final"];
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
      final: "F"
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

  function getRoundBaseNumber(round) {
    let number = 1;

    for (const current of roundsForCount(
      state.players.length
    )) {
      if (current === round) {
        return number;
      }

      number += matchCount(current);
    }

    return number;
  }

  function getMatchNumber(round, index, match) {
    return Number(
      match?.matchNumber ||
      getRoundBaseNumber(round) + index
    );
  }

  function normalizePlayer(player) {
    if (!player || !player.nome) {
      return null;
    }

    return {
      nome: String(player.nome).trim(),
      uid: String(player.uid || "").trim(),
      manual: Boolean(player.manual)
    };
  }

  function createEmptyBracket() {
    const bracket = {};

    roundsForCount(
      state.players.length
    ).forEach(round => {
      bracket[round] = Array.from(
        { length: matchCount(round) },
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

  function normalizeBracket(raw = {}) {
    const expected =
      roundsForCount(
        state.players.length
      );

    const savedRounds =
      Object.keys(raw).filter(round =>
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
        ...expected,
        ...savedRounds
      ])
    ];

    const bracket = {};

    rounds.forEach(round => {
      const saved =
        Array.isArray(raw[round])
          ? raw[round]
          : [];

      const total = Math.max(
        matchCount(round),
        saved.length
      );

      bracket[round] = Array.from(
        { length: total },
        (_, index) => {
          const match = saved[index] || {};

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

  function renderSlot( round, matchIndex, slot, player, match ) {
    const empty = !player;

    const position =
      slot === "player1" ? 1 : 2;

    const result =
      match?.resultado || null;

    const winnerPosition =
      Number(
        result?.winnerPosition || 0
      );

    const winner =
      winnerPosition === position;

    const scores = [];

    const sets = Array.isArray(
      result?.sets
    )
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
        scores.push(
          `<span>${esc(value)}</span>`
        );
      }
    });

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
        scores.push(
          `<span>${esc(value)}</span>`
        );
      }
    }

    return ` <button type="button" class="bracket-slot ${ empty ? "empty" : "" } ${winner ? "is-winner" : ""}" data-round="${esc(round)}" data-match="${matchIndex}" data-slot="${slot}" > ${ empty ? ` <ion-icon name="add-outline" class="bracket-empty-add-icon" ></ion-icon> ` : ` <span class="bracket-slot-content"> <span class="bracket-player-name-wrap"> <span class="bracket-slot-name"> ${esc(shortName(player.nome))} </span> ${ winner ? ` <ion-icon name="${ round === "final" ? "trophy-outline" : "checkmark-outline" }" class="${ round === "final" ? "bracket-champion-icon" : "bracket-winner-icon" }" ></ion-icon> ` : "" } </span> ${ scores.length ? ` <span class="bracket-slot-score"> ${scores.join("")} </span> ` : "" } </span> ` } </button> `;
  }

  function renderMatchDate(round, index, match) {
    if (isFinished()) {
      return match.matchDateTime
        ? ` <div class="bracket-match-date"> <input type="datetime-local" class="bracket-match-date-input" value="${esc(match.matchDateTime)}" disabled > </div> `
        : "";
    }

    return ` <div class="bracket-match-date"> <input type="datetime-local" class="bracket-match-date-input" data-date-round="${esc(round)}" data-date-match="${index}" value="${esc(match.matchDateTime || "")}" > </div> `;
  }

  function renderResultButton(round, index, match) {
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

  function renderBoard() {
    if (!el.board) return;

    const rounds =
      state.round === "all"
        ? roundsForCount(
            state.players.length
          )
        : [state.round];

    el.board.innerHTML =
      rounds
        .map(round => {
          const matches =
            state.bracket[round] || [];

          const active =
            matches.filter(
              match =>
                match.enabled !== false
            );

          return ` <section class="bracket-round-column" > <div class="bracket-round-title"> <span> ${esc(roundLabel(round))} </span> </div> <div class="bracket-round-matches"> ${active .map(match => { const index = matches.indexOf(match); return ` <article class="bracket-match"> <div class="bracket-match-label"> Jogo ${getMatchNumber( round, index, match )} </div> ${renderSlot( round, index, "player1", match.player1, match )} ${renderSlot( round, index, "player2", match.player2, match )} ${renderMatchDate( round, index, match )} ${renderResultButton( round, index, match )} </article> `; }) .join("")} </div> </section> `;
        })
        .join("");
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
      if (input) input.value = "";
    });

    showResultMessage("");
  }

  function updateSuperTieVisibility() {
    if (!el.resultSuperTieWrapper) return;

    el.resultSuperTieWrapper.hidden = true;

    const format =
      String(
        state.tournament?.formatoPartida || ""
      ).toLowerCase();

    if (!format.includes("2 sets")) {
      return;
    }

    const s1p1 =
      el.resultSet1Player1?.value;

    const s1p2 =
      el.resultSet1Player2?.value;

    const s2p1 =
      el.resultSet2Player1?.value;

    const s2p2 =
      el.resultSet2Player2?.value;

    if (
      s1p1 === "" ||
      s1p2 === "" ||
      s2p1 === "" ||
      s2p2 === ""
    ) {
      return;
    }

    const winner1 =
      Number(s1p1) > Number(s1p2)
        ? 1
        : Number(s2p1) > Number(s2p2)
          ? 2
          : null;

    const winner2 =
      Number(s2p1) > Number(s2p2)
        ? 1
        : Number(s2p2) > Number(s2p1)
          ? 2
          : null;

    const show =
      winner1 &&
      winner2 &&
      winner1 !== winner2;

    el.resultSuperTieWrapper.hidden =
      !show;
  }

  function configureResultFields() {
    const format =
      String(
        state.tournament?.formatoPartida || ""
      ).toLowerCase();

    const twoSets =
      format.includes("2 sets");

    const threeSets =
      format.includes("3 sets");

    if (el.resultSet2Wrapper) {
      el.resultSet2Wrapper.hidden =
        !twoSets && !threeSets;
    }

    if (el.resultSet3Wrapper) {
      el.resultSet3Wrapper.hidden =
        !threeSets;
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

  function openResultModal(round, index) {
    if (!isLive() || isFinished()) {
      return;
    }

    const match =
      state.bracket?.[round]?.[index];

    if (
      !match ||
      !match.player1 ||
      !match.player2
    ) {
      return;
    }

    state.resultRound = round;
    state.resultMatch = index;

    el.resultPlayer1Name.textContent =
      match.player1.nome;

    el.resultPlayer2Name.textContent =
      match.player2.nome;

    clearResultFields();
    configureResultFields();

    if (match.resultado) {
      fillResultFields(
        match.resultado
      );

      updateSuperTieVisibility();
    }

    el.resultModal.hidden = false;
  }

  function closeResultModal() {
    if (el.resultModal) {
      el.resultModal.hidden = true;
    }
  }

  function readNumber(input) {
    if (!input) return null;

    const value =
      String(input.value || "").trim();

    return value === ""
      ? null
      : Number(value);
  }

  function buildResult() {
    const result = {
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
      result.sets[0].player1 === null ||
      result.sets[0].player2 === null
    ) {
      showResultMessage(
        "Informe o resultado do 1º set."
      );

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
    }

    if (
      el.resultSuperTieWrapper &&
      !el.resultSuperTieWrapper.hidden
    ) {
      result.superTieBreak = {
        player1: readNumber(
          el.resultSuperTiePlayer1
        ),

        player2: readNumber(
          el.resultSuperTiePlayer2
        )
      };
    }

    let sets1 = 0;
    let sets2 = 0;

    result.sets.forEach(set => {
      if (set.player1 > set.player2) {
        sets1++;
      }

      if (set.player2 > set.player1) {
        sets2++;
      }
    });

    let winnerPosition = null;

    if (sets1 > sets2) {
      winnerPosition = 1;
    } else if (sets2 > sets1) {
      winnerPosition = 2;
    } else if (result.superTieBreak) {
      winnerPosition =
        result.superTieBreak.player1 >
        result.superTieBreak.player2
          ? 1
          : 2;
    }

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

  function advanceWinner( round, index, winner ) {
    const rounds =
      roundsForCount(
        state.players.length
      );

    const current =
      rounds.indexOf(round);

    if (
      current < 0 ||
      current >= rounds.length - 1
    ) {
      return {
        advanced: false,
        final: true
      };
    }

    const nextRound =
      rounds[current + 1];

    const nextMatches =
      state.bracket[nextRound] || [];

    const nextIndex =
      Math.floor(index / 2);

    const nextMatch =
      nextMatches[nextIndex];

    if (!nextMatch) {
      return {
        advanced: false,
        final: false
      };
    }

    const winnerData = {
      nome: winner.nome,
      uid: winner.uid || "",
      manual: Boolean(winner.manual),
      source: "winner"
    };

    if (
      nextMatch.player1 &&
      !nextMatch.player2
    ) {
      nextMatch.player2 =
        winnerData;

      return {
        advanced: true,
        final: false
      };
    }

    if (
      nextMatch.player2 &&
      !nextMatch.player1
    ) {
      nextMatch.player1 =
        winnerData;

      return {
        advanced: true,
        final: false
      };
    }

    if (!nextMatch.player1) {
      nextMatch.player1 =
        winnerData;

      return {
        advanced: true,
        final: false
      };
    }

    if (!nextMatch.player2) {
      nextMatch.player2 =
        winnerData;

      return {
        advanced: true,
        final: false
      };
    }

    return {
      advanced: false,
      final: false
    };
  }

  async function saveResult() {
    const match =
      state.bracket?.[
        state.resultRound
      ]?.[state.resultMatch];

    if (!match) return;

    const result =
      buildResult();

    if (!result) return;

    const winner =
      result.winnerPosition === 1
        ? match.player1
        : match.player2;

    result.vencedor = {
      nome: winner.nome,
      uid: winner.uid || ""
    };

    match.resultado =
      result;

    const advanced =
      advanceWinner(
        state.resultRound,
        state.resultMatch,
        winner
      );

    if (
      !advanced.advanced &&
      !advanced.final
    ) {
      showResultMessage(
        "Não foi possível encontrar uma posição vazia na próxima fase."
      );

      return;
    }

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

    showMessage(
      advanced.final
        ? "Resultado da final salvo com sucesso!"
        : `${winner.nome} avançou para a próxima fase.`,
      "success"
    );
  }

  async function finishTournament() {
    const confirmed =
      window.confirm(
        "Deseja finalizar o torneio?"
      );

    if (!confirmed) return;

    await db
      .collection("torneio")
      .doc(tournamentId)
      .update({
        status: "finalizado",
        statusLabel: "Finalizado",
        finishedAt:
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
  }

  function updateActions() {
    if (publicMode) {
      [
        el.saveBracket,
        el.finishBracket,
        el.finishTournament,
        el.shareBracket
      ].forEach(button => {
        if (button) {
          button.style.display = "none";
          button.disabled = true;
        }
      });

      document
        .querySelector(".bracket-back-btn")
        ?.remove();

      return;
    }

    if (el.saveBracket) {
      el.saveBracket.style.display =
        isFinished()
          ? "none"
          : "inline-flex";
    }

    if (el.finishBracket) {
      el.finishBracket.style.display =
        getStatus() === "preparacao"
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

  async function shareBracket() {
    const ref =
      db.collection("torneio")
        .doc(tournamentId);

    const snapshot =
      await ref.get();

    if (!snapshot.exists) return;

    const data =
      snapshot.data() || {};

    const token =
      data.shareToken ||
      crypto.randomUUID();

    if (!data.shareToken) {
      await ref.update({
        shareToken: token,
        shareEnabled: true
      });
    }

    const url =
      new URL(
        "chave-torneio.html",
        window.location.href
      );

    url.searchParams.set(
      "id",
      tournamentId
    );

    url.searchParams.set(
      "public",
      "1"
    );

    url.searchParams.set(
      "token",
      token
    );

    const shareUrl =
      url.toString();

    if (navigator.share) {
      await navigator.share({
        title:
          `Chave - ${data.nome || "Torneio"}`,
        url: shareUrl
      });

      return;
    }

    await navigator.clipboard?.writeText(
      shareUrl
    );

    showMessage(
      "Link da chave copiado.",
      "success"
    );
  }

  function generateBracketPdf() {
    const tournamentName =
      state.tournament?.nome ||
      "Torneio";
  
    const board =
      document.getElementById(
        "bracketBoard"
      );
  
    if (!board) {
      showMessage(
        "A chave ainda não foi carregada.",
        "error"
      );
  
      return;
    }
  
    const boardHtml =
      board.innerHTML;
  
    const printWindow =
      window.open(
        "",
        "_blank",
        "width=1600,height=1000"
      );
  
    if (!printWindow) {
      showMessage(
        "Permita pop-ups para gerar o PDF.",
        "error"
      );
  
      return;
    }
  
    const cssUrl =
      new URL(
        "css/chave-torneio.css",
        window.location.href
      ).href;
  
    printWindow.document.open();
  
    printWindow.document.write(` <!doctype html> <html lang="pt-BR"> <head> <meta charset="utf-8"> <title> Chave - ${esc(tournamentName)} </title> <link rel="stylesheet" href="${cssUrl}" > <style> @page { size: landscape; margin: 10mm; } * { box-sizing: border-box; } html, body { width: 100%; min-height: 100%; margin: 0; padding: 0; color: #17213d; background: #ffffff; font-family: Arial, Helvetica, sans-serif; } body { padding: 12px; } .pdf-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; width: 100%; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #05649a; } .pdf-title { margin: 0; color: #071b72; font-size: 22px; font-weight: 900; } .pdf-subtitle { margin-top: 4px; color: #617089; font-size: 11px; } /* * Mantém a chave completa na horizontal, * como aparece na tela. */ .pdf-bracket-board { display: flex !important; flex-direction: row !important; align-items: stretch !important; justify-content: flex-start !important; gap: 0 !important; width: 100% !important; min-height: 0 !important; overflow: visible !important; padding: 10px !important; border: 1px solid #d2d8df !important; border-radius: 12px !important; background: #ffffff !important; box-shadow: none !important; } .pdf-bracket-board .bracket-round-column { display: flex !important; flex: 1 1 0 !important; flex-direction: column !important; min-width: 0 !important; width: auto !important; padding: 0 8px !important; } .pdf-bracket-board .bracket-round-title { display: flex !important; align-items: center !important; justify-content: flex-start !important; min-height: 30px !important; margin-bottom: 10px !important; padding: 0 0 6px !important; color: #071b72 !important; border-bottom: 1px solid #e4e8ed !important; font-size: 12px !important; font-weight: 900 !important; } .pdf-bracket-board .bracket-round-title span:last-child { display: none !important; } .pdf-bracket-board .bracket-round-matches { display: flex !important; flex: 1 !important; flex-direction: column !important; justify-content: space-around !important; gap: 10px !important; } .pdf-bracket-board .bracket-match { position: relative !important; width: 100% !important; min-width: 0 !important; margin: 0 !important; padding: 8px !important; border: 1px solid #d2d8df !important; border-radius: 9px !important; background: #f8fafc !important; box-shadow: none !important; page-break-inside: avoid !important; } .pdf-bracket-board .bracket-match::after { display: block !important; right: -9px !important; width: 9px !important; border-top: 1px solid #9eabb8 !important; } .pdf-bracket-board .bracket-round-column:last-child .bracket-match::after { display: none !important; } .pdf-bracket-board .bracket-match-label { margin-bottom: 5px !important; color: #617089 !important; font-size: 9px !important; font-weight: 900 !important; } .pdf-bracket-board .bracket-slot { min-height: 28px !important; margin-top: 4px !important; padding: 5px 6px !important; border-radius: 5px !important; font-size: 10px !important; cursor: default !important; } .pdf-bracket-board .bracket-slot:hover { color: #05649a !important; border-color: #d2d8df !important; background: #ffffff !important; } .pdf-bracket-board .bracket-slot-number { width: 16px !important; height: 16px !important; font-size: 8px !important; } .pdf-bracket-board .bracket-slot-name { font-size: 10px !important; white-space: nowrap !important; } .pdf-bracket-board .bracket-slot-score { min-width: 38px !important; font-size: 10px !important; } .pdf-bracket-board .bracket-winner-icon { width: 13px !important; height: 13px !important; font-size: 13px !important; } .pdf-bracket-board .bracket-match-date { display: none !important; } .pdf-bracket-board .bracket-result-btn, .pdf-bracket-board .bracket-remove-game, .pdf-bracket-board .bracket-add-game { display: none !important; } .pdf-bracket-board .bracket-match-result { display: none !important; } .pdf-bracket-board .bracket-slot.empty { min-height: 28px !important; height: 28px !important; visibility: visible !important; border-style: dashed !important; background: #ffffff !important; } .pdf-bracket-board .bracket-slot.empty .bracket-empty-add-icon { display: none !important; } @media print { html, body { width: 100%; min-height: 100%; overflow: visible !important; } .pdf-bracket-board { page-break-inside: avoid !important; } .pdf-bracket-board .bracket-round-column { break-inside: avoid !important; } .pdf-bracket-board .bracket-match { break-inside: avoid !important; } } </style> </head> <body> <header class="pdf-header"> <div> <h1 class="pdf-title"> Nome do Torneio: ${esc(tournamentName)} </h1> <div class="pdf-subtitle"> Chave completa do torneio </div> </div> <div class="pdf-subtitle"> ${esc( state.tournament?.statusLabel || "" )} </div> </header> <section class="bracket-board pdf-bracket-board" > ${boardHtml} </section> </body> </html> `);
  
    printWindow.document.close();
  
    printWindow.focus();
  
    setTimeout(() => {
      printWindow.print();
    }, 700);
  }

  async function loadTournament() {
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
      Array.isArray(
        state.tournament.jogadores
      )
        ? state.tournament.jogadores
            .map(normalizePlayer)
            .filter(Boolean)
        : [];

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
        `${state.tournament.statusLabel || ""}`;
    }

    updateActions();
    renderBoard();
  }

  function bindEvents() {
    el.board?.addEventListener(
      "click",
      event => {
        const result =
          event.target.closest(
            "[data-result-round]"
          );

        if (result) {
          openResultModal(
            result.dataset.resultRound,
            Number(
              result.dataset.resultMatch
            )
          );

          return;
        }
      }
    );

    el.saveResult?.addEventListener(
      "click",
      saveResult
    );

    el.closeResultModal?.addEventListener(
      "click",
      closeResultModal
    );

    el.cancelResult?.addEventListener(
      "click",
      closeResultModal
    );

    el.finishTournament?.addEventListener(
      "click",
      finishTournament
    );

    el.generatePdf?.addEventListener(
      "click",
      generateBracketPdf
    );

    el.shareBracket?.addEventListener(
      "click",
      shareBracket
    );

    [
      el.resultSet1Player1,
      el.resultSet1Player2,
      el.resultSet2Player1,
      el.resultSet2Player2
    ].forEach(input => {
      input?.addEventListener(
        "input",
        updateSuperTieVisibility
      );
    });
  }

  async function init() {
    if (!db || !auth) {
      return;
    }

    const user =
      await new Promise(resolve => {
        if (auth.currentUser) {
          resolve(auth.currentUser);
          return;
        }

        const unsubscribe =
          auth.onAuthStateChanged(user => {
            unsubscribe();
            resolve(user);
          });
      });

    if (!user?.uid && !publicMode) {
      showMessage(
        "Usuário não autenticado.",
        "error"
      );

      return;
    }

    state.user = user || null;

    bindEvents();
    await loadTournament();
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();
