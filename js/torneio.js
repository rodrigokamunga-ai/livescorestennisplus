(() => {
  "use strict";

  const COLLECTION = "torneio";

  const ADMIN_KEY = "lsts_admin_session";
  const BIO_KEY = "lsts_biometric_session";
  const BIO_UID_KEY = "lsts_biometric_uid";
  const BIO_CURRENT_KEY = "lsts_biometric_current";

  const state = {
    user: null,
    tournaments: [],
    players: [],
    unsubscribe: null,
    searchTimer: null
  };

  const el = {
    wrapper: document.getElementById(
      "tournamentFormWrapper"
    ),

    form: document.getElementById(
      "tournamentForm"
    ),

    title: document.getElementById(
      "tournamentFormTitle"
    ),

    docId: document.getElementById(
      "tournamentDocId"
    ),

    name: document.getElementById(
      "tournamentName"
    ),

    game: document.getElementById(
      "tournamentGameFormat"
    ),

    match: document.getElementById(
      "tournamentMatchFormat"
    ),

    dateRange: document.getElementById(
      "tournamentDateRange"
    ),

    togglePlayers: document.getElementById(
      "toggleTournamentPlayersBtn"
    ),

    selected: document.getElementById(
      "tournamentSelectedPlayers"
    ),

    list: document.getElementById(
      "tournamentList"
    ),

    message: document.getElementById(
      "tournamentMessage"
    ),

    newBtn: document.getElementById(
      "newTournamentBtn"
    ),

    cancelBtn: document.getElementById(
      "cancelTournamentBtn"
    ),

    openSearch: document.getElementById(
      "openTournamentPlayerSearchBtn"
    ),

    modal: document.getElementById(
      "tournamentSearchModal"
    ),

    closeModal: document.getElementById(
      "closeTournamentSearchBtn"
    ),

    searchInput: document.getElementById(
      "tournamentSearchInput"
    ),

    searchStatus: document.getElementById(
      "tournamentSearchStatus"
    ),

    results: document.getElementById(
      "tournamentSearchResults"
    ),

    manualBox: document.getElementById(
      "tournamentManualPlayerBox"
    ),

    manualInput: document.getElementById(
      "tournamentManualPlayerInput"
    ),

    addManual: document.getElementById(
      "addTournamentManualPlayerBtn"
    ),

    confirm: document.getElementById(
      "tournamentConfirmModal"
    ),

    confirmText: document.getElementById(
      "tournamentConfirmMessage"
    ),

    confirmYes: document.getElementById(
      "tournamentConfirmYes"
    ),

    confirmNo: document.getElementById(
      "tournamentConfirmNo"
    )
  };

  const U = {
    norm(value = "") {
      return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    },

    esc(value = "") {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    getName(data = {}) {
      return String(
        data.displayName ||
        data.name ||
        data.fullName ||
        data.nome ||
        data.ownerName ||
        data.playerName ||
        ""
      ).trim();
    },

    getUid(data = {}, docId = "") {
      return String(
        data.uid ||
        data.userId ||
        data.ownerId ||
        docId ||
        ""
      ).trim();
    }
  };

  function message(text = "", type = "") {
    if (!el.message) {
      return;
    }

    el.message.textContent = text;
    el.message.className =
      `tournament-message ${type}`.trim();
  }

  function hasSession() {
    return (
      localStorage.getItem(ADMIN_KEY) === "1" ||
      localStorage.getItem(BIO_KEY) === "1"
    );
  }

  function isFinalizedTournament(data = {}) {
    const status =
      String(data.status || "")
        .trim()
        .toLowerCase();

    const label =
      U.norm(data.statusLabel || "");

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

  function getBiometricUser() {
    try {
      const data = JSON.parse(
        localStorage.getItem(
          BIO_CURRENT_KEY
        ) || "{}"
      );

      return {
        uid:
          data.uid ||
          localStorage.getItem(BIO_UID_KEY) ||
          "",

        email: data.email || "",

        displayName:
          data.displayName || ""
      };
    } catch (_) {
      return {
        uid:
          localStorage.getItem(BIO_UID_KEY) ||
          "",

        email: "",
        displayName: ""
      };
    }
  }

  async function resolveUser(user) {
    if (user?.uid) {
      state.user = {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || ""
      };

      return state.user;
    }

    if (
      localStorage.getItem(BIO_KEY) === "1"
    ) {
      const fallback =
        getBiometricUser();

      if (fallback.uid) {
        state.user = fallback;
        return fallback;
      }
    }

    return null;
  }

  function readPlayersFromTournament(data = {}) {
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

  function openForm(data = null, id = "") {
    if (!el.wrapper) {
      return;
    }

    el.form?.reset();

    if (el.docId) {
      el.docId.value = id;
    }

    if (el.title) {
      el.title.textContent = id
        ? "Editar torneio"
        : "Novo torneio";
    }

    if (data) {
      if (el.name) {
        el.name.value =
          data.nome || "";
      }

      if (el.game) {
        el.game.value =
          data.formatoJogo || "";
      }

      if (el.match) {
        el.match.value =
          data.formatoPartida || "";
      }

      if (el.dateRange) {
        el.dateRange.value =
          data.dataPeriodo ||
          data.dataHora ||
          "";
      }

      state.players =
        readPlayersFromTournament(data);
    } else {
      state.players = [];
    }

    renderPlayers();

    if (el.selected) {
      el.selected.classList.remove(
        "is-collapsed"
      );
    }

    if (el.togglePlayers) {
      el.togglePlayers.setAttribute(
        "aria-expanded",
        "true"
      );

      el.togglePlayers.innerHTML = ` <ion-icon name="eye-off-outline"></ion-icon> <span>Ocultar jogadores</span> `;
    }

    el.wrapper.hidden = false;

    el.wrapper.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function closeForm() {
    if (!el.wrapper) {
      return;
    }

    el.wrapper.hidden = true;

    el.form?.reset();

    if (el.docId) {
      el.docId.value = "";
    }

    if (el.title) {
      el.title.textContent =
        "Novo torneio";
    }

    state.players = [];

    renderPlayers();
    message("");
  }

  function renderPlayers() {
    if (!el.selected) {
      return;
    }

    if (!state.players.length) {
      el.selected.innerHTML = ` <div class="tournament-selected-empty"> Nenhum jogador adicionado ao torneio. </div> `;

      return;
    }

    el.selected.innerHTML =
      state.players
        .map(
          (player, index) => ` <div class="tournament-selected-player"> <span class="tournament-selected-number"> ${index + 1} </span> <span class="tournament-selected-name"> ${U.esc(player.nome)} </span> <button type="button" class="tournament-remove-player" data-remove-player="${U.esc( player.uid || player.nome )}" aria-label="Remover jogador" > <ion-icon name="close-outline"></ion-icon> </button> </div> `
        )
        .join("");
  }

  function addPlayer( name, uid = "", manual = false ) {
    const cleanName =
      String(name || "").trim();

    const cleanUid =
      String(uid || "").trim();

    if (!cleanName) {
      return;
    }

    const exists =
      state.players.some(
        player =>
          (
            cleanUid &&
            player.uid &&
            cleanUid === player.uid
          ) ||
          U.norm(player.nome) ===
            U.norm(cleanName)
      );

    if (exists) {
      if (el.searchStatus) {
        el.searchStatus.textContent =
          "Este jogador já foi adicionado.";
      }

      return;
    }

    state.players.push({
      posicao:
        state.players.length + 1,

      nome: cleanName,

      uid: cleanUid,

      manual:
        manual || !cleanUid
    });

    renderPlayers();
    closeSearch();
  }

  function removePlayer(key) {
    state.players =
      state.players
        .filter(
          player =>
            (player.uid || player.nome) !==
            key
        )
        .map((player, index) => ({
          ...player,
          posicao: index + 1
        }));

    renderPlayers();
  }

  function openSearch() {
    if (!el.modal) {
      return;
    }

    el.modal.hidden = false;
    el.modal.setAttribute(
      "aria-hidden",
      "false"
    );

    if (el.searchInput) {
      el.searchInput.value = "";
    }

    if (el.results) {
      el.results.innerHTML = "";
    }

    if (el.searchStatus) {
      el.searchStatus.textContent =
        "Digite pelo menos 2 letras.";
    }

    if (el.manualBox) {
      el.manualBox.hidden = true;
    }

    if (el.manualInput) {
      el.manualInput.value = "";
    }

    setTimeout(() => {
      el.searchInput?.focus();
    }, 100);
  }

  function closeSearch() {
    if (!el.modal) {
      return;
    }

    el.modal.hidden = true;
    el.modal.setAttribute(
      "aria-hidden",
      "true"
    );

    if (el.searchInput) {
      el.searchInput.value = "";
    }

    if (el.results) {
      el.results.innerHTML = "";
    }

    if (el.manualBox) {
      el.manualBox.hidden = true;
    }

    if (el.manualInput) {
      el.manualInput.value = "";
    }
  }

  async function findPlayers(query) {
    const q = U.norm(query);

    if (q.length < 2) {
      return [];
    }

    const map = new Map();

    for (const collection of [
      "users",
      "profiles"
    ]) {
      try {
        const snapshot =
          await __db
            .collection(collection)
            .get();

        snapshot.forEach(doc => {
          const data =
            doc.data() || {};

          const name =
            U.getName(data);

          const searchText =
            U.norm(
              [
                data.displayName,
                data.searchName,
                data.name,
                data.nome,
                data.email
              ]
                .filter(Boolean)
                .join(" ")
            );

          if (
            !name ||
            !searchText.includes(q)
          ) {
            return;
          }

          const uid =
            U.getUid(data, doc.id);

          const item = {
            id: doc.id,
            uid,
            name,
            data,
            collection
          };

          const previous =
            map.get(uid);

          if (
            !previous ||
            (
              collection === "profiles" &&
              previous.collection !== "profiles"
            )
          ) {
            map.set(uid, item);
          }
        });
      } catch (error) {
        console.warn(
          `Erro ao buscar em ${collection}:`,
          error
        );
      }
    }

    return [
      ...map.values()
    ].slice(0, 20);
  }

  function renderSearchResults(players) {
    if (!el.results) {
      return;
    }

    if (!players.length) {
      el.results.innerHTML = ` <div class="tournament-search-empty"> Nenhum jogador encontrado. </div> `;

      if (el.manualBox) {
        el.manualBox.hidden = false;
      }

      return;
    }

    if (el.manualBox) {
      el.manualBox.hidden = true;
    }

    el.results.innerHTML =
      players
        .map(
          player => ` <button type="button" class="tournament-search-result" data-player-name="${U.esc( player.name )}" data-player-uid="${U.esc( player.uid )}" > <span class="tournament-search-avatar"> ${U.esc( player.name .charAt(0) .toUpperCase() )} </span> <span class="tournament-search-result-main"> <strong> ${U.esc(player.name)} </strong> <small> ID: ${U.esc( player.uid || player.id )} </small> </span> <ion-icon name="chevron-forward-outline" ></ion-icon> </button> `
        )
        .join("");
  }

  function handleSearch() {
    clearTimeout(state.searchTimer);

    const query =
      el.searchInput?.value.trim() || "";

    if (query.length < 2) {
      if (el.searchStatus) {
        el.searchStatus.textContent =
          "Digite pelo menos 2 letras.";
      }

      if (el.results) {
        el.results.innerHTML = "";
      }

      if (el.manualBox) {
        el.manualBox.hidden = true;
      }

      return;
    }

    if (el.searchStatus) {
      el.searchStatus.textContent =
        "Pesquisando...";
    }

    state.searchTimer =
      setTimeout(async () => {
        const players =
          await findPlayers(query);

        renderSearchResults(players);

        if (el.searchStatus) {
          el.searchStatus.textContent =
            players.length
              ? `${players.length} jogador(es) encontrado(s).`
              : "Nenhum jogador encontrado.";
        }
      }, 300);
  }

  function buildTournamentData(previous = {}) {
    const jogadores =
      state.players.map(
        (player, index) => ({
          posicao: index + 1,

          nome: String(
            player.nome || ""
          ).trim(),

          uid: String(
            player.uid || ""
          ).trim(),

          manual: Boolean(
            player.manual
          )
        })
      );

    return {
      nome:
        el.name?.value.trim() || "",

      formatoJogo:
        el.game?.value.trim() || "",

      formatoPartida:
        el.match?.value.trim() || "",

      dataPeriodo:
        el.dateRange?.value.trim() || "",

      dataHora:
        el.dateRange?.value.trim() || "",

      status:
        previous.status ||
        "preparacao",

      statusLabel:
        previous.statusLabel ||
        "Em preparação",

      chavePreparada:
        Boolean(
          previous.chavePreparada
        ),

      jogadores,

      chave:
        previous.chave || {
          faseInicial: "",
          r32: [],
          r16: [],
          qf: [],
          sf: [],
          final: []
        },

      ownerId:
        state.user.uid,

      ownerEmail:
        state.user.email || "",

      updatedAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp()
    };
  }

  async function save(event) {
    event.preventDefault();

    if (!state.user?.uid) {
      message(
        "Usuário não autenticado. Faça login novamente.",
        "error"
      );

      return;
    }

    if (!el.form?.checkValidity()) {
      el.form?.reportValidity();
      return;
    }

    if (state.players.length < 2) {
      message(
        "Adicione pelo menos 2 jogadores.",
        "error"
      );

      return;
    }

    if (
      el.game?.value === "Duplas" &&
      state.players.length % 2 !== 0
    ) {
      message(
        "Para Duplas, a quantidade de jogadores deve ser par.",
        "error"
      );

      return;
    }

    const isEditing =
      Boolean(el.docId?.value);

    const confirmed =
      window.confirm(
        isEditing
          ? "Deseja alterar este torneio?"
          : "Deseja salvar este torneio?"
      );

    if (!confirmed) {
      message(
        "Operação cancelada.",
        "error"
      );

      return;
    }

    const id =
      el.docId?.value || "";

    const previous =
      id
        ? state.tournaments.find(
            tournament =>
              tournament.id === id
          )?.data || {}
        : {};

    const data =
      buildTournamentData(previous);

    try {
      if (id) {
        await __db
          .collection(COLLECTION)
          .doc(id)
          .update(data);

        message(
          "Torneio atualizado com sucesso.",
          "success"
        );
      } else {
        await __db
          .collection(COLLECTION)
          .add({
            ...data,

            createdAt:
              firebase.firestore
                .FieldValue
                .serverTimestamp()
          });

        message(
          "Torneio cadastrado com sucesso.",
          "success"
        );
      }

      setTimeout(
        closeForm,
        700
      );
    } catch (error) {
      console.error(
        "Erro ao salvar torneio:",
        error
      );

      message(
        error.message ||
          "Erro ao salvar o torneio.",
        "error"
      );
    }
  }

  async function startTournament(id) {
    const item =
      state.tournaments.find(
        tournament =>
          tournament.id === id
      );

    if (!item) {
      message(
        "Torneio não encontrado.",
        "error"
      );

      return;
    }

    const status =
      String(item.data.status || "")
        .trim()
        .toLowerCase();

    const label =
      U.norm(
        item.data.statusLabel || ""
      );

    const canOpen =
      [
        "preparada",
        "iniciado",
        "andamento",
        "em_andamento",
        "concluida",
        "concluido",
        "finalizada",
        "finished"
      ].includes(status) ||
      [
        "preparada",
        "em andamento",
        "concluida",
        "concluido",
        "finalizada",
        "finalizado"
      ].includes(label);

    if (!canOpen) {
      message(
        "Finalize a chave antes de abrir o torneio.",
        "error"
      );

      return;
    }

    if (
      status !== "preparada" &&
      label !== "preparada"
    ) {
      window.location.href =
        `chave-torneio.html?id=${encodeURIComponent( id )}&mode=live`;

      return;
    }

    const confirmed =
      window.confirm(
        `Deseja iniciar o torneio "${ item.data.nome || "" }"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await __db
        .collection(COLLECTION)
        .doc(id)
        .update({
          status: "iniciado",
          statusLabel: "Em andamento",

          startedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp(),

          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });

      window.location.href =
        `chave-torneio.html?id=${encodeURIComponent( id )}&mode=live`;
    } catch (error) {
      console.error(
        "Erro ao iniciar torneio:",
        error
      );

      message(
        error.message ||
          "Não foi possível iniciar o torneio.",
        "error"
      );
    }
  }

  function renderList() {
    if (!el.list) {
      return;
    }
  
    if (!state.tournaments.length) {
      el.list.innerHTML = ` <div class="tournament-empty-card"> <ion-icon name="trophy-outline"></ion-icon> <strong> Nenhum torneio cadastrado </strong> <span> Toque em “Novo torneio” para começar. </span> </div> `;
  
      return;
    }
  
    el.list.innerHTML =
      state.tournaments
        .map((item) => {
          const data =
            item.data || {};
  
          const players =
            Array.isArray(data.jogadores)
              ? data.jogadores
              : [];
  
          const statusValue =
            String(data.status || "")
              .trim()
              .toLowerCase();
  
          const playerListId =
            `tournamentPlayers_${item.id}`;
  
          const openLabel =
            statusValue === "preparada"
              ? "Iniciar"
              : "Abrir";
  
          return ` <article class="tournament-card" data-tournament-card="${U.esc( item.id )}" > <div class="tournament-card-top"> <div class="tournament-card-icon"> <ion-icon name="trophy-outline"></ion-icon> </div> <div class="tournament-card-heading"> <h3> ${U.esc( data.nome || "Torneio sem nome" )} </h3> <span> ${U.esc( data.statusLabel || "Em preparação" )} </span> </div> <span class="tournament-status-badge"> ${U.esc( data.statusLabel || "Em preparação" )} </span> </div> <div class="tournament-card-info"> <div> <span>Formato</span> <strong> ${U.esc( data.formatoJogo || "-" )} </strong> </div> <div> <span>Partida</span> <strong> ${U.esc( data.formatoPartida || "-" )} </strong> </div> <div> <span>Jogadores</span> <strong> ${players.length} </strong> </div> <div> <span>Período</span> <strong> ${U.esc( data.dataPeriodo || data.dataHora || "Não informado" )} </strong> </div> </div> <button type="button" class="tournament-toggle-card-players" data-action="toggle-card-players" data-target="${U.esc( playerListId )}" aria-expanded="false" > <ion-icon name="people-outline"></ion-icon> <span>Mostrar jogadores</span> </button> <div id="${U.esc(playerListId)}" class="tournament-card-player-list is-hidden" > ${ players.length ? players .map( (player, index) => ` <span class="tournament-player-chip"> <span class="tournament-player-chip-number"> ${index + 1} </span> <span> ${U.esc( player.nome )} </span> </span> ` ) .join("") : ` <span class="tournament-empty-players"> Nenhum jogador informado </span> ` } </div> <div class="tournament-card-actions"> <button type="button" class="tournament-btn tournament-btn-primary" data-action="bracket" data-id="${U.esc(item.id)}" > <ion-icon name="git-network-outline"></ion-icon> <span>Chave</span> </button> <button type="button" class="tournament-btn tournament-btn-start" data-action="start" data-id="${U.esc(item.id)}" > <ion-icon name="play-outline"></ion-icon> <span>${openLabel}</span> </button> <button type="button" class="tournament-btn tournament-btn-secondary" data-action="edit" data-id="${U.esc(item.id)}" > <ion-icon name="pencil-outline"></ion-icon> <span>Editar</span> </button> <button type="button" class="tournament-btn tournament-btn-danger" data-action="delete" data-id="${U.esc(item.id)}" > <ion-icon name="trash-outline"></ion-icon> <span>Excluir</span> </button> </div> </article> `;
        })
        .join("");
  }
  function listenTournaments() {
    if (!state.user?.uid) {
      return;
    }

    if (state.unsubscribe) {
      state.unsubscribe();
    }

    state.unsubscribe =
      __db
        .collection(COLLECTION)
        .where(
          "ownerId",
          "==",
          state.user.uid
        )
        .onSnapshot(
          snapshot => {
            state.tournaments =
              snapshot.docs.map(
                doc => ({
                  id: doc.id,
                  data: doc.data() || {}
                })
              );

            renderList();
          },
          error => {
            console.error(
              "Erro ao carregar torneios:",
              error
            );

            message(
              "Não foi possível carregar os torneios.",
              "error"
            );
          }
        );
  }

  function confirmDelete(id) {
    const item =
      state.tournaments.find(
        tournament =>
          tournament.id === id
      );

    if (!item) {
      return;
    }

    if (el.confirmText) {
      el.confirmText.textContent =
        `Deseja excluir o torneio "${ item.data.nome || "" }"?`;
    }

    if (el.confirm) {
      el.confirm.hidden = false;
    }

    if (el.confirmYes) {
      el.confirmYes.onclick =
        async () => {
          try {
            await __db
              .collection(COLLECTION)
              .doc(id)
              .delete();

            message(
              "Torneio excluído com sucesso.",
              "success"
            );
          } catch (error) {
            console.error(
              "Erro ao excluir torneio:",
              error
            );

            message(
              error.message ||
                "Erro ao excluir o torneio.",
              "error"
            );
          } finally {
            if (el.confirm) {
              el.confirm.hidden = true;
            }
          }
        };
    }

    if (el.confirmNo) {
      el.confirmNo.onclick = () => {
        if (el.confirm) {
          el.confirm.hidden = true;
        }
      };
    }
  }

  function togglePlayersVisibility() {
    if (!el.selected) {
      return;
    }

    const hidden =
      el.selected.classList.toggle(
        "is-collapsed"
      );

    if (el.togglePlayers) {
      el.togglePlayers.setAttribute(
        "aria-expanded",
        String(!hidden)
      );

      el.togglePlayers.innerHTML =
        hidden
          ? ` <ion-icon name="eye-outline"></ion-icon> <span>Mostrar jogadores</span> `
          : ` <ion-icon name="eye-off-outline"></ion-icon> <span>Ocultar jogadores</span> `;
    }
  }

  function toggleCardPlayers(event) {
    const button =
      event.target.closest(
        '[data-action="toggle-card-players"]'
      );

    if (!button) {
      return false;
    }

    const targetId =
      button.dataset.target || "";

    const playerList =
      document.getElementById(targetId);

    if (!playerList) {
      return true;
    }

    const hidden =
      playerList.classList.toggle(
        "is-hidden"
      );

    button.setAttribute(
      "aria-expanded",
      String(!hidden)
    );

    button.innerHTML =
      hidden
        ? ` <ion-icon name="people-outline"></ion-icon> <span>Mostrar jogadores</span> `
        : ` <ion-icon name="eye-off-outline"></ion-icon> <span>Ocultar jogadores</span> `;

    return true;
  }

  function bindEvents() {
    el.form?.addEventListener(
      "submit",
      save
    );

    el.newBtn?.addEventListener(
      "click",
      () => openForm()
    );

    el.cancelBtn?.addEventListener(
      "click",
      closeForm
    );

    el.openSearch?.addEventListener(
      "click",
      openSearch
    );

    el.closeModal?.addEventListener(
      "click",
      closeSearch
    );

    el.searchInput?.addEventListener(
      "input",
      handleSearch
    );

    el.togglePlayers?.addEventListener(
      "click",
      togglePlayersVisibility
    );

    el.addManual?.addEventListener(
      "click",
      () => {
        addPlayer(
          el.manualInput?.value || "",
          "",
          true
        );
      }
    );

    el.results?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            ".tournament-search-result"
          );

        if (!button) {
          return;
        }

        addPlayer(
          button.dataset.playerName || "",
          button.dataset.playerUid || "",
          false
        );
      }
    );

    el.selected?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-remove-player]"
          );

        if (!button) {
          return;
        }

        removePlayer(
          button.dataset.removePlayer
        );
      }
    );

    el.list?.addEventListener(
      "click",
      async event => {
        if (toggleCardPlayers(event)) {
          return;
        }

        const button =
          event.target.closest(
            "[data-action]"
          );

        if (!button) {
          return;
        }

        const id =
          button.dataset.id || "";

        const action =
          button.dataset.action || "";

        const item =
          state.tournaments.find(
            tournament =>
              tournament.id === id
          );

        if (!item) {
          return;
        }

        if (action === "bracket") {
          window.location.href =
            `chave-torneio.html?id=${encodeURIComponent( id )}`;

          return;
        }

        if (action === "start") {
          await startTournament(id);
          return;
        }

        if (action === "edit") {
          if (
            isFinalizedTournament(
              item.data
            )
          ) {
            message(
              "Torneios finalizados não podem ser alterados.",
              "error"
            );

            return;
          }

          openForm(item.data, id);
          return;
        }

        if (action === "delete") {
          confirmDelete(id);
        }
      }
    );

    el.modal?.addEventListener(
      "click",
      event => {
        if (event.target === el.modal) {
          closeSearch();
        }
      }
    );

    document.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape") {
          closeSearch();
        }
      }
    );
  }

  async function init() {
    if (!hasSession()) {
      window.location.replace(
        "login.html"
      );

      return;
    }

    if (
      !window.__auth ||
      !window.__db
    ) {
      message(
        "Firebase não foi carregado corretamente.",
        "error"
      );

      return;
    }

    bindEvents();
    renderPlayers();
    renderList();

    __auth.onAuthStateChanged(
      async user => {
        const resolved =
          await resolveUser(user);

        if (!resolved?.uid) {
          message(
            "Usuário não autenticado. Faça login novamente.",
            "error"
          );

          return;
        }

        listenTournaments();
      }
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();
