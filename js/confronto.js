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
