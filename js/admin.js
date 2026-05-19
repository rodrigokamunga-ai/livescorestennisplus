(() => {
  "use strict";

  const AdminApp = (() => {
    const ADMIN_KEY = "lsts_admin_session";
    const PAGE_SIZE = 5;

    const ALLOWED_FORMATS = [
      "1 set sem vantagem + um supertiebreak de 10 pontos",
      "2 sets sem vantagem + um supertiebreak de 10 pontos",
      "1 set pro de 8 games sem vantagem + um supertiebreak de 10 pontos"
    ];

    const ALLOWED_SURFACES = ["Rápida", "Saibro", "Grama"];

    const state = {
      allMatches: [],
      filteredMatches: [],
      currentPage: 1,
      matchesExpanded: true,
      filtersCollapsed: false,
      currentUser: null,
      currentProfileName: "",
      unsubscribe: null,
      initialized: false
    };

    const el = {
      showFormBtn: document.getElementById("showFormBtn"),
      showFormBtnBottom: document.getElementById("showFormBtnBottom"),
      toggleMatchesBtn: document.getElementById("toggleMatchesBtn"),
      toggleMatchesBtnBottom: document.getElementById("toggleMatchesBtnBottom"),
      logoutBtnBottom: document.getElementById("logoutBtnBottom"),
      matchFormWrapper: document.getElementById("matchFormWrapper"),
      form: document.getElementById("matchForm"),
      tbody: document.getElementById("matchesTable"),
      msg: document.getElementById("adminMsg"),
      dialog: document.getElementById("detailsDialog"),
      detailsContent: document.getElementById("detailsContent"),
      docId: document.getElementById("docId"),
      categoryName: document.getElementById("categoryName"),
      surfaceType: document.getElementById("surfaceType"),
      matchFormat: document.getElementById("matchFormat"),
      matchDateTime: document.getElementById("matchDateTime"),
      court: document.getElementById("court"),
      tournamentStage: document.getElementById("tournamentStage"),
      player1: document.getElementById("player1"),
      player2: document.getElementById("player2"),
      probPlayer1: document.getElementById("probPlayer1"),
      probPlayer2: document.getElementById("probPlayer2"),
      winnerByWO: document.getElementById("winnerByWO"),
      status: document.getElementById("status"),
      formTitle: document.getElementById("formTitle"),
      logoutBtn: document.getElementById("logoutBtn"),
      clearBtn: document.getElementById("clearBtn"),
      cancelBtn: document.getElementById("cancelBtn"),
      closeDialogBtn: document.getElementById("closeDialogBtn"),
      filterPlayers: document.getElementById("filterPlayers"),
      filterCategory: document.getElementById("filterCategory"),
      filterStatus: document.getElementById("filterStatus"),
      prevPageBtn: document.getElementById("prevPageBtn"),
      nextPageBtn: document.getElementById("nextPageBtn"),
      pageInfo: document.getElementById("pageInfo"),
      totalPagesEl: document.getElementById("totalPages"),
      itemsShown: document.getElementById("itemsShown"),
      itemsTotal: document.getElementById("itemsTotal"),
      matchesSection: document.getElementById("matchesSection"),
      filtersBar: document.getElementById("filtersBar")
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

      normalizeText(text = "") {
        return String(text || "").trim().toLowerCase();
      },

      allowedMatchFormat(value) {
        const text = String(value || "").trim().toLowerCase();
        return ALLOWED_FORMATS.includes(text);
      },

      normalizeMatchFormat(value) {
        const text = String(value || "").trim().toLowerCase();
        if (ALLOWED_FORMATS.includes(text)) return text;
        return "";
      },

      normalizeScore(score = {}) {
        return {
          points1: Number(score.points1 || 0),
          points2: Number(score.points2 || 0),
          games1: Number(score.games1 || 0),
          games2: Number(score.games2 || 0),
          sets1: Number(score.sets1 || 0),
          sets2: Number(score.sets2 || 0),
          tieBreakMode:
            score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
              ? score.tieBreakMode
              : null,
          tieBreakPoints1: Number(score.tieBreakPoints1 || 0),
          tieBreakPoints2: Number(score.tieBreakPoints2 || 0),
          lastTieBreakMode:
            score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10"
              ? score.lastTieBreakMode
              : null,
          lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
          lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0),
          setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
          server: score.server || "player1",
          totalPoints1: Number(score.totalPoints1 || 0),
          totalPoints2: Number(score.totalPoints2 || 0),
          breakPointsWon1: Number(score.breakPointsWon1 || 0),
          breakPointsWon2: Number(score.breakPointsWon2 || 0),
          breakPointsChances1: Number(score.breakPointsChances1 || 0),
          breakPointsChances2: Number(score.breakPointsChances2 || 0)
        };
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

      getStartedAtMs(match) {
        const started = U.toDate(match.startedAt);
        if (started) return started.getTime();

        const updated = U.toDate(match.updatedAt);
        if (updated) return updated.getTime();

        const matchDate = U.toDate(match.matchDateTime);
        if (matchDate) return matchDate.getTime();

        return null;
      },

      formatProb(value) {
        if (value === null || value === undefined || value === "") return "-";
        const n = Number(value);
        return Number.isFinite(n) ? `${n}%` : "-";
      },

      formatDuration(seconds) {
        const total = Number(seconds || 0);
        const h = String(Math.floor(total / 3600)).padStart(2, "0");
        const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
        const s = String(total % 60).padStart(2, "0");
        return `${h}:${m}:${s}`;
      },

      getCurrentUserProfile(user) {
        if (!user) return "";
        return String(user.displayName || "").trim();
      },

      getScoreLabel(match) {
        const score = match.score || {};
        const history = Array.isArray(score.setHistory) ? score.setHistory : [];

        if (String(match.status || "").toLowerCase() === "wo") return "WO";

        if (history.length) {
          const sets = history.map((setObj) => {
            const g1 = Number(setObj?.games1 || 0);
            const g2 = Number(setObj?.games2 || 0);
            const tb1 = Number(setObj?.tieBreakPoints1 || 0);
            const tb2 = Number(setObj?.tieBreakPoints2 || 0);
            const isTB = setObj?.tieBreakMode === "tb7" || setObj?.tieBreakMode === "super10";

            if (isTB && (tb1 > 0 || tb2 > 0)) {
              const p1Won = tb1 > tb2;
              return `${p1Won ? 7 : 6}x${p1Won ? 6 : 7} (${tb1}-${tb2})`;
            }

            return `${g1}x${g2}`;
          });

          return sets.join(" ");
        }

        const sets1 = Number(score.sets1 || 0);
        const sets2 = Number(score.sets2 || 0);
        return `${sets1}x${sets2}`;
      },

      getMatchDuration(match) {
        if (match?.durationSeconds && Number(match.durationSeconds) > 0) {
          return U.formatDuration(match.durationSeconds);
        }

        const started = U.toDate(match?.startedAt);
        const finished = U.toDate(match?.finishedAt);

        if (started && finished && finished >= started) {
          return U.formatDuration(Math.floor((finished.getTime() - started.getTime()) / 1000));
        }

        return "-";
      },

      getWinnerPosition(score, d) {
        const status = String(d?.status || "").trim().toLowerCase();
        const woWinner = String(d?.winnerByWO || "").trim().toLowerCase();

        if (status === "wo") {
          if (woWinner === "player1") return 1;
          if (woWinner === "player2") return 2;
        }

        if (Number(score.sets1 || 0) > Number(score.sets2 || 0)) return 1;
        if (Number(score.sets2 || 0) > Number(score.sets1 || 0)) return 2;

        return null;
      },

      getWONumberOrName(d) {
        const woWinner = String(d?.winnerByWO || "").trim().toLowerCase();

        if (woWinner === "player1") return d?.player1 || "Jogador 1";
        if (woWinner === "player2") return d?.player2 || "Jogador 2";

        return "Nenhum";
      },

      getSetDisplay(setObj) {
        if (!setObj) return { p1: "--", p2: "--" };

        const g1 = Number(setObj.games1 ?? 0);
        const g2 = Number(setObj.games2 ?? 0);
        const tb1 = Number(setObj.tieBreakPoints1 ?? 0);
        const tb2 = Number(setObj.tieBreakPoints2 ?? 0);
        const isTB = setObj.tieBreakMode === "tb7" || setObj.tieBreakMode === "super10";

        if (isTB && (tb1 > 0 || tb2 > 0)) {
          const p1Won = tb1 > tb2;
          return {
            p1: String(p1Won ? 7 : 6),
            p2: String(p1Won ? 6 : 7)
          };
        }

        return {
          p1: String(g1),
          p2: String(g2)
        };
      },

      isLegacyMatch(data) {
        return !String(data?.ownerId || "").trim();
      }
    };

    function setMsg(text) {
      if (el.msg) el.msg.textContent = text || "";
    }

    function goLogin() {
      window.location.replace("login.html");
    }

    function fillLoggedUserInPlayer1() {
      if (!el.player1) return;
      el.player1.value = state.currentProfileName || (state.currentUser?.displayName || "");
      el.player1.readOnly = true;
      el.player1.setAttribute("readonly", "readonly");
    }

    function showForm() {
      if (el.matchFormWrapper) el.matchFormWrapper.style.display = "block";
      el.matchFormWrapper?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function hideForm() {
      if (el.matchFormWrapper) el.matchFormWrapper.style.display = "none";
    }

    function clearForm() {
      if (el.form) el.form.reset();
      if (el.docId) el.docId.value = "";
      if (el.status) el.status.value = "scheduled";
      if (el.winnerByWO) el.winnerByWO.value = "";
      if (el.probPlayer1) el.probPlayer1.value = "";
      if (el.probPlayer2) el.probPlayer2.value = "";
      if (el.formTitle) el.formTitle.textContent = "Nova partida";
      fillLoggedUserInPlayer1();
      setMsg("");
    }

    function fillForm(data, id) {
      if (el.docId) el.docId.value = id || "";
      if (el.categoryName) el.categoryName.value = data?.categoryName || "";
      if (el.surfaceType) el.surfaceType.value = data?.surfaceType || "";
      if (el.matchFormat) el.matchFormat.value = U.normalizeMatchFormat(data?.matchFormat || "");
      if (el.matchDateTime) el.matchDateTime.value = data?.matchDateTime || "";
      if (el.court) el.court.value = data?.court || "";
      if (el.tournamentStage) el.tournamentStage.value = data?.tournamentStage || "";
      if (el.player1) {
        el.player1.value = data?.player1 || state.currentProfileName || "";
        el.player1.readOnly = true;
      }
      if (el.player2) el.player2.value = data?.player2 || "";
      if (el.probPlayer1) el.probPlayer1.value = data?.probPlayer1 ?? "";
      if (el.probPlayer2) el.probPlayer2.value = data?.probPlayer2 ?? "";
      if (el.winnerByWO) {
        const woValue = String(data?.winnerByWO || "").trim();
        el.winnerByWO.value = (woValue === "player1" || woValue === "player2") ? woValue : "";
      }
      if (el.status) el.status.value = data?.status || "scheduled";
      if (el.formTitle) el.formTitle.textContent = id ? "Editando partida" : "Nova partida";
    }

    function buildPublicLink(id) {
      return `${location.origin}${location.pathname.replace("admin.html", "player.html")}?id=${id}`;
    }

    function renderEmpty(message) {
      return `<tr><td colspan="4" class="empty-card">${U.escapeHtml(message)}</td></tr>`;
    }

    function sortLocalMatches() {
      state.allMatches.sort((a, b) => {
        const ta = U.getStartedAtMs(a.data) || 0;
        const tb = U.getStartedAtMs(b.data) || 0;
        return ta - tb;
      });
    }

    function applyFilters() {
      const p = el.filterPlayers?.value.trim().toLowerCase() || "";
      const c = el.filterCategory?.value.trim().toLowerCase() || "";
      const s = el.filterStatus?.value.trim().toLowerCase() || "";

      state.filteredMatches = state.allMatches.filter(({ data }) => {
        const ownerId = String(data.ownerId || "").trim();
        const isOwnedByCurrentUser = state.currentUser && ownerId === state.currentUser.uid;
        const isLegacy = U.isLegacyMatch(data);
        const isAdminUser = state.currentUser?.email === "rodrigokamunga@hotmail.com";
        const shouldShowByOwner = isAdminUser ? true : (isOwnedByCurrentUser || isLegacy);

        const playerText = `${data.player1 || ""} ${data.player2 || ""}`.toLowerCase();
        const categoryText = `${data.categoryName || ""}`.toLowerCase();
        const statusText = String(data.status || "scheduled").toLowerCase();

        return shouldShowByOwner &&
          (!p || playerText.includes(p)) &&
          (!c || categoryText.includes(c)) &&
          (!s || statusText === s);
      });

      state.currentPage = 1;
      renderPagination();
      renderCurrentPage();

      if (!state.filteredMatches.length) {
        const playerName = state.currentProfileName || state.currentUser?.displayName || "este usuário";
        setMsg(`Nenhuma partida encontrada para ${playerName}.`);
      }
    }

    function renderPagination() {
      const totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
      if (state.currentPage > totalPages) state.currentPage = totalPages;
      if (state.currentPage < 1) state.currentPage = 1;

      const start = (state.currentPage - 1) * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, state.filteredMatches.length);

      if (el.pageInfo) el.pageInfo.textContent = String(state.currentPage);
      if (el.totalPagesEl) el.totalPagesEl.textContent = String(totalPages);
      if (el.prevPageBtn) el.prevPageBtn.disabled = state.currentPage <= 1;
      if (el.nextPageBtn) el.nextPageBtn.disabled = state.currentPage >= totalPages;

      if (el.itemsTotal) el.itemsTotal.textContent = String(state.filteredMatches.length);
      if (el.itemsShown) el.itemsShown.textContent = String(state.filteredMatches.length ? end : 0);
    }

    function renderCurrentPage() {
      const start = (state.currentPage - 1) * PAGE_SIZE;
      const pageItems = state.filteredMatches.slice(start, start + PAGE_SIZE);

      el.tbody.innerHTML = pageItems.length
        ? pageItems.map(({ docSnap }) => rowHTML(docSnap)).join("")
        : renderEmpty("Nenhuma partida encontrada.");
    }

    function rowHTML(docSnap) {
      const d = docSnap.data();
      const statusText = String(d.status || "scheduled").toLowerCase();
      const label = statusText === "wo" ? "WO" : (d.status || "scheduled");

      return ` <tr> <td> <div class="players-cell"> <strong>${U.escapeHtml(d.player1 || "Jogador 1")}</strong> <span>vs</span> <strong>${U.escapeHtml(d.player2 || "Jogador 2")}</strong> </div> <div class="muted" style="font-size: 12px;"> ${U.escapeHtml(U.formatProb(d.probPlayer1))} x ${U.escapeHtml(U.formatProb(d.probPlayer2))} </div> </td> <td title="${U.escapeHtml(d.categoryName || "-")}">${U.escapeHtml(d.categoryName || "-")}</td> <td><span class="status-tag status-${statusText}">${U.escapeHtml(label)}</span></td> <td class="col-actions-center"> <div class="action-cell"> <div class="action-top-row">
      
      <button type="button" class="icon-btn" data-action="open" data-id="${docSnap.id}" title="Abrir link" aria-label="Abrir link">🔗</button> 
      
      <button type="button" class="icon-btn" data-action="detail" data-id="${docSnap.id}" title="Detalhar" aria-label="Detalhar">👁️</button> </div> <div class="action-bottom-row"> <button type="button" class="icon-btn" data-action="edit" data-id="${docSnap.id}" title="Editar" aria-label="Editar">✏️</button> <button type="button" class="icon-btn danger" data-action="delete" data-id="${docSnap.id}" title="Excluir" aria-label="Excluir">🗑️</button> </div> </div> </td> </tr> `;
    }

    function getMatchDuration(d) {
      if (d?.durationSeconds && Number(d.durationSeconds) > 0) {
        return U.formatDuration(d.durationSeconds);
      }

      const started = d?.startedAt?.toDate ? d.startedAt.toDate() : (d?.startedAt ? new Date(d.startedAt) : null);
      const finished = d?.finishedAt?.toDate ? d.finishedAt.toDate() : (d?.finishedAt ? new Date(d.finishedAt) : null);

      if (started && finished && !isNaN(started.getTime()) && !isNaN(finished.getTime()) && finished >= started) {
        return U.formatDuration(Math.floor((finished.getTime() - started.getTime()) / 1000));
      }

      return "-";
    }

    function renderGeneralBlock(d) {
      return ` <section class="detail-section detail-section-general"> <div class="detail-section-header"> <h4>Dados gerais</h4> <span class="detail-section-subtitle">Informações da partida</span> </div> <div class="detail-info-grid"> <div class="detail-info-item"><span>Categoria</span><strong>${U.escapeHtml(d.categoryName || "-")}</strong></div> <div class="detail-info-item"><span>Tipo de piso</span><strong>${U.escapeHtml(d.surfaceType || "-")}</strong></div> <div class="detail-info-item"><span>Formato</span><strong>${U.escapeHtml(U.normalizeMatchFormat(d.matchFormat || "-") || d.matchFormat || "-")}</strong></div> <div class="detail-info-item"><span>Data e hora</span><strong>${U.escapeHtml(d.matchDateTime ? new Date(d.matchDateTime).toLocaleString("pt-BR") : "-")}</strong></div> <div class="detail-info-item"><span>Quadra</span><strong>${U.escapeHtml(d.court || "-")}</strong></div> <div class="detail-info-item"><span>Fase</span><strong>${U.escapeHtml(d.tournamentStage || "-")}</strong></div> <div class="detail-info-item"><span>Status</span><strong>${U.escapeHtml(d.status || "-")}</strong></div> <div class="detail-info-item"><span>Jogador 1</span><strong>${U.escapeHtml(d.player1 || "-")}</strong></div> <div class="detail-info-item"><span>Jogador 2</span><strong>${U.escapeHtml(d.player2 || "-")}</strong></div> <div class="detail-info-item"><span>Prob. Jogador 1</span><strong>${U.escapeHtml(U.formatProb(d.probPlayer1))}</strong></div> <div class="detail-info-item"><span>Prob. Jogador 2</span><strong>${U.escapeHtml(U.formatProb(d.probPlayer2))}</strong></div> <div class="detail-info-item"><span>Vencedor por WO</span><strong>${U.escapeHtml(U.getWONumberOrName(d))}</strong></div> </div> </section> `;
    }

    function renderScoreBlock(d) {
      const score = U.normalizeScore(d.score || {});
      const history = Array.isArray(score.setHistory) ? score.setHistory : [];
      const set1 = U.getSetDisplay(history[0]);
      const set2 = U.getSetDisplay(history[1]);
      const duration = getMatchDuration(d);
      const status = String(d?.status || "").trim().toLowerCase();
      const isWO = status === "wo";
      const winnerPos = U.getWinnerPosition(score, d);
      const p1IsWinner = winnerPos === 1;

      const pointsText =
        (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10" || score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10")
          ? `${Number(score.tieBreakPoints1 || score.lastTieBreakPoints1 || 0)}x${Number(score.tieBreakPoints2 || score.lastTieBreakPoints2 || 0)}`
          : `${Number(score.points1 || 0)}x${Number(score.points2 || 0)}`;

      return ` <section class="detail-section detail-section-score"> <div class="detail-section-header"> <h4>Placar</h4> <span class="detail-section-subtitle">Situação atual da partida</span> </div> <div class="detail-score-card single-score-card"> <div class="detail-score-row ${p1IsWinner ? "winner-row" : ""}"> <div class="detail-player-title"> ${U.escapeHtml(d.player1 || "Jogador 1")} X ${U.escapeHtml(d.player2 || "Jogador 2")} ${p1IsWinner ? `<span class="winner-badge">${isWO ? "WO VENCEDOR" : "VENCEU"}</span>` : ""} </div> ${ isWO ? `<div class="detail-score-line"><span>Status</span><strong>FINALIZADA POR WO</strong></div>` : ` <div class="detail-score-line"><span>1º set</span><strong>${U.escapeHtml(set1.p1)} x ${U.escapeHtml(set1.p2)}</strong></div> <div class="detail-score-line"><span>2º set</span><strong>${U.escapeHtml(set2.p1)} x ${U.escapeHtml(set2.p2)}</strong></div> <div class="detail-pill" style="margin-top: 10px;"><span>Pontos</span><strong>${U.escapeHtml(pointsText)}</strong></div> ` } </div> <div class="detail-pill" style="margin-top: 12px;"> <span>Duração da partida</span> <strong>${U.escapeHtml(duration)}</strong> </div> </div> </section> `;
    }

    function renderSummaryBlock(d) {
      const score = U.normalizeScore(d.score || {});
      const totalPoints1 = Number(score.totalPoints1 || 0);
      const totalPoints2 = Number(score.totalPoints2 || 0);
      const breakPointsWon1 = Number(score.breakPointsWon1 || 0);
      const breakPointsChances1 = Number(score.breakPointsChances1 || 0);
      const breakPointsWon2 = Number(score.breakPointsWon2 || 0);
      const breakPointsChances2 = Number(score.breakPointsChances2 || 0);

      return ` <section class="detail-section detail-section-summary"> <div class="detail-section-header"> <h4>Resumo da partida</h4> <span class="detail-section-subtitle">Estatísticas gerais</span> </div> <div class="detail-summary-grid"> <div class="detail-summary-card"> <div class="detail-player-title">${U.escapeHtml(d.player1 || "Jogador 1")}</div> <div class="detail-summary-line"><span>Pontos totais</span><strong>${totalPoints1}</strong></div> <div class="detail-summary-line"><span>Break points</span><strong>${breakPointsWon1}/${breakPointsChances1}</strong></div> </div> <div class="detail-summary-card"> <div class="detail-player-title">${U.escapeHtml(d.player2 || "Jogador 2")}</div> <div class="detail-summary-line"><span>Pontos totais</span><strong>${totalPoints2}</strong></div> <div class="detail-summary-line"><span>Break points</span><strong>${breakPointsWon2}/${breakPointsChances2}</strong></div> </div> </div> </section> `;
    }

    function renderPublicLinkBlock(id) {
      const link = buildPublicLink(id);
      return ` <section class="detail-section detail-section-link"> <div class="detail-section-header"> <h4>Link público</h4> <span class="detail-section-subtitle">Abrir ou copiar a partida</span> </div> <div class="detail-link-box"> <a href="${U.escapeHtml(link)}" target="_blank" rel="noreferrer">${U.escapeHtml(link)}</a> </div> </section> `;
    }

    function detailsHTML(d, id) {
      return `<div class="details-layout">${renderGeneralBlock(d)}${renderScoreBlock(d)}${renderSummaryBlock(d)}${renderPublicLinkBlock(id)}</div>`;
    }

    function setMatchesCollapsed(collapsed) {
      state.matchesExpanded = !collapsed;
      el.matchesSection?.classList.toggle("matches-collapsed", collapsed);

      const topText = collapsed ? "Expandir" : "Recolher";
      const bottomText = collapsed ? "Expandir" : "Lista";

      if (el.toggleMatchesBtn) {
        el.toggleMatchesBtn.textContent = topText;
      }

      if (el.toggleMatchesBtnBottom) {
        const label = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-label");
        if (label) label.textContent = bottomText;
      }
    }

    function setFiltersCollapsed(collapsed) {
      state.filtersCollapsed = !!collapsed;
      el.matchesSection?.classList.toggle("filters-collapsed", collapsed);

      if (el.toggleMatchesBtnBottom) {
        const icon = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-icon");
        const label = el.toggleMatchesBtnBottom.querySelector(".admin-bottom-label");

        if (icon) {
          icon.textContent = collapsed ? "🔎" : "📋";
        }

        if (label) {
          label.textContent = collapsed ? "Filtros" : "Lista";
        }
      }

      if (el.toggleMatchesBtn) {
        el.toggleMatchesBtn.textContent = collapsed ? "Expandir" : "Recolher";
      }
    }

    function renderNoMatchesMessage() {
      const playerName = state.currentProfileName || state.currentUser?.displayName || "este usuário";
      setMsg(`Nenhuma partida encontrada para ${playerName}.`);
      if (el.tbody) {
        el.tbody.innerHTML = renderEmpty(`Nenhuma partida encontrada para ${playerName}.`);
      }
    }

    function refreshList() {
      sortLocalMatches();
      applyFilters();
      if (!state.filteredMatches.length && state.currentUser) {
        renderNoMatchesMessage();
      }
    }

    function listenMatches() {
      if (!state.currentUser) return;

      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }

      const isAdminUser = state.currentUser?.email === "rodrigokamunga@hotmail.com";

      let query = __db.collection("matches");
      if (!isAdminUser) {
        query = query.where("ownerId", "==", state.currentUser.uid);
      }

      state.unsubscribe = query.onSnapshot(
        (snapshot) => {
          state.allMatches = snapshot.docs.map((docSnap) => ({
            docSnap,
            data: docSnap.data()
          }));

          refreshList();
        },
        (err) => {
          console.error(err);
          setMsg("Não foi possível carregar suas partidas. Verifique as regras do Firestore.");
        }
      );
    }

    function updateAuthState(user) {
      if (!user) {
        state.currentUser = null;
        state.currentProfileName = "";
        if (el.tbody) el.tbody.innerHTML = renderEmpty("Usuário não autenticado.");
        setMsg("Usuário não autenticado.");
        return;
      }

      state.currentUser = user;
      state.currentProfileName = U.getCurrentUserProfile(user) || user.email || "";
      fillLoggedUserInPlayer1();
      listenMatches();
    }

    function bindEvents() {
      const session = localStorage.getItem(ADMIN_KEY);
      if (session !== "1") return goLogin();

      el.showFormBtn?.addEventListener("click", () => {
        showForm();
        fillLoggedUserInPlayer1();
      });

      el.showFormBtnBottom?.addEventListener("click", () => {
        showForm();
        fillLoggedUserInPlayer1();
      });

      el.toggleMatchesBtn?.addEventListener("click", () => {
        setFiltersCollapsed(!state.filtersCollapsed);
      });

      el.toggleMatchesBtnBottom?.addEventListener("click", () => {
        setFiltersCollapsed(!state.filtersCollapsed);
      });

      el.logoutBtn?.addEventListener("click", async () => {
        try {
          localStorage.removeItem(ADMIN_KEY);
          await __auth.signOut();
          goLogin();
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });

      el.logoutBtnBottom?.addEventListener("click", async () => {
        try {
          localStorage.removeItem(ADMIN_KEY);
          await __auth.signOut();
          goLogin();
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });

      el.clearBtn?.addEventListener("click", clearForm);

      el.cancelBtn?.addEventListener("click", () => {
        clearForm();
        hideForm();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      el.closeDialogBtn?.addEventListener("click", () => el.dialog.close());

      el.filterPlayers?.addEventListener("input", refreshList);
      el.filterCategory?.addEventListener("input", refreshList);
      el.filterStatus?.addEventListener("change", refreshList);

      el.prevPageBtn?.addEventListener("click", () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderPagination();
          renderCurrentPage();
        }
      });

      el.nextPageBtn?.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderPagination();
          renderCurrentPage();
        }
      });

      el.form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        setMsg("Salvando...");

        const selectedFormat = U.normalizeMatchFormat(el.matchFormat ? el.matchFormat.value : "");
        if (!selectedFormat || !U.allowedMatchFormat(selectedFormat)) {
          return setMsg("Formato inválido. Use apenas os 3 formatos permitidos.");
        }

        const selectedSurface = String(el.surfaceType?.value || "").trim();
        if (!ALLOWED_SURFACES.includes(selectedSurface)) {
          console.warn("Tipo de piso inválido:", selectedSurface);
          return setMsg("Selecione um tipo de piso válido.");
        }

        const prob1 = el.probPlayer1?.value === "" ? null : Number(el.probPlayer1.value);
        const prob2 = el.probPlayer2?.value === "" ? null : Number(el.probPlayer2.value);

        if (prob1 !== null && prob2 !== null) {
          const soma = Math.round((prob1 + prob2) * 100) / 100;
          if (soma !== 100) {
            return setMsg("A soma das probabilidades deve ser 100%.");
          }
        }

        const woWinner = String(el.winnerByWO?.value || "").trim();
        const finalStatus = woWinner ? "wo" : (el.status?.value || "scheduled");
        const player1Name = state.currentProfileName || state.currentUser?.displayName || "";

        console.log("Tipo de piso selecionado:", selectedSurface);
        console.log("Vencedor por WO selecionado:", woWinner || "Nenhum");

        const data = {
          ownerId: state.currentUser?.uid || "",
          ownerEmail: state.currentUser?.email || "",
          ownerName: player1Name,
          categoryName: el.categoryName?.value.trim() || "",
          surfaceType: selectedSurface,
          matchFormat: selectedFormat,
          matchDateTime: el.matchDateTime?.value || "",
          court: el.court?.value.trim() || "",
          tournamentStage: el.tournamentStage?.value.trim() || "",
          player1: player1Name,
          player2: el.player2?.value.trim() || "",
          probPlayer1: prob1,
          probPlayer2: prob2,
          winnerByWO: woWinner,
          status: finalStatus,
          score: {
            points1: 0,
            points2: 0,
            games1: 0,
            games2: 0,
            sets1: 0,
            sets2: 0,
            tieBreakMode: null,
            tieBreakPoints1: 0,
            tieBreakPoints2: 0,
            lastTieBreakMode: null,
            lastTieBreakPoints1: 0,
            lastTieBreakPoints2: 0,
            setHistory: [],
            server: "player1",
            totalPoints1: 0,
            totalPoints2: 0,
            breakPointsWon1: 0,
            breakPointsWon2: 0,
            breakPointsChances1: 0,
            breakPointsChances2: 0
          },
          durationSeconds: 0,
          startedAt: null,
          finishedAt: null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log("Objeto a ser salvo:", data);

        try {
          if (el.docId?.value) {
            await __db.collection("matches").doc(el.docId.value).update(data);
            setMsg(woWinner ? "Partida salva como WO." : "Partida cadastrada com sucesso!");
          } else {
            await __db.collection("matches").add({
              ...data,
              matchId: `JOGO-${Date.now().toString().slice(-6)}`,
              publicLinkId: crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now()).slice(-8),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setMsg(woWinner ? "Partida cadastrada como WO." : "Partida cadastrada com sucesso!");
          }

          clearForm();
          hideForm();
          refreshList();
        } catch (err) {
          console.error("Erro ao salvar partida:", err);
          setMsg(err.message || "Erro ao salvar a partida.");
        }
      });

      el.tbody?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const { id, action } = btn.dataset;
        const ref = __db.collection("matches").doc(id);

        try {
          if (action === "delete" && confirm("Excluir esta partida?")) {
            await ref.delete();
            setMsg("Partida excluída.");
            return;
          }

          if (action === "edit") {
            const snap = await ref.get();
            if (snap.exists) {
              fillForm(snap.data(), id);
              showForm();
            }
            return;
          }

          if (action === "detail") {
            const snap = await ref.get();
            if (snap.exists) {
              el.detailsContent.innerHTML = detailsHTML(snap.data(), id);
              el.dialog.showModal();
            }
            return;
          }

          if (action === "open") {
            const link = buildPublicLink(id);
            window.open(link, "_blank", "noopener,noreferrer");
          }
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });
    }

    function init() {
      if (state.initialized) return;
      state.initialized = true;

      bindEvents();
      setMatchesCollapsed(false);
      setFiltersCollapsed(false);

      const session = localStorage.getItem(ADMIN_KEY);
      if (session !== "1") {
        goLogin();
        return;
      }

      if (typeof __auth === "undefined" || typeof __db === "undefined") {
        setMsg("Firebase não carregado corretamente.");
        return;
      }

      __auth.onAuthStateChanged((user) => {
        updateAuthState(user);
      });

      if (__auth.currentUser) {
        updateAuthState(__auth.currentUser);
      }

      hideForm();
      fillLoggedUserInPlayer1();
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => AdminApp.init());
})();