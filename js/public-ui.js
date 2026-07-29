(() => {
  "use strict";

  function getPageParams() {
    return new URLSearchParams(window.location.search);
  }

  function getCurrentLiveMatch(card) {
    const matchId =
      String(card?.dataset?.matchId || "").trim();

    const ownerId =
      String(card?.dataset?.ownerId || "").trim();

    const shareToken =
      String(
        getPageParams().get("shareToken") || ""
      ).trim();

    return {
      matchId,
      ownerId,
      shareToken
    };
  }

  function buildLiveUrl(card, role = "viewer") {
    const data = getCurrentLiveMatch(card);

    const url = new URL(
      "aovivo.html",
      window.location.href
    );

    if (data.matchId) {
      url.searchParams.set(
        "id",
        data.matchId
      );
    }

    url.searchParams.set(
      "role",
      role
    );

    if (data.shareToken) {
      url.searchParams.set(
        "shareToken",
        data.shareToken
      );
    }

    return url.toString();
  }

  async function shareLiveMatch(card) {
    try {
      const shareUrl =
        buildLiveUrl(card, "viewer");

      if (navigator.share) {
        await navigator.share({
          title: "Partida ao vivo - TennisPro",
          text: "Acompanhe esta partida ao vivo.",
          url: shareUrl
        });

        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(
          shareUrl
        );

        alert("Link da partida copiado!");
        return;
      }

      window.prompt(
        "Copie o link da partida:",
        shareUrl
      );
    } catch (error) {
      console.error(
        "Erro ao compartilhar partida:",
        error
      );
    }
  }

  function openBroadcaster(card) {
    try {
      const url =
        buildLiveUrl(card, "broadcaster");

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error(
        "Erro ao abrir transmissor:",
        error
      );
    }
  }

  function openStats() {
    const statsButton =
      document.getElementById("statsBtn");

    if (statsButton) {
      statsButton.click();
      return;
    }

    console.warn(
      "Elemento #statsBtn não foi encontrado."
    );
  }

  function openH2H(card) {
    const params =
      getPageParams();

    const url =
      new URL(
        "confronto.html",
        window.location.href
      );

    url.searchParams.set(
      "embedded",
      "1"
    );

    const fields = [
      "matchId",
      "ownerId",
      "player1",
      "player2",
      "player3",
      "player4",
      "opponentId"
    ];

    const datasetMap = {
      matchId: "matchId",
      ownerId: "ownerId",
      player1: "player1",
      player2: "player2",
      player3: "player3",
      player4: "player4",
      opponentId: "opponentId"
    };

    fields.forEach((field) => {
      const datasetKey =
        datasetMap[field];

      const value =
        String(
          card?.dataset?.[datasetKey] || ""
        ).trim();

      if (value) {
        url.searchParams.set(
          field,
          value
        );
      }
    });

    const shareToken =
      String(
        params.get("shareToken") || ""
      ).trim();

    if (shareToken) {
      url.searchParams.set(
        "shareToken",
        shareToken
      );
    }

    if (typeof window.openConfrontoModal === "function") {
      window.openConfrontoModal(
        url.toString()
      );
      return;
    }

    window.open(
      url.toString(),
      "_blank",
      "noopener,noreferrer"
    );
  }

  function createActionButtons() {
    const probabilityBlocks =
      document.querySelectorAll(
        ".win-probability-chart"
      );

    probabilityBlocks.forEach((probabilityBlock) => {
      if (
        probabilityBlock.parentElement
          ?.querySelector(
            ".public-actions-section"
          )
      ) {
        return;
      }

      const card =
        probabilityBlock.closest(
          ".match-board"
        );

      if (!card) {
        return;
      }

      const actions =
        document.createElement("section");

      actions.className =
        "public-actions-section";

      actions.innerHTML = ` <div class="public-actions-row" aria-label="Ações da partida"> <button type="button" class="public-action-btn" data-action="live"> <ion-icon name="share-social-outline"> </ion-icon> <span>Live</span> </button> <button type="button" class="public-action-btn" data-action="stats"> <ion-icon name="stats-chart-outline"> </ion-icon> <span>Stats</span> </button> <button type="button" class="public-action-btn" data-action="h2h"> <ion-icon name="people-outline"> </ion-icon> <span>H2H</span> </button> <button type="button" class="public-action-btn" data-action="broadcast"> <ion-icon name="videocam-outline"> </ion-icon> <span>Transmitir</span> </button> </div> `;

      probabilityBlock.insertAdjacentElement(
        "afterend",
        actions
      );
    });
  }

  function bindActionEvents() {
    if (window.__tennisProActionsBound) {
      return;
    }

    window.__tennisProActionsBound = true;

    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            ".public-action-btn"
          );

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const card =
          button.closest(".match-board");

        const action =
          button.dataset.action || "";

        if (action === "live") {
          shareLiveMatch(card);
          return;
        }

        if (action === "stats") {
          openStats();
          return;
        }

        if (action === "h2h") {
          openH2H(card);
          return;
        }

        if (action === "broadcast") {
          openBroadcaster(card);
        }
      }
    );
  }

  function startObserver() {
    const lists = [
      document.getElementById("liveList"),
      document.getElementById("scheduledList"),
      document.getElementById("finishedList")
    ].filter(Boolean);

    const observer =
      new MutationObserver(() => {
        createActionButtons();
      });

    lists.forEach((list) => {
      observer.observe(list, {
        childList: true,
        subtree: true
      });
    });

    createActionButtons();
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      bindActionEvents();
      startObserver();
    }
  );
})();

