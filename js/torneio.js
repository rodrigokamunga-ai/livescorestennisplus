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
    categories: [],
    activeCategoryId: null,
  
    /* * Jogadores selecionados para formar uma dupla. */
    selectedPairPlayers: [],
  
    unsubscribe: null,
    searchTimer: null
  };

  const el = {
    wrapper: document.getElementById("tournamentFormWrapper"),
    form: document.getElementById("tournamentForm"),
    title: document.getElementById("tournamentFormTitle"),
    docId: document.getElementById("tournamentDocId"),
    name: document.getElementById("tournamentName"),

    categoryName: document.getElementById(
      "tournamentCategoryName"
    ),

    addCategory: document.getElementById(
      "addTournamentCategoryBtn"
    ),

    categories: document.getElementById(
      "tournamentCategories"
    ),

    list: document.getElementById("tournamentList"),
    message: document.getElementById("tournamentMessage"),
    newBtn: document.getElementById("newTournamentBtn"),
    cancelBtn: document.getElementById("cancelTournamentBtn"),

    modal: document.getElementById("tournamentSearchModal"),
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

    id(value = "") {
      return `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}_${U.norm(value)
        .replace(/[^a-z0-9]+/g, "_")}`;
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
    if (!el.message) return;

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

  function getBiometricUser() {
    try {
      const data = JSON.parse(
        localStorage.getItem(BIO_CURRENT_KEY) || "{}"
      );

      return {
        uid:
          data.uid ||
          localStorage.getItem(BIO_UID_KEY) ||
          "",
        email: data.email || "",
        displayName: data.displayName || ""
      };
    } catch (_) {
      return {
        uid: localStorage.getItem(BIO_UID_KEY) || "",
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

    if (localStorage.getItem(BIO_KEY) === "1") {
      const fallback = getBiometricUser();

      if (fallback.uid) {
        state.user = fallback;
        return fallback;
      }
    }

    return null;
  }

  function isFinalizedTournament(data = {}) {
    const status = U.norm(data.status);
    const label = U.norm(data.statusLabel);

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
          const nome = player.trim();

          return nome
            ? {
                posicao: index + 1,
                nome,
                uid: "",
                manual: true
              }
            : null;
        }

        const nome = String(
          player?.nome ||
          player?.name ||
          player?.displayName ||
          player?.nomeJogador ||
          ""
        ).trim();

        if (!nome) return null;

        const uid = String(
          player?.uid ||
          player?.userId ||
          ""
        ).trim();

        return {
          posicao:
            Number(player?.posicao || index + 1),
          nome,
          uid,
          manual:
            Boolean(player?.manual) || !uid
        };
      })
      .filter(Boolean);
  }

  function normalizeCategory( category = {}, index = 0 ) {
    return {
      id:
        String(category.id || "").trim() ||
        U.id(
          category.nome ||
          `categoria_${index + 1}`
        ),
  
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
  
      dataHora:
        String(
          category.dataHora ||
          category.dataPeriodo ||
          ""
        ).trim(),
  
        jogadores:
        readPlayersFromTournament(category),
      
      duplas:
        Array.isArray(category.duplas)
          ? category.duplas
          : [],
      
      chave:
        category.chave || null,
  
      chavePreparada:
        Boolean(category.chavePreparada),
  
      status:
        category.status || "",
  
      statusLabel:
        category.statusLabel || ""
    };
  }

  function readCategoriesFromTournament(data = {}) {
    if (Array.isArray(data.categorias)) {
      return data.categorias.map(normalizeCategory);
    }

    if (
      data.formatoJogo ||
      data.formatoPartida ||
      data.dataPeriodo ||
      data.dataHora ||
      Array.isArray(data.jogadores)
    ) {
      return [
        normalizeCategory({
          id: U.id("categoria_principal"),
          nome: "Categoria principal",
          formatoJogo: data.formatoJogo || "",
          formatoPartida: data.formatoPartida || "",
          dataPeriodo:
            data.dataPeriodo || data.dataHora || "",
          jogadores: data.jogadores || []
        })
      ];
    }

    return [];
  }

  function openForm(data = null, id = "") {
    if (!el.wrapper) return;

    el.form?.reset();

    if (el.docId) el.docId.value = id;

    if (el.title) {
      el.title.textContent = id
        ? "Editar torneio"
        : "Novo torneio";
    }

    state.categories = data
      ? readCategoriesFromTournament(data)
      : [];

    state.activeCategoryId = null;
    state.selectedPairPlayers = [];

    if (el.name) {
      el.name.value = data?.nome || "";
    }

    renderCategories();

    el.wrapper.hidden = false;

    el.wrapper.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function closeForm() {
    if (!el.wrapper) return;

    el.wrapper.hidden = true;
    el.form?.reset();

    if (el.docId) el.docId.value = "";

    if (el.title) {
      el.title.textContent = "Novo torneio";
    }

    state.categories = [];
    state.activeCategoryId = null;
    state.selectedPairPlayers = [];

    renderCategories();
    message("");
  }

  function addCategory() {
    const name = el.categoryName?.value.trim() || "";

    if (!name) {
      message("Informe o nome da categoria.", "error");
      el.categoryName?.focus();
      return;
    }

    

    state.categories.push({
      id: U.id(name),
      nome: name,
      formatoJogo: "",
      formatoPartida: "",
      dataPeriodo: "",
      jogadores: [],
      duplas: []
    });

    if (el.categoryName) {
      el.categoryName.value = "";
    }

    renderCategories();
    message("");
  }

  function removeCategory(categoryId) {
    state.categories = state.categories.filter(
      category => category.id !== categoryId
    );

    if (state.activeCategoryId === categoryId) {
      state.activeCategoryId = null;
    }

    renderCategories();
  }

  function findCategory(categoryId) {
    return state.categories.find(
      category => category.id === categoryId
    );
  }

  function updateCategoryField(
    categoryId,
    field,
    value
  ) {
    const category = findCategory(categoryId);

    if (!category) return;

    category[field] = value;
  }

  function validateCategoryPairs(category) {
    if (
      category.formatoJogo !== "Duplas"
    ) {
      return true;
    }
  
    const players =
      Array.isArray(category.jogadores)
        ? category.jogadores
        : [];
  
    const pairs =
      Array.isArray(category.duplas)
        ? category.duplas
        : [];
  
    if (players.length % 2 !== 0) {
      message(
        `A categoria "${category.nome}" precisa ter uma quantidade par de jogadores.`,
        "error"
      );
  
      return false;
    }
  
    if (
      pairs.length !== players.length / 2
    ) {
      message(
        `Crie todas as duplas da categoria "${category.nome}" antes de salvar.`,
        "error"
      );
  
      return false;
    }
  
    const usedPlayers =
      new Set();
  
    for (const dupla of pairs) {
      const player1 =
        dupla.jogador1 || {};
  
      const player2 =
        dupla.jogador2 || {};
  
      const player1Key =
        String(
          player1.uid ||
          U.norm(player1.nome || "")
        );
  
      const player2Key =
        String(
          player2.uid ||
          U.norm(player2.nome || "")
        );
  
      if (
        !player1Key ||
        !player2Key
      ) {
        message(
          `Existe uma dupla incompleta na categoria "${category.nome}".`,
          "error"
        );
  
        return false;
      }
  
      if (
        usedPlayers.has(player1Key) ||
        usedPlayers.has(player2Key)
      ) {
        message(
          `Um jogador foi incluído em mais de uma dupla na categoria "${category.nome}".`,
          "error"
        );
  
        return false;
      }
  
      usedPlayers.add(player1Key);
      usedPlayers.add(player2Key);
    }
  
    if (
      usedPlayers.size !== players.length
    ) {
      message(
        `Todos os jogadores da categoria "${category.nome}" precisam estar em uma dupla.`,
        "error"
      );
  
      return false;
    }
  
    return true;
  }

  function renderCategoryPlayers(category) {
    const players =
      Array.isArray(category.jogadores)
        ? category.jogadores
        : [];
  
    const duplas =
      Array.isArray(category.duplas)
        ? category.duplas
        : [];
  
    const isDoubles =
      U.norm(category.formatoJogo) ===
      "duplas";
  
    const pairedPlayerIds =
      new Set();
  
    const pairedPlayerNames =
      new Set();
  
    duplas.forEach(dupla => {
      if (dupla.jogador1?.uid) {
        pairedPlayerIds.add(
          String(dupla.jogador1.uid)
        );
      }
  
      if (dupla.jogador2?.uid) {
        pairedPlayerIds.add(
          String(dupla.jogador2.uid)
        );
      }
  
      if (dupla.jogador1?.nome) {
        pairedPlayerNames.add(
          U.norm(dupla.jogador1.nome)
        );
      }
  
      if (dupla.jogador2?.nome) {
        pairedPlayerNames.add(
          U.norm(dupla.jogador2.nome)
        );
      }
    });
  
    if (!players.length) {
      return ` <div class="tournament-selected-empty"> Nenhum jogador adicionado. </div> `;
    }
  
    return players
      .map((player, index) => {
        const playerKey =
          player.uid ||
          player.nome;
  
        const isPaired =
          (
            player.uid &&
            pairedPlayerIds.has(
              String(player.uid)
            )
          ) ||
          pairedPlayerNames.has(
            U.norm(player.nome)
          );
  
        /* * Formato Simples: * não exibe checkbox. */
        if (!isDoubles) {
          return ` <div class="tournament-selected-player"> <span class="tournament-selected-number"> ${index + 1} </span> <span class="tournament-selected-name"> ${U.esc(player.nome)} </span> <button type="button" class="tournament-remove-player" data-remove-category-player="${U.esc(category.id)}" data-player-key="${U.esc(playerKey)}" aria-label="Remover jogador" > <ion-icon name="close-outline"></ion-icon> </button> </div> `;
        }
  
        /* * Formato Duplas: * exibe checkbox para formar a dupla. */
        return ` <div class="tournament-category-player-option ${ isPaired ? "is-paired" : "" }" > <input type="checkbox" class="category-player-checkbox" data-category-id="${U.esc(category.id)}" data-player-key="${U.esc(playerKey)}" ${isPaired ? "disabled" : ""} > <span class="tournament-selected-number"> ${index + 1} </span> <span class="tournament-selected-name"> ${U.esc(player.nome)} </span> ${ isPaired ? ` <span class="tournament-player-paired-label"> Já está em uma dupla </span> ` : "" } <button type="button" class="tournament-remove-player" data-remove-category-player="${U.esc(category.id)}" data-player-key="${U.esc(playerKey)}" aria-label="Remover jogador" > <ion-icon name="close-outline"></ion-icon> </button> </div> `;
      })
      .join("");
  }

  function renderCategoryPairs(category) {
    const duplas =
      Array.isArray(category.duplas)
        ? category.duplas
        : [];
  
    if (!duplas.length) {
      return ` <div class="tournament-selected-empty"> Nenhuma dupla criada. </div> `;
    }
  
    return duplas
      .map(
        (dupla, index) => ` <div class="tournament-pair-card" data-pair-id="${U.esc(dupla.id || "")}" > <div class="tournament-pair-name"> <span class="tournament-pair-number"> ${index + 1} </span> <strong> ${U.esc( dupla.nome || `${dupla.jogador1?.nome || ""} / ${dupla.jogador2?.nome || ""}` )} </strong> </div> <button type="button" class="tournament-remove-pair-btn" data-remove-pair="${U.esc(category.id)}" data-pair-id="${U.esc(dupla.id || "")}" aria-label="Desfazer dupla" > <ion-icon name="close-outline"></ion-icon> <span> Desfazer </span> </button> </div> `
      )
      .join("");
  }



  function createPair(categoryId) {
    const category =
      findCategory(categoryId);
  
    if (!category) {
      message(
        "Categoria não encontrada.",
        "error"
      );
  
      return;
    }
  
    const selectedKeys =
      state.selectedPairPlayers.filter(
        key =>
          key.startsWith(
            `${categoryId}::`
          )
      );
  
    if (selectedKeys.length !== 2) {
      message(
        "Selecione exatamente dois jogadores para criar uma dupla.",
        "error"
      );
  
      return;
    }
  
    const selectedPlayers =
      selectedKeys
        .map(selectionKey => {
          const playerKey =
            selectionKey.substring(
              `${categoryId}::`.length
            );
  
          return category.jogadores.find(
            player =>
              String(
                player.uid ||
                player.nome
              ) === String(playerKey)
          );
        })
        .filter(Boolean);
  
    if (selectedPlayers.length !== 2) {
      message(
        "Não foi possível localizar os jogadores selecionados.",
        "error"
      );
  
      return;
    }
  
    if (!Array.isArray(category.duplas)) {
      category.duplas = [];
    }
  
    const alreadyPaired =
      category.duplas.some(dupla =>
        selectedPlayers.some(player => {
          const playerUid =
            String(player.uid || "");
  
          const playerName =
            U.norm(player.nome);
  
          return (
            (
              playerUid &&
              (
                String(
                  dupla.jogador1?.uid || ""
                ) === playerUid ||
                String(
                  dupla.jogador2?.uid || ""
                ) === playerUid
              )
            ) ||
            U.norm(
              dupla.jogador1?.nome || ""
            ) === playerName ||
            U.norm(
              dupla.jogador2?.nome || ""
            ) === playerName
          );
        })
      );
  
    if (alreadyPaired) {
      message(
        "Um dos jogadores já pertence a uma dupla.",
        "error"
      );
  
      return;
    }
  
    const jogador1 =
      selectedPlayers[0];
  
    const jogador2 =
      selectedPlayers[1];
  
    const dupla = {
      id: U.id(
        `${jogador1.nome}_${jogador2.nome}`
      ),
  
      nome:
        `${jogador1.nome} / ${jogador2.nome}`,
  
      jogador1: {
        uid:
          jogador1.uid || "",
  
        nome:
          jogador1.nome
      },
  
      jogador2: {
        uid:
          jogador2.uid || "",
  
        nome:
          jogador2.nome
      }
    };
  
    category.duplas.push(
      dupla
    );
  
    state.selectedPairPlayers =
      state.selectedPairPlayers.filter(
        key =>
          !key.startsWith(
            `${categoryId}::`
          )
      );
  
    renderCategories();
  
    message(
      `Dupla "${dupla.nome}" criada com sucesso.`,
      "success"
    );
  }

  function removePair( categoryId, pairId ) {
    const category =
      findCategory(categoryId);
  
    if (!category) {
      return;
    }
  
    category.duplas =
      Array.isArray(category.duplas)
        ? category.duplas.filter(
            dupla =>
              dupla.id !== pairId
          )
        : [];
  
    state.selectedPairPlayers =
      state.selectedPairPlayers.filter(
        key =>
          !key.startsWith(
            `${categoryId}::`
          )
      );
  
    renderCategories();
  
    message(
      "Dupla desfeita com sucesso.",
      "success"
    );
  }

  function renderCategories() {
    if (!el.categories) return;

    if (!state.categories.length) {
      el.categories.innerHTML = `
        <div class="tournament-selected-empty">
          Nenhuma categoria adicionada.
        </div>
      `;
      return;
    }

    el.categories.innerHTML = state.categories
      .map(
        category => `
          <div
            class="tournament-category-editor"
            data-category-id="${U.esc(category.id)}"
          >

            <div class="tournament-category-editor-head">

              <div>
                <strong>
                  ${U.esc(category.nome)}
                </strong>

                <small>
                  ${(category.jogadores || []).length}
                  jogador(es)
                </small>
              </div>

              <button
                type="button"
                class="tournament-remove-category"
                data-remove-category="${U.esc(category.id)}"
                aria-label="Remover categoria"
              >
                <ion-icon name="trash-outline"></ion-icon>
              </button>

            </div>

            <label class="tournament-field">

              <span class="tournament-label">
                Formato do jogo
              </span>

              <select
                class="tournament-input category-game"
                data-category-id="${U.esc(category.id)}"
                required
              >
                <option value="">
                  Selecione o formato do jogo
                </option>

                <option
                  value="Simples"
                  ${
                    category.formatoJogo === "Simples"
                      ? "selected"
                      : ""
                  }
                >
                  Simples
                </option>

                <option
                  value="Duplas"
                  ${
                    category.formatoJogo === "Duplas"
                      ? "selected"
                      : ""
                  }
                >
                  Duplas
                </option>
              </select>

            </label>

            <label class="tournament-field">

              <span class="tournament-label">
                Formato da partida
              </span>

              <select
                class="tournament-input category-match"
                data-category-id="${U.esc(category.id)}"
                required
              >
                <option value="">
                  Selecione o formato da partida
                </option>

                <option
                  value="1 set"
                  ${
                    category.formatoPartida === "1 set"
                      ? "selected"
                      : ""
                  }
                >
                  1 set
                </option>

                <option
                  value="2 sets + um super tie-break"
                  ${
                    category.formatoPartida ===
                    "2 sets + um super tie-break"
                      ? "selected"
                      : ""
                  }
                >
                  2 sets + um super tie-break
                </option>

                <option
                  value="3 sets"
                  ${
                    category.formatoPartida === "3 sets"
                      ? "selected"
                      : ""
                  }
                >
                  3 sets
                </option>
              </select>

            </label>

            <label class="tournament-field">

              <span class="tournament-label">
                Período do torneio
              </span>

              <textarea
                class="tournament-input tournament-date-range category-date"
                rows="3"
                data-category-id="${U.esc(category.id)}"
                required
                placeholder="Exemplo: 30/07/2026 - 01/08/2026"
              >${U.esc(category.dataPeriodo)}</textarea>

              <small class="tournament-field-help">
                Informe um período por linha.
              </small>

            </label>

            <div class="tournament-category-players">

              <span class="tournament-label">
                Jogadores da categoria
              </span>

              <p class="tournament-field-help">
                Adicione os jogadores pertencentes a esta categoria.
              </p>

              <button
                type="button"
                class="tournament-search-btn category-search-btn"
                data-category-id="${U.esc(category.id)}"
              >
                <ion-icon name="search-outline"></ion-icon>

                <span>
                  Pesquisar jogador
                </span>
              </button>

              <div class="category-selected-players">
  ${renderCategoryPlayers(category)}
</div>

${
  category.formatoJogo === "Duplas"
    ? ` <button
    type="button"
    class="tournament-btn tournament-btn-primary tournament-create-pair-btn"
    data-create-pair="${U.esc(category.id)}"
    disabled
  > <ion-icon name="people-outline"></ion-icon> <span> Criar dupla com selecionados </span> </button> <div class="tournament-category-pairs"> ${renderCategoryPairs(category)} </div> `
    : ""
}

            </div>

          </div>
        `
      )
      .join("");
  }

  function openSearch(categoryId = "") {
    if (!el.modal) return;

    state.activeCategoryId = categoryId;

    el.modal.hidden = false;
    el.modal.setAttribute("aria-hidden", "false");

    if (el.searchInput) el.searchInput.value = "";
    if (el.results) el.results.innerHTML = "";

    if (el.searchStatus) {
      el.searchStatus.textContent =
        "Digite pelo menos 2 letras.";
    }

    if (el.manualBox) el.manualBox.hidden = true;
    if (el.manualInput) el.manualInput.value = "";

    setTimeout(() => {
      el.searchInput?.focus();
    }, 100);
  }

  function closeSearch() {
    if (!el.modal) return;

    el.modal.hidden = true;
    el.modal.setAttribute("aria-hidden", "true");

    if (el.searchInput) el.searchInput.value = "";
    if (el.results) el.results.innerHTML = "";
    if (el.manualBox) el.manualBox.hidden = true;
    if (el.manualInput) el.manualInput.value = "";
  }

  async function findPlayers(query) {
    const q = U.norm(query);

    if (q.length < 2) return [];

    const map = new Map();

    for (const collection of ["users", "profiles"]) {
      try {
        const snapshot = await __db
          .collection(collection)
          .get();

        snapshot.forEach(doc => {
          const data = doc.data() || {};
          const name = U.getName(data);

          const searchText = U.norm(
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

          if (!name || !searchText.includes(q)) {
            return;
          }

          const uid = U.getUid(data, doc.id);

          const item = {
            id: doc.id,
            uid,
            name,
            data,
            collection
          };

          const previous = map.get(uid);

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

    return [...map.values()].slice(0, 20);
  }

  function renderSearchResults(players) {
    if (!el.results) return;

    if (!players.length) {
      el.results.innerHTML = `
        <div class="tournament-search-empty">
          Nenhum jogador encontrado.
        </div>
      `;

      if (el.manualBox) {
        el.manualBox.hidden = false;
      }

      return;
    }

    if (el.manualBox) {
      el.manualBox.hidden = true;
    }

    el.results.innerHTML = players
      .map(
        player => `
          <button
            type="button"
            class="tournament-search-result"
            data-player-name="${U.esc(player.name)}"
            data-player-uid="${U.esc(player.uid)}"
          >
            <span class="tournament-search-avatar">
              ${U.esc(
                player.name.charAt(0).toUpperCase()
              )}
            </span>

            <span class="tournament-search-result-main">
              <strong>
                ${U.esc(player.name)}
              </strong>

              <small>
                ID: ${U.esc(player.uid || player.id)}
              </small>
            </span>

            <ion-icon name="chevron-forward-outline"></ion-icon>
          </button>
        `
      )
      .join("");
  }

  function handleSearch() {
    clearTimeout(state.searchTimer);

    const query = el.searchInput?.value.trim() || "";

    if (query.length < 2) {
      if (el.searchStatus) {
        el.searchStatus.textContent =
          "Digite pelo menos 2 letras.";
      }

      if (el.results) el.results.innerHTML = "";
      if (el.manualBox) el.manualBox.hidden = true;

      return;
    }

    if (el.searchStatus) {
      el.searchStatus.textContent = "Pesquisando...";
    }

    state.searchTimer = setTimeout(async () => {
      const players = await findPlayers(query);

      renderSearchResults(players);

      if (el.searchStatus) {
        el.searchStatus.textContent = players.length
          ? `${players.length} jogador(es) encontrado(s).`
          : "Nenhum jogador encontrado.";
      }
    }, 300);
  }

  function addPlayer(
    name,
    uid = "",
    manual = false
  ) {
    const category = findCategory(
      state.activeCategoryId
    );

    if (!category) {
      message(
        "Selecione uma categoria antes de adicionar jogadores.",
        "error"
      );
      return;
    }

    const cleanName = String(name || "").trim();
    const cleanUid = String(uid || "").trim();

    if (!cleanName) return;

    const exists = category.jogadores.some(
      player =>
        (
          cleanUid &&
          player.uid &&
          cleanUid === player.uid
        ) ||
        U.norm(player.nome) === U.norm(cleanName)
    );

    if (exists) {
      if (el.searchStatus) {
        el.searchStatus.textContent =
          "Este jogador já foi adicionado nesta categoria.";
      }
      return;
    }

    category.jogadores.push({
      posicao: category.jogadores.length + 1,
      nome: cleanName,
      uid: cleanUid,
      manual: manual || !cleanUid
    });

    renderCategories();
    closeSearch();
  }

  function removeCategoryPlayer( categoryId, playerKey ) {
    const category =
      findCategory(categoryId);
  
    if (!category) {
      return;
    }
  
    category.jogadores =
      category.jogadores
        .filter(
          player =>
            String(
              player.uid ||
              player.nome
            ) !== String(playerKey)
        )
        .map((player, index) => ({
          ...player,
          posicao: index + 1
        }));
  
    state.selectedPairPlayers =
      state.selectedPairPlayers.filter(
        key =>
          key !==
          `${categoryId}::${playerKey}`
      );
  
    renderCategories();
  }

  function buildTournamentData(previous = {}) {
    const categorias =
  state.categories.map(category => ({
    id: category.id,

    nome:
      String(category.nome || "").trim(),

    formatoJogo:
      String(category.formatoJogo || "").trim(),

    formatoPartida:
      String(category.formatoPartida || "").trim(),

    dataPeriodo:
      String(category.dataPeriodo || "").trim(),

    dataHora:
      String(
        category.dataHora ||
        category.dataPeriodo ||
        ""
      ).trim(),

    jogadores:
      category.jogadores.map(
        (player, index) => ({
          posicao: index + 1,
          nome:
            String(player.nome || "").trim(),
          uid:
            String(player.uid || "").trim(),
          manual:
            Boolean(player.manual)
        })
      ),

      duplas:
  Array.isArray(category.duplas)
    ? category.duplas.map(dupla => ({
        id: dupla.id,

        nome: dupla.nome,

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
        }
      }))
    : [],

    chave:
      category.chave || null,

    chavePreparada:
      Boolean(category.chavePreparada),

    status:
      category.status || "",

    statusLabel:
      category.statusLabel || ""
  }));

    return {
      nome: el.name?.value.trim() || "",
      categorias,

      status: previous.status || "preparacao",
      statusLabel:
        previous.statusLabel || "Em preparação",

      chavePreparada:
        Boolean(previous.chavePreparada),

      chave: previous.chave || {
        faseInicial: "",
        r32: [],
        r16: [],
        qf: [],
        sf: [],
        final: []
      },

      ownerId: state.user.uid,
      ownerEmail: state.user.email || "",

      updatedAt:
        firebase.firestore.FieldValue.serverTimestamp()
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
      el.form.reportValidity();
      return;
    }

    if (!state.categories.length) {
      message(
        "Adicione pelo menos uma categoria.",
        "error"
      );
      return;
    }

    for (const category of state.categories) {
      if (!category.formatoJogo) {
        message(
          `Informe o formato do jogo da categoria "${category.nome}".`,
          "error"
        );
        return;
      }

      if (!category.formatoPartida) {
        message(
          `Informe o formato da partida da categoria "${category.nome}".`,
          "error"
        );
        return;
      }

      if (!category.dataPeriodo) {
        message(
          `Informe o período da categoria "${category.nome}".`,
          "error"
        );
        return;
      }

      if (category.jogadores.length < 2) {
        message(
          `Adicione pelo menos 2 jogadores na categoria "${category.nome}".`,
          "error"
        );
        return;
      }

      if (
        category.formatoJogo === "Duplas" &&
        category.jogadores.length % 2 !== 0
      ) {
        message(
          `A quantidade de jogadores da categoria "${category.nome}" deve ser par.`,
          "error"
        );
        return;
      }
    }

    const isEditing = Boolean(el.docId?.value);

    const confirmed = window.confirm(
      isEditing
        ? "Deseja alterar este torneio?"
        : "Deseja salvar este torneio?"
    );

    if (!confirmed) {
      message("Operação cancelada.", "error");
      return;
    }

    const id = el.docId?.value || "";

    const previous = id
      ? state.tournaments.find(
          tournament => tournament.id === id
        )?.data || {}
      : {};

    const data = buildTournamentData(previous);

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
              firebase.firestore.FieldValue.serverTimestamp()
          });

        message(
          "Torneio cadastrado com sucesso.",
          "success"
        );
      }

      setTimeout(closeForm, 700);
    } catch (error) {
      console.error("Erro ao salvar torneio:", error);

      message(
        error.message || "Erro ao salvar o torneio.",
        "error"
      );
    }
  }

  function renderTournamentCategoryContent(
    tournamentId,
    category = {}
  ) {
    const players = Array.isArray(category.jogadores)
      ? category.jogadores
      : [];

    const playerListId =
      `players_${tournamentId}_${category.id || "none"}`;

    return `
      <div class="tournament-card-info">

        <div>
          <span>Formato</span>
          <strong>
            ${U.esc(category.formatoJogo || "-")}
          </strong>
        </div>

        <div>
          <span>Partida</span>
          <strong>
            ${U.esc(category.formatoPartida || "-")}
          </strong>
        </div>

        <div>
          <span>Jogadores</span>
          <strong>
            ${players.length}
          </strong>
        </div>

        <div>
          <span>Período</span>
          <strong>
            ${U.esc(
              category.dataPeriodo ||
              category.dataHora ||
              "Não informado"
            )}
          </strong>
        </div>

      </div>

      <button
        type="button"
        class="tournament-toggle-card-players"
        data-action="toggle-category-players"
        data-target="${U.esc(playerListId)}"
        aria-expanded="false"
      >
        <ion-icon name="people-outline"></ion-icon>
        <span>Mostrar jogadores</span>
      </button>

      <div
        id="${U.esc(playerListId)}"
        class="tournament-card-player-list is-hidden"
      >
        ${
          players.length
            ? players
                .map(
                  (player, index) => `
                    <span class="tournament-player-chip">
                      <span class="tournament-player-chip-number">
                        ${index + 1}
                      </span>

                      <span>
                        ${U.esc(player.nome)}
                      </span>
                    </span>
                  `
                )
                .join("")
            : `
              <span class="tournament-empty-players">
                Nenhum jogador informado
              </span>
            `
        }
      </div>
    `;
  }

  function getTournamentCategories(data) {
    return readCategoriesFromTournament(data);
  }

  function renderList() {
    if (!el.list) return;

    if (!state.tournaments.length) {
      el.list.innerHTML = `
        <div class="tournament-empty-card">
          <ion-icon name="trophy-outline"></ion-icon>

          <strong>
            Nenhum torneio cadastrado
          </strong>

          <span>
            Toque em “Novo torneio” para começar.
          </span>
        </div>
      `;
      return;
    }

    el.list.innerHTML = state.tournaments
      .map(item => {
        const data = item.data || {};
        const categories = getTournamentCategories(data);
        const firstCategory = categories[0] || {};
        const selectId =
          `tournamentCategory_${item.id}`;

          const statusValue =
          U.norm(data.status);
        
        const finalized =
          isFinalizedTournament(data);
        
        const openLabel =
          statusValue === "preparada"
            ? "Iniciar"
            : "Abrir";
        
        const finalizedButtonClass =
          finalized
            ? "tournament-btn-disabled"
            : "";
        
        const finalizedDisabled =
          finalized
            ? "disabled"
            : "";

        return `
          <article
            class="tournament-card"
            data-tournament-card="${U.esc(item.id)}"
          >

            <div class="tournament-card-top">

              <div class="tournament-card-icon">
                <ion-icon name="trophy-outline"></ion-icon>
              </div>

              <div class="tournament-card-heading">

                <h3>
                  ${U.esc(
                    data.nome || "Torneio sem nome"
                  )}
                </h3>

                <span>
                  ${U.esc(
                    data.statusLabel ||
                    "Em preparação"
                  )}
                </span>

              </div>

              <span class="tournament-status-badge">
                ${U.esc(
                  data.statusLabel ||
                  "Em preparação"
                )}
              </span>

            </div>

            <div class="tournament-card-category">

              <label for="${U.esc(selectId)}">
                Categoria
              </label>

              <select
                id="${U.esc(selectId)}"
                class="tournament-input tournament-category-select"
                data-tournament-id="${U.esc(item.id)}"
              >
                ${
                  categories.length
                    ? categories
                        .map(
                          category => `
                            <option
                              value="${U.esc(category.id)}"
                              ${
                                category.id ===
                                firstCategory.id
                                  ? "selected"
                                  : ""
                              }
                            >
                              ${U.esc(category.nome)}
                            </option>
                          `
                        )
                        .join("")
                    : `
                      <option value="">
                        Nenhuma categoria cadastrada
                      </option>
                    `
                }
              </select>

            </div>

            <div
              class="tournament-category-content"
              data-category-content="${U.esc(item.id)}"
            >
              ${renderTournamentCategoryContent(
                item.id,
                firstCategory
              )}
            </div>

            <div class="tournament-card-actions">

            <button
  type="button"
  class="tournament-btn tournament-btn-primary"
  data-action="bracket"
  data-id="${U.esc(item.id)}"
  data-category-id="${U.esc(firstCategory.id || "")}"
>
  <ion-icon name="git-network-outline"></ion-icon>
  <span>Chave</span>
</button>

<button
type="button"
class="tournament-btn tournament-btn-start ${finalizedButtonClass}"
data-action="start"
data-id="${U.esc(item.id)}"
${finalizedDisabled}
>
<ion-icon name="play-outline"></ion-icon>
<span> ${finalized ? "Finalizado" : openLabel} </span>
</button>

<button
type="button"
class="tournament-btn tournament-btn-secondary ${finalizedButtonClass}"
data-action="edit"
data-id="${U.esc(item.id)}"
${finalizedDisabled}
>
<ion-icon name="pencil-outline"></ion-icon>

<span> ${finalized ? "Bloqueado" : "Editar"} </span>
</button>

              <button
                type="button"
                class="tournament-btn tournament-btn-danger"
                data-action="delete"
                data-id="${U.esc(item.id)}"
              >
                <ion-icon name="trash-outline"></ion-icon>
                <span>Excluir</span>
              </button>

            </div>

          </article>
        `;
      })
      .join("");
  }

  function toggleCategoryPlayers(event) {
    const button = event.target.closest(
      '[data-action="toggle-category-players"]'
    );

    if (!button) return false;

    const target = document.getElementById(
      button.dataset.target || ""
    );

    if (!target) return true;

    const hidden = target.classList.toggle(
      "is-hidden"
    );

    button.setAttribute(
      "aria-expanded",
      String(!hidden)
    );

    button.innerHTML = hidden
      ? `
        <ion-icon name="people-outline"></ion-icon>
        <span>Mostrar jogadores</span>
      `
      : `
        <ion-icon name="eye-off-outline"></ion-icon>
        <span>Ocultar jogadores</span>
      `;

    return true;
  }

  function changeSelectedCategory(event) {
    const select =
      event.target.closest(
        ".tournament-category-select"
      );
  
    if (!select) {
      return;
    }
  
    const tournamentId =
      select.dataset.tournamentId || "";
  
    const categoryId =
      select.value || "";
  
    const tournament =
      state.tournaments.find(
        item => item.id === tournamentId
      );
  
    if (!tournament) {
      return;
    }
  
    const categories =
      getTournamentCategories(
        tournament.data
      );
  
    const category =
      categories.find(
        item =>
          String(item.id) ===
          String(categoryId)
      );
  
    const content =
      el.list.querySelector(
        `[data-category-content="${tournamentId}"]`
      );
  
    if (content) {
      content.innerHTML =
        renderTournamentCategoryContent(
          tournamentId,
          category || {}
        );
    }
  
    /* * Atualiza o botão Chave com a categoria selecionada. */
    const card =
      select.closest(
        "[data-tournament-card]"
      );
  
    const bracketButton =
      card?.querySelector(
        '[data-action="bracket"]'
      );
  
    if (bracketButton) {
      bracketButton.dataset.categoryId =
        categoryId;
    }
  }

  async function startTournament(id) {
    const item =
      state.tournaments.find(
        tournament => tournament.id === id
      );
  
    if (!item) {
      message(
        "Torneio não encontrado.",
        "error"
      );
  
      return;
    }
  
    const card =
      document.querySelector(
        `[data-tournament-card="${id}"]`
      );
  
    const categorySelect =
      card?.querySelector(
        ".tournament-category-select"
      );
  
    const selectedCategoryId =
      categorySelect?.value || "";
  
    if (!selectedCategoryId) {
      message(
        "Selecione uma categoria antes de abrir o torneio.",
        "error"
      );
  
      return;
    }
  
    const data =
      item.data || {};
  
    const status =
      U.norm(data.status);
  
    const statusLabel =
      U.norm(data.statusLabel);
  
    const tournamentAlreadyOpen =
      [
        "iniciado",
        "andamento",
        "em_andamento",
        "concluido",
        "concluida",
        "finalizado",
        "finalizada",
        "finished"
      ].includes(status) ||
      [
        "em_andamento",
        "em andamento",
        "concluido",
        "concluida",
        "finalizado",
        "finalizada",
        "finished"
      ].includes(statusLabel);
  
    if (tournamentAlreadyOpen) {
      window.location.href =
        `chave-torneio.html?id=${encodeURIComponent(id)}&categoryId=${encodeURIComponent(selectedCategoryId)}&mode=live`;
  
      return;
    }
  
    const keyIsPrepared =
      status === "preparada" ||
      statusLabel === "preparada";
  
    if (keyIsPrepared) {
      const confirmed =
        window.confirm(
          `Deseja iniciar o torneio "${data.nome || ""}"?`
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
          `chave-torneio.html?id=${encodeURIComponent(id)}&categoryId=${encodeURIComponent(selectedCategoryId)}&mode=live`;
  
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
  
      return;
    }
  
    window.location.href =
      `chave-torneio.html?id=${encodeURIComponent(id)}&categoryId=${encodeURIComponent(selectedCategoryId)}`;
  }
  function confirmDelete(id) {
    const item = state.tournaments.find(
      tournament => tournament.id === id
    );

    if (!item) return;

    if (el.confirmText) {
      el.confirmText.textContent =
        `Deseja excluir o torneio "${item.data.nome || ""}"?`;
    }

    if (el.confirm) {
      el.confirm.hidden = false;
      el.confirm.setAttribute("aria-hidden", "false");
    }

    if (el.confirmYes) {
      el.confirmYes.onclick = async () => {
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
            el.confirm.setAttribute(
              "aria-hidden",
              "true"
            );
          }
        }
      };
    }

    if (el.confirmNo) {
      el.confirmNo.onclick = () => {
        if (el.confirm) {
          el.confirm.hidden = true;
          el.confirm.setAttribute(
            "aria-hidden",
            "true"
          );
        }
      };
    }
  }

  function listenTournaments() {
    if (!state.user?.uid) return;

    if (state.unsubscribe) {
      state.unsubscribe();
    }

    state.unsubscribe = __db
      .collection(COLLECTION)
      .where("ownerId", "==", state.user.uid)
      .onSnapshot(
        snapshot => {
          state.tournaments = snapshot.docs.map(
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

  function bindEvents() {
    el.form?.addEventListener("submit", save);

    el.newBtn?.addEventListener(
      "click",
      () => openForm()
    );

    el.cancelBtn?.addEventListener(
      "click",
      closeForm
    );

    el.addCategory?.addEventListener(
      "click",
      addCategory
    );

    el.categoryName?.addEventListener(
      "keydown",
      event => {
        if (event.key === "Enter") {
          event.preventDefault();
          addCategory();
        }
      }
    );

    el.categories?.addEventListener(
      "input",
      event => {
        const categoryId =
          event.target.dataset.categoryId;

        if (!categoryId) return;

        if (
          event.target.classList.contains(
            "category-date"
          )
        ) {
          updateCategoryField(
            categoryId,
            "dataPeriodo",
            event.target.value
          );
        }
      }
    );

    el.categories?.addEventListener(
      "change",
      event => {
        /* * Checkbox para selecionar jogadores * que formarão uma dupla. */
        const checkbox =
          event.target.closest(
            ".category-player-checkbox"
          );
    
        if (checkbox) {
          const categoryId =
            checkbox.dataset.categoryId || "";
    
          const playerKey =
            checkbox.dataset.playerKey || "";
    
          const selectionKey =
            `${categoryId}::${playerKey}`;
    
          if (checkbox.checked) {
            if (
              !state.selectedPairPlayers.includes(
                selectionKey
              )
            ) {
              state.selectedPairPlayers.push(
                selectionKey
              );
            }
          } else {
            state.selectedPairPlayers =
              state.selectedPairPlayers.filter(
                key =>
                  key !== selectionKey
              );
          }
    
          const selectedCount =
            state.selectedPairPlayers.filter(
              key =>
                key.startsWith(
                  `${categoryId}::`
                )
            ).length;
    
          /* * Limita a seleção a dois jogadores. */
          if (selectedCount > 2) {
            checkbox.checked = false;
    
            state.selectedPairPlayers =
              state.selectedPairPlayers.filter(
                key =>
                  key !== selectionKey
              );
    
            message(
              "Selecione somente dois jogadores para formar uma dupla.",
              "error"
            );
    
            return;
          }
    
          /* * Habilita o botão somente quando * exatamente dois jogadores forem selecionados. */
          const pairButton =
            el.categories.querySelector(
              `[data-create-pair="${categoryId}"]`
            );
    
          if (pairButton) {
            pairButton.disabled =
              selectedCount !== 2;
          }
    
          return;
        }
    
        /* * Alteração do formato Simples/Duplas. */
        const categoryId =
          event.target.dataset.categoryId || "";
    
        if (!categoryId) {
          return;
        }
    
        if (
          event.target.classList.contains(
            "category-game"
          )
        ) {
          updateCategoryField(
            categoryId,
            "formatoJogo",
            event.target.value
          );
    
          /* * Atualiza a visualização: * - Simples: remove os checkboxes; * - Duplas: mostra os checkboxes e o botão. */
          renderCategories();
    
          return;
        }
    
        /* * Alteração do formato da partida. */
        if (
          event.target.classList.contains(
            "category-match"
          )
        ) {
          updateCategoryField(
            categoryId,
            "formatoPartida",
            event.target.value
          );
    
          return;
        }
      }
    );

    el.categories?.addEventListener(
      "click",
      event => {
        const createPairButton =
          event.target.closest(
            "[data-create-pair]"
          );
    
        if (createPairButton) {
          createPair(
            createPairButton.dataset.createPair
          );
    
          return;
        }
    
        const removePairButton =
          event.target.closest(
            "[data-remove-pair]"
          );
    
        if (removePairButton) {
          removePair(
            removePairButton.dataset.removePair,
            removePairButton.dataset.pairId
          );
    
          return;
        }
    
        const removeCategoryButton =
          event.target.closest(
            "[data-remove-category]"
          );
    
        if (removeCategoryButton) {
          removeCategory(
            removeCategoryButton.dataset.removeCategory
          );
    
          return;
        }
    
        const removePlayerButton =
          event.target.closest(
            "[data-remove-category-player]"
          );
    
        if (removePlayerButton) {
          removeCategoryPlayer(
            removePlayerButton.dataset
              .removeCategoryPlayer,
            removePlayerButton.dataset.playerKey
          );
    
          return;
        }
    
        const searchButton =
          event.target.closest(
            ".category-search-btn"
          );
    
        if (searchButton) {
          openSearch(
            searchButton.dataset.categoryId
          );
        }
      }
    );

    el.searchInput?.addEventListener(
      "input",
      handleSearch
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
        const button = event.target.closest(
          ".tournament-search-result"
        );

        if (!button) return;

        addPlayer(
          button.dataset.playerName || "",
          button.dataset.playerUid || "",
          false
        );
      }
    );

    el.closeModal?.addEventListener(
      "click",
      closeSearch
    );

    el.modal?.addEventListener(
      "click",
      event => {
        if (event.target === el.modal) {
          closeSearch();
        }
      }
    );

    el.list?.addEventListener(
      "change",
      changeSelectedCategory
    );

    el.list?.addEventListener(
      "click",
      async event => {
        if (toggleCategoryPlayers(event)) {
          return;
        }

        const button = event.target.closest(
          "[data-action]"
        );

        

        if (!button) return;

        const id = button.dataset.id || "";
        const action = button.dataset.action || "";

        const item = state.tournaments.find(
          tournament => tournament.id === id
        );

        if (!item) return;

        if (
          isFinalizedTournament(item.data) &&
          (
            action === "start" ||
            action === "edit"
          )
        ) {
          message(
            "Este torneio está finalizado e não pode mais ser aberto ou editado.",
            "error"
          );
        
          return;
        }

        if (action === "bracket") {
          const card =
            button.closest(
              "[data-tournament-card]"
            );
        
          const categorySelect =
            card?.querySelector(
              ".tournament-category-select"
            );
        
          const selectedCategoryId =
            button.dataset.categoryId ||
            categorySelect?.value ||
            "";
        
          if (!selectedCategoryId) {
            message(
              "Selecione uma categoria antes de montar a chave.",
              "error"
            );
        
            return;
          }
        
          window.location.href =
            `chave-torneio.html?id=${encodeURIComponent(id)}&categoryId=${encodeURIComponent(selectedCategoryId)}`;
        
          return;
        }

        if (action === "start") {
          await startTournament(id);
          return;
        }

        if (action === "edit") {
          if (isFinalizedTournament(item.data)) {
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

    document.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape") {
          closeSearch();

          if (el.confirm && !el.confirm.hidden) {
            el.confirm.hidden = true;
            el.confirm.setAttribute(
              "aria-hidden",
              "true"
            );
          }
        }
      }
    );
  }

  async function init() {
    if (!hasSession()) {
      window.location.replace("login.html");
      return;
    }

    if (!window.__auth || !window.__db) {
      message(
        "Firebase não foi carregado corretamente.",
        "error"
      );
      return;
    }

    bindEvents();
    renderCategories();
    renderList();

    __auth.onAuthStateChanged(
      async user => {
        const resolved = await resolveUser(user);

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
