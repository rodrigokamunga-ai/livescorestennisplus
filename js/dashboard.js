(() => {
  "use strict";

  const DashboardApp = (() => {
    const db = firebase.firestore();
    const PAGE_SIZE = 5;

    const state = {
      currentUser: null,
      currentUserName: "",
      allMatches: [],
      filteredMatches: [],
      currentPage: 1,
      totalPages: 1,
      unsubscribe: null,
      mobileCardsContainer: null,
      isMobile: false,
      filtersCollapsed: true
    };

    const el = {
      yearFilter:       document.getElementById("yearFilter"),
      modalityFilter:   document.getElementById("modalityFilter"),
      gameFormatFilter: document.getElementById("gameFormatFilter"),
      player2Filter:    document.getElementById("player2Filter"),
      totalMatches:     document.getElementById("totalMatches"),
      totalWins:        document.getElementById("totalWins"),
      totalLosses:      document.getElementById("totalLosses"),
      dashboardMessage: document.getElementById("dashboardMessage"),
      pieChart:         document.getElementById("pieChart"),
      barChart:         document.getElementById("barChart"),
      toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
      applyFilterBtn:   document.getElementById("applyFilterBtn"),
      clearFilterBtn:   document.getElementById("clearFilterBtn"),
      filtersWrap:      document.querySelector(".dashboard-filters"),
      tableWrap:        document.querySelector(".dashboard-table-wrap")
    };

    // ─── Utilitários ──────────────────────────────────────────────────────

    const U = {
      normalizeText(value = "") {
        return String(value || "").trim().toLowerCase();
      },

      escapeHtml(str = "") {
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      },

      toDate(value) {
        if (!value) return null;
        if (typeof value.toDate === "function") {
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

      getMatchYear(match) {
        const d = U.toDate(match.matchDateTime);
        return d ? String(d.getFullYear()) : "";
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
        const score  = match.score || {};

        if (status === "wo") {
          const wo = U.normalizeText(match.winnerByWO);
          if (wo === "player1") return 1;
          if (wo === "player2") return 2;
          return null;
        }

        const sets1 = Number(score.sets1 || 0);
        const sets2 = Number(score.sets2 || 0);
        if (sets1 > sets2) return 1;
        if (sets2 > sets1) return 2;
        return null;
      },

      getModalidade(match) {
        return String(match.modality || match.modalidade || "").trim();
      },

      getGameFormat(match) {
        return String(match.gameFormat || "").trim();
      },

      isDoubles(match) {
        const gf = U.normalizeText(match.gameFormat || "");
        return gf === "duplas" || gf === "duplas mistas";
      },

      isUserInMatch(match, userName) {
        const current   = U.normalizeText(userName);
        const p1        = U.normalizeText(match.player1   || "");
        const p2        = U.normalizeText(match.player2   || "");
        const p3        = U.normalizeText(match.player3   || "");
        const p4        = U.normalizeText(match.player4   || "");
        const ownerName = U.normalizeText(match.ownerName || "");
        return p1 === current || p2 === current ||
               p3 === current || p4 === current ||
               ownerName === current;
      },

      getCurrentTeamPlayers(match, currentUserName) {
        const p1      = String(match.player1 || "").trim();
        const p2      = String(match.player2 || "").trim();
        const p3      = String(match.player3 || "").trim();
        const p4      = String(match.player4 || "").trim();
        const current = U.normalizeText(currentUserName);

        if (U.isDoubles(match)) {
          const t1 = U.normalizeText(p1) === current || U.normalizeText(p2) === current;
          const t2 = U.normalizeText(p3) === current || U.normalizeText(p4) === current;
          if (t1) return [p1, p2];
          if (t2) return [p3, p4];
          return [p1, p2];
        }

        if (U.normalizeText(p1) === current) return [p1];
        if (U.normalizeText(p2) === current) return [p2];
        return [p1];
      },

      getOpponentTeamPlayers(match, currentUserName) {
        const p1      = String(match.player1 || "").trim();
        const p2      = String(match.player2 || "").trim();
        const p3      = String(match.player3 || "").trim();
        const p4      = String(match.player4 || "").trim();
        const current = U.normalizeText(currentUserName);

        if (U.isDoubles(match)) {
          const t1 = U.normalizeText(p1) === current || U.normalizeText(p2) === current;
          const t2 = U.normalizeText(p3) === current || U.normalizeText(p4) === current;
          if (t1) return [p3, p4];
          if (t2) return [p1, p2];
          return [p3, p4];
        }

        if (U.normalizeText(p1) === current) return [p2];
        if (U.normalizeText(p2) === current) return [p1];
        return [p2];
      },

      getConfrontationLabel(match, currentUserName) {
        const cur = U.getCurrentTeamPlayers(match, currentUserName).join(" / ");
        const opp = U.getOpponentTeamPlayers(match, currentUserName).join(" / ");
        return `${cur} x ${opp}`;
      },

      getWinnerName(match, currentUserName) {
        const winner = U.getMatchWinner(match);

        if (winner === 1) {
          return U.isDoubles(match)
            ? U.getCurrentTeamPlayers(match, currentUserName).join(" / ")
            : String(match.player1 || "Jogador 1").trim();
        }
        if (winner === 2) {
          return U.isDoubles(match)
            ? U.getOpponentTeamPlayers(match, currentUserName).join(" / ")
            : String(match.player2 || "Jogador 2").trim();
        }

        const wo = U.normalizeText(match.winnerByWO);
        if (wo === "player1") {
          return U.isDoubles(match)
            ? U.getCurrentTeamPlayers(match, currentUserName).join(" / ")
            : String(match.player1 || "Jogador 1").trim();
        }
        if (wo === "player2") {
          return U.isDoubles(match)
            ? U.getOpponentTeamPlayers(match, currentUserName).join(" / ")
            : String(match.player2 || "Jogador 2").trim();
        }

        return "Empate";
      },

      isMobile() {
        return window.matchMedia("(max-width: 768px)").matches;
      }
    };

    // ─── Helpers de canvas ────────────────────────────────────────────────

    function roundRect(ctx, x, y, width, height, radius) {
      const r = Math.min(radius, height / 2, width / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y,         x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x,         y + height, r);
      ctx.arcTo(x,         y + height, x,         y,          r);
      ctx.arcTo(x,         y,          x + width, y,          r);
      ctx.closePath();
    }

    function setMessage(text) {
      if (el.dashboardMessage) el.dashboardMessage.textContent = text || "";
    }

    // ─── Mobile cards container ───────────────────────────────────────────

    function ensureMobileCardsContainer() {
      if (state.mobileCardsContainer || !el.tableWrap) return;
      const container = document.createElement("div");
      container.id = "dashboardMobileCards";
      container.style.display       = "none";
      container.style.marginTop     = "12px";
      container.style.gap           = "12px";
      container.style.flexDirection = "column";
      el.tableWrap.appendChild(container);
      state.mobileCardsContainer = container;
    }

    function applyResponsiveMode() {
      state.isMobile = U.isMobile();
      if (!state.mobileCardsContainer) return;
      const table = el.tableWrap?.querySelector("table");
      state.mobileCardsContainer.style.display = state.isMobile ? "flex" : "none";
      if (table) table.style.display = "none";
    }

    // ─── Filtros de opções ────────────────────────────────────────────────

    function renderOptionsFromMatches() {
      const yearSet = new Set();
      state.allMatches.forEach((m) => {
        const year = U.getMatchYear(m);
        if (year) yearSet.add(year);
      });

      const currentYear = el.yearFilter?.value || "";
      if (el.yearFilter) {
        el.yearFilter.innerHTML =
          `<option value="">Selecione o ano</option>` +
          [...yearSet]
            .sort((a, b) => Number(b) - Number(a))
            .map((y) => `<option value="${y}">${y}</option>`)
            .join("");
        el.yearFilter.value = currentYear;
      }
    }

    // ─── Estatísticas ─────────────────────────────────────────────────────

    function computeStats(matches) {
      let wins = 0;
      let losses = 0;

      matches.forEach((m) => {
        const winner = U.getMatchWinner(m);
        if (!winner) return;

        const currentTeam     = U.getCurrentTeamPlayers(m, state.currentUserName);
        const currentTeamNorm = currentTeam.map((p) => U.normalizeText(p));

        if (U.isDoubles(m)) {
          const winnerTeam = winner === 1
            ? [String(m.player1 || "").trim(), String(m.player2 || "").trim()]
            : [String(m.player3 || "").trim(), String(m.player4 || "").trim()];
          const winnerTeamNorm  = winnerTeam.map((p) => U.normalizeText(p));
          const currentTeamWon  = currentTeamNorm.some((p) => winnerTeamNorm.includes(p));
          if (currentTeamWon) wins += 1; else losses += 1;
          return;
        }

        const p1      = U.normalizeText(m.player1 || "");
        const p2      = U.normalizeText(m.player2 || "");
        const current = U.normalizeText(state.currentUserName);

        if (winner === 1) {
          if (p1 === current)      wins   += 1;
          else if (p2 === current) losses += 1;
        } else if (winner === 2) {
          if (p2 === current)      wins   += 1;
          else if (p1 === current) losses += 1;
        }
      });

      return { wins, losses };
    }

    // ─── Gráfico de pizza ─────────────────────────────────────────────────

    function drawPieChart(wins, losses) {
      if (!el.pieChart) return;

      const canvas      = el.pieChart;
      const ctx         = canvas.getContext("2d");
      const w           = canvas.width;
      const h           = canvas.height;
      const cx          = w / 2;
      const cy          = h / 2 - 4;
      const outerRadius = Math.min(w, h) * 0.40;
      const innerRadius = outerRadius * 0.48;
      const total       = wins + losses;
      const duration    = 900;
      const startTime   = performance.now();

      // Gradiente radial sólido — usado quando fatia ocupa 100%
      function makeSolidRadialGrad(color1, color2) {
        const g = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
        g.addColorStop(0, color1);
        g.addColorStop(1, color2);
        return g;
      }

      // Gradiente linear seguro — pontos calculados no interior do arco
      function makeLinearGrad(startAngle, endAngle, color1, color2) {
        const gx1 = cx + Math.cos(startAngle) * outerRadius * 0.6;
        const gy1 = cy + Math.sin(startAngle) * outerRadius * 0.6;
        const gx2 = cx + Math.cos(endAngle)   * outerRadius * 0.6;
        const gy2 = cy + Math.sin(endAngle)   * outerRadius * 0.6;

        // Se os pontos forem muito próximos, usa gradiente radial como fallback
        if (Math.abs(gx1 - gx2) < 2 && Math.abs(gy1 - gy2) < 2) {
          return makeSolidRadialGrad(color1, color2);
        }
        const g = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
        g.addColorStop(0, color1);
        g.addColorStop(1, color2);
        return g;
      }

      // Desenha uma fatia (ou círculo completo quando isFull = true)
      function drawSlice(startAngle, endAngle, color1, color2, isFull) {
        // Preenchimento com sombra
        ctx.save();
        ctx.shadowColor   = "rgba(0,0,0,0.35)";
        ctx.shadowBlur    = 14;
        ctx.shadowOffsetY = 4;

        const grad = isFull
          ? makeSolidRadialGrad(color1, color2)
          : makeLinearGrad(startAngle, endAngle, color1, color2);

        ctx.beginPath();
        if (isFull) {
          // Círculo completo — sem moveTo para evitar triângulo degenerado
          ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        } else {
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, outerRadius, startAngle, endAngle);
          ctx.closePath();
        }
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // Borda sutil (sem sombra)
        ctx.save();
        ctx.beginPath();
        if (isFull) {
          ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        } else {
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, outerRadius, startAngle, endAngle);
          ctx.closePath();
        }
        ctx.lineWidth   = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.stroke();
        ctx.restore();
      }

      function drawFrame(now) {
        const elapsed  = now - startTime;
        const progress = Math.min(1, elapsed / duration);

        ctx.clearRect(0, 0, w, h);

        // Fundo
        const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, outerRadius * 2);
        bg.addColorStop(0, "#182235");
        bg.addColorStop(1, "#0f1726");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Halo externo
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius + 12, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.fill();

        // Estado vazio
        if (total === 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
          ctx.fillStyle = "#0f1726";
          ctx.fill();

          ctx.fillStyle    = "#e8eefc";
          ctx.font         = "700 18px Inter, Arial, sans-serif";
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Sem dados", cx, cy - 4);

          ctx.fillStyle = "rgba(232,238,252,0.65)";
          ctx.font      = "600 12px Inter, Arial, sans-serif";
          ctx.fillText("aguardando partidas", cx, cy + 18);
          return;
        }

        // Fatias
        const slices = [
          { value: wins,   color1: "#4da3ff", color2: "#1f6feb",
            pct: Math.round((wins   / total) * 100) },
          { value: losses, color1: "#ff8a8a", color2: "#e55353",
            pct: Math.round((losses / total) * 100) }
        ];

        // Detecta se apenas uma fatia tem valor (100%)
        const onlyOne  = slices.filter((s) => s.value > 0).length === 1;
        let startAngle = -Math.PI / 2;

        slices.forEach((slice) => {
          if (slice.value <= 0) return;

          const animatedAngle = (slice.value * progress / total) * Math.PI * 2;
          const endAngle      = startAngle + animatedAngle;
          const midAngle      = startAngle + animatedAngle / 2;

          // isFull só ativa no último frame para evitar artefatos na animação
          const isFull = onlyOne && progress >= 0.99;

          drawSlice(startAngle, endAngle, slice.color1, slice.color2, isFull);

          // Percentual dentro da fatia
          if (progress > 0.75 && slice.pct >= 5) {
            const tx = cx + Math.cos(midAngle) * (outerRadius * 0.68);
            const ty = cy + Math.sin(midAngle) * (outerRadius * 0.68);

            ctx.save();
            ctx.font         = "700 15px Inter, Arial, sans-serif";
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth    = 4;
            ctx.strokeStyle  = "rgba(10,18,35,0.92)";
            ctx.strokeText(`${slice.pct}%`, tx, ty);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(`${slice.pct}%`, tx, ty);
            ctx.restore();
          }

          startAngle = endAngle;
        });

        // Buraco central (donut)
        const centerGrad = ctx.createRadialGradient(cx, cy - 8, 8, cx, cy, innerRadius + 12);
        centerGrad.addColorStop(0, "#1b2940");
        centerGrad.addColorStop(1, "#0f1726");

        ctx.beginPath();
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = centerGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
        ctx.lineWidth   = 1.5;
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.stroke();

        // Texto central
        const displayedTotal = Math.round(total * progress);

        ctx.save();
        ctx.fillStyle    = "#f4f8ff";
        ctx.font         = "800 36px Inter, Arial, sans-serif";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(displayedTotal), cx, cy - 8);

        ctx.fillStyle = "rgba(232,238,252,0.72)";
        ctx.font      = "700 12px Inter, Arial, sans-serif";
        ctx.fillText("partidas", cx, cy + 18);
        ctx.restore();

        // Legenda
        const legendY = h - 34;
        const boxW    = 114;
        const boxH    = 22;

        const legendItems = [
          {
            x:     18,
            text:  `Vitórias ${wins} (${Math.round((wins / total) * 100)}%)`,
            color: "#4da3ff"
          },
          {
            x:     w - boxW - 18,
            text:  `Derrotas ${losses} (${Math.round((losses / total) * 100)}%)`,
            color: "#ff8a8a"
          }
        ];

        legendItems.forEach((item) => {
          // Caixa de fundo
          ctx.save();
          ctx.fillStyle = "rgba(255,255,255,0.07)";
          roundRect(ctx, item.x, legendY, boxW, boxH, 999);
          ctx.fill();
          ctx.restore();

          // Bolinha colorida
          ctx.save();
          ctx.fillStyle = item.color;
          ctx.beginPath();
          ctx.arc(item.x + 11, legendY + boxH / 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Texto
          ctx.save();
          ctx.fillStyle    = "#e8eefc";
          ctx.font         = "700 11px Inter, Arial, sans-serif";
          ctx.textAlign    = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(item.text, item.x + 21, legendY + boxH / 2);
          ctx.restore();
        });

        if (progress < 1) requestAnimationFrame(drawFrame);
      }

      requestAnimationFrame(drawFrame);
    }

    // ─── Gráfico de barras ────────────────────────────────────────────────

    function drawBarChart(wins, losses) {
      if (!el.barChart) return;

      const canvas = el.barChart;
      const ctx    = canvas.getContext("2d");
      const w      = canvas.width;
      const h      = canvas.height;

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#162033");
      bg.addColorStop(1, "#0f1726");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const values = [
        { label: "Vitórias", value: wins,   c1: "#4da3ff", c2: "#1f6feb" },
        { label: "Derrotas", value: losses, c1: "#ff8a8a", c2: "#e55353" }
      ];

      const maxVal   = Math.max(1, ...values.map((v) => v.value));
      const padLeft  = 90;
      const padRight = 28;
      const chartW   = w - padLeft - padRight;
      const barH     = 28;
      const gap      = 26;
      const startY   = 76;

      ctx.fillStyle = "rgba(232,238,252,0.55)";
      ctx.font      = "700 12px Inter, Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Comparativo de resultados", 18, 28);

      values.forEach((item, index) => {
        const y     = startY + index * (barH + gap);
        const width = Math.max(8, (item.value / maxVal) * chartW);

        ctx.fillStyle    = "#e8eefc";
        ctx.font         = "700 14px Inter, Arial, sans-serif";
        ctx.textAlign    = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(item.label, 18, y + barH / 2);

        // Trilha de fundo
        const trackGrad = ctx.createLinearGradient(padLeft, y, padLeft + chartW, y);
        trackGrad.addColorStop(0, "rgba(255,255,255,0.06)");
        trackGrad.addColorStop(1, "rgba(255,255,255,0.03)");
        ctx.beginPath();
        roundRect(ctx, padLeft, y, chartW, barH, 14);
        ctx.fillStyle = trackGrad;
        ctx.fill();

        // Barra colorida
        const barGrad = ctx.createLinearGradient(padLeft, y, padLeft + width, y);
        barGrad.addColorStop(0, item.c1);
        barGrad.addColorStop(1, item.c2);

        ctx.save();
        ctx.shadowColor   = item.c1;
        ctx.shadowBlur    = 12;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        roundRect(ctx, padLeft, y, width, barH, 14);
        ctx.fillStyle = barGrad;
        ctx.fill();
        ctx.restore();

        // Valor e percentual
        const pct = Math.round((item.value / Math.max(1, wins + losses)) * 100);
        ctx.fillStyle = "#f4f8ff";
        ctx.font      = "800 13px Inter, Arial, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${item.value} (${pct}%)`, w - 12, y + barH / 2);
      });

      // Eixo mínimo / máximo
      ctx.fillStyle = "rgba(232,238,252,0.55)";
      ctx.font      = "700 11px Inter, Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("0", padLeft, h - 18);
      ctx.textAlign = "right";
      ctx.fillText(String(maxVal), padLeft + chartW, h - 18);
    }

    // ─── Cards mobile ─────────────────────────────────────────────────────

    function renderMobileCards(matches) {
      if (!state.mobileCardsContainer) return;

      if (!matches.length) {
        state.mobileCardsContainer.innerHTML =
          `<div class="empty-card">Nenhuma partida encontrada.</div>`;
        return;
      }

      state.mobileCardsContainer.innerHTML = matches
        .slice()
        .sort((a, b) =>
          (U.toDate(b.matchDateTime)?.getTime() || 0) -
          (U.toDate(a.matchDateTime)?.getTime() || 0)
        )
        .map((m) => {
          const confrontation = U.getConfrontationLabel(m, state.currentUserName);
          const winnerText    = U.getWinnerName(m, state.currentUserName);
          const date          = U.formatDate(m.matchDateTime);
          const modality      = U.getModalidade(m) || "-";
          const format        = U.getGameFormat(m) || "-";

          return ` <article class="dashboard-mobile-card"> <div class="dashboard-mobile-card-head"> <div class="dashboard-mobile-date">${U.escapeHtml(date)}</div> <div class="dashboard-mobile-winner">${U.escapeHtml(winnerText)}</div> </div> <div class="dashboard-mobile-confrontation">${U.escapeHtml(confrontation)}</div> <div class="dashboard-mobile-meta"> <span><strong>Modalidade:</strong> ${U.escapeHtml(modality)}</span> <span><strong>Formato:</strong> ${U.escapeHtml(format)}</span> </div> </article>`;
        })
        .join("");
    }

    // ─── Paginação ────────────────────────────────────────────────────────

    function updatePagination() {
      state.totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
      if (state.currentPage > state.totalPages) state.currentPage = state.totalPages;
      if (state.currentPage < 1)                state.currentPage = 1;

      const pageInfoEl  = document.getElementById("pageInfo");
      const tableMetaEl = document.getElementById("tableMeta");

      if (pageInfoEl)  pageInfoEl.textContent  = `Página ${state.currentPage} de ${state.totalPages}`;
      if (tableMetaEl) tableMetaEl.textContent = `${state.filteredMatches.length} registros`;

      state.pagedMatches = state.filteredMatches.slice(
        (state.currentPage - 1) * PAGE_SIZE,
        state.currentPage * PAGE_SIZE
      );
    }

    function renderCurrentPage() {
      if (state.isMobile) renderMobileCards(state.filteredMatches);
    }

    // ─── Filtros ──────────────────────────────────────────────────────────

    function applyFilters() {
      const year       = String(el.yearFilter?.value       || "").trim();
      const modality   = String(el.modalityFilter?.value   || "").trim();
      const gameFormat = String(el.gameFormatFilter?.value || "").trim();
      const opponent   = String(el.player2Filter?.value    || "").trim();

      let filtered = [...state.allMatches];

      if (year)       filtered = filtered.filter((m) => U.getMatchYear(m)  === year);
      if (modality)   filtered = filtered.filter((m) => U.getModalidade(m) === modality);
      if (gameFormat) filtered = filtered.filter((m) => U.getGameFormat(m) === gameFormat);

      if (opponent) {
        const oppNorm = U.normalizeText(opponent);
        filtered = filtered.filter((m) => {
          const p1 = U.normalizeText(m.player1 || "");
          const p2 = U.normalizeText(m.player2 || "");
          const p3 = U.normalizeText(m.player3 || "");
          const p4 = U.normalizeText(m.player4 || "");
          return p1.includes(oppNorm) || p2.includes(oppNorm) ||
                 p3.includes(oppNorm) || p4.includes(oppNorm);
        });
      }

      filtered = filtered.filter((m) => U.isUserInMatch(m, state.currentUserName));

      state.filteredMatches = filtered;
      state.currentPage     = 1;

      const stats = computeStats(filtered);

      if (el.totalMatches) el.totalMatches.textContent = String(filtered.length);
      if (el.totalWins)    el.totalWins.textContent    = String(stats.wins);
      if (el.totalLosses)  el.totalLosses.textContent  = String(stats.losses);

      drawPieChart(stats.wins, stats.losses);
      drawBarChart(stats.wins, stats.losses);

      updatePagination();
      renderCurrentPage();

      setMessage(
        filtered.length
          ? `Exibindo ${filtered.length} partidas filtradas.`
          : "Nenhuma partida encontrada para os filtros aplicados."
      );
    }

    // ─── Firestore listener ───────────────────────────────────────────────

    function listenMatches() {
      if (state.unsubscribe) { state.unsubscribe(); state.unsubscribe = null; }

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

            renderOptionsFromMatches();
            applyFilters();
          },
          (err) => {
            console.error(err);
            setMessage("Erro ao carregar partidas.");
          }
        );
    }

    // ─── Toggle filtros ───────────────────────────────────────────────────

    function toggleFilters() {
      state.filtersCollapsed = !state.filtersCollapsed;

      if (el.filtersWrap) {
        el.filtersWrap.style.display = state.filtersCollapsed ? "none" : "grid";
      }

      const label = el.toggleFiltersBtn?.querySelector(".career-bottom-label");
      if (label) label.textContent = state.filtersCollapsed ? "Filtros" : "Lista";
      
    }

    // ─── Eventos ──────────────────────────────────────────────────────────

    function bindEvents() {
      el.toggleFiltersBtn?.addEventListener("click", toggleFilters);
      el.applyFilterBtn?.addEventListener("click",  applyFilters);
    
      el.clearFilterBtn?.addEventListener("click", () => {
        if (el.yearFilter)       el.yearFilter.value       = "";
        if (el.modalityFilter)   el.modalityFilter.value   = "";
        if (el.gameFormatFilter) el.gameFormatFilter.value = "";
        if (el.player2Filter)    el.player2Filter.value    = "";
        applyFilters();
      });
    
      document.getElementById("logoutBtnBottom")?.addEventListener("click", async () => {
        try {
          await firebase.auth().signOut();
          window.location.href = "login.html";
        } catch (err) {
          console.error(err);
          setMessage("Erro ao sair.");
        }
      });
    
      window.addEventListener("resize", () => {
        const wasMobile = state.isMobile;
        state.isMobile  = U.isMobile();
        if (wasMobile !== state.isMobile) {
          applyResponsiveMode();
          renderCurrentPage();
        }
      });
    }

    // ─── Estilos mobile injetados ─────────────────────────────────────────

    function injectMobileStyles() {
      if (document.getElementById("dashboardMobileStyles")) return;

      const style = document.createElement("style");
      style.id    = "dashboardMobileStyles";
      style.textContent = ` .dashboard-mobile-card { padding: 14px; border-radius: 18px; background: linear-gradient(180deg, rgba(44,54,74,.96), rgba(30,39,58,.98)); border: 1px solid rgba(255,255,255,.08); box-shadow: 0 12px 30px rgba(0,0,0,.18); display: flex; flex-direction: column; gap: 10px; } .dashboard-mobile-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; } .dashboard-mobile-date { font-size: 0.8rem; color: rgba(232,238,252,0.75); font-weight: 800; } .dashboard-mobile-winner { font-size: 0.78rem; color: #f4f8ff; font-weight: 900; padding: 6px 10px; border-radius: 999px; background: rgba(96,165,250,0.14); border: 1px solid rgba(96,165,250,0.18); } .dashboard-mobile-confrontation { font-size: 0.95rem; font-weight: 800; color: #f4f8ff; line-height: 1.35; word-break: break-word; } .dashboard-mobile-meta { display: grid; grid-template-columns: 1fr; gap: 6px; font-size: 0.82rem; color: rgba(232,238,252,0.82); } .dashboard-mobile-meta strong { color: #fff; } `;
      document.head.appendChild(style);
    }

    // ─── Init ─────────────────────────────────────────────────────────────

    function init() {
      injectMobileStyles();
      ensureMobileCardsContainer();
      bindEvents();
      applyResponsiveMode();

      state.filtersCollapsed = true;
      if (el.filtersWrap) el.filtersWrap.style.display = "none";

      const label = el.toggleFiltersBtn?.querySelector(".career-bottom-label");
      if (label) label.textContent = "Filtros";

      if (typeof __auth === "undefined" || typeof __db === "undefined") {
        setMessage("Firebase não carregado corretamente.");
        return;
      }

      __auth.onAuthStateChanged((user) => {
        if (!user) {
          state.currentUser = null;
          setMessage("Usuário não autenticado.");
          return;
        }

        state.currentUser     = user;
        state.currentUserName = U.getCurrentUserProfile(user);
        listenMatches();
      });
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => DashboardApp.init());
})();
